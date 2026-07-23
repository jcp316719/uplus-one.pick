/**
 * U+ Pick 사전예약 - "알림 신청" 접수용 Google Apps Script
 *
 * 이 코드는 preorder.html의 "알림 신청" 모달에서 전송하는 이름/연락처를
 * 받아 (1) 구글 시트에 자동 저장하고 (2) 관리자 이메일로 알림을 보냅니다.
 *
 * ── 설치 방법 ──
 * 1) https://sheets.new 로 새 구글 시트를 만듭니다. (시트 이름은 자유)
 * 2) 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3) 기본으로 열려있는 코드(Code.gs)를 전부 지우고, 이 파일의 내용을 그대로 붙여넣기
 * 4) 아래 NOTIFY_EMAIL 값을 실제로 알림받을 이메일 주소로 변경
 * 5) 상단 [배포] > [새 배포] 클릭
 *    - 유형: "웹 앱" 선택
 *    - 실행 계정: "나(본인 계정)"
 *    - 액세스 권한: "모든 사용자" (또는 "Anyone") ← 반드시 이렇게 설정해야
 *      preorder.html에서 보낸 요청을 받을 수 있습니다.
 * 6) [배포] 클릭 → 권한 승인(본인 구글 계정으로 로그인/허용)
 * 7) 배포 완료 후 나오는 "웹 앱 URL"을 복사
 * 8) preorder.html 파일을 열어 아래 줄을 찾아서:
 *      const GAS_WEB_APP_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
 *    'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE' 부분을 방금 복사한 URL로 교체
 * 9) 저장 후 사이트 재배포/업로드하면 바로 작동합니다.
 *
 * ※ 스크립트나 시트 내용을 수정한 뒤에는 [배포] > [배포 관리] > 배포 수정(연필 아이콘)
 *    > "새 버전"으로 다시 배포해야 변경사항이 실제 웹 앱에 반영됩니다.
 *
 * ── 카카오 알림톡(SOLAPI) 연동 방법 (선택 사항) ──
 * 아래 SOLAPI_* 값 5개를 채우면, 신청 접수 시 고객에게 카카오 알림톡이 자동 발송됩니다.
 * 값이 비어있으면(플레이스홀더 상태) 이 기능은 조용히 건너뛰고, 시트 저장/이메일 알림은 그대로 동작합니다.
 *
 * 1) SOLAPI 콘솔(console.solapi.com) 우측 상단 계정 메뉴 또는 [개발] 메뉴에서
 *    API Key / API Secret 발급 → SOLAPI_API_KEY / SOLAPI_API_SECRET에 입력
 * 2) [발송 준비] > [카카오/네이버/RCS] > [채널/그룹]에서 연동된 채널(uplusone) 클릭 →
 *    표시되는 pfId (PF로 시작하는 값) → SOLAPI_PF_ID에 입력
 * 3) [알림톡 템플릿]에서 심사 승인된 템플릿의 템플릿 ID (KA로 시작하는 값) →
 *    SOLAPI_TEMPLATE_ID에 입력
 * 4) [발송 준비] > [발신번호]에서 등록/인증한 발신 전화번호(숫자만, 하이픈 없이) →
 *    SOLAPI_SENDER_NUMBER에 입력
 * 5) 템플릿 문구의 변수명이 #{고객명}, #{상품명}이 아니라면 아래 sendAlimtalk 함수 안의
 *    variables 객체의 키 이름을 실제 등록한 변수명과 동일하게 맞춰주세요.
 */

// 알림 받을 관리자 이메일 주소로 변경하세요
const NOTIFY_EMAIL = 'your-email@example.com';

// ── SOLAPI 카카오 알림톡 연동 설정 (승인 완료 후 아래 5개 값을 채워주세요) ──
const SOLAPI_API_KEY = 'YOUR_SOLAPI_API_KEY';
const SOLAPI_API_SECRET = 'YOUR_SOLAPI_API_SECRET';
const SOLAPI_PF_ID = 'YOUR_KAKAO_PFID';           // 예: PFxxxxxxxxxxxxxxxx
const SOLAPI_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';    // 예: KAxxxxxxxxxxxxxxxx
const SOLAPI_SENDER_NUMBER = 'YOUR_SENDER_PHONE'; // 예: 0212345678 (하이픈 없이)

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = (data.name || '').toString().slice(0, 50);
    const phone = (data.phone || '').toString().slice(0, 30);
    const product = (data.product || '').toString().slice(0, 200);
    const page = (data.page || '').toString().slice(0, 300);
    const consent = data.consent === true ? '동의' : '미동의';
    const consentTime = (data.consentTime || '').toString().slice(0, 50);
    const timestamp = new Date();

    // 1) 구글 시트에 한 줄 기록 (신청일/이름/연락처/상품명/개인정보동의/동의시각 6개 컬럼)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['신청일시', '이름', '연락처', '상품명', '개인정보동의', '동의 시각']);
    }
    sheet.appendRow([timestamp, name, phone, product, consent, consentTime]);

    // 2) 관리자 이메일 알림
    if (NOTIFY_EMAIL && NOTIFY_EMAIL.indexOf('@') > -1) {
      const subject = '[U+ Pick] 사전예약 알림 신청 - ' + (product || '상품 미지정');
      const body =
        '새로운 알림 신청이 접수되었습니다.\n\n' +
        '상품: ' + product + '\n' +
        '이름: ' + name + '\n' +
        '연락처: ' + phone + '\n' +
        '신청 시간: ' + timestamp + '\n' +
        '신청 페이지: ' + page;
      MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
    }

    // 3) 고객에게 카카오 알림톡 발송 (SOLAPI 설정이 완료된 경우에만 동작)
    sendAlimtalk(name, phone, product);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * SOLAPI를 통해 카카오 알림톡을 발송합니다.
 * SOLAPI_* 값이 아직 플레이스홀더 상태면 아무 것도 하지 않고 조용히 리턴합니다.
 */
function sendAlimtalk(name, phone, product) {
  if (!SOLAPI_API_KEY || SOLAPI_API_KEY.indexOf('YOUR_SOLAPI') !== -1) return;
  if (!SOLAPI_PF_ID || SOLAPI_PF_ID.indexOf('YOUR_KAKAO') !== -1) return;
  if (!SOLAPI_TEMPLATE_ID || SOLAPI_TEMPLATE_ID.indexOf('YOUR_TEMPLATE') !== -1) return;

  try {
    const now = new Date().toISOString();
    const salt = genRanHex(64);
    const message = now + salt;
    const byteSignature = Utilities.computeHmacSha256Signature(message, SOLAPI_API_SECRET);
    const signature = byteSignature.reduce(function (str, chr) {
      chr = (chr < 0 ? chr + 256 : chr).toString(16);
      return str + (chr.length === 1 ? '0' : '') + chr;
    }, '');

    const authHeader =
      'HMAC-SHA256 apiKey=' + SOLAPI_API_KEY +
      ', date=' + now +
      ', salt=' + salt +
      ', signature=' + signature;

    const payload = {
      messages: [{
        from: SOLAPI_SENDER_NUMBER,
        to: phone.replace(/-/g, ''),
        kakaoOptions: {
          pfId: SOLAPI_PF_ID,
          templateId: SOLAPI_TEMPLATE_ID,
          variables: {
            '#{고객명}': name,
            '#{상품명}': product || '문의 상품'
          }
        }
      }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: authHeader },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', options);
  } catch (err) {
    // 알림톡 발송이 실패하더라도 시트 저장/이메일 알림은 이미 끝난 상태이므로 무시하고 넘어갑니다.
  }
}

function genRanHex(size) {
  return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}
