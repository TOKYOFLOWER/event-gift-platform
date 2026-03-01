/**
 * shared/utils/auth.js
 * ロールチェック・オーナーシップ検証。Admin WebApp 専用。
 * 変更履歴: 2026-03-01 初版
 */

/**
 * 現在のセッションユーザーが allowedRoles のいずれかを持つか検証する。
 * 満たさない場合は Error をスローする。
 * @param {string[]} allowedRoles
 * @returns {Object} Users シートのユーザーオブジェクト
 */
function requireRole(allowedRoles) {
  var email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('LOGIN_REQUIRED');

  var user = findUserByEmail(email);
  if (!user || !user.isActive) throw new Error('ACCESS_DENIED');
  if (allowedRoles.indexOf(user.role) === -1) throw new Error('FORBIDDEN');

  return user;
}

/**
 * ORGANIZER が自分のリソースにのみアクセスできることを確認する。
 * ADMIN はすべてのリソースにアクセス可。
 * @param {Object} user - requireRole() の戻り値
 * @param {string} resourceOrganizerId - リソースの organizerId
 * @returns {boolean}
 */
function requireOwnership(user, resourceOrganizerId) {
  if (user.role === ROLE.ADMIN) return true;
  if (user.role === ROLE.ORGANIZER && user.organizerId === resourceOrganizerId) return true;
  throw new Error('FORBIDDEN');
}

/**
 * PERFORMER が自分のプロフィールにのみアクセスできることを確認する。
 * @param {Object} user
 * @param {string} resourcePerformerId
 * @returns {boolean}
 */
function requireSelfOrAdmin(user, resourcePerformerId) {
  if (user.role === ROLE.ADMIN) return true;
  if (user.role === ROLE.PERFORMER && user.performerId === resourcePerformerId) return true;
  throw new Error('FORBIDDEN');
}
