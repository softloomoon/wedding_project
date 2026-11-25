/* 테스트 & 밸런스 게임 목록 — 메인 슬라이드, 게임 모아보기(/games/), 결과 화면 아래 추천에 함께 쓰여요.
   새 테스트는 여기에 한 줄 추가하면 돼요. game:true 면 '게임 하기' 버튼이 나와요.
   about: 게임 모아보기(/games/)에 나오는 소개 글. done: 결과 화면이 나왔는지 알아보는 표시(이게 보이면 아래에 다른 게임 추천이 나와요) */
window.WP_TESTS = [
  { id:"majinoseon", title:"나의 결혼 우선순위 테스트", desc:"안정, 자유, 가족, 성장 중 결혼에서 내가 가장 지키고 싶은 건?", img:"test3/card.svg", src:"test3/", tone:"#ffffff", fit:true, done:"#screen-result.active",
    about:"10가지 상황으로 알아보는 나의 결혼 가치 유형. 결과는 동물 카드로 나와요." },
  { id:"values", title:"결혼 가치관 맞춰보기", desc:"우리, 결혼에 대해 같은 그림을 그리고 있을까?", img:"values/hero.jpg", src:"values/", tone:"#fffaf2", done:"#rs, #cp",
    about:"같은 질문에 둘이 각자 답하고, 생각이 다른 부분을 미리 확인해요." },
  { id:"balance", title:"신혼생활 밸런스 게임", desc:"정답은 없어요. 다만 둘의 답이 다를 뿐! 20문항, 2분이면 끝.", img:"balance/img/cover.png", src:"balance/", tone:"#ffffff", fit:true, game:true, done:"#resTitle, #retryBtn",
    about:"20가지 신혼 선택으로 나의 신혼 스타일을 알고, 배우자와 일치율을 비교해요." }
];
