/* 테스트 & 밸런스 게임 목록 — 메인 슬라이드, 게임 모아보기(/games/), 결과 화면 아래 추천에 함께 쓰여요.
   새 테스트는 여기에 한 줄 추가하면 돼요. game:true 면 '게임 하기' 버튼이 나와요.
   about: 게임 모아보기(/games/)에 나오는 소개 글. done: 결과 화면이 나왔는지 알아보는 표시(이게 보이면 아래에 다른 게임 추천이 나와요) */
window.WP_TESTS = [
  { id:"majinoseon", title:"나의 결혼 우선순위 테스트", desc:"안정, 자유, 가족, 성장 중 결혼에서 내가 가장 지키고 싶은 건?", img:"test3/card.svg", src:"test3/", tone:"#ffffff", fit:true, done:"#screen-result.active",
    about:"결혼생활에서 마주칠 수 있는 10가지 상황에 답하면 안정·자유·가족·성장 중 내가 결혼에서 가장 먼저 지키고 싶은 가치를 알려 줘요. 결과는 고슴도치·고양이·토끼·여우 유형 카드로 나오고, 사진으로 저장해 예비 배우자와 비교해 볼 수 있어요." },
  { id:"values", title:"결혼 가치관 맞춰보기", desc:"우리, 결혼에 대해 같은 그림을 그리고 있을까?", img:"values/hero.jpg", src:"values/", tone:"#fffaf2", done:"#rs, #cp",
    about:"결혼, 돈, 결혼식에 대한 질문에 두 사람이 각자 답하고 결과를 나란히 비교해 보는 테스트예요. 맞고 틀린 답은 없고, 서로 생각이 다른 부분을 결혼 전에 미리 알고 이야기해 보는 것이 목적이에요." },
  { id:"balance", title:"신혼생활 밸런스 게임", desc:"정답은 없어요. 다만 둘의 답이 다를 뿐! 20문항, 2분이면 끝.", img:"balance/img/cover.png", src:"balance/", tone:"#ffffff", fit:true, game:true, done:"#resTitle, #retryBtn",
    about:"신혼생활에서 흔히 부딪히는 20가지 선택지 중 하나를 고르는 2분짜리 게임이에요. 결과로 알콩달콩 이벤트형·든든한 단짝형·둘만의 로맨스형·편안한 동반자형 중 나의 신혼 스타일이 나오고, 초대 코드로 예비 배우자와 일치율을 비교할 수 있어요." }
];
