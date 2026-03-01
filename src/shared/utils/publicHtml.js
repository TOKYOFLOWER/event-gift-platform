/**
 * shared/utils/publicHtml.js
 * 公開WebApp向け HTML レイアウト・コンポーネント（Bootstrap5・レスポンシブ）
 * 変更履歴: 2026-03-02 Phase3 実装
 */

/**
 * 公開サイト共通レイアウトでラップした HtmlOutput を返す
 * @param {string} title
 * @param {string} bodyHtml
 * @param {Object} [opts]  - { ogDescription, ogImage }
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildPublicPage(title, bodyHtml, opts) {
  opts = opts || {};
  var siteTitle = 'FlowerGift - イベント差し入れ';
  var baseUrl   = ScriptApp.getService().getUrl();

  var head = '<!DOCTYPE html><html lang="ja"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + escHtml(title) + ' | ' + siteTitle + '</title>'
    + '<meta name="description" content="' + escHtml(opts.ogDescription || 'イベントへ花の差し入れを贈ろう') + '">'
    + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">'
    + '<style>'
    + ':root{--brand:#c0392b;--brand-light:#f9ebea}'
    + 'body{background:#fff;color:#222;font-family:"Helvetica Neue",Arial,sans-serif}'
    + '.navbar-brand{font-weight:800;color:var(--brand)!important;font-size:1.4rem}'
    + '.hero{background:linear-gradient(135deg,var(--brand) 0%,#922b21 100%);color:#fff;padding:3rem 1rem}'
    + '.hero h1{font-weight:800}'
    + '.event-card{border:none;box-shadow:0 2px 12px rgba(0,0,0,.08);transition:.2s}'
    + '.event-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,.15)}'
    + '.performer-card{background:#fafafa;border-radius:12px;padding:1rem;text-align:center}'
    + '.performer-avatar{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--brand)}'
    + '.performer-avatar-placeholder{width:80px;height:80px;border-radius:50%;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto}'
    + '.product-card{border:2px solid transparent;border-radius:12px;cursor:pointer;transition:.2s}'
    + '.product-card.selected,.product-card:hover{border-color:var(--brand);background:var(--brand-light)}'
    + '.product-img{width:100%;height:180px;object-fit:cover;border-radius:8px}'
    + '.gift-btn{background:var(--brand);color:#fff;border:none;border-radius:30px;padding:.6rem 1.6rem;font-weight:700}'
    + '.gift-btn:hover{background:#922b21;color:#fff}'
    + '.status-badge{display:inline-block;padding:.3em .8em;border-radius:20px;font-size:.8rem;font-weight:700}'
    + '.badge-PAID{background:#d5f5e3;color:#1e8449}'
    + '.badge-PENDING{background:#fef9e7;color:#b7950b}'
    + '.section-title{font-weight:800;font-size:1.4rem;border-left:4px solid var(--brand);padding-left:.8rem;margin:2rem 0 1rem}'
    + 'footer{background:#222;color:#aaa;padding:2rem 1rem;margin-top:4rem}'
    + '@media(max-width:576px){.hero{padding:2rem .5rem}.hero h1{font-size:1.6rem}}'
    + '</style>'
    + '</head><body>';

  var nav = '<nav class="navbar navbar-light bg-white border-bottom sticky-top">'
    + '<div class="container">'
    + '<a class="navbar-brand" href="' + baseUrl + '">🌸 FlowerGift</a>'
    + '<a href="' + baseUrl + '?page=orderInquiry" class="btn btn-outline-secondary btn-sm">注文照会</a>'
    + '</div></nav>';

  var footer = '<footer><div class="container">'
    + '<p class="mb-1">🌸 FlowerGift — イベントへ想いを届ける差し入れプラットフォーム</p>'
    + '<p class="small mb-0">© 2026 FlowerGift. Powered by Google Apps Script.</p>'
    + '</div></footer>';

  var scripts = '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>'
    + '</body></html>';

  return HtmlService.createHtmlOutput(head + nav + '<main>' + bodyHtml + '</main>' + footer + scripts)
    .setTitle(title + ' | ' + siteTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 公開フォーム（action=doPost URL） */
function openPublicForm(hiddens) {
  var url = ScriptApp.getService().getUrl();
  var h   = '<form method="POST" action="' + url + '" id="mainForm">';
  if (hiddens) {
    Object.keys(hiddens).forEach(function(k) {
      h += '<input type="hidden" name="' + escHtml(k) + '" value="' + escHtml(hiddens[k]) + '">';
    });
  }
  return h;
}

/** JST 表示用日時整形 */
function formatDateJST(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d)) return String(isoStr).slice(0, 16);
  // UTC+9
  var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  var y   = jst.getUTCFullYear();
  var mo  = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  var dy  = ('0' + jst.getUTCDate()).slice(-2);
  var h   = ('0' + jst.getUTCHours()).slice(-2);
  var mi  = ('0' + jst.getUTCMinutes()).slice(-2);
  return y + '年' + mo + '月' + dy + '日 ' + h + ':' + mi;
}

function formatDateOnlyJST(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d)) return String(isoStr).slice(0, 10);
  var jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  var y   = jst.getUTCFullYear();
  var mo  = ('0' + (jst.getUTCMonth() + 1)).slice(-2);
  var dy  = ('0' + jst.getUTCDate()).slice(-2);
  var days = ['日','月','火','水','木','金','土'];
  var dow  = days[jst.getUTCDay()];
  return y + '年' + mo + '月' + dy + '日（' + dow + '）';
}
