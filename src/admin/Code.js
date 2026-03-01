/**
 * src/admin/Code.js
 * Admin WebApp エントリポイント（Googleログイン必須）
 * 変更履歴:
 *   2026-03-01 Phase1 スタブ作成
 *   2026-03-01 Phase2 doGet/doPost 完全実装・全ルーティング対応
 */

function doGet(e) {
  try {
    var user = requireRole([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.PERFORMER]);
    var page   = (e && e.parameter && e.parameter.page) || 'dashboard';
    var params = (e && e.parameter) || {};
    return route(page, params, user);
  } catch (err) {
    if (['LOGIN_REQUIRED', 'ACCESS_DENIED', 'FORBIDDEN'].indexOf(err.message) !== -1) {
      return buildPage('アクセス拒否', alertDanger('アクセス権限がありません。(' + err.message + ')'));
    }
    Logger.log('doGet error: ' + err.message + '\n' + err.stack);
    return buildPage('エラー', alertDanger('予期しないエラーが発生しました。'));
  }
}

function doPost(e) {
  try {
    var user   = requireRole([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.PERFORMER]);
    var params = (e && e.parameter) || {};
    var action = params.action || '';
    var result = dispatchPost(action, params, user);
    // 処理後リダイレクト先
    var redirect = result.redirect || (ScriptApp.getService().getUrl() + '?page=dashboard');
    return HtmlService.createHtmlOutput(
      '<script>window.top.location.href="' + redirect + '";</script>'
    );
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return buildPage('エラー', alertDanger(escHtml(err.message)));
  }
}

/**
 * POST アクションディスパッチャ
 */
function dispatchPost(action, params, user) {
  var base = ScriptApp.getService().getUrl();

  switch (action) {
    // --- Users ---
    case 'createUser':   return postCreateUser(params, user);
    case 'updateUser':   return postUpdateUser(params, user);
    case 'deactivateUser': return postDeactivateUser(params, user);

    // --- Events ---
    case 'createEvent':  return postCreateEvent(params, user);
    case 'updateEvent':  return postUpdateEvent(params, user);
    case 'publishEvent': return postPublishEvent(params, user);
    case 'closeEvent':   return postCloseEvent(params, user);

    // --- EventSessions ---
    case 'saveSessions': return postSaveSessions(params, user);

    // --- TicketTypes ---
    case 'saveTickets':  return postSaveTickets(params, user);

    // --- Performers ---
    case 'createPerformer': return postCreatePerformer(params, user);
    case 'updatePerformer': return postUpdatePerformer(params, user);
    case 'assignPerformer': return postAssignPerformer(params, user);
    case 'removePerformer': return postRemovePerformer(params, user);

    // --- Receivers ---
    case 'saveReceiver': return postSaveReceiver(params, user);

    // --- Products ---
    case 'createProduct': return postCreateProduct(params, user);
    case 'updateProduct': return postUpdateProduct(params, user);
    case 'toggleProduct': return postToggleProduct(params, user);

    // --- Orders ---
    case 'updateFulfillment': return postUpdateFulfillment(params, user);

    default:
      throw new Error('Unknown action: ' + action);
  }
}
