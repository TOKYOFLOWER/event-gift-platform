/**
 * src/public/routes.js
 * 公開WebApp ルーティング
 * 変更履歴: 2026-03-02 Phase3 実装
 */

/**
 * GET ルーティング
 * @param {string} page
 * @param {Object} params - e.parameter
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function routeGet(page, params) {
  switch (page) {
    case 'eventList':
    case '':
      return renderEventList();

    case 'eventDetail':
      return renderEventDetail(params.eventId);

    case 'giftProducts':
      return renderGiftProducts(params);

    case 'giftCheckout':
      return renderGiftCheckout(params);

    case 'thankYou':
      return renderThankYou(params);

    case 'orderInquiry':
      return renderOrderInquiry(params);

    default:
      return buildPublicPage('ページが見つかりません',
        '<div class="container py-5 text-center"><h3>404 Not Found</h3>'
        + '<a href="' + ScriptApp.getService().getUrl() + '">← TOP へ戻る</a></div>');
  }
}

/**
 * POST ルーティング
 * action パラメータがある場合はフォーム処理、
 * ない場合は GMO-PG 結果通知として処理する。
 * @param {Object} params - e.parameter
 * @returns {GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput}
 */
function routePost(params) {
  var action = params.action || '';

  // GMO-PG 結果通知（OrderID パラメータで識別）
  if (!action && params.OrderID) {
    var result = handleGmoNotification(params);
    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.TEXT);
  }

  switch (action) {
    case 'giftCheckout':
      // 商品選択フォーム → チェックアウト画面
      return renderGiftCheckout(params);

    case 'createOrder':
      // 購入情報確定 → GMO-PG リダイレクト
      return createOrderAndRedirect(params, params.eventId, params.performerId);

    case 'inquireOrder':
      // 注文照会
      return renderOrderInquiry(params);

    default:
      return buildPublicPage('エラー',
        '<div class="container py-5"><p class="text-danger">不正なリクエストです。</p></div>');
  }
}
