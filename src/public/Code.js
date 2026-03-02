/**
 * src/public/Code.js
 * Public REST API エントリポイント（認証不要）
 * 変更履歴:
 *   2026-03-01 Phase1 スタブ
 *   2026-03-02 Phase3 HTML実装
 *   2026-03-02 Phase4 REST API化
 *   2026-03-02 Phase4b CORS回避: JSONP対応 + _m=post
 *
 * CORS 回避策:
 *   GET  → JSONP（?callback=cbName）
 *   POST → ?_m=post を付けた JSONP GET として doGet で処理
 *   GMO-PG 結果通知のみ doPost で TEXT 応答を維持
 */

// ─────────────────────────────────────────────
// エントリポイント
// ─────────────────────────────────────────────

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || '';

  try {
    var data;
    if (params._m === 'post') {
      // JSONP 経由の POST 操作
      data = routePost(action, params);
    } else {
      data = routeGet(action, params);
    }
    return jsonOk(data, params.callback);
  } catch (err) {
    return jsonError(err, params.callback);
  }
}

function doPost(e) {
  var params      = (e && e.parameter)  || {};
  var postData    = (e && e.postData)   || {};
  var contentType = (postData.type      || '').toLowerCase();
  var contents    = (postData.contents  || '');
  var action      = params.action || '';

  // ── [1] GMO OpenAPI Webhook（application/json POST）──────────
  // GMO-PG OpenAPIタイプは Webhook を JSON で送信する。
  // GAS は 2xx を返せば OK（レスポンスボディは任意）。
  if (contentType.indexOf('application/json') !== -1 && contents) {
    try {
      var webhookBody = JSON.parse(contents);
      handleGmoWebhook(webhookBody);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      Logger.log('GMO webhook parse/handle error: ' + err.message);
      // GMO への応答は 200 を返す（再試行ループを防ぐ）
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── [2] GMO 旧プロトコルタイプ通知（form-encoded & OrderID あり）──
  // OpenAPIタイプに完全移行後は不要になるが、後方互換として残す。
  if (params.OrderID) {
    try {
      var result = handleGmoNotification(params);
      return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      Logger.log('GMO notify (legacy) error: ' + err.message);
      return ContentService.createTextOutput('NG').setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // ── [3] その他の POST（後方互換用）──────────────────────────
  try {
    var body = {};
    try { body = JSON.parse(contents); } catch (_) {}
    var merged = Object.assign({}, body, params);
    var data = routePost(action, merged);
    return jsonOk(data, params.callback);
  } catch (err) {
    return jsonError(err, params.callback);
  }
}

// ─────────────────────────────────────────────
// JSON / JSONP レスポンスヘルパー
// ─────────────────────────────────────────────

function jsonOk(data, callback) {
  var payload = JSON.stringify({ ok: true, data: data });
  if (callback) {
    payload = sanitizeCallback(callback) + '(' + payload + ')';
    return ContentService.createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(err, callback) {
  var status = 500;
  var code   = 'INTERNAL_ERROR';
  var msg    = err.message || 'Internal error';

  if (msg === 'NOT_FOUND')   { status = 404; code = 'NOT_FOUND'; }
  if (msg === 'BAD_REQUEST') { status = 400; code = 'BAD_REQUEST'; }
  if (msg === 'CLOSED')      { status = 410; code = 'CLOSED'; }

  Logger.log('[Public API Error] code=' + code + ' msg=' + msg);

  var payload = JSON.stringify({ ok: false, error: { code: code, message: msg }, status: status });
  if (callback) {
    payload = sanitizeCallback(callback) + '(' + payload + ')';
    return ContentService.createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeCallback(cb) {
  return String(cb).replace(/[^a-zA-Z0-9_.]/g, '');
}
