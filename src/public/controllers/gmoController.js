/**
 * src/public/controllers/gmoController.js
 * GMO-PG リンクタイプPlus 連携
 *
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装（リンクタイプPlus）
 *   2026-03-02 Phase4 JSON API化
 *   2026-03-02 Phase5 OpenAPIタイプ v1.12.0 対応
 *   2026-03-03 Phase6 リンクタイプPlus（リダイレクト方式）に戻す
 *     - フロントにカード入力フォームを持たない
 *     - GAS で GetLinkplusUrlPayment.json を呼び決済 URL を取得
 *     - フロントは取得した URL にリダイレクトするだけ
 *     - 結果通知プログラム（doPost）で PENDING → PAID 確定
 *
 * セキュリティ注意: カード情報・個人情報を絶対にログ出力しない
 */

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

var GMO_LINKPLUS_TEST = 'https://pt01.mul-pay.jp';
var GMO_LINKPLUS_PROD = 'https://p01.mul-pay.jp';

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

  // ── GMO リンクタイプPlus 決済URL取得 ──────────────────────
  var linkUrl;
  try {
    linkUrl = getGmoLinkPlusUrl(order, params.returnBaseUrl);
  } catch (err) {
    // 決済URL取得失敗 → 注文をキャンセルして例外を再スロー
    try { updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED }); } catch (_) {}
    Logger.log('GMO LinkPlus error: ' + err.message);
    throw new Error('決済サービスへの接続に失敗しました。しばらくしてから再度お試しください。');
  }

  // ── フロントエンドへ返す ─────────────────────────────────────
  return {
    orderId:     order.orderId,
    gmoOrderId:  order.gmoOrderId,
    redirectUrl: linkUrl
  };
}

// ─────────────────────────────────────────────
// GMO リンクタイプPlus 決済URL取得
// ─────────────────────────────────────────────

/**
 * GMO-PG GetLinkplusUrlPayment.json を呼び、決済ページURLを返す。
 *
 * @param {Object} order          - createOrder() の戻り値
 * @param {string} returnBaseUrl  - フロントエンドのベース URL
 * @returns {string} GMO-PG 決済ページ URL
 */
function getGmoLinkPlusUrl(order, returnBaseUrl) {
  var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
  var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);
  var configId = getScriptProperty(PROP.GMO_CONFIG_ID);
  if (!shopId || !shopPass) throw new Error('GMO_SHOP_ID / GMO_SHOP_PASS が未設定です');
  if (!configId) throw new Error('GMO_CONFIG_ID が未設定です');

  var env     = getScriptProperty(PROP.APP_ENV);
  var apiBase = getScriptProperty(PROP.GMO_API_ENDPOINT)
                || (env === 'production' ? GMO_LINKPLUS_PROD : GMO_LINKPLUS_TEST);

  var endpoint = apiBase + '/payment/GetLinkplusUrlPayment.json';

  // 結果通知URL（GAS Public doPost）
  var notifyUrl = ScriptApp.getService().getUrl();

  // 戻り先URL
  var thankYouUrl    = buildThankYouUrl_(order, returnBaseUrl);
  var cancelUrl      = buildCancelUrl_(order, returnBaseUrl);

  var payload = {
    geturlparam: {
      ShopID:   shopId,
      ShopPass: shopPass
    },
    configid: configId,
    transaction: {
      OrderID:         order.gmoOrderId,
      Amount:          String(order.totalJPY),
      Tax:             '0'
    },
    credit: {
      JobCd:  'CAPTURE',
      Method: '1'
    },
    // 結果通知プログラムURL（GMO管理画面でも設定可能だが、APIでも指定できる）
    resultnotify: {
      NotifyUrl: notifyUrl
    },
    // 購入者の戻り先
    displayinfo: {
      ReturnUrl: thankYouUrl,
      CancelUrl: cancelUrl
    }
  };

  var options = {
    method:             'post',
    contentType:        'application/json;charset=utf-8',
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(endpoint, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText('UTF-8');

  Logger.log('GMO LinkPlus GetUrl HTTP ' + code);

  if (code < 200 || code >= 300) {
    Logger.log('GMO LinkPlus error body: ' + body.slice(0, 500));
    throw new Error('GMO-PG API error HTTP ' + code);
  }

  var result = {};
  try { result = JSON.parse(body); } catch (_) {
    throw new Error('GMO-PG API から不正なレスポンスを受け取りました');
  }

  if (result.ErrCode) {
    Logger.log('GMO LinkPlus ErrCode=' + result.ErrCode + ' ErrInfo=' + result.ErrInfo);
    throw new Error('GMO-PG エラー: ' + result.ErrCode + ' ' + (result.ErrInfo || ''));
  }

  if (!result.LinkUrl) {
    throw new Error('GMO-PG から決済URLが返されませんでした');
  }

  return result.LinkUrl;
}

// ─────────────────────────────────────────────
// 結果通知ハンドラ（doPost から呼ばれる）
// ─────────────────────────────────────────────

/**
 * GMO-PG リンクタイプPlus 結果通知プログラム（form-encoded POST）。
 * doPost(e) から params.OrderID がある場合に呼ばれる。
 *
 * セキュリティ:
 *   - ShopID 検証
 *   - OrderID 存在確認
 *   - 金額照合
 *   - 冪等性チェック（既に PAID なら重複無視）
 *
 * @param {Object} params - e.parameter
 * @returns {string} '0'（正常）or 'NG'（異常）
 */
function handleGmoNotification(params) {
  try {
    if (!params.OrderID || !params.Status) {
      Logger.log('GMO notify: missing OrderID or Status');
      return 'NG';
    }

    // ShopID 検証（なりすまし対策）
    var shopId = getScriptProperty(PROP.GMO_SHOP_ID);
    if (params.ShopID && params.ShopID !== shopId) {
      Logger.log('GMO notify: invalid ShopID');
      return 'NG';
    }

    var order = findOrderByGmoOrderId(params.OrderID);
    if (!order) {
      Logger.log('GMO notify: order not found for ' + params.OrderID);
      return 'NG';
    }

    // 冪等性チェック: 既に PAID なら重複通知として正常応答
    if (order.paymentStatus === PAYMENT_STATUS.PAID) return '0';

    // 金額照合
    if (params.Amount && String(params.Amount) !== String(order.totalJPY)) {
      Logger.log('GMO notify: amount mismatch. expected=' + order.totalJPY + ' got=' + params.Amount);
      return 'NG';
    }

    if (params.Status === 'CAPTURE' || params.Status === 'SALES') {
      // 決済成功
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

      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED', ENTITY_TYPE.ORDER, order.orderId,
        { paymentStatus: PAYMENT_STATUS.PENDING },
        { paymentStatus: PAYMENT_STATUS.PAID });

    } else if (params.Status === 'CANCEL' || params.Status === 'RETURN') {
      updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
      writeAuditLog('SYSTEM', 'PAYMENT_CANCELED', ENTITY_TYPE.ORDER, order.orderId,
        {}, { status: params.Status });
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
 */
function buildThankYouUrl_(order, returnBaseUrl) {
  var base = returnBaseUrl
    ? returnBaseUrl.replace(/\/$/, '')
    : ScriptApp.getService().getUrl();
  return base + '/thank-you.html?gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
}

/**
 * payment-cancel.html の完全 URL を組み立てる。
 */
function buildCancelUrl_(order, returnBaseUrl) {
  var base = returnBaseUrl
    ? returnBaseUrl.replace(/\/$/, '')
    : ScriptApp.getService().getUrl();
  return base + '/payment-cancel.html?gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
}
