/**
 * src/public/controllers/gmoController.js
 * GMO-PG マルチペイメントサービス OpenAPIタイプ v1.12.0 連携
 *
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装（リンクタイプPlus）
 *   2026-03-02 Phase4 JSON API化
 *   2026-03-02 Phase5 OpenAPIタイプ v1.12.0 対応
 *     - getGmoLinkPlusUrl を廃止し callGmoOpenApiCharge に完全置換
 *     - クレジット: /v1/credit/charge（Basic認証 + token.js トークン）
 *     - ウォレット: /v1/wallet/charge（PayPay 等）
 *     - Webhook: application/json POST → handleGmoWebhook
 *     - コールバック: GET ?p=<Base64URL JSON> → フロントで処理
 *
 * セキュリティ注意: カード情報・個人情報を絶対にログ出力しない
 */

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

var GMO_OPENAPI_TEST = 'https://stg.openapi.mul-pay.jp';
var GMO_OPENAPI_PROD = 'https://api.openapi.mul-pay.jp';

/** payType 値（フロントエンドから受け取る文字列） */
var PAY_TYPE_CREDIT = 'credit';
var PAY_TYPE_PAYPAY = 'paypay';

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
 *   payType   : 'credit' | 'paypay'（省略時 = 'credit'）
 *   gmoToken  : GMO token.js で取得したトークン（credit の場合必須）
 *   returnBaseUrl : フロントエンドのベース URL
 *
 * レスポンス: { orderId, gmoOrderId, redirectUrl }
 */
function apiCreatePublicOrder(params) {
  // ── バリデーション ──────────────────────────────────────────
  if (!params.eventId)     throw badRequest('eventId は必須です');
  if (!params.performerId) throw badRequest('performerId は必須です');
  if (!params.productId)   throw badRequest('productId は必須です');
  if (!params.buyerEmail)  throw badRequest('buyerEmail は必須です');
  validateEmail(params.buyerEmail);

  var payType = (params.payType || PAY_TYPE_CREDIT).toLowerCase();
  if (payType !== PAY_TYPE_CREDIT && payType !== PAY_TYPE_PAYPAY) {
    throw badRequest('payType は "credit" または "paypay" のみ有効です');
  }
  if (payType === PAY_TYPE_CREDIT && !params.gmoToken) {
    throw badRequest('クレジットカード決済には gmoToken が必須です');
  }

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

  // ── 受取先解決 ───────────────────────────────────────────────
  var receiver = getDefaultReceiverForEvent(params.eventId);
  if (!receiver) throw new Error('受取設定が完了していません。管理者にお問い合わせください。');

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

  // ── GMO OpenAPI 決済リクエスト ──────────────────────────────
  var chargeResult;
  try {
    chargeResult = callGmoOpenApiCharge(order, params.returnBaseUrl, payType, params.gmoToken);
  } catch (err) {
    // 決済リクエスト失敗 → 注文をキャンセルして例外を再スロー
    try { updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED }); } catch (_) {}
    Logger.log('GMO charge error: ' + err.message);
    throw new Error('決済サービスへの接続に失敗しました。しばらくしてから再度お試しください。');
  }

  // ── accessId をシートに保存 ─────────────────────────────────
  if (chargeResult.accessId) {
    updateOrderPayment(order.orderId, { gmoAccessId: chargeResult.accessId });
  }

  // ── 同期決済成功（非3DS）: 即時 PAID に更新 ─────────────────
  if (chargeResult.status === 'CAPTURE' && !chargeResult.redirectUrl) {
    updateOrderPayment(order.orderId, {
      paymentStatus: PAYMENT_STATUS.PAID,
      gmoAccessId:   chargeResult.accessId   || '',
      gmoTranId:     chargeResult.tranId      || chargeResult.tran_id || '',
      paidAt:        nowISO()
    });
    try {
      sendOrderConfirmationEmail(order);
      sendNewOrderNotificationToAdmin(order);
    } catch (mailErr) {
      Logger.log('Mail error (non-fatal): ' + mailErr.message);
    }
    writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED_SYNC', ENTITY_TYPE.ORDER, order.orderId,
      { paymentStatus: PAYMENT_STATUS.PENDING },
      { paymentStatus: PAYMENT_STATUS.PAID });
  }

  // ── フロントエンドへ返す ─────────────────────────────────────
  return {
    orderId:     order.orderId,
    gmoOrderId:  order.gmoOrderId,
    redirectUrl: chargeResult.redirectUrl || buildThankYouUrl_(order, params.returnBaseUrl)
  };
}

// ─────────────────────────────────────────────
// GMO OpenAPI 決済リクエスト
// ─────────────────────────────────────────────

