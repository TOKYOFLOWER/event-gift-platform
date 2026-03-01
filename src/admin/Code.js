/**
 * src/admin/Code.js
 * Admin WebApp エントリポイント（Googleログイン必須）
 * 変更履歴: 2026-03-01 Phase1 スタブ作成
 */

function doGet(e) {
  try {
    var user = requireRole([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.PERFORMER]);
    var page = (e && e.parameter && e.parameter.page) || 'dashboard';
    // TODO Phase2: ルーティング実装
    return HtmlService.createHtmlOutput('<h1>Admin: ' + user.displayName + '</h1><p>page=' + page + '</p>');
  } catch (err) {
    if (err.message === 'LOGIN_REQUIRED' || err.message === 'ACCESS_DENIED' || err.message === 'FORBIDDEN') {
      return HtmlService.createHtmlOutput('<h1>アクセス権限がありません</h1><p>' + err.message + '</p>');
    }
    throw err;
  }
}
