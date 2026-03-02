/**
 * src/public/controllers/gmoController.js
 * GMO-PG リンクタイプPlus 連携 API
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装
 *   2026-03-02 Phase4 JSON API化
 *     - createOrderAndRedirect → apiCreatePublicOrder（JSONでリダイレクトURLを返す）
 *     - handleGmoNotification はそのまま維持（GMO仕様でテキスト応答）
 *
 * セキュリティ注意: このファイルはカード情報を絶対にログ出力しない
 */

var GMO_TEST_ENDPOINT  = 'https://pt01.mul-pay.jp/payment/GetLinkplusUrlPayment.json';
var GMO_PROD_ENDPOINT  = 'https://p01.mul-pay.jp/payment/GetLinkplusUrlPayment.json';

/**
 * POST ?action=createOrder
 * 注文を作成して GMO-PG の決済URL を取得し JSON で返す。
 * フロントエンド側で window.location.href = data.redirectUrl でリダイレクトする。
 *
 * @param {Object} params - { eventId, performerId, productId, buyerName, buyerEmail,
 *                            buyerPhone, messageToPerformer, isMessagePublic, isAnonymous }
 * @returns {{ orderId, gmoOrderId, redirectUrl }}
 */
function apiCreatePublicOrder(params) {
  // 1. バリデーション
  if (!params.eventId)     throw badRequest('eventId は必須です');
  if (!params.performerId) throw badRequest('performerId は必須です');
  if (!params.productId)   throw badRequest('productId は必須です');
  if (!params.buyerEmail)  throw badRequest('buyerEmail は必須です');

  var product = findProductById(params.productId);
  if (!product || !product.isActive) throw notFound('商品が見つかりません');

  var ev = findEventById(params.eventId);
  if (!ev || ev.status !== EVENT_STATUS.PUBLISHED) throw notFound('イベントが見つかりません');

  var now = new Date();
  if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) <= now) {
    throw closedError('差し入れの受付期間が終了しています');
  }

  validateEmail(params.buyerEmail);

  // 2. 受取先を解決
  var receiver = getDefaultReceiverForEvent(params.eventId);
  if (!receiver) throw new Error('受取設定が完了していません。管理者にお問い合わせください。');

  // 3. Orders に PENDING で作成
  var order = createOrder({
    eventId:             params.eventId,
    organizerId:         ev.organizerId,
    performerId:         params.performerId,
    receiverId:          receiver.receiverId,
    productId:           product.productId,
    qty:                 1,
    unitPriceJPY:        product.priceJPY,
    buyerName:           params.buyerName            || '',
    buyerEmail:          params.buyerEmail,
    buyerPhone:          params.buyerPhone            || '',
    messageToPerformer:  params.messageToPerformer    || '',
    isMessagePublic:     params.isMessagePublic === true || params.isMessagePublic === 'true' || params.isMessagePublic === 'on',
    isAnonymous:         params.isAnonymous     === true || params.isAnonymous     === 'true' || params.isAnonymous     === 'on'
  });

  // 4. GMO-PG 決済URL取得
  var linkUrl;
  try {
    linkUrl = getGmoLinkPlusUrl(order, params.returnBaseUrl);
  } catch (err) {
    // URL取得失敗時は注文をキャンセル
    updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
    throw new Error('決済サービスへの接続に失敗しました。しばらくしてから再度お試しください。');
  }

  // 5. JSON レスポンス（フロントエンドがリダイレクトを処理する）
  return {
    orderId:     order.orderId,
    gmoOrderId:  order.gmoOrderId,
    redirectUrl: linkUrl
  };
}

/**
 * GMO-PG GetLinkplusUrlPayment.json を呼んで決済URL を返す。
 * @param {Object} order           - createOrder() の戻り値
 * @param {string} [returnBaseUrl] - フロントエンドのベースURL（サンクスページ用）
 *                                   指定がない場合は GAS WebApp URL を使用（後方互換）
 * @returns {string} LinkUrl
 */
