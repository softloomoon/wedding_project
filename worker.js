/* Wedding Project Worker
   - 정적 파일(index.html, test3/, values/, balance/ ...)은 그대로 ASSETS 로 내보냅니다.
   - /api/questions : 질문 게시판 목록(GET)과 새 질문 등록 표시(POST)
     게시판에는 "새로운 질문이 등록되었습니다"와 등록 시각만 남깁니다.
     질문 내용, 이메일, IP 같은 개인정보는 저장하지 않습니다. (질문 내용은 메일로만 전달)
*/
import { DurableObject } from "cloudflare:workers";

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const RATE_WINDOW_MS = 60 * 1000; // 같은 접속자는 1분에 한 번만 등록
const RATE_MAX_KEYS = 5000;

export class QuestionBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL)"
    );
    /* 도배 방지용: 메모리에만 잠시 두고 저장하지 않습니다 */
    this.recent = new Map();
  }

  list(limit, offset) {
    const items = this.sql
      .exec("SELECT id, created_at FROM questions ORDER BY id DESC LIMIT ? OFFSET ?", limit, offset)
      .toArray();
    const total = this.sql.exec("SELECT COUNT(*) AS n FROM questions").one().n;
    return { total, items };
  }

  add(key) {
    const now = Date.now();
    const last = this.recent.get(key);
    if (last && now - last < RATE_WINDOW_MS) return { ok: false, reason: "too_fast" };
    if (this.recent.size > RATE_MAX_KEYS) {
      for (const [k, t] of this.recent) if (now - t >= RATE_WINDOW_MS) this.recent.delete(k);
    }
    this.recent.set(key, now);
    const row = this.sql
      .exec("INSERT INTO questions (created_at) VALUES (?) RETURNING id, created_at", now)
      .one();
    return { ok: true, item: row };
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function rateKey(request) {
  /* IP 는 저장하지 않고, 도배 방지 비교용 해시로만 잠깐 씁니다 */
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("wp-board:" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/questions") {
      const board = env.QUESTION_BOARD.get(env.QUESTION_BOARD.idFromName("main"));
      if (request.method === "GET") {
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || PAGE_SIZE));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset"), 10) || 0);
        return json(await board.list(limit, offset));
      }
      if (request.method === "POST") {
        /* 다른 사이트에서 함부로 등록하지 못하게 같은 주소에서 온 요청만 받습니다 */
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return json({ ok: false, reason: "forbidden" }, 403);
        const res = await board.add(await rateKey(request));
        return json(res, res.ok ? 201 : 429);
      }
      return json({ ok: false, reason: "method_not_allowed" }, 405);
    }
    if (url.pathname.startsWith("/api/")) return json({ ok: false, reason: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
