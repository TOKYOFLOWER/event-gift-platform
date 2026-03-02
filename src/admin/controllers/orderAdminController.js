/**
 * src/admin/controllers/orderAdminController.js
 * Orders / PickupList / AuditLog API
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

// ─────────────────────────────────────────────
// GET ハンドラー
// ─────────────────────────────────────────────

/**
 * GET ?action=listOrders[&eventId=xxx][&paymentStatus=xxx][&fulfillmentStatus=xxx]
 */
function apiListOrders(params, user) {
  var orders = user.role === ROLE.ADMIN
    ? listAllOrders()
    : listOrdersByOrganizer(user.organizerId);

  // フィルタリング
  if (params.eventId) {
    orders = orders.filter(function(o) { return String(o.eventId) === String(params.eventId); });
  }
  if (params.paymentStatus) {
    orders = orders.filter(function(o) { return o.paymentStatus === params.paymentStatus; });
  }
  if (params.fulfillmentStatus) {
    orders = orders.filter(function(o) { return o.fulfillmentStatus === params.fulfillmentStatus; });
  }

  return orders;
}

/**
 * GET ?action=getOrder&id=xxx
 * 注文詳細＋関連データ
 */
function apiGetOrder(orderId, user) {
  if (!orderId) throw badRequest('id は必須です');
  var o = findOrderById(orderId);
  if (!o) throw notFound('注文が見つかりません');
  if (user.role !== ROLE.ADMIN) requireOwnership(user, o.organizerId);

  var product   = findProductById(o.productId);
  var performer = findPerformerById(o.performerId);
  var ev        = findEventById(o.eventId);

  return {
    order:     o,
    product:   product   || null,
    performer: performer || null,
    event:     ev        || null
  };
}

/**
 * GET ?action=getPickupList&eventId=xxx
 * 確定済み注文の受取リスト
 */
function apiGetPickupList(eventId, user) {
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  if (user.role !== ROLE.ADMIN) requireOwnership(user, ev.organizerId);

  var orders = listOrdersByEvent(eventId).filter(function(o) {
    return o.paymentStatus === PAYMENT_STATUS.PAID;
  });

  var items = orders.map(function(o) {
    var product   = findProductById(o.productId);
    var performer = findPerformerById(o.performerId);
    return {
      orderId:           o.orderId,
      gmoOrderId:        o.gmoOrderId,
      performerId:       o.performerId,
      performerName:     performer ? performer.displayName : o.performerId,
      productId:         o.productId,
      productName:       product   ? product.name         : o.productId,
      qty:               o.qty,
      buyerName:         o.isAnonymous ? '匿名' : (o.buyerName || '-'),
      isAnonymous:       o.isAnonymous,
      fulfillmentStatus: o.fulfillmentStatus,
      paidAt:            o.paidAt
    };
  });

  return {
    event: ev,
    items: items,
    total: items.length
  };
}

/**
 * GET ?action=listAuditLogs[&limit=200]
 */
function apiListAuditLogs(params, user) {
  requireRole([ROLE.ADMIN]);
  var limit = Number(params.limit) || 200;
  return listAuditLog(limit);
}

// ─────────────────────────────────────────────
// POST ハンドラー
// ─────────────────────────────────────────────

/**
 * POST ?action=updateFulfillment
 * body: { id, fulfillmentStatus }
 */
function apiUpdateFulfillment(params, user) {
  requireRole([ROLE.ADMIN]);
  var orderId = params.id || params.orderId;
  if (!orderId)                  throw badRequest('id は必須です');
  if (!params.fulfillmentStatus) throw badRequest('fulfillmentStatus は必須です');

  var o = findOrderById(orderId);
  if (!o) throw notFound('注文が見つかりません');

  var before = { fulfillmentStatus: o.fulfillmentStatus };
  updateFulfillmentStatus(orderId, params.fulfillmentStatus);
  writeAuditLog(user.email, 'UPDATE_FULFILLMENT', ENTITY_TYPE.ORDER, orderId, before, { fulfillmentStatus: params.fulfillmentStatus });

  return { orderId: orderId, fulfillmentStatus: params.fulfillmentStatus };
}
