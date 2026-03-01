/**
 * shared/utils/email.js
 * GmailApp を使ったメール送信ユーティリティ
 * 変更履歴: 2026-03-01 初版
 */

/**
 * プレーンテキストメールを送信する。
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 */
function sendPlainEmail(to, subject, body) {
  GmailApp.sendEmail(to, subject, body);
}

/**
 * HTML メールを送信する。
 * @param {string} to
 * @param {string} subject
 * @param {string} htmlBody
 * @param {string} [plainBody]
 */
function sendHtmlEmail(to, subject, htmlBody, plainBody) {
  GmailApp.sendEmail(to, subject, plainBody || '', { htmlBody: htmlBody });
}

/**
 * 注文確定メールを購入者へ送信する。
 * @param {Object} order
 */
function sendOrderConfirmationEmail(order) {
  var subject = '【差し入れ注文確定】ご注文ありがとうございます - ' + order.gmoOrderId;
  var body = [
    order.buyerName + ' 様',
    '',
    'ご注文が確定しました。',
    '',
    '■ 注文番号: ' + order.gmoOrderId,
    '■ 商品: ' + (order.productName || order.productId),
    '■ 数量: ' + order.qty,
    '■ 合計: ¥' + order.totalJPY,
    '',
    'ご不明な点はお問い合わせください。'
  ].join('\n');

  sendPlainEmail(order.buyerEmail, subject, body);
}

/**
 * 新規差し入れ通知を運営へ送信する。
 * @param {Object} order
 */
function sendNewOrderNotificationToAdmin(order) {
  var adminEmail = getScriptProperty(PROP.ADMIN_NOTIFICATION_EMAIL);
  if (!adminEmail) return;

  var subject = '【新規差し入れ】注文ID: ' + order.gmoOrderId;
  var body = [
    '新規差し入れが確定しました。',
    '',
    '注文ID: ' + order.gmoOrderId,
    'イベントID: ' + order.eventId,
    '出演者ID: ' + order.performerId,
    '商品ID: ' + order.productId,
    '数量: ' + order.qty,
    '合計: ¥' + order.totalJPY
  ].join('\n');

  sendPlainEmail(adminEmail, subject, body);
}
