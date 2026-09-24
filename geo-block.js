/* ══════════════════════════════════════════════════════════════════
   유입 경로 기록
   손님이 어디를 거쳐 들어왔는지(네이버 검색 / 블로그 / 광고 / 인스타 등)를
   첫 방문 순간에 한 번 저장해 두고, 나중에 신청할 때 함께 보낸다.
   페이지를 옮겨 다녀도 처음 값이 유지된다.

   이 파일은 모든 페이지에 들어가므로 여기에 둔다.
   어느 페이지로 처음 들어오든 기록된다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'uplus_src';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { return; }

  var p = new URLSearchParams(location.search);
  var ref = document.referrer || '';
  var host = '';
  try { host = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch (e) {}

  var label = '';

  /* 1) 광고에서 온 경우 — 주소에 흔적이 남는다 */
  var utm = p.get('utm_source') || '';
  if (p.get('gclid')) label = '구글 광고';
  else if (p.get('fbclid')) label = '페이스북/인스타 광고';
  else if (p.get('n_media') || p.get('NaPm') || p.get('n_query')) label = '네이버 광고';
  else if (utm) {
    var u = utm.toLowerCase();
    if (u.indexOf('naver') > -1) label = '네이버 광고';
    else if (u.indexOf('google') > -1) label = '구글 광고';
    else if (u.indexOf('insta') > -1) label = '인스타그램';
    else if (u.indexOf('face') > -1) label = '페이스북';
    else if (u.indexOf('youtube') > -1 || u.indexOf('yt') === 0) label = '유튜브';
    else if (u.indexOf('kakao') > -1) label = '카카오';
    else if (u.indexOf('blog') > -1) label = '블로그';
    else label = utm;
  }

  /* 2) 광고 표시가 없으면 직전 페이지 주소로 판단한다 */
  if (!label && host) {
    if (host.indexOf('blog.naver') > -1) label = '네이버 블로그';
    else if (host.indexOf('cafe.naver') > -1) label = '네이버 카페';
    else if (host.indexOf('naver') > -1) label = '네이버 검색';
    else if (host.indexOf('daum') > -1 || host.indexOf('kakao') > -1) label = '다음/카카오';
    else if (host.indexOf('google') > -1) label = '구글 검색';
    else if (host.indexOf('youtube') > -1 || host.indexOf('youtu.be') > -1) label = '유튜브';
    else if (host.indexOf('instagram') > -1) label = '인스타그램';
    else if (host.indexOf('facebook') > -1) label = '페이스북';
    else if (host.indexOf('daangn') > -1) label = '당근마켓';
    else if (host.indexOf('uplus-one') > -1) label = '';           // 우리 사이트 내부 이동
    else label = host;                                             // 그 외는 주소 그대로
  }

  /* 3) 아무 흔적도 없으면 주소를 직접 입력했거나 즐겨찾기로 들어온 것 */
  if (!label) label = '직접 유입';

  var extra = [];
  if (p.get('utm_medium')) extra.push(p.get('utm_medium'));
  if (p.get('utm_campaign')) extra.push(p.get('utm_campaign'));
  if (extra.length) label += ' (' + extra.join(' / ') + ')';

  try {
    sessionStorage.setItem(KEY, label);
    sessionStorage.setItem(KEY + '_page', location.pathname.split('/').pop() || 'index.html');
  } catch (e) {}
})();

/* 저장해 둔 유입 경로를 돌려준다. 신청 폼에서 쓴다. */
function visitSource() {
  try {
    var s = sessionStorage.getItem('uplus_src') || '';
    var pg = sessionStorage.getItem('uplus_src_page') || '';
    return s + (pg ? ' · ' + pg : '');
  } catch (e) { return ''; }
}

