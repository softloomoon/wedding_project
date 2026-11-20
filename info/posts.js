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
