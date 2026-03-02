/**
 * src/public/controllers/giftController.js
 * Public ギフト・注文 API
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=listProducts[&category=FLOWER][&eventId=xxx]
 * 販売中商品一覧。eventId が指定された場合はイベントの公開確認も行う。
 * @param {Object} params
 * @returns {Array<Object>}
 */
function apiListPublicProducts(params) {
  var now = new Date();

  // eventId が指定された場合はイベントのバリデーション
  if (params.eventId) {
    var ev = findEventById(params.eventId);
    // normalizeStatus() で大文字小文字・前後スペースを吸収（シート手動入力対策）
    if (!ev || normalizeStatus(ev.status) !== EVENT_STATUS.PUBLISHED) {
      throw notFound('イベントが見つかりません');
    }
    if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) <= now) {
      throw closedError('差し入れの受付は終了しました');
    }
  }

  var products = listActiveProducts();

  // カテゴリフィルタ
  if (params.category) {
    products = products.filter(function(p) { return p.category === params.category; });
  }

  return products;
}

/**
 * GET ?action=inquireOrder&gmoOrderId=xxx&email=xxx
 * 注文照会（メールアドレス照合あり）
 * @param {Object} params
 * @returns {Object}
 */
function apiInquireOrder(params) {
  if (!params.gmoOrderId) throw badRequest('gmoOrderId は必須です');
  if (!params.email)      throw badRequest('email は必須です');

  var order = findOrderByGmoOrderId(params.gmoOrderId);
  if (!order) {
    throw notFound('注文が見つかりません');
  }

  // メールアドレス照合（個人情報保護）
  if (order.buyerEmail !== params.email) {
    throw notFound('注文が見つかりません');
  }

  var product   = findProductById(order.productId);
  var performer = findPerformerById(order.performerId);
  var ev        = findEventById(order.eventId);

  return {
    orderId:           order.orderId,
    gmoOrderId:        order.gmoOrderId,
    paymentStatus:     order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    productName:       product   ? product.name         : order.productId,
    totalJPY:          order.totalJPY,
    performerName:     performer ? performer.displayName : order.performerId,
    eventTitle:        ev        ? ev.title              : order.eventId,
    paidAt:            order.paidAt,
    createdAt:         order.createdAt
  };
}
