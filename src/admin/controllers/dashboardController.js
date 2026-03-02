/**
 * src/admin/controllers/dashboardController.js
 * A1: ダッシュボード API
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=getDashboard
 * @param {Object} user
 * @returns {{stats: Object, recentEvents: Array}}
 */
function apiGetDashboard(user) {
  var events   = listAllEvents();
  var orders   = listAllOrders();

  var publishedCount  = events.filter(function(e) { return e.status === EVENT_STATUS.PUBLISHED; }).length;
  var totalCount      = events.length;
  var pendingOrders   = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PENDING; }).length;
  var paidOrders      = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PAID; }).length;
  var canceledOrders  = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.CANCELED; }).length;
  var totalSales      = orders.filter(function(o) { return o.paymentStatus === PAYMENT_STATUS.PAID; })
                              .reduce(function(s, o) { return s + Number(o.totalJPY); }, 0);

  var recentEvents = events.slice(-10).reverse().map(function(ev) {
    return {
      eventId:         ev.eventId,
      title:           ev.title,
      status:          ev.status,
      venueName:       ev.venueName,
      giftDeadlineAt:  ev.giftDeadlineAt
    };
  });

  return {
    stats: {
      totalEvents:     totalCount,
      publishedEvents: publishedCount,
      paidOrders:      paidOrders,
      pendingOrders:   pendingOrders,
      canceledOrders:  canceledOrders,
      totalSalesJPY:   totalSales
    },
    recentEvents: recentEvents
  };
}
