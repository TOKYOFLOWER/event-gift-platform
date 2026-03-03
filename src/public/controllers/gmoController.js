/**
 * src/public/controllers/gmoController.js
 * GMO-PG OpenAPIタイプ 連携（トークン決済）
 *
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装（リンクタイプPlus）
 *   2026-03-03 Phase7 OpenAPIタイプ（トークン方式）に変更
 *     - フロントで token.js によりカード情報をトークン化
 *     - GAS で /credit/charge API（Basic認証）を呼び即時決済
 *     - 3DS リダイレクトにも対応
 *
 * セキュリティ注意: カード情報・個人情報を絶対にログ出力しない
 */

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

var GMO_OPENAPI_TEST = 'https://stg.openapi.mul-pay.jp';
var GMO_OPENAPI_PROD = 'https://openapi.mul-pay.jp';

// ─────────────────────────────────────────────
// ShopID 取得 API
// ─────────────────────────────────────────────

/**
 * GET ?action=getShopId
 * フロントエンドの token.js 初期化用に ShopID を返す。
 */
function apiGetShopId() {
  var shopId = getScriptProperty(PROP.GMO_SHOP_ID);
  if (!shopId) throw new Error('GMO_SHOP_ID が未設定です');
  return { shopId: shopId };
}

// ─────────────────────────────────────────────
// 注文作成 API
// ─────────────────────────────────────────────

/**
 * POST ?action=createOrder (_m=post)
 *
 * フロントエンドから受け取るパラメータ:
 *   eventId, performerId, productId,
 *   buyerName, buyerEmail, buyerPhone,
 *   messageToPerformer, isMessagePublic, isAnonymous,
 *   gmoToken      : token.js で取得したカードトークン
 *   returnBaseUrl : フロントエンドのベース URL
 *
 * レスポンス: { orderId, gmoOrderId, status, redirectUrl? }
 */
function apiCreatePublicOrder(params) {
  // ── バリデーション ──────────────────────────────────────────
  if (!params.eventId)     throw badRequest('イベントが指定されていません');
  if (!params.performerId) throw badRequest('出演者が指定されていません');
  if (!params.productId)   throw badRequest('商品が指定されていません');
  if (!params.buyerEmail)  throw badRequest('メールアドレスを入力してください');
  if (!params.gmoToken)    throw badRequest('カード情報の取得に失敗しました。再度お試しください');
  validateEmail(params.buyerEmail);

  // ── エンティティ取得 ────────────────────────────────────────
  var product = findProductById(params.productId);
  if (!product || !product.isActive) throw notFound('商品が見つかりません');

  var ev = findEventById(params.eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  if (normalizeStatus(ev.status) !== EVENT_STATUS.PUBLISHED) throw notFound('イベントが見つかりません');

  var now = new Date();
  if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) <= now) {
    throw closedError('差し入れの受付期間が終了しています');
  }

  // ── 受取先解決（未設定なら会場受取をデフォルト作成）───────────
  var receiver = getDefaultReceiverForEvent(params.eventId);
  if (!receiver) {
    receiver = createReceiver({
      eventId:      params.eventId,
      receiveType:  RECEIVE_TYPE.VENUE,
      shippingName: ev.title || ''
    });
  }

  // ── Orders シートに PENDING で登録 ──────────────────────────
  var order = createOrder({
    eventId:            params.eventId,
    organizerId:        ev.organizerId,
    performerId:        params.performerId,
    receiverId:         receiver.receiverId,
    productId:          product.productId,
    qty:                1,
    unitPriceJPY:       Number(product.priceJPY),
    buyerName:          params.buyerName           || '',
    buyerEmail:         params.buyerEmail,
    buyerPhone:         params.buyerPhone          || '',
    messageToPerformer: params.messageToPerformer  || '',
    isMessagePublic: params.isMessagePublic === true
                     || params.isMessagePublic === 'true'
                     || params.isMessagePublic === 'on',
    isAnonymous:     params.isAnonymous === true
                     || params.isAnonymous === 'true'
                     || params.isAnonymous === 'on'
  });

  // ── GMO OpenAPI /credit/charge ──────────────────────────────
  var chargeResult;
  try {
    chargeResult = callGmoOpenApiCharge(order, params.gmoToken, params.returnBaseUrl);
  } catch (err) {
    try { updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED }); } catch (_) {}
    Logger.log('GMO charge error: ' + err.message);
    throw new Error('決済処理に失敗しました。カード情報を確認のうえ再度お試しください。');
  }

  // ── レスポンス ──────────────────────────────────────────────
  if (chargeResult.redirectUrl) {
    // 3DS 認証が必要 → フロントでリダイレクト
    return {
      orderId:     order.orderId,
      gmoOrderId:  order.gmoOrderId,
      status:      'REDIRECT',
      redirectUrl: chargeResult.redirectUrl
    };
  }

  // 即時決済成功 → PAID に更新
  updateOrderPayment(order.orderId, {
    paymentStatus: PAYMENT_STATUS.PAID,
    gmoAccessId:   chargeResult.accessId  || '',
    gmoTranId:     chargeResult.processId || '',
    paidAt:        nowISO()
  });

  try {
    sendOrderConfirmationEmail(order);
    sendNewOrderNotificationToAdmin(order);
  } catch (mailErr) {
    Logger.log('Mail error (non-fatal): ' + mailErr.message);
  }

  writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED', ENTITY_TYPE.ORDER, order.orderId,
    { paymentStatus: PAYMENT_STATUS.PENDING },
    { paymentStatus: PAYMENT_STATUS.PAID });

  return {
    orderId:     order.orderId,
    gmoOrderId:  order.gmoOrderId,
    status:      'CAPTURED'
  };
}

