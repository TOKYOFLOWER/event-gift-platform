/**
 * src/public/Code.js
 * Public WebApp エントリポイント
 * 変更履歴:
 *   2026-03-01 Phase1 スタブ
 *   2026-03-02 Phase3 完全実装（全ページ + GMO-PG結果通知）
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var page   = params.page || 'eventList';
    return routeGet(page, params);
  } catch (err) {
    Logger.log('doGet error: ' + err.message + '\n' + (err.stack || ''));
    return buildPublicPage('エラー',
      '<div class="container py-5 text-center">'
      + '<h3>申し訳ありません</h3>'
      + '<p class="text-muted">予期しないエラーが発生しました。しばらくしてから再度お試しください。</p>'
      + '<a href="' + ScriptApp.getService().getUrl() + '">← TOP へ戻る</a>'
      + '</div>');
  }
}

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    return routePost(params);
  } catch (err) {
    // GMO-PG通知の場合はNGを返す、フォームの場合はエラーページ
    Logger.log('doPost error: ' + err.message);
    // params にカード情報が含まれる可能性があるので絶対にログしない
    if (!((e && e.parameter && e.parameter.action))) {
      // 結果通知への失敗応答
      return ContentService.createTextOutput('NG').setMimeType(ContentService.MimeType.TEXT);
    }
    return buildPublicPage('エラー',
      '<div class="container py-5 text-center">'
      + '<h3>エラーが発生しました</h3>'
      + '<p class="text-muted">' + escHtml(err.message) + '</p>'
      + '<a href="' + ScriptApp.getService().getUrl() + '">← TOP へ戻る</a>'
      + '</div>');
  }
}