/* geo-block.js — 해외 접속 안내 스크립트 (클라이언트 측 소프트 필터)
   - 방문자의 IP로 국가를 조회하여 대한민국(KR)이 아니면 안내 화면을 보여줍니다.
   - 자바스크립트를 끄거나 우회하면 통과될 수 있어 완전한 보안 차단은 아닙니다.
     더 확실한 차단이 필요하면 Cloudflare 등 서버/CDN 단 차단을 함께 사용하세요.
   - 국가 조회에 실패(네트워크 오류, API 장애 등)하면 사이트를 정상적으로 보여줍니다(fail-open).
   - 모든 페이지의 <head>에 이 스크립트를 동일하게 넣어야 각 페이지가 개별적으로 보호됩니다. */
(function () {
  var ALLOWED_COUNTRY = 'KR';
  var STYLE_ID = 'geo-block-hide-style';
  var settled = false;

  // 국가 판정이 끝나기 전까지 화면 깜빡임을 막기 위해 본문을 잠시 숨김
  var hideStyle = document.createElement('style');
  hideStyle.id = STYLE_ID;
  hideStyle.textContent = 'body{opacity:0 !important}';
  document.documentElement.appendChild(hideStyle);

  function removeHideStyle() {
    var s = document.getElementById(STYLE_ID);
    if (s) s.remove();
  }

  function revealBody() {
    if (settled) return;
    settled = true;
    removeHideStyle();
  }

  function showBlockScreen() {
    if (settled) return;
    settled = true;
    function render() {
      document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'text-align:center;padding:40px 20px;font-family:\'Apple SD Gothic Neo\',\'Noto Sans KR\',sans-serif;background:#fff;box-sizing:border-box;">' +
          '<div style="font-size:48px;margin-bottom:16px;">🚫</div>' +
          '<div style="font-size:18px;font-weight:800;color:#111;margin-bottom:10px;">이용하실 수 없는 접속 환경입니다</div>' +
          '<div style="font-size:14px;color:#666;line-height:1.7;">본 사이트는 대한민국 내에서만 이용 가능합니다.<br>문의사항은 카카오톡 또는 전화로 연락해 주세요.</div>' +
        '</div>';
      // hideStyle이 body{opacity:0 !important}로 걸려 있어 인라인 opacity로는 덮어쓸 수 없으므로 스타일 자체를 제거
      removeHideStyle();
    }
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render);
  }

  function onLoaded(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // 조회 API가 하나 실패해도 다음 API로 넘어가도록 순차 시도
  var PROVIDERS = [
    {
      url: 'https://ipapi.co/json/',
      getCountry: function (data) { return data && data.country_code; }
    },
    {
      url: 'https://api.country.is/',
      getCountry: function (data) { return data && data.country; }
    },
    {
      url: 'https://get.geojs.io/v1/ip/country.json',
      getCountry: function (data) { return data && data.country_code; }
    }
  ];

  /* 3곳을 "순차"가 아니라 "동시에" 물어본다.
     순차로 하면 첫 곳이 느릴 때 그 시간만큼 화면이 계속 하얗게 남는다.
     가장 먼저 답한 곳의 결과만 쓰고 나머지는 버린다. */
  function askAll() {
    var pending = PROVIDERS.length;
    PROVIDERS.forEach(function (p) {
      fetch(p.url, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (settled) return;
          var cc = p.getCountry(data);
          if (!cc) { if (--pending <= 0) onLoaded(revealBody); return; }
          if (cc.toUpperCase() !== ALLOWED_COUNTRY) showBlockScreen();
          else onLoaded(revealBody);
        })
        .catch(function () {
          // 모두 실패하면 막지 않고 통과 (fail-open)
          if (--pending <= 0) onLoaded(revealBody);
        });
    });
  }

  /* 내 PC에서 파일을 직접 열어 확인하는 경우(file://)는 국가 조회 자체가
     불가능해 무의미하게 기다리게 되므로 건너뛴다. 실제 사이트에는 영향 없음. */
  if (location.protocol === 'file:') {
    revealBody();
    return;
  }

  // 안전장치: 1.5초 안에 아무 곳도 답하지 않으면 통과 (화면이 계속 하얗게 남지 않도록)
  setTimeout(function () { onLoaded(revealBody); }, 1500);

  askAll();
})();
