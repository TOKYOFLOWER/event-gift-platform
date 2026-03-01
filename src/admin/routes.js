/**
 * src/admin/routes.js
 * Admin WebApp のルーティング（doGet から呼ばれる）
 * 変更履歴: 2026-03-01 Phase2 実装
 */

/**
 * ページ名 → コントローラ関数のマップ
 * @param {string} page
 * @param {Object} params - e.parameter
 * @param {Object} user   - requireRole() の戻り値
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function route(page, params, user) {
  switch (page) {
    // ダッシュボード
    case 'dashboard':       return renderDashboard(user);

    // ユーザー管理 (ADMIN)
    case 'userList':        return renderUserList(user);
    case 'userForm':        return renderUserForm(user, params.userId || null);

    // イベント
    case 'eventList':       return renderEventList(user);
    case 'eventForm':       return renderEventForm(user, params.eventId || null);
    case 'sessionManage':   return renderSessionManage(user, params.eventId);
    case 'ticketManage':    return renderTicketManage(user, params.eventId);

    // 出演者
    case 'performerList':   return renderPerformerList(user);
    case 'performerForm':   return renderPerformerForm(user, params.performerId || null);
    case 'performerAssign': return renderPerformerAssign(user, params.eventId);

    // 受取設定
    case 'receiverSetup':   return renderReceiverSetup(user, params.eventId);

    // 商品
    case 'productList':     return renderProductList(user);
    case 'productForm':     return renderProductForm(user, params.productId || null);

    // 注文
    case 'orderList':       return renderOrderList(user, params);
    case 'orderDetail':     return renderOrderDetail(user, params.orderId);

    // 受取リスト出力
    case 'pickupList':      return renderPickupList(user, params.eventId);

    // 監査ログ
    case 'auditLog':        return renderAuditLogView(user);

    default:
      return renderError('ページが見つかりません: ' + page);
  }
}

function renderError(msg) {
  return buildPage('エラー', '<div class="alert alert-danger">' + escHtml(msg) + '</div>');
}
