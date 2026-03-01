/**
 * shared/utils/html.js
 * HTML生成ユーティリティ（XSS対策・共通レイアウト）
 * 変更履歴: 2026-03-01 Phase2 実装
 */

/**
 * HTML エスケープ
 */
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 管理画面の共通レイアウトでラップした HtmlOutput を返す
 * @param {string} title
 * @param {string} bodyHtml
 * @param {Object} [user]
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function buildPage(title, bodyHtml, user) {
  var nav = user ? buildNav(user) : '';
  var html = '<!DOCTYPE html><html lang="ja"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + escHtml(title) + ' | EventGift Admin</title>'
    + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">'
    + '<style>'
    + 'body{padding-top:70px;background:#f8f9fa}'
    + '.navbar-brand{font-weight:700}'
    + '.table th{background:#343a40;color:#fff}'
    + '.badge-DRAFT{background:#6c757d}'
    + '.badge-PUBLISHED{background:#198754}'
    + '.badge-CLOSED{background:#dc3545}'
    + '.badge-PENDING{background:#ffc107;color:#000}'
    + '.badge-PAID{background:#198754}'
    + '.badge-CANCELED{background:#dc3545}'
    + '</style>'
    + '</head><body>'
    + nav
    + '<div class="container-fluid py-4">'
    + '<h2 class="mb-4">' + escHtml(title) + '</h2>'
    + bodyHtml
    + '</div>'
    + '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title + ' | EventGift Admin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
}

function buildNav(user) {
  var base = ScriptApp.getService().getUrl() + '?page=';
  var links = [
    ['dashboard',     '🏠 ダッシュボード'],
    ['eventList',     '📅 イベント'],
    ['performerList', '🎤 出演者'],
    ['productList',   '🌸 商品'],
    ['orderList',     '📦 注文'],
  ];
  if (user && user.role === 'ADMIN') {
    links.push(['userList',  '👤 ユーザー']);
    links.push(['auditLog',  '📋 監査ログ']);
  }
  var items = links.map(function(l) {
    return '<li class="nav-item"><a class="nav-link text-white" href="' + base + l[0] + '">' + l[1] + '</a></li>';
  }).join('');
  return '<nav class="navbar navbar-dark bg-dark fixed-top">'
    + '<div class="container-fluid">'
    + '<a class="navbar-brand" href="' + base + 'dashboard">🎁 EventGift Admin</a>'
    + '<ul class="navbar-nav flex-row gap-2">' + items + '</ul>'
    + '<span class="text-white small">' + escHtml(user ? user.displayName : '') + '</span>'
    + '</div></nav>';
}

/**
 * フォームの input/select 部品を生成するヘルパー群
 */
function inputText(name, label, value, required) {
  var req = required ? ' required' : '';
  return '<div class="mb-3">'
    + '<label class="form-label">' + escHtml(label) + (required ? ' <span class="text-danger">*</span>' : '') + '</label>'
    + '<input type="text" class="form-control" name="' + escHtml(name) + '" value="' + escHtml(value || '') + '"' + req + '>'
    + '</div>';
}

function inputTextarea(name, label, value, rows) {
  return '<div class="mb-3">'
    + '<label class="form-label">' + escHtml(label) + '</label>'
    + '<textarea class="form-control" name="' + escHtml(name) + '" rows="' + (rows || 3) + '">'
    + escHtml(value || '')
    + '</textarea></div>';
}

function inputSelect(name, label, options, selected, required) {
  var req = required ? ' required' : '';
  var opts = options.map(function(o) {
    var sel = String(o.value) === String(selected) ? ' selected' : '';
    return '<option value="' + escHtml(o.value) + '"' + sel + '>' + escHtml(o.label) + '</option>';
  }).join('');
  return '<div class="mb-3">'
    + '<label class="form-label">' + escHtml(label) + (required ? ' <span class="text-danger">*</span>' : '') + '</label>'
    + '<select class="form-select" name="' + escHtml(name) + '"' + req + '>' + opts + '</select>'
    + '</div>';
}

function inputCheckbox(name, label, checked) {
  return '<div class="mb-3 form-check">'
    + '<input type="checkbox" class="form-check-input" name="' + escHtml(name) + '" id="chk_' + escHtml(name) + '"' + (checked ? ' checked' : '') + '>'
    + '<label class="form-check-label" for="chk_' + escHtml(name) + '">' + escHtml(label) + '</label>'
    + '</div>';
}

function inputNumber(name, label, value, required, min) {
  var req = required ? ' required' : '';
  return '<div class="mb-3">'
    + '<label class="form-label">' + escHtml(label) + (required ? ' <span class="text-danger">*</span>' : '') + '</label>'
    + '<input type="number" class="form-control" name="' + escHtml(name) + '" value="' + escHtml(value || 0) + '" min="' + (min || 0) + '"' + req + '>'
    + '</div>';
}

function inputDateTime(name, label, value) {
  return '<div class="mb-3">'
    + '<label class="form-label">' + escHtml(label) + '</label>'
    + '<input type="datetime-local" class="form-control" name="' + escHtml(name) + '" value="' + escHtml(value ? value.slice(0,16) : '') + '">'
    + '</div>';
}

function btnPrimary(label) {
  return '<button type="submit" class="btn btn-primary">' + escHtml(label) + '</button> ';
}

function btnLink(href, label, cls) {
  return '<a href="' + escHtml(href) + '" class="btn ' + (cls || 'btn-secondary') + '">' + escHtml(label) + '</a> ';
}

function alertSuccess(msg) {
  return '<div class="alert alert-success">' + escHtml(msg) + '</div>';
}

function alertDanger(msg) {
  return '<div class="alert alert-danger">' + escHtml(msg) + '</div>';
}

function statusBadge(status) {
  return '<span class="badge badge-' + escHtml(status) + '">' + escHtml(status) + '</span>';
}

/**
 * GAS doPost 向けフォーム: アクション名と隠しフィールドを含むフォームを生成
 */
function openForm(action, hiddens) {
  var url = ScriptApp.getService().getUrl();
  var h = '<form method="POST" action="' + url + '">'
    + '<input type="hidden" name="action" value="' + escHtml(action) + '">';
  if (hiddens) {
    Object.keys(hiddens).forEach(function(k) {
      h += '<input type="hidden" name="' + escHtml(k) + '" value="' + escHtml(hiddens[k]) + '">';
    });
  }
  return h;
}

function closeForm() { return '</form>'; }
