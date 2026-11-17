/**
 * Wedding Project 메일 발송기 (Google Apps Script)
 *
 * Cloudflare Worker 가 이 웹앱으로 요청을 보내면, 내 Gmail 계정으로 메일을 보내 줍니다.
 * (개인 Gmail 기준 하루 약 100통까지 보낼 수 있어요.)
 *
 * 설정 방법
 * 1. https://script.google.com 에서 [새 프로젝트]를 만들고 이 파일 내용을 그대로 붙여넣기
 * 2. 아래 SECRET 값을 아무도 모르는 긴 문자열로 바꾸기 (Cloudflare 의 MAIL_SECRET 과 같은 값)
 * 3. [배포] → [새 배포] → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 *    → 배포 후 권한 허용 → 나오는 '웹 앱 URL'을 Cloudflare 의 MAIL_WEBHOOK_URL 에 넣기
 */
const SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!SECRET || SECRET === 'CHANGE_ME_TO_A_LONG_RANDOM_STRING' || data.secret !== SECRET) {
      return out({ ok: false, reason: 'unauthorized' });
    }
    if (!data.to || !data.subject || !data.html) return out({ ok: false, reason: 'bad_request' });
    MailApp.sendEmail({
      to: String(data.to),
      subject: String(data.subject).slice(0, 200),
      htmlBody: String(data.html),
      name: 'Wedding Project',
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, reason: String(err) });
  }
}

function doGet() {
  return out({ ok: true, service: 'wedding-project-mail' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