/**
 * GMO-PG OpenAPI に決済リクエストを送り、結果を返す。
 *
 * @param {Object} order          - createOrder() の戻り値
 * @param {string} returnBaseUrl  - フロントエンドのベース URL（thank-you.html 用）
 * @param {string} payType        - 'credit' | 'paypay'
 * @param {string} [gmoToken]     - token.js で取得したカードトークン（credit のみ）
 * @returns {{ accessId, redirectUrl?, status?, tranId? }}
 */
function callGmoOpenApiCharge(order, returnBaseUrl, payType, gmoToken) {
  var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
  var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);
  if (!shopId || !shopPass) throw new Error('GMO_SHOP_ID / GMO_SHOP_PASS が未設定です');

  var env       = getScriptProperty(PROP.APP_ENV);
  var apiBase   = getScriptProperty(PROP.GMO_API_ENDPOINT)
                  || (env === 'production' ? GMO_OPENAPI_PROD : GMO_OPENAPI_TEST);

  // コールバック URL（フロントエンドの thank-you.html）
  var callbackUrl = buildThankYouUrl_(order, returnBaseUrl);

  // Webhook URL（GAS Public doPost）
  var notifyUrl = ScriptApp.getService().getUrl();

  // Basic 認証ヘッダー: Base64Encode(ShopID:ShopPassword)
  var credentials = Utilities.base64Encode(shopId + ':' + shopPass);

  var endpoint, payload;

  if (payType === PAY_TYPE_CREDIT) {
    // ── クレジットカード（token.js トークン方式）────────────────
    endpoint = apiBase + '/v1/credit/charge';
    payload  = {
      shopId:          shopId,
      orderId:         order.gmoOrderId,
      amount:          order.totalJPY,
      tax:             0,
      jobCode:         'CAPTURE',
      token:           gmoToken,
      callbackUrl:     callbackUrl,
      notifyUrl:       notifyUrl,
      // useThreeDSecure: true にすると 3DS フロー（redirectUrl が返る）
      // false にすると同期決済（テスト時は false が手軽）
      useThreeDSecure: (env === 'production')
    };
  } else {
    // ── ウォレット（PayPay 等）──────────────────────────────────
    endpoint = apiBase + '/v1/wallet/charge';
    payload  = {
      shopId:      shopId,
      orderId:     order.gmoOrderId,
      amount:      order.totalJPY,
      tax:         0,
      payType:     'Paypay',   // GMO 仕様: 先頭大文字
      callbackUrl: callbackUrl,
      notifyUrl:   notifyUrl
    };
  }

  var options = {
    method:             'post',
    contentType:        'application/json',
    headers: {
      'Authorization': 'Basic ' + credentials
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(endpoint, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText('UTF-8');

  Logger.log('GMO OpenAPI [' + endpoint.split('/').pop() + '] HTTP ' + code);

  if (code < 200 || code >= 300) {
    var errData = {};
    try { errData = JSON.parse(body); } catch (_) {}
    Logger.log('GMO OpenAPI error body: ' + body.slice(0, 500));
    throw new Error('GMO-PG API error ' + code + ': ' + (errData.message || errData.errCode || ''));
  }

  var result = {};
  try { result = JSON.parse(body); } catch (_) {
    throw new Error('GMO-PG API から不正なレスポンスを受け取りました');
  }

  // errCode があればエラー
  if (result.errCode) {
    Logger.log('GMO errCode=' + result.errCode + ' errInfo=' + result.errInfo);
    throw new Error('GMO-PG エラー: ' + result.errCode + ' ' + (result.errInfo || ''));
  }

  return result;  // { accessId, redirectUrl?, status?, tranId?, accessPass?, ... }
}

// ─────────────────────────────────────────────
// GMO Webhook ハンドラ（OpenAPI JSON POST）
// ─────────────────────────────────────────────

/**
 * GMO OpenAPI から送られてくる Webhook（application/json）を処理する。
 * doPost(e) から呼ばれる。
 *
 * Webhook ボディ例（クレジット）:
 *   { "orderId": "ORD-xxx", "accessId": "aaa", "event": "CREDIT_CAPTURE",
 *     "status": "CAPTURE", "amount": 5000 }
 *
 * Webhook ボディ例（PayPay）:
 *   { "orderId": "ORD-xxx", "accessId": "aaa", "event": "WALLET_PAID",
 *     "status": "PAYSUCCESS", "amount": 5000 }
 *
 * @param {Object} body - JSON.parse されたボディ
 */
function handleGmoWebhook(body) {
  try {
    var orderId = body.orderId || body.order_id;
    if (!orderId) {
      Logger.log('GMO webhook: missing orderId. body=' + JSON.stringify(body).slice(0, 200));
      return;
    }

    var order = findOrderByGmoOrderId(orderId);
    if (!order) {
      Logger.log('GMO webhook: order not found: ' + orderId);
      return;
    }

    // 冪等性チェック: 既に PAID なら重複通知として無視
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      Logger.log('GMO webhook: already PAID, ignoring duplicate for ' + orderId);
      return;
    }

    var event  = body.event  || '';
    var status = body.status || '';

    // 決済成功パターン（クレジット CAPTURE / ウォレット PAYSUCCESS）
    var isPaid = event === 'CREDIT_CAPTURE'
              || event === 'WALLET_PAID'
              || status === 'CAPTURE'
              || status === 'PAYSUCCESS'
              || status === 'SALES';

    // 金額照合（念のため）
    if (body.amount && Number(body.amount) !== Number(order.totalJPY)) {
      Logger.log('GMO webhook: amount mismatch. expected=' + order.totalJPY + ' got=' + body.amount);
      // 照合失敗は記録するが処理は続行（後で手動確認）
    }

    if (isPaid) {
      updateOrderPayment(order.orderId, {
        paymentStatus: PAYMENT_STATUS.PAID,
        gmoAccessId:   body.accessId   || body.access_id   || '',
        gmoTranId:     body.tranId     || body.tran_id     || '',
        paidAt:        nowISO()
      });

      try {
        sendOrderConfirmationEmail(order);
        sendNewOrderNotificationToAdmin(order);
      } catch (mailErr) {
        Logger.log('Mail error (non-fatal): ' + mailErr.message);
      }

      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED_WEBHOOK', ENTITY_TYPE.ORDER, order.orderId,
        { paymentStatus: PAYMENT_STATUS.PENDING },
        { paymentStatus: PAYMENT_STATUS.PAID, event: event });

      Logger.log('GMO webhook: PAID ' + orderId);

    } else if (event === 'CREDIT_CANCEL'
            || event === 'WALLET_CANCEL'
            || status === 'CANCEL') {
      updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
      writeAuditLog('SYSTEM', 'PAYMENT_CANCELED_WEBHOOK', ENTITY_TYPE.ORDER, order.orderId,
        {}, { event: event });
      Logger.log('GMO webhook: CANCELED ' + orderId);

    } else {
      Logger.log('GMO webhook: unhandled event=' + event + ' status=' + status + ' orderId=' + orderId);
    }

  } catch (err) {
    // 個人情報保護のため body をまるごとログしない
    Logger.log('handleGmoWebhook error: ' + err.message);
  }
}

