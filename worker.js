/* Wedding Project Worker — 익명 질문방
   - 정적 파일(index.html, qna/, test3/ ...)은 ASSETS 로 그대로 내보냅니다.
   - /api/* 는 익명 질문방 API 입니다. 데이터는 Durable Object(SQLite) 하나에 저장합니다.

   설정 (Cloudflare 대시보드 > Workers > wedding-project > Settings > Variables and Secrets)
   - ADMIN_EMAIL        (wrangler.jsonc vars) 새 질문·의견 알림을 받을 운영자 메일
   - REVIEW_QUESTIONS   (wrangler.jsonc vars) "true" 면 새 질문은 운영자 승인 후 공개
   - ADMIN_KEY          (Secret) 관리자 페이지 비밀번호 + 메일 속 승인 링크 서명용. 없으면 검토 없이 바로 공개됩니다.
   - MAIL_WEBHOOK_URL   (Secret) 메일 발송용 Google Apps Script 웹앱 주소 (apps-script/mail-relay.gs)
   - MAIL_SECRET        (Secret) 위 Apps Script 에 넣은 SECRET 과 같은 값
   - TURNSTILE_SITE_KEY (vars, 선택) / TURNSTILE_SECRET (Secret, 선택) Cloudflare Turnstile 스팸 방지
   - BANNED_WORDS       (vars, 선택) 쉼표로 구분한 추가 금칙어

   공개 API 는 이메일 주소를 절대 돌려주지 않습니다.
*/
import { DurableObject } from "cloudflare:workers";

const DAY = 24 * 60 * 60 * 1000;
const TOPICS = ["결혼 준비 및 비용", "연인 관계 및 가치관", "예식 및 신혼생활", "기타 궁금한 점"];
const LIMITS = {
  question: { min: 10, max: 1000, gapMs: 2 * 60 * 1000, perDay: 5 },
  comment: { min: 2, max: 500, gapMs: 20 * 1000, perDay: 30 },
};
const MIN_FILL_MS = 3000; // 폼을 연 지 3초 안에 보낸 글은 자동 등록으로 봅니다
const MAX_LINKS = 1;
const REPORT_HIDE_AT = 3; // 서로 다른 방문자 3명이 신고하면 자동으로 숨깁니다

/* 금칙어 (띄어쓰기·기호를 빼고 비교). 필요하면 wrangler.jsonc 의 BANNED_WORDS 로 더 넣을 수 있어요. */
const BANNED = [
  "씨발", "시발", "ㅆㅂ", "ㅅㅂ", "병신", "븅신", "ㅂㅅ", "개새끼", "개새기", "좆", "지랄", "미친년", "미친놈", "니애미", "느금마", "엠창", "걸레년",
  "카지노", "바카라", "토토사이트", "먹튀", "대출문의", "출장안마", "출장마사지", "오픈채팅방", "텔레그램", "수익보장", "고수익", "부업문의", "비아그라",
];
/* 공개 글에 넣으면 안 되는 개인정보 */
const PRIVATE_PATTERNS = [
  [/01[016789][\s.\-]?\d{3,4}[\s.\-]?\d{4}/, "phone"],
  [/\b0\d{1,2}[\s.\-]\d{3,4}[\s.\-]\d{4}\b/, "phone"],
  [/[^\s@]+@[^\s@]+\.[a-z]{2,}/i, "email_in_body"],
  [/\d{6}[\s\-]?[1-4]\d{6}/, "rrn"],
];

