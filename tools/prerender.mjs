/* 검색엔진(자바스크립트를 실행하지 않는 크롤러)도 내용을 볼 수 있도록, 자바스크립트로 그리는 목록을 HTML에 미리 써 넣어요.
   tests-data.js, info/posts.js, talk/topics.js 를 고친 뒤 이 폴더 위에서 실행:  node tools/prerender.mjs
   페이지 안의 <!--pre:이름--> … <!--/pre:이름--> 사이만 바꿔요. 화면에서는 자바스크립트가 같은 내용을 다시 그려요. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
for (const f of ["tests-data.js", "info/posts.js", "talk/topics.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), { window: win, document: { readyState: "complete", querySelectorAll: () => [] } });
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TESTS = win.WP_TESTS, POSTS = win.WP_POSTS, TALK = win.WP_TALK;

const mainCard = (t) => `<a class="card" href="/${t.src}" data-test="${t.id}" style="--tone:${t.tone}"><div class="card-art${t.fit ? " fit" : ""}"><img src="${t.img}" alt=""></div><div class="card-body"><h3 class="card-title">${esc(t.title)}</h3><p class="card-desc">${esc(t.desc)}</p><span class="pill">${t.game ? "게임 하기" : "테스트 하기"}</span></div></a>`;
const gameCard = (t) => `<a class="card" href="/${t.src}" style="--tone:${t.tone}"><div class="card-art${t.fit ? " fit" : ""}"><img src="/${t.img}" alt=""></div><div class="card-body"><h2 class="card-title">${esc(t.title)}</h2><p class="card-desc">${esc(t.desc)}</p><p class="card-about">${esc(t.about || "")}</p><span class="pill">${t.game ? "게임 하기" : "테스트 하기"}</span></div></a>`;
const infoItem = (p, cur) => `<a class="ip-item${p.id === cur ? " is-current" : ""}" href="${p.path}"${p.id === cur ? ' aria-current="page"' : ""}><span class="ip-icon" aria-hidden="true">${p.icon}</span><span class="ip-main"><span class="ip-tag">${esc(p.tag)}</span><span class="ip-title">${esc(p.title)}</span><span class="ip-desc">${esc(p.desc)}</span><span class="ip-meta">${esc(p.date + " · " + p.read)}</span></span>${p.id === cur ? '<span class="ip-go" aria-hidden="true">지금 보는 글</span>' : ""}</a>`;
const t0 = TALK[0];

function fill(file, blocks) {
  const f = path.join(ROOT, file);
  let s = fs.readFileSync(f, "utf8"), changed = 0;
  for (const [name, html] of Object.entries(blocks)) {
    const re = new RegExp(`<!--pre:${name}-->[\\s\\S]*?<!--/pre:${name}-->`);
    if (!re.test(s)) continue;
    s = s.replace(re, `<!--pre:${name}-->${html}<!--/pre:${name}-->`); changed++;
  }
  if (changed) { fs.writeFileSync(f, s); console.log("prerendered", file, changed); }
}

fill("index.html", {
  tests: TESTS.map(mainCard).join(""),
  info3: POSTS.slice(0, 3).map((p) => infoItem(p)).join(""),
  talkhead: `<a class="tk-topic" href="/talk/${t0.no}/">${t0.icon} ${t0.no}. ${esc(t0.title)}</a>`,
  talkq: `<p class="tk-q">${esc(t0.qs[0])}</p>`,
});
fill("games/index.html", { games: TESTS.map(gameCard).join("") });
fill("info/index.html", { infoall: POSTS.map((p) => infoItem(p)).join("") });
for (const p of POSTS) fill(p.path.replace(/^\//, "") + "index.html", { infomore: POSTS.map((x) => infoItem(x, p.id)).join("") });
