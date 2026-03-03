/**
 * src/public/Code.js
 * Public REST API エントリポイント（認証不要）
 * 変更履歴:
 *   2026-03-01 Phase1 スタブ
 *   2026-03-02 Phase3 HTML実装
 *   2026-03-02 Phase4 REST API化
 *   2026-03-02 Phase4b CORS回避: JSONP対応 + _m=post
 *   2026-03-03 Phase7 OpenAPIタイプ Webhook対応
 *
 * CORS 回避策:
 *   GET  → JSONP（?callback=cbName）
 *   POST → ?_m=post を付けた JSONP GET として doGet で処理
 *   GMO-PG Webhook は doPost で JSON / TEXT 応答
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
  var contentType = (postData.type      || '');
  var action      = params.action || '';

  // ── [1] GMO OpenAPI Webhook（JSON POST, event フィールドあり）──
  if (contentType === 'application/json' && !action) {
    try {
      var jsonBody = JSON.parse(contents);
      if (jsonBody.event) {
        var webhookResult = handleGmoWebhook(jsonBody);
        return ContentService.createTextOutput(webhookResult)
          .setMimeType(ContentService.MimeType.TEXT);
      }
    } catch (err) {
      Logger.log('GMO webhook error: ' + err.message);
      return ContentService.createTextOutput('OK')
        .setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // ── [2] GMO LinkPlus 結果通知（form-encoded POST, OrderID あり）──
  // 後方互換: form-encoded の結果通知にも対応
  if (params.OrderID) {
    try {
      var notifyResult = handleGmoNotification(params);
      return ContentService.createTextOutput(notifyResult)
        .setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      Logger.log('GMO notify error: ' + err.message);
      return ContentService.createTextOutput('NG')
        .setMimeType(ContentService.MimeType.TEXT);
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

// ─────────────────────────────────────────────
// LinkPlus 後方互換: form-encoded 結果通知
// ─────────────────────────────────────────────

function handleGmoNotification(params) {
  try {
    if (!params.OrderID || !params.Status) return 'NG';

    var shopId = getScriptProperty(PROP.GMO_SHOP_ID);
    if (params.ShopID && params.ShopID !== shopId) return 'NG';

    var order = findOrderByGmoOrderId(params.OrderID);
    if (!order) return 'NG';

    if (order.paymentStatus === PAYMENT_STATUS.PAID) return '0';

    if (params.Amount && String(params.Amount) !== String(order.totalJPY)) return 'NG';

    if (params.Status === 'CAPTURE' || params.Status === 'SALES') {
      updateOrderPayment(order.orderId, {
        paymentStatus: PAYMENT_STATUS.PAID,
        gmoAccessId:   params.AccessID || '',
        gmoTranId:     params.TranID   || '',
        paidAt:        nowISO()
      });
      try {
        sendOrderConfirmationEmail(order);
        sendNewOrderNotificationToAdmin(order);
      } catch (_) {}
    } else if (params.Status === 'CANCEL' || params.Status === 'RETURN') {
      updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
    }
    return '0';
  } catch (err) {
    Logger.log('handleGmoNotification error: ' + err.message);
    return 'NG';
  }
}
