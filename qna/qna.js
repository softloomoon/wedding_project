/* Wedding Project 익명 질문방 — 메인 페이지와 질문방 페이지가 함께 쓰는 스크립트 */
(function () {
  const API = "/api";
  const TOPICS = ["결혼 준비 및 비용", "연인 관계 및 가치관", "예식 및 신혼생활", "기타 궁금한 점"];
  const REASONS = {
    too_fast: "조금 전에 글을 남기셨어요. 잠시 후 다시 시도해 주세요.",
    daily_limit: "오늘 남길 수 있는 글 수를 넘었어요. 내일 다시 시도해 주세요.",
    duplicate: "같은 내용의 글이 이미 등록돼 있어요.",
    too_quick: "조금만 천천히 작성해 주세요. 몇 초 뒤 다시 보내 주세요.",
    links: "링크는 1개까지만 넣을 수 있어요.",
    banned: "사용할 수 없는 표현이 들어 있어요. 내용을 다듬어 주세요.",
    phone: "전화번호 같은 개인정보는 공개 글에 적을 수 없어요.",
    email_in_body: "이메일 주소는 본문에 적을 수 없어요. 알림을 원하면 아래 알림 칸에 입력해 주세요.",
    rrn: "주민등록번호 같은 개인정보는 적을 수 없어요.",
    captcha: "스팸 방지 확인을 완료해 주세요.",
    length: "글자 수를 확인해 주세요.",
    title_length: "제목은 5자 이상 60자 이하로 적어 주세요.",
    email: "이메일 주소 형식을 확인해 주세요.",
    agree: "공개 및 개인정보 안내에 동의해 주세요.",
    not_found: "글을 찾을 수 없어요. 삭제되었거나 아직 공개되지 않았을 수 있어요.",
    spam: "등록하지 못했어요.",
    forbidden: "등록하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    network: "연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.",
  };
  const msgFor = (r) => REASONS[r] || "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

  async function api(path, opts) {
    opts = opts || {};
    const init = { method: opts.method || "GET", headers: { Accept: "application/json" } };
    if (opts.body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    let res;
    try { res = await fetch(API + path, init); } catch (e) { return { ok: false, reason: "network" }; }
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok && data.ok === undefined) data.ok = false;
    if (!res.ok && !data.reason) data.reason = res.status === 404 ? "not_found" : "network";
    if (res.ok && data.ok === undefined) data.ok = true;
    return data;
  }

  let configP = null;
  const config = () => (configP = configP || api("/config").then((c) => (c && c.topics ? c : { turnstileSiteKey: "", review: false })));

  /* Cloudflare Turnstile (설정된 경우에만) */
  let tsP = null;
  function loadTurnstile() {
    if (tsP) return tsP;
    tsP = new Promise((resolve) => {
      window.__wpTs = () => resolve(window.turnstile);
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__wpTs";
      s.async = true; s.defer = true; s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return tsP;
  }
  async function spamGuard(box) {
    const cfg = await config();
    const g = { openedAt: Date.now(), widget: null, ts: null };
    if (cfg.turnstileSiteKey) {
      const ts = await loadTurnstile();
      if (ts) { g.ts = ts; g.widget = ts.render(box, { sitekey: cfg.turnstileSiteKey, language: "ko" }); }
    }
    g.token = () => (g.ts && g.widget !== null ? g.ts.getResponse(g.widget) || "" : "");
    g.reset = () => { g.openedAt = Date.now(); if (g.ts && g.widget !== null) g.ts.reset(g.widget); };
    return g;
  }

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function fmtDate(ts) {
    const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts));
    const g = (t) => (p.find((x) => x.type === t) || {}).value;
    return g("year") + "." + g("month") + "." + g("day");
  }
  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "방금 전";
    if (m < 60) return m + "분 전";
    if (m < 24 * 60) return Math.floor(m / 60) + "시간 전";
    if (m < 7 * 24 * 60) return Math.floor(m / 1440) + "일 전";
    return fmtDate(ts);
  }
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } },
    add(k, v) { try { const a = store.get(k); if (!a.includes(v)) { a.push(v); localStorage.setItem(k, JSON.stringify(a.slice(-500))); } } catch (e) {} },
  };
  const qnaBase = () => (location.pathname.indexOf("/qna/") > -1 ? "./" : "qna/");

  /* 질문 목록 한 줄 */
  function questionItem(q) {
    const li = document.createElement("li");
    li.className = "qn-item" + (q.is_notice ? " is-notice" : "");
    const a = document.createElement("a");
    a.href = qnaBase() + "?id=" + q.id;
    a.innerHTML =
      '<p class="qn-q">' + (q.is_notice ? '<span class="qn-badge">공지</span> ' : '<span class="qn-mark">Q.</span> ') + '<span class="qn-text"></span></p>' +
      '<p class="qn-excerpt"></p>' +
      '<p class="qn-meta">' + (q.is_notice ? "운영자" : "익명 질문자") + '<span>의견 ' + (q.comment_count || 0) + "개</span><span>조회 " + (q.views || 0) + "</span><span>" + ago(q.created_at) + "</span></p>";
    a.querySelector(".qn-text").textContent = q.title || q.body;
    const ex = a.querySelector(".qn-excerpt");
    if (q.title && q.body && q.body.indexOf(q.title) !== 0) ex.textContent = q.body.replace(/\s+/g, " "); else ex.remove();
    li.appendChild(a);
    return li;
  }

  /* 익명 질문 작성 폼 */
  function mountAskForm(root, opts) {
    opts = opts || {};
    const uid = "ask" + Math.random().toString(36).slice(2, 7);
    root.innerHTML =
      '<form class="qn-form" novalidate>' +
      '<h3 class="qn-form-title">무엇이든 물어보세요 💌</h3>' +
      '<p class="qn-lead">닉네임이나 회원가입 없이 익명으로 질문할 수 있어요.</p>' +
      '<p class="qn-public" style="margin:0 0 16px">💡 <b>모든 질문과 의견은 공개돼요.</b> 누구나 읽을 수 있으니 실명, 전화번호, 주소, 회사명 같은 개인정보는 적지 말아 주세요. 이메일 주소는 알림용으로만 쓰고 절대 공개하지 않아요. 비방·광고 글은 신고되면 숨겨지고, 운영자가 삭제할 수 있어요.</p>' +
      '<fieldset><legend>질문 분야</legend>' +
      TOPICS.map((t, i) => '<label class="qn-radio"><input type="radio" name="' + uid + '-topic" value="' + esc(t) + '"' + (i === 0 ? " checked" : "") + ">" + esc(t) + "</label>").join("") +
      "</fieldset>" +
      '<label class="qn-label" for="' + uid + '-title">질문 제목</label>' +
      '<input type="text" class="qn-title-input" id="' + uid + '-title" maxlength="60" placeholder="예: 결혼 준비는 어디서부터 시작해야 할까요?" autocomplete="off">' +
      '<p class="qn-hint"><span>한 문장으로 짧게 적어 주세요.</span><span class="qn-tcount">0/60</span></p>' +
      '<label class="qn-label" for="' + uid + '-body">자세한 설명</label>' +
      '<textarea id="' + uid + '-body" maxlength="1000" placeholder="상황이나 궁금한 점을 자세히 적어 주세요. 자세할수록 좋은 의견을 받을 수 있어요."></textarea>' +
      '<p class="qn-hint"><span>실명, 전화번호, 주소 같은 개인정보는 적지 말아 주세요.</span><span class="qn-count">0/1000</span></p>' +
      '<label class="qn-check"><input type="checkbox" class="qn-notify">새 의견이 달리면 이메일로 알림 받기 (선택)</label>' +
      '<div class="qn-email-box" hidden><input type="email" class="qn-email" maxlength="120" placeholder="알림 받을 이메일 주소" autocomplete="email">' +
      '<p class="qn-hint">이메일은 알림과 질문 관리 링크를 보내는 데에만 쓰고 절대 공개하지 않아요. 언제든 알림을 끌 수 있어요.</p></div>' +
      '<div class="qn-hp" aria-hidden="true"><label>웹사이트<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="qn-ts"></div>' +
      '<label class="qn-check qn-agree"><input type="checkbox" class="qn-agree-box"><span>질문과 이 질문에 달리는 의견은 <b>누구나 볼 수 있게 공개</b>된다는 점, 이메일은 알림 목적으로만 쓰이고 공개되지 않는다는 점에 동의해요.</span></label>' +
      '<button type="submit" class="qn-btn qn-send" disabled>질문 등록하기</button>' +
      '<p class="qn-msg" role="status" aria-live="polite"></p>' +
      "</form>";
    const f = root.querySelector("form"), body = f.querySelector("textarea"), count = f.querySelector(".qn-count");
    const title = f.querySelector(".qn-title-input"), tcount = f.querySelector(".qn-tcount");
    const notify = f.querySelector(".qn-notify"), emailBox = f.querySelector(".qn-email-box"), email = f.querySelector(".qn-email");
    const agree = f.querySelector(".qn-agree-box"), send = f.querySelector(".qn-send"), msg = f.querySelector(".qn-msg");
    const say = (t, cls) => { msg.textContent = t; msg.className = "qn-msg" + (cls ? " " + cls : ""); };
    const upd = () => {
      count.textContent = body.value.length + "/1000"; tcount.textContent = title.value.length + "/60";
      send.disabled = !title.value.trim() || !body.value.trim() || !agree.checked;
    };
    body.addEventListener("input", upd); title.addEventListener("input", upd); agree.addEventListener("change", upd);
    title.addEventListener("keydown", (e) => { if (e.key === "Enter"){ e.preventDefault(); body.focus(); } });
    notify.addEventListener("change", () => { emailBox.hidden = !notify.checked; if (notify.checked) email.focus(); });
    let guard = null;
    spamGuard(f.querySelector(".qn-ts")).then((g) => (guard = g));
    let busy = false;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const text = body.value.trim(), mail = email.value.trim(), ttl = title.value.trim();
      if (ttl.length < 5) { say("제목을 5자 이상 적어 주세요.", "err"); title.focus(); return; }
      if (text.length < 5) { say("자세한 설명을 5자 이상 적어 주세요.", "err"); body.focus(); return; }
      if (notify.checked && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { say("알림 받을 이메일 주소를 확인해 주세요.", "err"); email.focus(); return; }
      if (!agree.checked) { say(REASONS.agree, "err"); return; }
      busy = true; send.disabled = true; send.textContent = "등록하는 중…"; say("");
      const r = await api("/questions", { method: "POST", body: {
        topic: (f.querySelector("input[type=radio]:checked") || {}).value,
        title: ttl, body: text, notify: notify.checked, email: notify.checked ? mail : "", agree: true,
        website: f.website.value, elapsed: guard ? Date.now() - guard.openedAt : 0, turnstile: guard ? guard.token() : "",
      } });
      busy = false; send.textContent = "질문 등록하기";
      if (!r.ok) { say(msgFor(r.reason), "err"); if (guard) guard.reset(); upd(); return; }
      f.reset(); emailBox.hidden = true; upd(); if (guard) guard.reset();
      showDone(root, r, notify.checked);
      if (opts.onDone) opts.onDone(r);
    });
    upd();
    return { focus: () => title.focus(), reset: () => { if (guard) guard.openedAt = Date.now(); } };
  }

  function showDone(root, r, mailed) {
    const box = document.createElement("div");
    box.className = "qn-done";
    box.setAttribute("role", "status");
    box.innerHTML =
      "<p><b>" + (r.status === "public" ? "질문이 등록됐어요! 💌" : "질문이 접수됐어요! 💌") + "</b> " +
      (r.status === "public" ? "지금 바로 질문방에서 볼 수 있어요." : "운영 정책에 맞게 확인한 뒤 공개돼요.") + "</p>" +
      '<p class="qn-manage">내 질문 관리 링크 (알림 끄기·삭제)<br><a class="qn-manage-link"></a></p>' +
      '<p class="qn-hint">' + (mailed ? "같은 링크를 메일로도 보내 드렸어요. " : "") + "이 링크는 다시 보여드릴 수 없으니 꼭 저장해 두세요. 다른 사람에게 공유하지 마세요.</p>" +
      '<div class="qn-done-actions"><button type="button" class="qn-btn qn-ghost qn-copy">링크 복사</button>' +
      (r.status === "public" ? '<a class="qn-btn qn-ghost" href="' + qnaBase() + "?id=" + r.id + '">질문 보러 가기</a>' : "") + "</div>";
    const a = box.querySelector(".qn-manage-link");
    a.href = r.manageUrl; a.textContent = r.manageUrl;
    box.querySelector(".qn-copy").addEventListener("click", (e) => {
      const b = e.currentTarget;
      try { navigator.clipboard.writeText(r.manageUrl).then(() => (b.textContent = "복사했어요"), () => (b.textContent = "길게 눌러 복사해 주세요")); } catch (err) { b.textContent = "길게 눌러 복사해 주세요"; }
    });
    const old = root.querySelector(".qn-done");
    if (old) old.remove();
    root.prepend(box);
  }

  window.WPQna = { api, config, spamGuard, esc, fmtDate, ago, store, msgFor, questionItem, mountAskForm, TOPICS };
})();
