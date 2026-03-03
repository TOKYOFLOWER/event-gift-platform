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
  var contents    = (postData.contents  || '');
  var action      = params.action || '';

  // ── [1] GMO-PG 結果通知プログラム（form-encoded POST, OrderID あり）──
  // リンクタイプPlus は結果通知を form-encoded で POST する。
  // 正常応答 = '0'、異常応答 = 'NG'
  if (params.OrderID) {
    try {
      var result = handleGmoNotification(params);
      return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      Logger.log('GMO notify error: ' + err.message);
      return ContentService.createTextOutput('NG').setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // ── [2] その他の POST（後方互換用）──────────────────────────
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
