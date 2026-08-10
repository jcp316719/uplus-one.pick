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

  function tryProvider(i) {
    if (settled) return;
    if (i >= PROVIDERS.length) {
      // 모든 조회 실패: 접속을 막지 않고 통과 (fail-open)
      onLoaded(revealBody);
      return;
    }
    var p = PROVIDERS[i];
    fetch(p.url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var cc = p.getCountry(data);
        if (!cc) { tryProvider(i + 1); return; }
        if (cc.toUpperCase() !== ALLOWED_COUNTRY) {
          showBlockScreen();
        } else {
          onLoaded(revealBody);
        }
      })
      .catch(function () { tryProvider(i + 1); });
  }

  // 안전장치: 4초 안에 어떤 API도 응답하지 않으면 통과 (사이트가 계속 하얗게 남지 않도록)
  setTimeout(function () { onLoaded(revealBody); }, 4000);

  tryProvider(0);
})();
