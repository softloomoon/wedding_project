/* Cloudflare Web Analytics(방문자 통계) 코드를 모든 페이지 </body> 앞에 넣어요.
   사용법 (이 폴더 위에서):  node tools/analytics.mjs 347685929cf84bf788718e9f1793af89
   빼려면:  node tools/analytics.mjs --remove
   테스트 화면(values/, test3/, balance/)은 메인 화면 안에 들어가 보이므로 넣지 않아요 (한 번 방문이 두 번 세지지 않게). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (process.argv[2] || "").trim();
const remove = arg === "--remove";
if (!remove && !/^[0-9a-f]{32}$/.test(arg)) { console.error("Web Analytics token(32자리)을 넣어 주세요."); process.exit(1); }
const re = /<!--cf-analytics-->[\s\S]*?<!--\/cf-analytics-->\n?/;
const tag = `<!--cf-analytics--><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${arg}"}'></script><!--/cf-analytics-->\n`;
const skipDir = new Set(["node_modules", ".git", "tools", "apps-script", ".wrangler", "values", "test3", "balance"]);
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDir.has(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".html") && !f.endsWith(path.join("qna", "admin.html"))) {
      const s = fs.readFileSync(f, "utf8");
      if (!s.includes("</body>")) continue;
      const t = s.replace(re, "");
      const out = remove ? t : t.replace("</body>", tag + "</body>");
      if (out !== s) { fs.writeFileSync(f, out); n++; }
    }
  }
})(ROOT);
console.log(remove ? `방문자 통계 코드를 ${n}개 페이지에서 뺐어요.` : `방문자 통계 코드를 ${n}개 페이지에 넣었어요.`);