/* ───────── 저장소 (Durable Object) ───────── */
export class QuestionBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    const schema = [
      `CREATE TABLE IF NOT EXISTS qna_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        topic TEXT NOT NULL,
        body TEXT NOT NULL,
        email TEXT,
        notify INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        views INTEGER NOT NULL DEFAULT 0,
        comment_count INTEGER NOT NULL DEFAULT 0,
        last_activity INTEGER NOT NULL,
        is_notice INTEGER NOT NULL DEFAULT 0,
        manage_hash TEXT,
        report_count INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS qna_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'public',
        likes INTEGER NOT NULL DEFAULT 0,
        report_count INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS qna_comments_q ON qna_comments(question_id, id)`,
      `CREATE TABLE IF NOT EXISTS qna_rate (key TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS qna_rate_k ON qna_rate(key, kind, at)`,
      `CREATE TABLE IF NOT EXISTS qna_likes (comment_id INTEGER NOT NULL, key TEXT NOT NULL, PRIMARY KEY(comment_id, key))`,
      `CREATE TABLE IF NOT EXISTS qna_reports (kind TEXT NOT NULL, target_id INTEGER NOT NULL, key TEXT NOT NULL, at INTEGER NOT NULL, reason TEXT, PRIMARY KEY(kind, target_id, key))`,
      `CREATE TABLE IF NOT EXISTS qna_views (question_id INTEGER NOT NULL, key TEXT NOT NULL, day INTEGER NOT NULL, PRIMARY KEY(question_id, key, day))`
    ];
    for (const q of schema) this.sql.exec(q);
  }

  rows(q, ...b) { return this.sql.exec(q, ...b).toArray(); }
  first(q, ...b) { return this.rows(q, ...b)[0] || null; }

  /* 스팸 방지: 같은 접속자의 연속 등록 / 하루 등록 수 / 같은 글 반복 */
  checkRate(key, kind, body) {
    const now = Date.now(), lim = LIMITS[kind];
    this.sql.exec("DELETE FROM qna_rate WHERE at < ?", now - DAY);
    const last = this.first("SELECT MAX(at) AS at FROM qna_rate WHERE key = ? AND kind = ?", key, kind);
    if (last && last.at && now - last.at < lim.gapMs) return "too_fast";
    const n = this.first("SELECT COUNT(*) AS n FROM qna_rate WHERE key = ? AND kind = ?", key, kind).n;
    if (n >= lim.perDay) return "daily_limit";
    const table = kind === "question" ? "qna_questions" : "qna_comments";
    if (this.first(`SELECT id FROM ${table} WHERE body = ? AND created_at > ? LIMIT 1`, body, now - DAY)) return "duplicate";
    return null;
  }
  hit(key, kind) { this.sql.exec("INSERT INTO qna_rate (key, kind, at) VALUES (?, ?, ?)", key, kind, Date.now()); }

  listQuestions(sort, limit, offset) {
    const order = sort === "popular"
      ? "(last_activity > ?) DESC, comment_count DESC, views DESC, id DESC"
      : "id DESC";
    const args = sort === "popular" ? [Date.now() - 30 * DAY] : [];
    const items = this.rows(
      `SELECT id, created_at, topic, body, views, comment_count FROM qna_questions WHERE status = 'public' AND is_notice = 0 ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...args, limit, offset
    );
    const total = this.first("SELECT COUNT(*) AS n FROM qna_questions WHERE status = 'public' AND is_notice = 0").n;
    const notices = this.rows("SELECT id, created_at, topic, body, views, comment_count, 1 AS is_notice FROM qna_questions WHERE status = 'public' AND is_notice = 1 ORDER BY id DESC LIMIT 3");
    return { total, items, notices };
  }

  getQuestion(id) {
    const q = this.first("SELECT id, created_at, topic, body, views, comment_count, is_notice FROM qna_questions WHERE id = ? AND status = 'public'", id);
    if (!q) return null;
    const comments = this.rows("SELECT id, created_at, body, likes FROM qna_comments WHERE question_id = ? AND status = 'public' ORDER BY id ASC", id);
    return { question: q, comments };
  }

  addQuestion({ key, topic, body, email, publish, manageHash }) {
    const why = this.checkRate(key, "question", body);
    if (why) return { ok: false, reason: why };
    this.hit(key, "question");
    const now = Date.now();
    const row = this.first(
      "INSERT INTO qna_questions (created_at, topic, body, email, notify, status, last_activity, manage_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      now, topic, body, email || null, email ? 1 : 0, publish ? "public" : "pending", now, manageHash
    );
    return { ok: true, id: row.id, status: publish ? "public" : "pending" };
  }

  addComment({ key, questionId, body }) {
    const q = this.first("SELECT id, body, email, notify FROM qna_questions WHERE id = ? AND status = 'public'", questionId);
    if (!q) return { ok: false, reason: "not_found" };
    const why = this.checkRate(key, "comment", body);
    if (why) return { ok: false, reason: why };
    this.hit(key, "comment");
    const now = Date.now();
    const c = this.first("INSERT INTO qna_comments (question_id, created_at, body) VALUES (?, ?, ?) RETURNING id, created_at, body, likes", questionId, now, body);
    this.recount(questionId, now);
    return { ok: true, comment: c, question: { id: q.id, body: q.body, email: q.notify ? q.email : null } };
  }

  recount(questionId, touch) {
    const n = this.first("SELECT COUNT(*) AS n FROM qna_comments WHERE question_id = ? AND status = 'public'", questionId).n;
    if (touch) this.sql.exec("UPDATE qna_questions SET comment_count = ?, last_activity = ? WHERE id = ?", n, touch, questionId);
    else this.sql.exec("UPDATE qna_questions SET comment_count = ? WHERE id = ?", n, questionId);
  }

  addView(questionId, key) {
    const day = Math.floor(Date.now() / DAY);
    this.sql.exec("DELETE FROM qna_views WHERE day < ?", day - 1);
    const before = this.first("SELECT 1 AS x FROM qna_views WHERE question_id = ? AND key = ? AND day = ?", questionId, key, day);
    if (before) return { ok: true };
    this.sql.exec("INSERT INTO qna_views (question_id, key, day) VALUES (?, ?, ?)", questionId, key, day);
    this.sql.exec("UPDATE qna_questions SET views = views + 1 WHERE id = ? AND status = 'public'", questionId);
    return { ok: true };
  }

  like(commentId, key) {
    const c = this.first("SELECT id, likes FROM qna_comments WHERE id = ? AND status = 'public'", commentId);
    if (!c) return { ok: false, reason: "not_found" };
    if (this.first("SELECT 1 AS x FROM qna_likes WHERE comment_id = ? AND key = ?", commentId, key)) return { ok: true, likes: c.likes, already: true };
    this.sql.exec("INSERT INTO qna_likes (comment_id, key) VALUES (?, ?)", commentId, key);
    const likes = this.first("UPDATE qna_comments SET likes = likes + 1 WHERE id = ? RETURNING likes", commentId).likes;
    return { ok: true, likes };
  }

  report(kind, id, key, reason) {
    const table = kind === "q" ? "qna_questions" : "qna_comments";
    const t = this.first(`SELECT id, body, status, report_count FROM ${table} WHERE id = ?`, id);
    if (!t || t.status !== "public") return { ok: false, reason: "not_found" };
    if (this.first("SELECT 1 AS x FROM qna_reports WHERE kind = ? AND target_id = ? AND key = ?", kind, id, key)) return { ok: true, already: true };
    this.sql.exec("INSERT INTO qna_reports (kind, target_id, key, at, reason) VALUES (?, ?, ?, ?, ?)", kind, id, key, Date.now(), reason);
    const count = this.first(`UPDATE ${table} SET report_count = report_count + 1 WHERE id = ? RETURNING report_count`, id).report_count;
    let autoHidden = false;
    if (count >= REPORT_HIDE_AT) {
      this.sql.exec(`UPDATE ${table} SET status = 'hidden' WHERE id = ?`, id);
      if (kind === "c") this.recount(this.first("SELECT question_id FROM qna_comments WHERE id = ?", id).question_id);
      autoHidden = true;
    }
    return { ok: true, count, autoHidden, body: t.body };
  }

  /* 질문자 비밀 관리 링크 */
  manageGet(id, hash) {
    const q = this.first("SELECT id, created_at, topic, body, status, notify, (email IS NOT NULL) AS has_email, comment_count, views, manage_hash FROM qna_questions WHERE id = ?", id);
    if (!q || !q.manage_hash || q.manage_hash !== hash || q.status === "deleted") return null;
    delete q.manage_hash;
    return q;
  }
  manageDo(id, hash, action, email) {
    const q = this.manageGet(id, hash);
    if (!q) return { ok: false, reason: "not_found" };
    if (action === "notify_off") this.sql.exec("UPDATE qna_questions SET notify = 0 WHERE id = ?", id);
    else if (action === "notify_on") {
      if (email) this.sql.exec("UPDATE qna_questions SET email = ?, notify = 1 WHERE id = ?", email, id);
      else if (q.has_email) this.sql.exec("UPDATE qna_questions SET notify = 1 WHERE id = ?", id);
      else return { ok: false, reason: "email" };
    } else if (action === "delete") {
      this.deleteQuestion(id);
      return { ok: true, deleted: true };
    } else return { ok: false, reason: "bad_request" };
    return { ok: true, question: this.manageGet(id, hash) };
  }

  deleteQuestion(id) {
    this.sql.exec("DELETE FROM qna_likes WHERE comment_id IN (SELECT id FROM qna_comments WHERE question_id = ?)", id);
    this.sql.exec("DELETE FROM qna_comments WHERE question_id = ?", id);
    this.sql.exec("DELETE FROM qna_reports WHERE kind = 'q' AND target_id = ?", id);
    this.sql.exec("DELETE FROM qna_views WHERE question_id = ?", id);
    this.sql.exec("DELETE FROM qna_questions WHERE id = ?", id);
  }
  deleteComment(id) {
    const c = this.first("SELECT question_id FROM qna_comments WHERE id = ?", id);
    if (!c) return { ok: false };
    this.sql.exec("DELETE FROM qna_likes WHERE comment_id = ?", id);
    this.sql.exec("DELETE FROM qna_reports WHERE kind = 'c' AND target_id = ?", id);
    this.sql.exec("DELETE FROM qna_comments WHERE id = ?", id);
    this.recount(c.question_id);
    return { ok: true };
  }
  addNotice(body) {
    const now = Date.now();
    return this.first("INSERT INTO qna_questions (created_at, topic, body, status, last_activity, is_notice, notify) VALUES (?, '공지', ?, 'public', ?, 1, 0) RETURNING id", now, body, now);
  }

  /* 운영자 기능 */
  setStatus(kind, id, status) {
    if (!["public", "hidden", "pending"].includes(status)) return { ok: false };
    if (kind === "q") {
      const q = this.first("SELECT id, body, email, notify, status FROM qna_questions WHERE id = ?", id);
      if (!q) return { ok: false, reason: "not_found" };
      this.sql.exec("UPDATE qna_questions SET status = ? WHERE id = ?", status, id);
      return { ok: true, before: q.status, question: { id: q.id, body: q.body, email: q.notify ? q.email : null } };
    }
    const c = this.first("SELECT id, question_id FROM qna_comments WHERE id = ?", id);
    if (!c || status === "pending") return { ok: false, reason: "not_found" };
    this.sql.exec("UPDATE qna_comments SET status = ? WHERE id = ?", status, id);
    this.recount(c.question_id);
    return { ok: true };
  }

  unsubscribe(id) {
    this.sql.exec("UPDATE qna_questions SET notify = 0 WHERE id = ?", id);
    return { ok: true };
  }

  adminList(status, limit, offset) {
    const items = this.rows(
      `SELECT id, created_at, topic, body, status, views, comment_count, report_count, is_notice, (email IS NOT NULL) AS has_email FROM qna_questions ${status === "all" ? "" : "WHERE status = ?"} ORDER BY id DESC LIMIT ? OFFSET ?`,
      ...(status === "all" ? [] : [status]), limit, offset
    );
    return { items };
  }

  adminComments(limit, offset) {
    return {
      items: this.rows(
        "SELECT c.id, c.question_id, c.created_at, c.body, c.status, c.likes, c.report_count, q.body AS question FROM qna_comments c JOIN qna_questions q ON q.id = c.question_id ORDER BY c.id DESC LIMIT ? OFFSET ?",
        limit, offset
      ),
    };
  }
}

/* ───────── 도우미 ───────── */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const html = (title, bodyHtml, status = 200) =>
  new Response(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;background:#f8efe2;color:#3a2430;font:16px/1.65 "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all}
main{max-width:520px;margin:48px auto;padding:28px;background:#fffaf2;border:2px dashed #ecd9ce;border-radius:22px}
h1{font-size:1.4rem;margin:0 0 12px}p{margin:0 0 14px}blockquote{margin:0 0 18px;padding:12px 16px;background:#f8efe2;border-radius:12px;white-space:pre-wrap}
button,a.btn{display:inline-block;border:0;border-radius:999px;background:#a3265c;color:#fff;font:inherit;font-weight:700;padding:10px 22px;cursor:pointer;text-decoration:none}
a{color:#a3265c}</style></head><body><main>${bodyHtml}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const clip = (t, n) => (t.length > n ? t.slice(0, n) + "…" : t);
const clean = (t) => String(t || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
const linkCount = (t) => (t.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|kr|io|xyz|top|ru|cn|info|biz)\b/gi) || []).length;
const isEmail = (t) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(t);

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/* IP 는 저장하지 않고, 스팸 방지 비교용 해시만 하루 동안 씁니다 */
async function visitorKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return (await sha("wp-qna|" + (env.ADMIN_KEY || "salt") + "|" + ip)).slice(0, 24);
}
async function sign(env, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const reviewOn = (env) => String(env.REVIEW_QUESTIONS || "").toLowerCase() === "true" && !!env.ADMIN_KEY;

async function sendMail(env, to, subject, body) {
  if (!env.MAIL_WEBHOOK_URL || !env.MAIL_SECRET || !to) return false;
  try {
    const res = await fetch(env.MAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.MAIL_SECRET, to, subject, html: body }),
    });
    return res.ok;
  } catch (e) {
    console.log("mail failed", e && e.message);
    return false;
  }
}
const mailWrap = (inner) =>
  `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#3a2430;max-width:560px">${inner}<p style="color:#9a7d83;font-size:13px;margin-top:24px">Wedding Project 익명 질문방</p></div>`;
const quote = (t) => `<blockquote style="margin:12px 0;padding:12px 16px;background:#f8efe2;border-radius:12px;white-space:pre-wrap">${esc(t)}</blockquote>`;

async function modLink(env, origin, kind, id, action) {
  return `${origin}/api/mod?k=${kind}&id=${id}&a=${action}&t=${await sign(env, `mod|${kind}|${id}|${action}`)}`;
}

async function verifyTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", token);
    form.append("remoteip", request.headers.get("cf-connecting-ip") || "");
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const d = await r.json();
    return !!d.success;
  } catch (e) {
    return false;
  }
}

