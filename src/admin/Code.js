/**
 * src/admin/Code.js
 * Admin REST API エントリポイント（Googleログイン必須）
 * 変更履歴:
 *   2026-03-01 Phase1 スタブ作成
 *   2026-03-01 Phase2 doGet/doPost HTML実装
 *   2026-03-02 Phase4 REST API化（HTMLレスポンス廃止）
 *   2026-03-02 Phase4b CORS回避: JSONP対応 + _m=post + _token認証
 *
 * CORS 回避策:
 *   フロントエンドは全リクエストを JSONP（script タグ）で送信する。
 *   POST 操作は ?_m=post を付けて doGet 経由で処理する。
 *   認証は ?_token=<GoogleAccessToken> で行い、Google tokeninfo API で検証する。
 */

// ─────────────────────────────────────────────
// エントリポイント
// ─────────────────────────────────────────────

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || '';

  try {
    // _token または Session でユーザーを解決
    var user = requireRole([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.PERFORMER], params);

    var data;
    if (params._m === 'post') {
      // JSONP 経由の POST 操作（?_m=post が付いている場合）
      data = routePost(action, params, user);
    } else {
      data = routeGet(action, params, user);
    }

    return jsonOk(data, params.callback);
  } catch (err) {
    return jsonError(err, params.callback);
  }
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || '';

  // GMO-PG 結果通知（action なし & OrderID あり）は認証不要
  if (!action && params.OrderID) {
    try {
      var result = handleGmoNotification(params);
      return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      return ContentService.createTextOutput('NG').setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // 通常 POST（将来の後方互換用 — 現在は doGet 経由 JSONP が主）
  try {
    var user = requireRole([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.PERFORMER], params);

    var body = {};
    if (e && e.postData && e.postData.type === 'application/json') {
      try { body = JSON.parse(e.postData.contents); } catch (_) {}
    }
    var merged = Object.assign({}, body, params);

    var data = routePost(action, merged, user);
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

  if (msg === 'LOGIN_REQUIRED')  { status = 401; code = 'LOGIN_REQUIRED'; }
  if (msg === 'ACCESS_DENIED')   { status = 403; code = 'ACCESS_DENIED'; }
  if (msg === 'FORBIDDEN')       { status = 403; code = 'FORBIDDEN'; }
  if (msg === 'NOT_FOUND')       { status = 404; code = 'NOT_FOUND'; }
  if (msg === 'BAD_REQUEST')     { status = 400; code = 'BAD_REQUEST'; }

  // エラーの場合はスタック以外をログ（個人情報漏洩防止）
  Logger.log('[Admin API Error] code=' + code + ' msg=' + msg);

  var payload = JSON.stringify({ ok: false, error: { code: code, message: msg }, status: status });
  if (callback) {
    payload = sanitizeCallback(callback) + '(' + payload + ')';
    return ContentService.createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

/** JSONP コールバック名のサニタイズ（XSS対策） */
function sanitizeCallback(cb) {
  return String(cb).replace(/[^a-zA-Z0-9_.]/g, '');
}
