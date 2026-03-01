/**
 * src/admin/controllers/dashboardController.js
 * A1: ダッシュボード
 * 変更履歴: 2026-03-01 Phase2 実装
 */

function renderDashboard(user) {
  var events   = listAllEvents();
  var orders   = listAllOrders();
  var products = listAllProducts();

  var publishedCount = events.filter(function(e) { return e.status === EVENT_STATUS.PUBLISHED; }).length;
  var pendingOrders  = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PENDING; }).length;
  var paidOrders     = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PAID; }).length;
  var totalSales     = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PAID; })
                             .reduce(function(s, o) { return s + Number(o.totalJPY); }, 0);

  var base = ScriptApp.getService().getUrl() + '?page=';
  var body = '<div class="row g-4 mb-4">'
    + card('公開中イベント', publishedCount, 'success', base + 'eventList')
    + card('注文（確定済み）', paidOrders, 'primary', base + 'orderList')
    + card('注文（保留中）', pendingOrders, 'warning', base + 'orderList&paymentStatus=PENDING')
    + card('累計売上', '¥' + totalSales.toLocaleString(), 'info', base + 'orderList')
    + '</div>'
    + '<h5>最近のイベント</h5>'
    + renderRecentEvents(events.slice(-5).reverse());

  return buildPage('ダッシュボード', body, user);
}

function card(label, value, color, href) {
  return '<div class="col-md-3">'
    + '<a href="' + escHtml(href) + '" class="text-decoration-none">'
    + '<div class="card border-' + color + ' h-100">'
    + '<div class="card-body text-center">'
    + '<div class="display-6 fw-bold text-' + color + '">' + escHtml(String(value)) + '</div>'
    + '<div class="text-muted">' + escHtml(label) + '</div>'
    + '</div></div></a></div>';
}

function renderRecentEvents(events) {
  if (!events.length) return '<p class="text-muted">イベントがありません。</p>';
  var base = ScriptApp.getService().getUrl() + '?page=';
  var rows = events.map(function(ev) {
    return '<tr><td>' + escHtml(ev.title) + '</td>'
      + '<td>' + statusBadge(ev.status) + '</td>'
      + '<td>' + escHtml(ev.venueName) + '</td>'
      + '<td>' + escHtml(ev.giftDeadlineAt ? ev.giftDeadlineAt.slice(0,10) : '-') + '</td>'
      + '<td><a href="' + base + 'eventForm&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-primary">編集</a></td>'
      + '</tr>';
  }).join('');
  return '<table class="table table-hover"><thead><tr><th>タイトル</th><th>状態</th><th>会場</th><th>締切</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
}
