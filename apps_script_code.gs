/**
 * U+ Pick 사전예약 "알림 신청" 접수용 Google Apps Script
 *
 * ⚠️ 이 파일은 홈페이지에 업로드하지 마세요.
 *    Apps Script 편집기에 붙여넣기 위한 참고용 파일입니다.
 *    (예전에 GitHub 에 올라가면서 API 키가 공개된 적이 있습니다)
 *
 * 하는 일
 *   1) 구글 시트에 신청 내역 한 줄 기록
 *   2) 관리자 이메일로 알림 발송
 *   3) 고객에게 카카오 알림톡 발송 (SOLAPI)
 *
 * ── 채워야 할 값은 아래 3개뿐입니다 ──
 *   NOTIFY_EMAIL / SOLAPI_API_KEY / SOLAPI_API_SECRET
 *   나머지는 이미 채워져 있습니다.
 *
 * ── 수정 후 반드시 재배포 ──
 *   [배포] > [배포 관리] > 연필 아이콘 > 버전 "새 버전" > [배포]
 *   이걸 안 하면 수정한 내용이 실제로 반영되지 않습니다.
 */

/* ① 알림 받을 이메일 주소 (지금 비어 있어서 메일이 안 갑니다) */
const NOTIFY_EMAIL = '';

/* ② SOLAPI 콘솔에서 새로 발급한 키 (기존 키는 공개됐으므로 반드시 폐기 후 재발급) */
const SOLAPI_API_KEY = '';
const SOLAPI_API_SECRET = '';

/* 아래 3개는 그대로 두시면 됩니다 */
const SOLAPI_PF_ID = 'KA01PF260723050358693swJ9Fydpdzb';
const SOLAPI_TEMPLATE_ID = 'KA01TP260723054435194beMKt7Xn9u7';
const SOLAPI_SENDER_NUMBER = '01034918888';

/* 알림톡 템플릿에 등록한 변수명. 콘솔의 템플릿 내용과 글자 하나까지 같아야 합니다. */
const TPL_VAR_NAME = '#{고객명}';
const TPL_VAR_PRODUCT = '#{상품명}';

const HEADERS = ['신청일시', '이름', '연락처', '상품명', '모델', '용량', '색상', '개인정보동의', '동의 시각', '알림톡'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const name = String(data.name || '').slice(0, 50);
    const phone = String(data.phone || '').slice(0, 30);
    const product = String(data.product || '').slice(0, 200);
    const model = String(data.model || '').slice(0, 100);
    const storage = String(data.storage || '').slice(0, 40);
    const color = String(data.color || '').slice(0, 40);
    const page = String(data.page || '').slice(0, 300);
    const consent = data.consent === true ? '동의' : '미동의';
    const consentTime = String(data.consentTime || '').slice(0, 50);
    const timestamp = new Date();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    // 알림톡을 먼저 보내고 그 결과를 같은 줄에 남긴다.
    // 실패해도 신청 자체는 반드시 기록되도록 안을 try 로 감싼다.
    let talkResult;
    try {
      talkResult = sendAlimtalk(name, phone, product);
    } catch (err) {
      talkResult = '오류: ' + err.message;
    }

    sheet.appendRow([timestamp, name, phone, product, model, storage, color, consent, consentTime, talkResult]);

    if (NOTIFY_EMAIL && NOTIFY_EMAIL.indexOf('@') > -1) {
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        '[U+ Pick] 사전예약 신청 - ' + (product || '상품 미지정'),
        '새로운 사전예약 신청이 접수되었습니다.\n\n' +
        '상품: ' + product + '\n' +
        '  └ 모델 ' + model + ' / 용량 ' + storage + ' / 색상 ' + color + '\n' +
        '이름: ' + name + '\n' +
        '연락처: ' + phone + '\n' +
        '신청 시간: ' + timestamp + '\n' +
        '알림톡: ' + talkResult + '\n' +
        '신청 페이지: ' + page
      );
    }

    return json({ result: 'success' });
  } catch (err) {
    return json({ result: 'error', message: err.message });
  }
}

/**
 * 카카오 알림톡 발송.
 * 성공/실패 사유를 문자열로 돌려주고, 그 값이 시트 마지막 칸에 기록된다.
 * 예전에는 실패해도 아무 흔적이 안 남아 문제를 알 수 없었다.
 */
function sendAlimtalk(name, phone, product) {
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) return '건너뜀 (API 키 미설정)';

  const now = new Date().toISOString();
  const salt = genRanHex(64);
  const signature = Utilities.computeHmacSha256Signature(now + salt, SOLAPI_API_SECRET)
    .reduce(function (str, chr) {
      chr = (chr < 0 ? chr + 256 : chr).toString(16);
      return str + (chr.length === 1 ? '0' : '') + chr;
    }, '');

  const payload = {
    messages: [{
      from: SOLAPI_SENDER_NUMBER,
      to: String(phone).replace(/[^0-9]/g, ''),
      kakaoOptions: {
        pfId: SOLAPI_PF_ID,
        templateId: SOLAPI_TEMPLATE_ID,
        variables: (function () {
          const v = {};
          v[TPL_VAR_NAME] = name;
          v[TPL_VAR_PRODUCT] = product || '문의 상품';
          return v;
        })()
      }
    }]
  };

  const res = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'HMAC-SHA256 apiKey=' + SOLAPI_API_KEY +
                     ', date=' + now + ', salt=' + salt + ', signature=' + signature
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code !== 200) return '실패 (' + code + ') ' + body.slice(0, 200);

  // 200 이어도 개별 건이 거절될 수 있으므로 결과 안을 들여다본다.
  try {
    const r = JSON.parse(body);
    if (r.failedMessageList && r.failedMessageList.length) {
      const f = r.failedMessageList[0];
      return '거절: ' + (f.statusMessage || f.statusCode || '사유 불명');
    }
  } catch (err) { /* 파싱 실패는 무시하고 성공으로 본다 */ }

  return '발송 성공';
}

/**
 * ▶ 연결이 잘 됐는지 확인하는 테스트.
 *   편집기 상단에서 함수를 testAlimtalk 으로 고른 뒤 [실행]을 누르세요.
 *   아래 번호를 본인 휴대폰 번호로 바꿔서 테스트하시면 됩니다.
 *   결과는 [실행 로그]에 나옵니다.
 */
function testAlimtalk() {
  const result = sendAlimtalk('홍길동', '01000000000', '아이폰 18 Pro');
  Logger.log(result);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function genRanHex(size) {
  let s = '';
  for (let i = 0; i < size; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