// ─────────────────────────────────────────────
// GMO OpenAPI /credit/charge
// ─────────────────────────────────────────────

/**
 * GMO-PG OpenAPI /credit/charge を呼ぶ。
 * Basic認証: ShopID:ShopPass
 *
 * @param {Object} order          - createOrder() の戻り値
 * @param {string} token          - フロントで取得したカードトークン
 * @param {string} returnBaseUrl  - フロントエンドのベース URL
 * @returns {{ processId?, accessId?, redirectUrl? }}
 */
function callGmoOpenApiCharge(order, token, returnBaseUrl) {
  var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
  var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);

  Logger.log('[GMO charge] shopId=' + (shopId || '(empty)') + ' shopPass=' + (shopPass ? '***set***' : '(empty)'));

  if (!shopId || !shopPass) throw new Error('GMO_SHOP_ID / GMO_SHOP_PASS が未設定です');

  var env     = getScriptProperty(PROP.APP_ENV);
  var apiBase = env === 'production' ? GMO_OPENAPI_PROD : GMO_OPENAPI_TEST;

  Logger.log('[GMO charge] env=' + (env || '(empty)') + ' apiBase=' + apiBase);

  var endpoint = apiBase + '/credit/charge';

  var callbackUrl = buildThankYouUrl_(order, returnBaseUrl);
  var webhookUrl  = ScriptApp.getService().getUrl();

  Logger.log('[GMO charge] endpoint=' + endpoint);
  Logger.log('[GMO charge] orderId=' + order.gmoOrderId + ' amount=' + order.totalJPY);
  Logger.log('[GMO charge] callbackUrl=' + callbackUrl);
  Logger.log('[GMO charge] webhookUrl=' + webhookUrl);
  Logger.log('[GMO charge] token length=' + (token ? token.length : 0));

  var payload = {
    merchant: {
      name:                '株式会社東京フラワー',
      nameKana:            'カブシキガイシャトウキョウフラワー',
      nameAlphabet:        'Tokyo Flower Co., Ltd.',
      nameShort:           'Tokyo Flower',
      contactName:         'カスタマーサポート',
      contactPhone:        '03-3561-5787',
      contactOpeningHours: '10:00-18:00',
      callbackUrl:         callbackUrl,
      webhookUrl:          webhookUrl
    },
    order: {
      orderId:         order.gmoOrderId,
      amount:          String(order.totalJPY),
      currency:        'JPY',
      transactionType: 'CIT'
    },
    payer: {
      name:  order.buyerName  || '',
      email: order.buyerEmail || ''
    },
    creditInformation: {
      tokenizedCard: {
        type:  'MP_TOKEN',
        token: token
      },
      creditChargeOptions: {
        authorizationMode: 'CAPTURE',
        paymentMethod:     'ONE_TIME'
      }
    }
  };

  // ペイロードログ（トークンはマスク）
  var logPayload = JSON.parse(JSON.stringify(payload));
  logPayload.creditInformation.tokenizedCard.token = '***masked***';
  Logger.log('[GMO charge] request payload: ' + JSON.stringify(logPayload));

  var auth = Utilities.base64Encode(shopId + ':' + shopPass);

  var options = {
    method:             'post',
    contentType:        'application/json;charset=utf-8',
    headers: {
      'Authorization':   'Basic ' + auth,
      'Idempotency-Key': order.gmoOrderId
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(endpoint, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText('UTF-8');

  // レスポンス全体をログ
  Logger.log('[GMO charge] HTTP ' + code + ' response: ' + body.slice(0, 1000));

  if (code < 200 || code >= 300) {
    var errBody = {};
    try { errBody = JSON.parse(body); } catch (_) {}
    var errDetail = errBody.detail || errBody.title || body.slice(0, 500);
    Logger.log('[GMO charge] ERROR detail=' + errDetail + ' type=' + (errBody.type || ''));
    throw new Error('GMO-PG 決済エラー (HTTP ' + code + '): ' + errDetail);
  }

  var result = {};
  try { result = JSON.parse(body); } catch (_) {
    Logger.log('[GMO charge] JSON parse failed: ' + body.slice(0, 500));
    throw new Error('GMO-PG API から不正なレスポンスを受け取りました');
  }

  Logger.log('[GMO charge] success keys: ' + Object.keys(result).join(','));

  // 3DS リダイレクトが必要な場合
  if (result.redirectUrl) {
    Logger.log('[GMO charge] 3DS redirect required');
    return { redirectUrl: result.redirectUrl };
  }

  // 即時決済成功
  var creditResult = result.creditResult || {};
  Logger.log('[GMO charge] CAPTURED processId=' + (creditResult.processId || '') + ' accessId=' + (result.accessId || ''));
  return {
    processId: creditResult.processId || '',
    accessId:  result.accessId || ''
  };
}

// ─────────────────────────────────────────────
// GMO OpenAPI Webhook ハンドラ（doPost から呼ばれる）
// ─────────────────────────────────────────────

/**
 * GMO-PG OpenAPI Webhook（JSON POST）。
 * 3DS 完了後の非同期通知を処理する。
 *
 * @param {Object} data - パースされた JSON ボディ
 * @returns {string} 'OK'
 */
function handleGmoWebhook(data) {
  try {
    var event    = data.event    || '';
    var accessId = data.accessId || '';
    var orderId  = data.orderId  || '';

    Logger.log('GMO webhook event=' + event + ' orderId=' + orderId);

    if (event !== 'TDS_CHARGE_FINISHED') {
      return 'OK';
    }

    var order = orderId ? findOrderByGmoOrderId(orderId) : null;
    if (!order) {
      Logger.log('GMO webhook: order not found for orderId=' + orderId);
      return 'OK';
    }

    // 冪等性チェック
    if (order.paymentStatus === PAYMENT_STATUS.PAID) return 'OK';

    // /order/inquiry で最終ステータスを確認
    var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
    var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);
    var env     = getScriptProperty(PROP.APP_ENV);
    var apiBase = env === 'production' ? GMO_OPENAPI_PROD : GMO_OPENAPI_TEST;
    var auth = Utilities.base64Encode(shopId + ':' + shopPass);

    var inquiryResp = UrlFetchApp.fetch(apiBase + '/order/inquiry', {
      method:             'post',
      contentType:        'application/json;charset=utf-8',
      headers:            { 'Authorization': 'Basic ' + auth },
      payload:            JSON.stringify({ orderId: order.gmoOrderId }),
      muteHttpExceptions: true
    });

    var inquiryBody = {};
    try { inquiryBody = JSON.parse(inquiryResp.getContentText('UTF-8')); } catch (_) {}

    var status = inquiryBody.status || '';
    if (status === 'CAPTURE' || status === 'SALES') {
      updateOrderPayment(order.orderId, {
        paymentStatus: PAYMENT_STATUS.PAID,
        gmoAccessId:   inquiryBody.accessId || accessId,
        gmoTranId:     (inquiryBody.creditResult && inquiryBody.creditResult.processId) || '',
        paidAt:        nowISO()
      });

      try {
        sendOrderConfirmationEmail(order);
        sendNewOrderNotificationToAdmin(order);
      } catch (mailErr) {
        Logger.log('Mail error (non-fatal): ' + mailErr.message);
      }

      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED', ENTITY_TYPE.ORDER, order.orderId,
        { paymentStatus: PAYMENT_STATUS.PENDING },
        { paymentStatus: PAYMENT_STATUS.PAID });
    }

    return 'OK';
  } catch (err) {
    Logger.log('handleGmoWebhook error: ' + err.message);
    return 'OK';
  }
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

function buildThankYouUrl_(order, returnBaseUrl) {
  var base = returnBaseUrl
    ? returnBaseUrl.replace(/\/$/, '')
    : ScriptApp.getService().getUrl();
  return base + '/thank-you.html?gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
}