function getGmoLinkPlusUrl(order, returnBaseUrl) {
  var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
  var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);
  var configId = getScriptProperty(PROP.GMO_CONFIG_ID);
  var env      = getScriptProperty(PROP.APP_ENV);
  var endpoint = (env === 'production') ? GMO_PROD_ENDPOINT : GMO_TEST_ENDPOINT;

  if (!shopId || !shopPass) throw new Error('GMO_SHOP_ID / GMO_SHOP_PASS が未設定です');

  // 決済完了後のリダイレクト先（フロントエンドのサンクスページ）
  var base = returnBaseUrl
    ? (returnBaseUrl.replace(/\/$/, ''))
    : ScriptApp.getService().getUrl();

  // フロントエンド側のサンクスページ URL（?gmoOrderId=xxx で受け取る想定）
  var returnUrl = base + '/thank-you?gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
  var cancelUrl = base + '/events/' + encodeURIComponent(order.eventId);

  // 結果通知URL（GAS Public WebApp の doPost）
  var notifyUrl = ScriptApp.getService().getUrl();

  var payload = {
    geturlparam: {
      ShopID:   shopId,
      ShopPass: shopPass
    },
    transaction: {
      OrderID: order.gmoOrderId,
      Amount:  String(order.totalJPY),
      Tax:     '0'
    },
    credit: {
      JobCd:  'CAPTURE',
      Method: '1'
    },
    resultskipflag: '0',
    returnurl:  returnUrl,
    cancelurl:  cancelUrl,
    notifyurl:  notifyUrl
  };

  if (configId) payload.configid = configId;

  var options = {
    method:      'post',
    contentType: 'application/json;charset=utf-8',
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(endpoint, options);
  var code     = response.getResponseCode();
  var body     = response.getContentText();

  if (code !== 200) {
    Logger.log('GMO API error: HTTP ' + code);
    throw new Error('GMO-PG API error: ' + code);
  }

  var result = JSON.parse(body);

  if (result.ErrCode) {
    Logger.log('GMO ErrCode: ' + result.ErrCode + ' / ' + result.ErrInfo);
    throw new Error('GMO-PG エラー: ' + result.ErrCode);
  }
  if (!result.LinkUrl) {
    Logger.log('GMO response has no LinkUrl: ' + body.slice(0, 200));
    throw new Error('GMO-PG から LinkUrl が取得できませんでした');
  }

  return result.LinkUrl;
}

/**
 * GMO-PG 結果通知（ResultReceive）を処理する。
 * doPost(e) から呼ばれる。冪等性チェック付き。
 * ※ このメソッドはテキスト（'0' or 'NG'）を返す（GMO仕様）
 * @param {Object} params - e.parameter
 * @returns {string} '0'（正常）or 'NG'（異常）
 */
function handleGmoNotification(params) {
  try {
    // 1. 必須パラメータ確認
    if (!params.OrderID || !params.Status) {
      Logger.log('GMO notify: missing OrderID or Status');
      return 'NG';
    }

    // 2. ShopID 検証（なりすまし対策）
    var shopId = getScriptProperty(PROP.GMO_SHOP_ID);
    if (params.ShopID && params.ShopID !== shopId) {
      Logger.log('GMO notify: invalid ShopID');
      return 'NG';
    }

    // 3. 注文検索
    var order = findOrderByGmoOrderId(params.OrderID);
    if (!order) {
      Logger.log('GMO notify: order not found for ' + params.OrderID);
      return 'NG';
    }

    // 4. 冪等性チェック: 既に PAID なら正常応答（重複通知）
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return '0';
    }

    // 5. 金額照合
    if (params.Amount && String(params.Amount) !== String(order.totalJPY)) {
      Logger.log('GMO notify: amount mismatch. Expected=' + order.totalJPY + ' Got=' + params.Amount);
      return 'NG';
    }

    // 6. ステータス処理
    if (params.Status === 'CAPTURE' || params.Status === 'SALES') {
      // 決済成功
      updateOrderPayment(order.orderId, {
        paymentStatus: PAYMENT_STATUS.PAID,
        gmoAccessId:   params.AccessID || '',
        gmoTranId:     params.TranID   || '',
        paidAt:        nowISO()
      });

      // メール送信（失敗しても通知は成功扱い）
      try {
        sendOrderConfirmationEmail(order);
        sendNewOrderNotificationToAdmin(order);
      } catch (mailErr) {
        Logger.log('Mail send error (non-fatal): ' + mailErr.message);
      }

      // 監査ログ
      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED', ENTITY_TYPE.ORDER, order.orderId,
        { paymentStatus: PAYMENT_STATUS.PENDING },
        { paymentStatus: PAYMENT_STATUS.PAID, gmoOrderId: order.gmoOrderId });

    } else if (params.Status === 'CANCEL') {
      // 決済キャンセル
      updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
      writeAuditLog('SYSTEM', 'PAYMENT_CANCELED', ENTITY_TYPE.ORDER, order.orderId);
    }
    // その他ステータス（UNPROCESSED等）は無視して正常応答

    return '0';

  } catch (err) {
    // 個人情報を含む可能性があるため params はログしない
    Logger.log('handleGmoNotification error: ' + err.message);
    return 'NG';
  }
}
