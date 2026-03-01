/**
 * src/public/controllers/gmoController.js
 * GMO-PG リンクタイプPlus 連携
 * - 決済URL取得（GetLinkplusUrlPayment.json）
 * - 結果通知受信（doPost / 冪等性チェック）
 * 変更履歴: 2026-03-02 Phase3 実装
 * セキュリティ注意: このファイルはカード情報を絶対にログ出力しない
 */

var GMO_TEST_ENDPOINT  = 'https://pt01.mul-pay.jp/payment/GetLinkplusUrlPayment.json';
var GMO_PROD_ENDPOINT  = 'https://p01.mul-pay.jp/payment/GetLinkplusUrlPayment.json';

/**
 * 注文を作成して GMO-PG の決済URL を取得し、リダイレクト用 HtmlOutput を返す。
 * @param {Object} params - フォームパラメータ（buyerName, buyerEmail, productId, etc.）
 * @param {string} eventId
 * @param {string} performerId
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function createOrderAndRedirect(params, eventId, performerId) {
  // 1. バリデーション
  var product = findProductById(params.productId);
  if (!product || !product.isActive) throw new Error('商品が見つかりません');

  var ev = findEventById(eventId);
  if (!ev || ev.status !== EVENT_STATUS.PUBLISHED) throw new Error('イベントが見つかりません');

  var now = new Date();
  if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) <= now) throw new Error('差し入れの受付期間が終了しています');

  validateEmail(params.buyerEmail);

  // 2. 受取先を解決（パフォーマー固有 or イベントデフォルト）
  var receiver = getDefaultReceiverForEvent(eventId);
  if (!receiver) throw new Error('受取設定が完了していません。管理者にお問い合わせください。');

  // 3. 主催者 ID を解決
  var organizerId = ev.organizerId;

  // 4. Orders に PENDING で作成
  var order = createOrder({
    eventId:             eventId,
    organizerId:         organizerId,
    performerId:         performerId,
    receiverId:          receiver.receiverId,
    productId:           product.productId,
    qty:                 1,
    unitPriceJPY:        product.priceJPY,
    buyerName:           params.buyerName           || '',
    buyerEmail:          params.buyerEmail,
    buyerPhone:          params.buyerPhone           || '',
    messageToPerformer:  params.messageToPerformer   || '',
    isMessagePublic:     params.isMessagePublic === 'on',
    isAnonymous:         params.isAnonymous     === 'on'
  });

  // 5. GMO-PG 決済URL取得
  var linkUrl;
  try {
    linkUrl = getGmoLinkPlusUrl(order);
  } catch (err) {
    // URL取得失敗時は注文をキャンセル
    updateOrderPayment(order.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
    throw new Error('決済サービスへの接続に失敗しました。しばらくしてから再度お試しください。');
  }

  // 6. GMO-PG 決済画面へリダイレクト
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<title>決済画面へ移動中...</title></head><body>'
    + '<p style="text-align:center;padding:3rem;font-family:sans-serif">決済画面へ移動しています...</p>'
    + '<script>window.location.href=' + JSON.stringify(linkUrl) + ';</script>'
    + '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('決済画面へ移動中')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * GMO-PG GetLinkplusUrlPayment.json を呼んで決済URL を返す。
 * @param {Object} order - createOrder() の戻り値
 * @returns {string} LinkUrl
 */
function getGmoLinkPlusUrl(order) {
  var shopId   = getScriptProperty(PROP.GMO_SHOP_ID);
  var shopPass = getScriptProperty(PROP.GMO_SHOP_PASS);
  var configId = getScriptProperty(PROP.GMO_CONFIG_ID);
  var env      = getScriptProperty(PROP.APP_ENV);
  var endpoint = (env === 'production') ? GMO_PROD_ENDPOINT : GMO_TEST_ENDPOINT;

  if (!shopId || !shopPass) throw new Error('GMO_SHOP_ID / GMO_SHOP_PASS が未設定です');

  // 決済完了後の戻り先URL
  var baseUrl   = ScriptApp.getService().getUrl();
  var returnUrl = baseUrl + '?page=thankYou&gmoOrderId=' + encodeURIComponent(order.gmoOrderId);
  // 結果通知URL（doPost が受け取る）
  var notifyUrl = baseUrl;

  var payload = {
    geturlparam: {
      ShopID:   shopId,
      ShopPass: shopPass
    },
    transaction: {
      OrderID:  order.gmoOrderId,
      Amount:   String(order.totalJPY),
      Tax:      '0'
    },
    credit: {
      JobCd:  'CAPTURE',
      Method: '1'
    },
    resultskipflag: '0',
    returnurl:   returnUrl,
    cancelurl:   baseUrl + '?page=eventDetail&gmoOrderId=' + encodeURIComponent(order.gmoOrderId),
    notifyurl:   notifyUrl
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

  // エラーチェック（ErrCode が返る場合）
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

/**
 * 注文照会（P7 フォームの POST 処理）
 */
function handleOrderInquiry(params) {
  return renderOrderInquiry(params);
}
