/**
 * src/admin/controllers/userAdminController.js
 * Users API（ADMIN専用）
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=listUsers
 */
function apiListUsers(user) {
  requireRole([ROLE.ADMIN]);
  // パスワード等のセンシティブ情報は存在しないが念のため全フィールド返却
  return listUsers(false);
}

/**
 * GET ?action=getUser&id=xxx
 */
function apiGetUser(userId, user) {
  if (!userId) throw badRequest('id は必須です');
  requireRole([ROLE.ADMIN]);
  var u = findUserById(userId);
  if (!u) throw notFound('ユーザーが見つかりません');
  return u;
}

/**
 * POST ?action=createUser
 * body: { displayName, email, role, organizerId, performerId }
 */
function apiCreateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  if (!params.displayName) throw badRequest('displayName は必須です');
  if (!params.email)       throw badRequest('email は必須です');
  if (!params.role)        throw badRequest('role は必須です');

  var created = createUser({
    displayName: params.displayName,
    email:       params.email,
    role:        params.role,
    organizerId: params.organizerId || '',
    performerId: params.performerId || ''
  });
  writeAuditLog(user.email, 'CREATE_USER', ENTITY_TYPE.EVENT, params.email);
  return created;
}

/**
 * POST ?action=updateUser
 * body: { id, displayName, email, role, organizerId, performerId, isActive }
 */
function apiUpdateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  var userId = params.id || params.userId;
  if (!userId) throw badRequest('id は必須です');

  var u = findUserById(userId);
  if (!u) throw notFound('ユーザーが見つかりません');

  var updated = updateUser(userId, {
    displayName: params.displayName,
    email:       params.email,
    role:        params.role,
    organizerId: params.organizerId || '',
    performerId: params.performerId || '',
    isActive:    params.isActive === true || params.isActive === 'true' || params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_USER', ENTITY_TYPE.EVENT, userId);
  return updated;
}

/**
 * POST ?action=deactivateUser
 * body: { id }
 */
function apiDeactivateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  var userId = params.id || params.userId;
  if (!userId) throw badRequest('id は必須です');

  deactivateUser(userId);
  writeAuditLog(user.email, 'DEACTIVATE_USER', ENTITY_TYPE.EVENT, userId);
  return { userId: userId, isActive: false };
}
