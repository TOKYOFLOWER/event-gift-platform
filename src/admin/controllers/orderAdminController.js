/**
 * src/admin/controllers/orderAdminController.js
 * A10: Orders一覧, A11: Orders詳細, A12: Pickup List, A14: AuditLog
 * 変更履歴: 2026-03-01 Phase2 実装
 */

// ===== A10: Order List =====

function renderOrderList(user, params) {
  var orders = user.role === ROLE.ADMIN
    ? listAllOrders()
    : listOrdersByOrganizer(user.organizerId);

  // フィルタ
  if (params && params.paymentStatus) {
    orders = orders.filter(function(o) { return o.paymentStatus === params.paymentStatus; });
  }
  if (params && params.eventId) {
    orders = orders.filter(function(o) { return String(o.eventId) === String(params.eventId); });
  }

  var base = ScriptApp.getService().getUrl() + '?page=';
  var rows = orders.map(function(o) {
    return '<tr>'
      + '<td><a href="' + base + 'orderDetail&orderId=' + escHtml(o.orderId) + '">' + escHtml(o.gmoOrderId) + '</a></td>'
      + '<td>' + escHtml(o.eventId) + '</td>'
      + '<td>' + statusBadge(o.paymentStatus) + '</td>'
      + '<td>' + escHtml(o.fulfillmentStatus) + '</td>'
      + '<td>¥' + Number(o.totalJPY).toLocaleString() + '</td>'
      + '<td>' + escHtml(o.createdAt ? o.createdAt.slice(0,10) : '') + '</td>'
      + '</tr>';
  }).join('');

  var body = '<p class="text-muted">' + orders.length + ' 件</p>'
    + '<table class="table table-hover table-sm"><thead><tr><th>注文ID</th><th>イベント</th><th>決済</th><th>配送</th><th>金額</th><th>日付</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="6" class="text-center text-muted">注文がありません</td></tr>') + '</tbody></table>';

  return buildPage('注文管理', body, user);
}

// ===== A11: Order Detail =====

function renderOrderDetail(user, orderId) {
  if (!orderId) throw new Error('orderId が必要です');
  var o = findOrderById(orderId);
  if (!o) throw new Error('注文が見つかりません');
  if (user.role !== ROLE.ADMIN) requireOwnership(user, o.organizerId);

  var base = ScriptApp.getService().getUrl() + '?page=';
  var product  = findProductById(o.productId);
  var performer = findPerformerById(o.performerId);

  var fsOpts = Object.keys(FULFILLMENT_STATUS).map(function(k) {
    return { value: FULFILLMENT_STATUS[k], label: FULFILLMENT_STATUS[k] };
  });

  var body = '<div class="row">'
    + '<div class="col-md-6">'
    + '<table class="table table-sm"><tbody>'
    + row2('注文番号', o.gmoOrderId)
    + row2('決済状態', statusBadge(o.paymentStatus))
    + row2('配送状態', statusBadge(o.fulfillmentStatus))
    + row2('商品', product ? escHtml(product.name) : escHtml(o.productId))
    + row2('数量', String(o.qty))
    + row2('合計', '¥' + Number(o.totalJPY).toLocaleString())
    + row2('出演者', performer ? escHtml(performer.displayName) : escHtml(o.performerId))
    + row2('作成日', escHtml(o.createdAt ? o.createdAt.slice(0,16) : ''))
    + row2('支払日', escHtml(o.paidAt ? o.paidAt.slice(0,16) : '-'))
    + '</tbody></table></div>'
    + '<div class="col-md-6">'
    + '<h6>メッセージ</h6>'
    + '<p>' + escHtml(o.messageToPerformer || '（なし）') + '</p>'
    + '<p class="text-muted small">公開: ' + (o.isMessagePublic ? 'はい' : 'いいえ') + ' / 匿名: ' + (o.isAnonymous ? 'はい' : 'いいえ') + '</p>'
    + '</div></div>';

  // 配送ステータス更新フォーム（ADMIN のみ）
  if (user.role === ROLE.ADMIN) {
    body += '<hr><h6>配送状態を更新</h6>'
      + openForm('updateFulfillment', { orderId: orderId })
      + inputSelect('fulfillmentStatus', '配送ステータス', fsOpts, o.fulfillmentStatus, true)
      + btnPrimary('更新')
      + closeForm();
  }

  body += btnLink(base + 'orderList', '← 注文一覧');
  return buildPage('注文詳細: ' + o.gmoOrderId, body, user);
}

