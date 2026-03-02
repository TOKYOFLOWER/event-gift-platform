/**
 * src/admin/routes.js
 * Admin REST API ルーター
 * 変更履歴:
 *   2026-03-01 Phase2 HTML ルーティング実装
 *   2026-03-02 Phase4 JSON API ルーターに書き換え
 *
 * GET  ?action=<action>  → routeGet()
 * POST ?action=<action>  → routePost()
 *
 * 全ハンドラーはデータオブジェクト（Object / Array）を返す。
 * JSON シリアライズと ContentService への変換は Code.js が担う。
 */

// ─────────────────────────────────────────────
// GET ルーター
// ─────────────────────────────────────────────

/**
 * @param {string} action
 * @param {Object} params - e.parameter
 * @param {Object} user   - requireRole() の戻り値
 * @returns {*} レスポンスデータ（Object or Array）
 */
function routeGet(action, params, user) {
  switch (action) {

    // ── ダッシュボード ──────────────────────────
    case 'getDashboard':
      return apiGetDashboard(user);

    // ── イベント ────────────────────────────────
    case 'listEvents':
      return apiListEvents(user);

    case 'getEvent':
      return apiGetEvent(params.id, user);

    case 'listSessions':
      return apiListSessions(params.eventId, user);

    case 'listTicketTypes':
      return apiListTicketTypes(params.eventId, user);

    case 'listEventPerformers':
      return apiListEventPerformers(params.eventId, user);

    case 'listReceivers':
      return apiListReceivers(params.eventId, user);

    // ── 出演者 ──────────────────────────────────
    case 'listPerformers':
      return apiListPerformers(user);

    case 'getPerformer':
      return apiGetPerformer(params.id, user);

    // ── 商品 ────────────────────────────────────
    case 'listProducts':
      return apiListProducts(user);

    case 'getProduct':
      return apiGetProduct(params.id, user);

    // ── 注文 ────────────────────────────────────
    case 'listOrders':
      return apiListOrders(params, user);

    case 'getOrder':
      return apiGetOrder(params.id, user);

    case 'getPickupList':
      return apiGetPickupList(params.eventId, user);

    // ── ユーザー ────────────────────────────────
    case 'listUsers':
      return apiListUsers(user);

    case 'getUser':
      return apiGetUser(params.id, user);

    // ── 監査ログ ────────────────────────────────
    case 'listAuditLogs':
      return apiListAuditLogs(params, user);

    // ── 自分自身 ────────────────────────────────
    case 'getMe':
      return user;

    default:
      throw notFound('Unknown action: ' + action);
  }
}

// ─────────────────────────────────────────────
// POST ルーター
// ─────────────────────────────────────────────

/**
 * @param {string} action
 * @param {Object} params - フォームパラメータ + JSONボディのマージ
 * @param {Object} user
 * @returns {*} レスポンスデータ
 */
function routePost(action, params, user) {
  switch (action) {

    // ── ユーザー ────────────────────────────────
    case 'createUser':     return apiCreateUser(params, user);
    case 'updateUser':     return apiUpdateUser(params, user);
    case 'deactivateUser': return apiDeactivateUser(params, user);

    // ── イベント ────────────────────────────────
    case 'createEvent':    return apiCreateEvent(params, user);
    case 'updateEvent':    return apiUpdateEvent(params, user);
    case 'publishEvent':   return apiPublishEvent(params, user);
    case 'closeEvent':     return apiCloseEvent(params, user);

    // ── セッション ──────────────────────────────
    case 'createSession':  return apiCreateSession(params, user);
    case 'deleteSession':  return apiDeleteSession(params, user);

    // ── 券種 ────────────────────────────────────
    case 'createTicketType': return apiCreateTicketType(params, user);
    case 'deleteTicketType': return apiDeleteTicketType(params, user);

    // ── 出演者 ──────────────────────────────────
    case 'createPerformer':  return apiCreatePerformer(params, user);
    case 'updatePerformer':  return apiUpdatePerformer(params, user);
    case 'assignPerformer':  return apiAssignPerformer(params, user);
    case 'removePerformer':  return apiRemovePerformer(params, user);

    // ── 受取設定 ────────────────────────────────
    case 'createReceiver': return apiCreateReceiver(params, user);
    case 'updateReceiver': return apiUpdateReceiver(params, user);

    // ── 商品 ────────────────────────────────────
    case 'createProduct':  return apiCreateProduct(params, user);
    case 'updateProduct':  return apiUpdateProduct(params, user);
    case 'toggleProduct':  return apiToggleProduct(params, user);

    // ── 注文 ────────────────────────────────────
    case 'updateFulfillment': return apiUpdateFulfillment(params, user);

    default:
      throw badRequest('Unknown action: ' + action);
  }
}

// ─────────────────────────────────────────────
// エラーファクトリ
// ─────────────────────────────────────────────

function notFound(msg)    { var e = new Error(msg || 'NOT_FOUND');    e.message = msg || 'NOT_FOUND';    return e; }
function badRequest(msg)  { var e = new Error(msg || 'BAD_REQUEST');  e.message = msg || 'BAD_REQUEST';  return e; }
function forbidden(msg)   { var e = new Error(msg || 'FORBIDDEN');    e.message = msg || 'FORBIDDEN';    return e; }
