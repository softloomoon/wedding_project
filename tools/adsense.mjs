/* 애드센스 코드를 모든 페이지 <head>에 넣어요.
   사용법 (이 폴더 위에서):  node tools/adsense.mjs pub-1234567890123456
   이미 들어 있으면 새 ID로 바꿔요. 빼려면:  node tools/adsense.mjs --remove */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (process.argv[2] || "").trim().replace(/^ca-/, "");
const remove = arg === "--remove";
if (!remove && !/^pub-\d{10,20}$/.test(arg)) { console.error("게시자 ID를 pub-숫자 형식으로 넣어 주세요. 예: node tools/adsense.mjs pub-1234567890123456"); process.exit(1); }
const re = /\n?<!--adsense-->[\s\S]*?<!--\/adsense-->/;
const tag = remove ? "" : `\n<!--adsense--><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${arg}" crossorigin="anonymous"></script><!--/adsense-->`;
const skip = new Set(["node_modules", ".git", "tools", "apps-script", ".wrangler"]);
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".html") && !f.includes(`${path.sep}qna${path.sep}admin.html`) && !f.includes(`${path.sep}artifact-type${path.sep}`)) {
      let s = fs.readFileSync(f, "utf8");
      if (!s.includes("</head>")) continue;
      const t = s.replace(re, "");
      const out = remove ? t : t.replace("</head>", `${tag.trimStart()}\n</head>`);
      if (out !== s) { fs.writeFileSync(f, out); n++; }
    }
  }
})(ROOT);
console.log(remove ? `애드센스 코드를 ${n}개 페이지에서 뺐어요.` : `애드센스 코드를 ${n}개 페이지에 넣었어요 (${arg}).`);
