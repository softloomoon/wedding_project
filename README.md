# 결혼 가치관 맞춰보기 — 배포용 파일

이 폴더 하나만 있으면 바로 무료 호스팅에 올릴 수 있어요. 서버나 데이터베이스 없이 순수 HTML/JS 한 파일(`index.html`)로 동작합니다.

## 안에 들어있는 파일

- `index.html` — Wedding Project 메인 페이지. 카테고리 4개: ① 테스트 & 밸런스 게임(카드 슬라이드) ② 결혼 준비 정보 ③ 연인이 나누면 좋을 대화 질문 ④ 궁금한 점 질문하기(질문 접수 폼)
- `values/index.html` — 결혼 가치관 맞춰보기 테스트 (질문, 결과 화면, 이미지 저장/공유 기능 포함)
- `test3/index.html` — 나의 결혼 마지노선 테스트
- `balance/index.html` — 신혼생활 밸런스 게임 (그림은 `balance/img/`)
- `qna/` — 익명 질문방 페이지(`index.html`), 관리자 페이지(`admin.html`), 공통 스크립트·스타일
- `worker.js`, `wrangler.jsonc`, `.assetsignore` — Cloudflare Workers 설정과 익명 질문방 API
- `apps-script/mail-relay.gs` — 메일 발송용 Google Apps Script
- `vercel.json` — Vercel 배포용 설정
- `netlify.toml` — Netlify 배포용 설정
- `README.md` — 이 안내문

## 가장 쉬운 방법: Netlify Drop (회원가입 없이 바로 테스트)

1. https://app.netlify.com/drop 접속
2. 이 폴더(`wedding-site`)를 통째로 페이지에 드래그 앤 드롭
3. 몇 초 뒤 `https://무작위이름.netlify.app` 주소가 바로 생성돼요
4. 테스트만 해보고 끝낼 거면 이걸로 충분하고, 계속 쓰고 싶으면 아래 방법으로 정식 배포하세요 (Drop으로 만든 사이트는 임시 성격이라 계정에 연결해 관리하는 걸 추천해요)

## 정식 배포: Vercel

1. https://vercel.com 가입 (GitHub 계정으로 가입하면 편해요)
2. 이 폴더를 GitHub 저장소에 올리기
   - GitHub 사용이 처음이면: https://github.com 가입 → New repository → 이 폴더의 파일들을 업로드
3. Vercel 대시보드에서 **Add New → Project** → 방금 만든 저장소 선택 → **Deploy** 클릭
4. 배포가 끝나면 `https://프로젝트명.vercel.app` 주소가 생성돼요
5. 이후 GitHub 저장소 내용을 수정하면 Vercel이 자동으로 재배포해줘요

## 정식 배포: Netlify (계정 연동)

1. https://netlify.com 가입
2. **Add new site → Import an existing project** → GitHub 저장소 연결
3. Build command는 비워두고, Publish directory는 `.` (현재 폴더)로 설정
4. **Deploy site** 클릭 → 무료 주소 생성

## 나중에 도메인을 연결하려면

Vercel이나 Netlify 둘 다 대시보드의 **Domains** 메뉴에서 구매한 도메인을 연결할 수 있어요. 도메인은 가비아, 후이즈, Namecheap, Google Domains 같은 곳에서 구매하면 됩니다.

## 익명 질문방 (4번 카테고리)

- 메인 4번 칸: 인기 질문 3개 + **익명으로 질문하기** 버튼(눌러야 작성 폼이 열림) + 전체 보기 링크
- `qna/` 질문방 페이지: 최신/인기 정렬, 공지 고정, 질문 상세, 익명 의견, 공감, 신고, 질문자 관리 링크 화면
- `qna/admin.html` 관리자 페이지: 질문 승인, 숨기기, 다시 공개, 삭제, 의견 관리, 공지 쓰기
- 서버: `worker.js` (Cloudflare Worker) + Durable Object(SQLite). 배포할 때 자동으로 만들어져요.

### 동작 방식
- 질문: 회원가입 없이 작성하고 바로 공개돼요. (`wrangler.jsonc`의 `REVIEW_QUESTIONS`를 `"true"`로 바꾸면 운영자가 승인해야 공개돼요.)
- 의견: 누구나 바로 공개. 서로 다른 3명이 신고하면 자동으로 숨겨져요.
- 이메일: 알림을 원하는 사람만 입력. 공개 API는 이메일을 절대 돌려주지 않아요.
  - 질문 접수 시 **비밀 관리 링크**를 화면에 보여주고 메일로도 보내요. 이 링크로 알림을 끄고 켜거나 질문을 지울 수 있어요.
  - 새 의견이 달리면 질문자에게 메일이 가고, 메일마다 알림 해제 링크가 있어요.
- 운영자 메일(`ADMIN_EMAIL`)로 새 질문(승인 링크 포함), 새 의견, 신고 알림이 와요.
- 스팸 방지: 허니팟 칸, 작성 시간 확인, 같은 접속자의 연속 등록 제한(질문 2분, 의견 20초, 하루 질문 5개·의견 30개), 같은 글 반복 금지, 링크는 1개까지, 금칙어, 전화번호·이메일·주민번호 차단, 다른 사이트에서 오는 요청 차단. 원하면 Cloudflare Turnstile도 켤 수 있어요.

### 처음 한 번 설정하기
1. **관리자 비밀번호**: Cloudflare 대시보드 → Workers & Pages → wedding-project → Settings → Variables and Secrets → Add → 종류 **Secret**, 이름 `ADMIN_KEY`, 값은 길고 어려운 비밀번호
2. **메일 발송**: `apps-script/mail-relay.gs` 맨 위 안내대로 Google Apps Script 웹앱을 배포하고, 같은 화면에 Secret으로 `MAIL_WEBHOOK_URL`(웹앱 URL), `MAIL_SECRET`(스크립트의 SECRET 값)을 추가
3. (선택) Turnstile: Cloudflare → Turnstile에서 위젯을 만들고, `wrangler.jsonc`의 `TURNSTILE_SITE_KEY`에 사이트 키를 넣은 뒤 Secret으로 `TURNSTILE_SECRET` 추가

- `ADMIN_KEY`가 없으면 승인할 방법이 없어서 질문이 바로 공개돼요.
- 메일 설정이 없으면 게시판은 그대로 동작하고 메일만 가지 않아요.

## 참고

- 테스트·밸런스 게임 답변은 어디에도 저장되지 않아요. 익명 질문방만 Cloudflare에 저장돼요.
- 애드센스를 붙이려면 개인정보처리방침, 이용약관 같은 페이지와 블로그성 콘텐츠가 더 필요할 수 있어요. 승인 기준은 바뀔 수 있으니 신청 전 공식 안내를 확인하세요.
