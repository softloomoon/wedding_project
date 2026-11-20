/* 결혼 준비 정보 글 목록 — 여기에 항목을 추가하면 메인 2번 칸, 게시판(/info/), 글 아래 목록에 함께 나와요.
   새 글은 info/<id>/index.html 로 만들고 path 를 맞춰 주세요. 위에 있을수록 먼저 보여요. */
window.WP_POSTS = [
  {
    id: "order",
    path: "/info/order/",
    tag: "준비 순서",
    icon: "🗓️",
    title: "결혼 준비 순서 한눈에 보기",
    desc: "상견례부터 혼인신고까지, 예식 12개월 전부터 시기별로 무엇을 해야 하는지 정리했어요.",
    date: "2026.11.21",
    read: "약 6분",
  },
  {
    id: "checklist",
    path: "/info/checklist/",
    tag: "체크리스트",
    icon: "✅",
    title: "결혼 준비 체크리스트 (시기별)",
    desc: "준비 순서에 맞춘 체크리스트예요. 하나씩 체크하면 진행률이 보이고, 이 기기에 저장돼요.",
    date: "2026.11.21",
    read: "체크하며 보기",
  },
  {
    id: "fair",
    path: "/info/fair/",
    tag: "웨딩 박람회",
    icon: "🎪",
    title: "웨딩 박람회, 꼭 가야 할까? 가는 이유와 전국 일정 확인법",
    desc: "박람회에 가면 좋은 점, 가기 전 준비, 현장 계약 주의사항, 지역별 일정 확인하는 곳까지 정리했어요.",
    date: "2026.11.21",
    read: "약 5분",
  },
];

/* 목록 그리기: current 를 주면 그 글은 '지금 보는 글'로 표시해요 */
window.WPInfoList = function (el, opts) {
  opts = opts || {};
  el.innerHTML = "";
  (window.WP_POSTS || []).slice(0, opts.limit || 99).forEach(function (p, i) {
    var a = document.createElement("a");
    a.className = "ip-item" + (p.id === opts.current ? " is-current" : "");
    a.href = p.path;
    if (p.id === opts.current) a.setAttribute("aria-current", "page");
    a.innerHTML =
      '<span class="ip-icon" aria-hidden="true"></span>' +
      '<span class="ip-main"><span class="ip-tag"></span><span class="ip-title"></span><span class="ip-desc"></span>' +
      '<span class="ip-meta"></span></span>' +
      '<span class="ip-go" aria-hidden="true">' + (p.id === opts.current ? "지금 보는 글" : "읽기 →") + "</span>";
    a.querySelector(".ip-icon").textContent = p.icon;
    a.querySelector(".ip-tag").textContent = p.tag;
    a.querySelector(".ip-title").textContent = p.title;
    a.querySelector(".ip-desc").textContent = p.desc;
    a.querySelector(".ip-meta").textContent = p.date + " · " + p.read;
    el.appendChild(a);
  });
};

/* 공유하기: 휴대폰은 공유 창, 안 되면 링크 복사 */
(function () {
  function init() {
    document.querySelectorAll("[data-share]").forEach(function (btn) {
      var msg = btn.parentNode.querySelector(".share-msg");
      btn.addEventListener("click", function () {
        var url = location.origin + location.pathname;
        var t = document.querySelector('meta[property="og:title"]');
        var d = document.querySelector('meta[property="og:description"]');
        var data = { title: t ? t.content : document.title, text: d ? d.content : "", url: url };
        var say = function (x) { if (msg) msg.textContent = x; };
        var copy = function () {
          try {
            navigator.clipboard.writeText(url).then(function () { say("링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요."); }, function () { say("복사가 안 되면 이 주소를 길게 눌러 복사해 주세요: " + url); });
          } catch (e) { say("복사가 안 되면 이 주소를 길게 눌러 복사해 주세요: " + url); }
        };
        if (navigator.share) {
          navigator.share(data).catch(function (e) { if (!e || e.name !== "AbortError") copy(); });
        } else copy();
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
