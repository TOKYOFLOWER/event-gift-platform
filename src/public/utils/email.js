/**
 * shared/utils/email.js
 * GmailApp を使ったメール送信ユーティリティ
 * 変更履歴:
 *   2026-03-01 Phase2 初版
 *   2026-03-02 Phase3 注文確定メール・テンプレート強化
 * セキュリティ注意: 個人情報をLogger.logに出力しない
 */

function sendPlainEmail(to, subject, body) {
  GmailApp.sendEmail(to, subject, body);
}

function sendHtmlEmail(to, subject, htmlBody, plainBody) {
  GmailApp.sendEmail(to, subject, plainBody || '', { htmlBody: htmlBody });
}

/**
 * 注文確定メールを購入者へ送信する。
 * @param {Object} order - Ordersシートの行オブジェクト
 */
function sendOrderConfirmationEmail(order) {
  var product  = findProductById(order.productId);
  var ev       = findEventById(order.eventId);
  var performer = findPerformerById(order.performerId);

  var subject = '【差し入れ注文確定】' + (ev ? ev.title : '') + ' - ' + order.gmoOrderId;

  var html = '<div style="font-family:sans-serif;max-width:600px;margin:auto">'
    + '<div style="background:#c0392b;color:#fff;padding:24px;border-radius:8px 8px 0 0">'
    + '<h2 style="margin:0">🌸 ご注文ありがとうございます</h2></div>'
    + '<div style="padding:24px;border:1px solid #eee;border-radius:0 0 8px 8px">'
    + '<p>' + escHtml(order.buyerName || 'お客様') + ' 様</p>'
    + '<p>差し入れのご注文が確定しました。</p>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
    + '<tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #eee"><strong>注文番号</strong></td><td style="padding:8px;border:1px solid #eee;font-family:monospace">' + escHtml(order.gmoOrderId) + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #eee"><strong>商品</strong></td><td style="padding:8px;border:1px solid #eee">' + escHtml(product ? product.name : order.productId) + '</td></tr>'
    + '<tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #eee"><strong>数量</strong></td><td style="padding:8px;border:1px solid #eee">' + escHtml(String(order.qty)) + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #eee"><strong>合計金額</strong></td><td style="padding:8px;border:1px solid #eee;color:#c0392b;font-weight:bold">¥' + Number(order.totalJPY).toLocaleString() + '</td></tr>'
    + '<tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #eee"><strong>宛先</strong></td><td style="padding:8px;border:1px solid #eee">' + escHtml(performer ? performer.displayName : '') + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #eee"><strong>イベント</strong></td><td style="padding:8px;border:1px solid #eee">' + escHtml(ev ? ev.title : '') + '</td></tr>'
    + '</table>'
    + '<p style="color:#888;font-size:13px">差し入れは会場でまとめて出演者にお渡しします。<br>お問い合わせは注文番号をご提示ください。</p>'
    + '</div></div>';

  var plain = [
    (order.buyerName || 'お客様') + ' 様',
    '',
    '差し入れのご注文が確定しました。',
    '',
    '注文番号: ' + order.gmoOrderId,
    '商品: ' + (product ? product.name : order.productId),
    '数量: ' + order.qty,
    '合計: ¥' + order.totalJPY,
    '宛先: ' + (performer ? performer.displayName : ''),
    'イベント: ' + (ev ? ev.title : '')
  ].join('\n');

  sendHtmlEmail(order.buyerEmail, subject, html, plain);
}

/**
 * 新規差し入れ通知を運営・主催者へ送信する。
 * @param {Object} order
 */
function sendNewOrderNotificationToAdmin(order) {
  var adminEmail = getScriptProperty(PROP.ADMIN_NOTIFICATION_EMAIL);
  if (!adminEmail) return;

  var product  = findProductById(order.productId);
  var ev       = findEventById(order.eventId);
  var performer = findPerformerById(order.performerId);

  var subject = '【新規差し入れ】' + (ev ? ev.title : '') + ' / ' + (performer ? performer.displayName : '');
  var body = [
    '新規差し入れが確定しました。',
    '',
    '注文ID: ' + order.gmoOrderId,
    '商品: ' + (product ? product.name : order.productId),
    '数量: ' + order.qty,
    '金額: ¥' + order.totalJPY,
    '出演者: ' + (performer ? performer.displayName : ''),
    'イベント: ' + (ev ? ev.title : '')
  ].join('\n');

  sendPlainEmail(adminEmail, subject, body);
}