// ─────────────────────────────────────────────
// 旧プロトコルタイプ結果通知（後方互換 — 非推奨）
// ─────────────────────────────────────────────

/**
 * GMO-PG 旧プロトコルタイプ（form-encoded POST）の結果通知。
 * doPost(e) から params.OrderID がある場合に呼ばれる後方互換ハンドラ。
 * OpenAPIタイプに完全移行後は削除可能。
 *
 * @param {Object} params - e.parameter
 * @returns {string} '0'（正常）or 'NG'（異常）
 */
function handleGmoNotification(params) {
  try {
    if (!params.OrderID || !params.Status) {
      Logger.log('GMO notify (legacy): missing OrderID or Status');
      return 'NG';
    }

    var shopId = getScriptProperty(PROP.GMO_SHOP_ID);
    if (params.ShopID && params.ShopID !== shopId) {
      Logger.log('GMO notify (legacy): invalid ShopID');
      return 'NG';
    }

    var order = findOrderByGmoOrderId(params.OrderID);
    if (!order) {
      Logger.log('GMO notify (legacy): order not found for ' + params.OrderID);
      return 'NG';
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) return '0';

    if (params.Amount && String(params.Amount) !== String(order.totalJPY)) {
      Logger.log('GMO notify (legacy): amount mismatch');
      return 'NG';
    }

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
      } catch (mailErr) {
        Logger.log('Mail error (non-fatal): ' + mailErr.message);
      }
      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED_LEGACY', ENTITY_TYPE.ORDER, order.orderId,
        { paymentStatus: PAYMENT_STATUS.PENDING }, { paymentStatus: PAYMENT_STATUS.PAID });
    } else if (params.Status === 'CANCEL') {
      updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
    }

    return '0';
  } catch (err) {
    Logger.log('handleGmoNotification error: ' + err.message);
    return 'NG';
  }
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

/**
 * thank-you.html の完全 URL を組み立てる。
 * GMO がこの URL に ?p=<base64url> を付加してリダイレクトする。
 */
function buildThankYouUrl_(order, returnBaseUrl) {
  var base = returnBaseUrl
    ? returnBaseUrl.replace(/\/$/, '')
    : ScriptApp.getService().getUrl();
  return base + '/thank-you.html?gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
}
