/**
 * src/public/Code.js
 * Public WebApp エントリポイント
 * 変更履歴: 2026-03-01 Phase1 スタブ作成
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'eventList';
  // TODO Phase3: ルーティング実装
  return HtmlService.createHtmlOutput('<h1>Event Gift Platform</h1><p>page=' + page + '</p>');
}

function doPost(e) {
  // GMO-PG 結果通知受信
  // TODO Phase3: handleGmoNotification(e.parameter) を呼ぶ
  return ContentService.createTextOutput('0').setMimeType(ContentService.MimeType.TEXT);
}
