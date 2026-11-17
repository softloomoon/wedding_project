# 결혼 가치관 맞춰보기 — 배포용 파일

이 폴더 하나만 있으면 바로 무료 호스팅에 올릴 수 있어요. 서버나 데이터베이스 없이 순수 HTML/JS 한 파일(`index.html`)로 동작합니다.

## 안에 들어있는 파일

- `index.html` — Wedding Project 메인 페이지 (테스트 카드 슬라이드)
- `values/index.html` — 결혼 가치관 맞춰보기 테스트 (질문, 결과 화면, 이미지 저장/공유 기능 포함)
- `test3/index.html` — 나의 결혼 마지노선 테스트
- `balance/index.html` — 신혼생활 밸런스 게임 (그림은 `balance/img/`)
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

## 참고

- 이 사이트는 서버가 없어서 사용자 답변이 어디에도 저장되지 않아요. 통계를 모으고 싶으면 나중에 서버리스 함수나 데이터베이스를 추가해야 해요.
- 애드센스를 붙이려면 개인정보처리방침, 이용약관 같은 페이지와 블로그성 콘텐츠가 더 필요할 수 있어요. 승인 기준은 바뀔 수 있으니 신청 전 공식 안내를 확인하세요.