/* 사람이 쓴 글인지 기본 확인 (허니팟, 작성 시간, 링크 수, Turnstile) */
async function spamCheck(env, request, data, text) {
  if (data.website) return "spam";
  if (linkCount(text) > MAX_LINKS) return "links";
  const flat = text.replace(/[\s.,!?~^*_\-+=|/\\'"`()\[\]{}<>:;]/g, "").toLowerCase();
  const extra = String(env.BANNED_WORDS || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (BANNED.concat(extra).some((w) => flat.includes(w))) return "banned";
  for (const [re, why] of PRIVATE_PATTERNS) if (re.test(text)) return why;
  if (!(Number(data.elapsed) >= MIN_FILL_MS)) return "too_quick";
  if (!(await verifyTurnstile(env, data.turnstile, request))) return "captcha";
  return null;
}

async function readJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 16000) return null;
  try { return await request.json(); } catch (e) { return null; }
}

/* ───────── 라우팅 ───────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);

    const board = env.QUESTION_BOARD.get(env.QUESTION_BOARD.idFromName("main"));
    const origin = url.origin;
    const method = request.method;

    /* 다른 사이트에서 글을 등록하지 못하게 같은 주소에서 온 POST 만 받습니다 (메일 속 링크 확인 페이지는 예외) */
    if (method === "POST" && !path.startsWith("/api/mod") && !path.startsWith("/api/unsub")) {
      const o = request.headers.get("origin");
      if (o && o !== origin) return json({ ok: false, reason: "forbidden" }, 403);
    }

    if (path === "/api/config" && method === "GET") {
      return json({ turnstileSiteKey: env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY || "" : "", review: reviewOn(env), topics: TOPICS });
    }

    if (path === "/api/questions" && method === "GET") {
      const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 10));
      const offset = Math.max(0, parseInt(url.searchParams.get("offset"), 10) || 0);
      const sort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";
      const data = await board.listQuestions(sort, limit, offset);
      data.items = data.items.map((q) => ({ ...q, body: clip(q.body, 160) }));
      return json(data);
    }

    if (path === "/api/questions" && method === "POST") {
      const d = await readJson(request);
      if (!d) return json({ ok: false, reason: "bad_request" }, 400);
      const body = clean(d.body), topic = TOPICS.includes(d.topic) ? d.topic : TOPICS[3];
      const email = d.notify === true ? clean(d.email).toLowerCase() : "";
      if (d.notify === true && !email) return json({ ok: false, reason: "email" }, 400);
      if (body.length < LIMITS.question.min || body.length > LIMITS.question.max) return json({ ok: false, reason: "length" }, 400);
      if (email && !isEmail(email)) return json({ ok: false, reason: "email" }, 400);
      if (d.agree !== true) return json({ ok: false, reason: "agree" }, 400);
      const spam = await spamCheck(env, request, d, body);
      if (spam) return json({ ok: false, reason: spam }, 400);
      const publish = !reviewOn(env);
      const token = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await board.addQuestion({ key: await visitorKey(request, env), topic, body, email, publish, manageHash: await sha("manage|" + token) });
      if (!res.ok) return json(res, 429);
      const manageUrl = `${origin}/qna/?manage=${res.id}-${token}`;
      if (email) {
        ctx.waitUntil(sendMail(env, email, "[웨딩 프로젝트] 질문이 접수됐어요 (관리 링크)",
          mailWrap(`<p><b>익명 질문방에 질문이 접수됐어요.</b> ${publish ? "지금 바로 공개됐어요." : "운영 정책에 맞게 확인한 뒤 공개돼요."}</p>${quote(clip(body, 200))}<p>새 의견이 달리면 이 메일로 알려 드려요.</p><p><a href="${manageUrl}" style="font-weight:700">내 질문 관리하기</a><br><span style="font-size:13px;color:#9a7d83">이 링크로 알림을 끄거나 질문을 삭제할 수 있어요. 다른 사람에게 공유하지 마세요.</span></p>`)));
      }
      if (env.ADMIN_EMAIL) {
        ctx.waitUntil((async () => {
          const links = env.ADMIN_KEY
            ? (publish
                ? `<p><a href="${await modLink(env, origin, "q", res.id, "hide")}">이 질문 숨기기</a></p>`
                : `<p><a href="${await modLink(env, origin, "q", res.id, "approve")}" style="font-weight:700">✅ 승인하고 공개하기</a> &nbsp;·&nbsp; <a href="${await modLink(env, origin, "q", res.id, "hide")}">숨기기</a></p>`)
            : "";
          await sendMail(env, env.ADMIN_EMAIL, `[웨딩 프로젝트] 새 질문 #${res.id}${publish ? "" : " (승인 대기)"}`,
            mailWrap(`<p><b>새 질문이 ${publish ? "등록되어 공개됐어요" : "들어왔어요. 확인 후 승인해 주세요"}.</b></p><p>분야: ${esc(topic)}<br>질문자 알림 메일: ${email ? "입력함" : "없음"}</p>${quote(body)}${links}<p><a href="${origin}/qna/admin.html">관리자 페이지</a></p>`));
        })());
      }
      return json({ ok: true, id: res.id, status: res.status, manageUrl }, 201);
    }

    let m = path.match(/^\/api\/questions\/(\d+)$/);
    if (m && method === "GET") {
      const data = await board.getQuestion(Number(m[1]));
      return data ? json(data) : json({ ok: false, reason: "not_found" }, 404);
    }

    m = path.match(/^\/api\/questions\/(\d+)\/view$/);
    if (m && method === "POST") {
      await board.addView(Number(m[1]), await visitorKey(request, env));
      return json({ ok: true });
    }

    m = path.match(/^\/api\/questions\/(\d+)\/comments$/);
    if (m && method === "POST") {
      const d = await readJson(request);
      if (!d) return json({ ok: false, reason: "bad_request" }, 400);
      const body = clean(d.body);
      if (body.length < LIMITS.comment.min || body.length > LIMITS.comment.max) return json({ ok: false, reason: "length" }, 400);
      const spam = await spamCheck(env, request, d, body);
      if (spam) return json({ ok: false, reason: spam }, 400);
      const qid = Number(m[1]);
      const res = await board.addComment({ key: await visitorKey(request, env), questionId: qid, body });
      if (!res.ok) return json({ ok: false, reason: res.reason }, res.reason === "not_found" ? 404 : 429);
      ctx.waitUntil((async () => {
        const link = `${origin}/qna/?id=${qid}`;
        if (res.question.email) {
          const unsub = env.ADMIN_KEY ? `${origin}/api/unsub?id=${qid}&t=${await sign(env, `unsub|${qid}`)}` : "";
          await sendMail(env, res.question.email, "[웨딩 프로젝트] 내 질문에 새로운 의견이 달렸어요",
            mailWrap(`<p><b>남겨주신 질문에 새로운 의견이 달렸어요.</b></p><p style="color:#9a7d83">내 질문</p>${quote(clip(res.question.body, 200))}<p style="color:#9a7d83">새 의견</p>${quote(body)}<p><a href="${link}" style="font-weight:700">질문방에서 보기</a></p>${unsub ? `<p style="font-size:13px"><a href="${unsub}" style="color:#9a7d83">이 질문의 알림 그만 받기</a></p>` : ""}`));
        }
        if (env.ADMIN_EMAIL) {
          const hide = env.ADMIN_KEY ? `<p><a href="${await modLink(env, origin, "c", res.comment.id, "hide")}">이 의견 숨기기</a></p>` : "";
          await sendMail(env, env.ADMIN_EMAIL, `[웨딩 프로젝트] 질문 #${qid}에 새 의견`,
            mailWrap(`<p>질문 #${qid}에 새 의견이 달렸어요.</p>${quote(body)}<p><a href="${link}">질문 보기</a></p>${hide}`));
        }
      })());
      return json({ ok: true, comment: res.comment }, 201);
    }

    m = path.match(/^\/api\/comments\/(\d+)\/like$/);
    if (m && method === "POST") {
      const r = await board.like(Number(m[1]), await visitorKey(request, env));
      return json(r, r.ok ? 200 : 404);
    }

    if (path === "/api/report" && method === "POST") {
      const d = await readJson(request);
      if (!d || !["q", "c"].includes(d.kind) || !(Number(d.id) > 0)) return json({ ok: false, reason: "bad_request" }, 400);
      const reason = clip(clean(d.reason), 100);
      const r = await board.report(d.kind, Number(d.id), await visitorKey(request, env), reason);
      if (r.ok && !r.already && env.ADMIN_EMAIL && (r.count === 1 || r.autoHidden)) {
        ctx.waitUntil((async () => {
          const what = d.kind === "q" ? `질문 #${d.id}` : `의견 #${d.id}`;
          const links = env.ADMIN_KEY
            ? (r.autoHidden ? `<p><a href="${await modLink(env, origin, d.kind, d.id, "show")}">문제없으면 다시 공개하기</a></p>` : `<p><a href="${await modLink(env, origin, d.kind, d.id, "hide")}" style="font-weight:700">숨기기</a></p>`)
            : "";
          await sendMail(env, env.ADMIN_EMAIL, `[웨딩 프로젝트] ${what} 신고${r.autoHidden ? " — 자동 숨김" : ""}`,
            mailWrap(`<p>${what}이(가) 신고됐어요. (누적 ${r.count}회${r.autoHidden ? `, ${REPORT_HIDE_AT}회가 넘어 자동으로 숨겼어요` : ""})</p>${reason ? `<p>신고 사유: ${esc(reason)}</p>` : ""}${quote(clip(r.body, 300))}${links}<p><a href="${origin}/qna/admin.html">관리자 페이지</a></p>`));
        })());
      }
      return json({ ok: r.ok, already: !!r.already }, r.ok ? 200 : 404);
    }

    if (path === "/api/manage") {
      const raw = method === "GET" ? { id: url.searchParams.get("id"), token: url.searchParams.get("token") } : await readJson(request);
      const id = Number(raw && raw.id), token = String((raw && raw.token) || "");
      if (!(id > 0) || !/^[0-9a-f]{36}$/.test(token)) return json({ ok: false, reason: "not_found" }, 404);
      const hash = await sha("manage|" + token);
      if (method === "GET") {
        const q = await board.manageGet(id, hash);
        return q ? json({ ok: true, question: q }) : json({ ok: false, reason: "not_found" }, 404);
      }
      if (method === "POST") {
        const email = clean(raw.email).toLowerCase();
        if (email && !isEmail(email)) return json({ ok: false, reason: "email" }, 400);
        const r = await board.manageDo(id, hash, raw.action, email);
        return json(r, r.ok ? 200 : 400);
      }
    }

    /* 메일 속 승인·숨기기 링크: 링크를 열면 확인 화면 → 버튼(POST)을 눌러야 실행 (메일 링크 미리보기로 실수로 실행되지 않게) */
    if (path === "/api/mod") {
      const k = url.searchParams.get("k"), id = Number(url.searchParams.get("id")), a = url.searchParams.get("a"), t = url.searchParams.get("t") || "";
      const okArgs = ["q", "c"].includes(k) && id > 0 && ["approve", "hide", "show"].includes(a);
      if (!env.ADMIN_KEY || !okArgs || !same(t, await sign(env, `mod|${k}|${id}|${a}`))) return html("잘못된 링크", "<h1>링크가 올바르지 않아요</h1><p>메일에 있는 링크를 그대로 열어 주세요.</p>", 403);
      const label = { approve: "승인하고 공개", hide: "숨기기", show: "다시 공개" }[a];
      const what = k === "q" ? `질문 #${id}` : `의견 #${id}`;
      if (method === "GET") {
        return html(label, `<h1>${what} ${label}</h1><p>아래 버튼을 누르면 적용돼요.</p><form method="post"><button type="submit">${label}</button></form>`);
      }
      if (method === "POST") {
        const status = a === "hide" ? "hidden" : "public";
        const r = await board.setStatus(k, id, status);
        if (!r.ok) return html("없음", `<h1>${what}을(를) 찾지 못했어요</h1>`, 404);
        if (k === "q" && status === "public" && r.before === "pending" && r.question.email) {
          ctx.waitUntil(sendMail(env, r.question.email, "[웨딩 프로젝트] 남겨주신 질문이 공개됐어요",
            mailWrap(`<p><b>남겨주신 질문이 익명 질문방에 공개됐어요.</b></p>${quote(clip(r.question.body, 200))}<p><a href="${origin}/qna/?id=${id}" style="font-weight:700">질문방에서 보기</a></p><p style="font-size:13px;color:#9a7d83">새 의견이 달리면 이 메일로 알려 드려요.</p>`)));
        }
        const view = k === "q" ? `${origin}/qna/?id=${id}` : `${origin}/qna/admin.html`;
        return html("완료", `<h1>${what}: ${label} 완료</h1><p><a href="${view}">확인하러 가기</a></p>`);
      }
      return html("오류", "<h1>지원하지 않는 요청이에요</h1>", 405);
    }

    if (path === "/api/unsub") {
      const id = Number(url.searchParams.get("id")), t = url.searchParams.get("t") || "";
      if (!env.ADMIN_KEY || !(id > 0) || !same(t, await sign(env, `unsub|${id}`))) return html("잘못된 링크", "<h1>링크가 올바르지 않아요</h1>", 403);
      if (method === "GET") return html("알림 그만 받기", `<h1>이 질문의 알림을 그만 받을까요?</h1><p>새 의견이 달려도 더 이상 메일을 보내지 않아요.</p><form method="post"><button type="submit">알림 그만 받기</button></form>`);
      if (method === "POST") { await board.unsubscribe(id); return html("완료", `<h1>알림을 껐어요</h1><p><a href="${origin}/qna/?id=${id}">질문 보러 가기</a></p>`); }
      return html("오류", "<h1>지원하지 않는 요청이에요</h1>", 405);
    }

    /* 관리자 API: X-Admin-Key 헤더가 ADMIN_KEY 와 같아야 합니다 */
    if (path.startsWith("/api/admin/")) {
      if (!env.ADMIN_KEY) return json({ ok: false, reason: "admin_key_not_set" }, 503);
      if (!same(request.headers.get("x-admin-key") || "", env.ADMIN_KEY)) return json({ ok: false, reason: "unauthorized" }, 401);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 50));
      const offset = Math.max(0, parseInt(url.searchParams.get("offset"), 10) || 0);
      if (path === "/api/admin/questions" && method === "GET") {
        const st = url.searchParams.get("status");
        return json(await board.adminList(["pending", "public", "hidden", "all"].includes(st) ? st : "pending", limit, offset));
      }
      if (path === "/api/admin/comments" && method === "GET") return json(await board.adminComments(limit, offset));
      if (path === "/api/admin/delete" && method === "POST") {
        const d = await readJson(request);
        if (!d || !["q", "c"].includes(d.kind) || !(Number(d.id) > 0)) return json({ ok: false, reason: "bad_request" }, 400);
        if (d.kind === "q") { await board.deleteQuestion(Number(d.id)); return json({ ok: true }); }
        const r = await board.deleteComment(Number(d.id));
        return json(r, r.ok ? 200 : 404);
      }
      if (path === "/api/admin/notice" && method === "POST") {
        const d = await readJson(request);
        const body = clean(d && d.body);
        if (body.length < 2 || body.length > 2000) return json({ ok: false, reason: "length" }, 400);
        const r = await board.addNotice(body);
        return json({ ok: true, id: r.id }, 201);
      }
      if (path === "/api/admin/status" && method === "POST") {
        const d = await readJson(request);
        if (!d || !["q", "c"].includes(d.kind)) return json({ ok: false, reason: "bad_request" }, 400);
        const r = await board.setStatus(d.kind, Number(d.id), d.status);
        if (r.ok && d.kind === "q" && d.status === "public" && r.before === "pending" && r.question.email) {
          ctx.waitUntil(sendMail(env, r.question.email, "[웨딩 프로젝트] 남겨주신 질문이 공개됐어요",
            mailWrap(`<p><b>남겨주신 질문이 익명 질문방에 공개됐어요.</b></p>${quote(clip(r.question.body, 200))}<p><a href="${origin}/qna/?id=${d.id}" style="font-weight:700">질문방에서 보기</a></p>`)));
        }
        return json({ ok: !!r.ok }, r.ok ? 200 : 404);
      }
      return json({ ok: false, reason: "not_found" }, 404);
    }

    return json({ ok: false, reason: "not_found" }, 404);
  },
};
