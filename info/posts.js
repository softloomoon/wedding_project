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
    id: "budget",
    path: "/info/budget/",
    tag: "예산",
    icon: "💰",
    title: "결혼 예산 짜는 법 (예산표 포함)",
    desc: "총 예산 정하기부터 항목별 배분, 예비비까지. 평균 결혼 비용과 엑셀로 받을 수 있는 예산표를 담았어요.",
    date: "2026.11.21",
    read: "약 7분 · 예산표",
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
    id: "sdm",
    path: "/info/sdm/",
    tag: "스드메",
    icon: "👰",
    title: "스드메 용어 정리와 추가금 체크",
    desc: "원본, 가봉, 헬퍼, 얼리 스타트… 상담에서 자주 나오는 용어와 계약 전 꼭 물어볼 추가금 질문을 정리했어요.",
    date: "2026.11.21",
    read: "약 6분",
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
  {
    id: "meeting", path: "/info/meeting/", tag: "상견례", icon: "🤝",
    title: "상견례 준비, 이것만 챙기면 편해요",
    desc: "상견례 시기와 장소 고르는 법, 비용과 선물, 진행 순서, 피하면 좋은 대화 주제까지 정리했어요.",
    date: "2026.11.25", read: "약 5분",
  },
  {
    id: "home", path: "/info/home/", tag: "신혼집", icon: "🏠",
    title: "신혼집 구하기, 계약 전에 꼭 볼 것",
    desc: "지역·예산 정하기, 전세·월세·매매 비교, 등기부등본부터 전입신고·확정일자·보증보험까지 정리했어요.",
    date: "2026.11.25", read: "약 6분",
  },
  {
    id: "invitation", path: "/info/invitation/", tag: "청첩장", icon: "💌",
    title: "청첩장, 언제 누구에게 어떻게 돌릴까",
    desc: "종이·모바일 청첩장 준비 시기, 누구에게 어떻게 전할지, 문구 쓰는 법과 놓치기 쉬운 예절을 정리했어요.",
    date: "2026.11.25", read: "약 4분",
  },
  {
    id: "honeymoon", path: "/info/honeymoon/", tag: "신혼여행", icon: "✈️",
    title: "신혼여행지 고르는 법, 시기와 기준",
    desc: "예약 시기, 휴양·관광·국내 여행 비교, 날씨와 비행시간 따져 보기, 출발 전 준비물까지 정리했어요.",
    date: "2026.11.25", read: "약 5분",
  },
  {
    id: "registration", path: "/info/registration/", tag: "혼인신고", icon: "📝",
    title: "혼인신고, 언제 어떻게 할까?",
    desc: "준비물과 증인, 신고하는 곳, 신고 시기에 따라 달라지는 세액공제·청약·대출 기준까지 정리했어요.",
    date: "2026.11.25", read: "약 5분",
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
      (p.id === opts.current ? '<span class="ip-go" aria-hidden="true">지금 보는 글</span>' : "");
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
