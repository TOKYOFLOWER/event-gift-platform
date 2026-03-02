/**
 * src/admin/controllers/performerAdminController.js
 * Performers API（ADMIN専用）
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=listPerformers
 */
function apiListPerformers(user) {
  requireRole([ROLE.ADMIN]);
  return listAllPerformers(false);
}

/**
 * GET ?action=getPerformer&id=xxx
 */
function apiGetPerformer(performerId, user) {
  if (!performerId) throw badRequest('id は必須です');
  requireRole([ROLE.ADMIN]);
  var p = findPerformerById(performerId);
  if (!p) throw notFound('出演者が見つかりません');
  return p;
}

/**
 * POST ?action=createPerformer
 * body: { displayName, titleOrGroup, bio, avatarUrl, snsUrl }
 */
function apiCreatePerformer(params, user) {
  requireRole([ROLE.ADMIN]);
  if (!params.displayName) throw badRequest('displayName は必須です');

  var p = createPerformer({
    displayName:  params.displayName,
    titleOrGroup: params.titleOrGroup || '',
    bio:          params.bio          || '',
    avatarUrl:    params.avatarUrl    || '',
    snsUrl:       params.snsUrl       || ''
  });
  writeAuditLog(user.email, 'CREATE_PERFORMER', ENTITY_TYPE.PERFORMER, p.performerId);
  return p;
}

/**
 * POST ?action=updatePerformer
 * body: { id, displayName, ... }
 */
function apiUpdatePerformer(params, user) {
  var performerId = params.id || params.performerId;
  if (!performerId) throw badRequest('id は必須です');
  requireSelfOrAdmin(user, performerId);

  var before = findPerformerById(performerId);
  if (!before) throw notFound('出演者が見つかりません');

  var updated = updatePerformer(performerId, {
    displayName:  params.displayName,
    titleOrGroup: params.titleOrGroup || '',
    bio:          params.bio          || '',
    avatarUrl:    params.avatarUrl    || '',
    snsUrl:       params.snsUrl       || '',
    isActive:     params.isActive === true || params.isActive === 'true' || params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_PERFORMER', ENTITY_TYPE.PERFORMER, performerId, before);
  return updated;
}