function row2(label, valHtml) {
  return '<tr><th class="text-muted" style="width:40%">' + escHtml(label) + '</th><td>' + valHtml + '</td></tr>';
}

// ===== A12: Pickup List =====

function renderPickupList(user, eventId) {
  if (!eventId) throw new Error('eventId が必要です');
  var ev = findEventById(eventId);
  if (!ev) throw new Error('イベントが見つかりません');
  if (user.role !== ROLE.ADMIN) requireOwnership(user, ev.organizerId);

  var orders = listOrdersByEvent(eventId).filter(function(o) {
    return o.paymentStatus === PAYMENT_STATUS.PAID;
  });

  var rows = orders.map(function(o) {
    var product   = findProductById(o.productId);
    var performer = findPerformerById(o.performerId);
    return '<tr>'
      + '<td>' + escHtml(o.gmoOrderId) + '</td>'
      + '<td>' + escHtml(performer ? performer.displayName : o.performerId) + '</td>'
      + '<td>' + escHtml(product ? product.name : o.productId) + '</td>'
      + '<td>' + escHtml(String(o.qty)) + '</td>'
      + '<td>' + escHtml(o.isAnonymous ? '匿名' : (o.buyerName || '-')) + '</td>'
      + '<td>' + escHtml(o.fulfillmentStatus) + '</td>'
      + '</tr>';
  }).join('');

  var base = ScriptApp.getService().getUrl() + '?page=';
  var body = '<p class="text-muted">確定済み注文: ' + orders.length + ' 件 / イベント: ' + escHtml(ev.title) + '</p>'
    + '<table class="table table-bordered table-sm" id="pickupTable"><thead><tr>'
    + '<th>注文番号</th><th>出演者</th><th>商品</th><th>数量</th><th>贈り主</th><th>ステータス</th>'
    + '</tr></thead><tbody>'
    + (rows || '<tr><td colspan="6" class="text-center text-muted">対象注文がありません</td></tr>')
    + '</tbody></table>'
    + '<button class="btn btn-outline-secondary btn-sm mt-2" onclick="window.print()">🖨 印刷</button> '
    + btnLink(base + 'orderList&eventId=' + eventId, '← 注文一覧');

  return buildPage('受取リスト', body, user);
}

// ===== A14: Audit Log =====

function renderAuditLogView(user) {
  requireRole([ROLE.ADMIN]);
  var logs = listAuditLog(200);
  var rows = logs.map(function(l) {
    return '<tr>'
      + '<td>' + escHtml(l.createdAt ? l.createdAt.slice(0,16) : '') + '</td>'
      + '<td>' + escHtml(l.actorEmail) + '</td>'
      + '<td>' + escHtml(l.action) + '</td>'
      + '<td>' + escHtml(l.entityType) + '</td>'
      + '<td>' + escHtml(l.entityId) + '</td>'
      + '</tr>';
  }).join('');

  var body = '<p class="text-muted">最新 200 件</p>'
    + '<table class="table table-sm table-hover"><thead><tr><th>日時</th><th>操作者</th><th>操作</th><th>対象種別</th><th>対象ID</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="5" class="text-center text-muted">ログがありません</td></tr>') + '</tbody></table>';

  return buildPage('監査ログ', body, user);
}

// ===== POST handlers =====

function postUpdateFulfillment(params, user) {
  requireRole([ROLE.ADMIN]);
  var o = findOrderById(params.orderId);
  if (!o) throw new Error('注文が見つかりません');
  var before = { fulfillmentStatus: o.fulfillmentStatus };
  updateFulfillmentStatus(params.orderId, params.fulfillmentStatus);
  writeAuditLog(user.email, 'UPDATE_FULFILLMENT', ENTITY_TYPE.ORDER, params.orderId, before, { fulfillmentStatus: params.fulfillmentStatus });
  return { redirect: ScriptApp.getService().getUrl() + '?page=orderDetail&orderId=' + params.orderId };
}
