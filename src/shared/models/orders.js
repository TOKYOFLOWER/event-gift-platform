/**
 * shared/models/orders.js
 * Orders シートの CRUD（アクセス制限: Admin/Organizer のみ）
 * 変更履歴: 2026-03-01 初版
 * セキュリティ注意: buyerEmail 等の個人情報をログ出力しない
 */

function createOrder(data) {
  requireFields(data, ['eventId', 'organizerId', 'performerId', 'receiverId', 'productId', 'qty', 'unitPriceJPY', 'buyerEmail']);
  validateEmail(data.buyerEmail);
  validatePositiveInt(data.qty, 'qty');
  validatePositiveInt(data.unitPriceJPY, 'unitPriceJPY');

  var qty    = Number(data.qty);
  var unit   = Number(data.unitPriceJPY);
  var total  = qty * unit;
  var now    = nowISO();
  var gmoOrderId = 'ORD-' + generateUuid().replace(/-/g, '').slice(0, 16).toUpperCase();

  var row = {
    orderId:              generateUuid(),
    eventId:              data.eventId,
    organizerId:          data.organizerId,
    performerId:          data.performerId,
    receiverId:           data.receiverId,
    productId:            data.productId,
    qty:                  qty,
    unitPriceJPY:         unit,
    totalJPY:             total,
    buyerName:            data.buyerName            || '',
    buyerEmail:           data.buyerEmail,
    buyerPhone:           data.buyerPhone            || '',
    messageToPerformer:   data.messageToPerformer    || '',
    isMessagePublic:      data.isMessagePublic  === true,
    isAnonymous:          data.isAnonymous      === true,
    gmoOrderId:           gmoOrderId,
    gmoAccessId:          '',
    gmoAccessPass:        '',
    gmoTranId:            '',
    paymentStatus:        PAYMENT_STATUS.PENDING,
    fulfillmentStatus:    FULFILLMENT_STATUS.NEW,
    paidAt:               '',
    createdAt:            now,
    updatedAt:            now
  };
  sheetInsert(SHEET.ORDERS, row);
  return row;
}

function findOrderById(orderId) {
  return sheetFindOne(SHEET.ORDERS, 'orderId', orderId);
}

function findOrderByGmoOrderId(gmoOrderId) {
  return sheetFindOne(SHEET.ORDERS, 'gmoOrderId', gmoOrderId);
}

function listOrdersByEvent(eventId) {
  return sheetFindMany(SHEET.ORDERS, 'eventId', eventId);
}

function listOrdersByOrganizer(organizerId) {
  return sheetFindMany(SHEET.ORDERS, 'organizerId', organizerId);
}

function listOrdersByStatus(paymentStatus) {
  return sheetFilter(SHEET.ORDERS, { paymentStatus: paymentStatus });
}

function listAllOrders() {
  return sheetGetAll(SHEET.ORDERS).rows;
}

function updateOrderPayment(orderId, updates) {
  // 個人情報フィールドをログしない
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.ORDERS, 'orderId', orderId, updates);
}

function updateFulfillmentStatus(orderId, fulfillmentStatus) {
  validateEnum(fulfillmentStatus, FULFILLMENT_STATUS, 'fulfillmentStatus');
  return sheetUpdate(SHEET.ORDERS, 'orderId', orderId, {
    fulfillmentStatus: fulfillmentStatus,
    updatedAt:         nowISO()
  });
}

/**
 * PENDING かつ作成から 24 時間以上経過した注文を CANCELED にする。
 * GAS タイマートリガーから呼ばれる。
 */
function cleanupPendingOrders() {
  var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var orders  = listOrdersByStatus(PAYMENT_STATUS.PENDING);
  orders.forEach(function(o) {
    if (new Date(o.createdAt) < cutoff) {
      updateOrderPayment(o.orderId, { paymentStatus: PAYMENT_STATUS.CANCELED });
      Logger.log('Canceled stale order: ' + o.orderId);
    }
  });
}
