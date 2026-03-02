/**
 * shared/setup.js
 * Google Sheets の初期化スクリプト（一度だけ手動実行）
 * GAS エディタから setupSpreadsheet() を実行してヘッダー行を一括作成する
 * 変更履歴: 2026-03-01 Phase2 実装
 */

/** 全シートのヘッダー定義 */
var SHEET_HEADERS = {
  Users:           ['userId','email','displayName','role','organizerId','performerId','isActive','createdAt','updatedAt'],
  EventSeries:     ['seriesId','seriesName','organizerId','description','isActive','createdAt','updatedAt'],
  Events:          ['eventId','organizerId','seriesId','seriesNumber','title','description','genre','category',
                    'venueName','venuePref','venueCity','venueAddress','venuePostalCode','venuePhone','venueUrl',
                    'venueAccess','ticketUrl','coverImageUrl','flyerImageUrl','contactInfo','eventNotes',
                    'status','giftDeadlineAt','createdAt','updatedAt'],
  EventSessions:   ['sessionId','eventId','sessionLabel','doorsAt','startAt','endAt','sortOrder','capacityNote','createdAt','updatedAt'],
  TicketTypes:     ['ticketTypeId','eventId','label','priceJPY','description','conditions','sortOrder','createdAt'],
  Performers:      ['performerId','displayName','titleOrGroup','bio','avatarUrl','snsUrl','isActive','createdAt','updatedAt'],
  EventPerformers: ['eventId','performerId','sortOrder','isGiftEnabled','createdAt'],
  Receivers:       ['receiverId','eventId','performerId','receiveType','internalLabel','shippingName','shippingAddress','shippingPhone','notesInternal','isActive','createdAt','updatedAt'],
  Products:        ['productId','name','category','priceJPY','description','imageUrl','isActive','sortOrder','createdAt','updatedAt'],
  Orders:          ['orderId','eventId','organizerId','performerId','receiverId','productId','qty','unitPriceJPY','totalJPY',
                    'buyerName','buyerEmail','buyerPhone','messageToPerformer','isMessagePublic','isAnonymous',
                    'gmoOrderId','gmoAccessId','gmoAccessPass','gmoTranId','paymentStatus','fulfillmentStatus','paidAt','createdAt','updatedAt'],
  AuditLog:        ['logId','actorEmail','action','entityType','entityId','beforeJson','afterJson','createdAt']
};

/**
 * スプレッドシートに全シートとヘッダー行を作成する。
 * 既存シートはスキップ（上書きしない）。
 * GAS エディタから一度だけ手動実行する。
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet();
  var created = [];
  var skipped = [];

  Object.keys(SHEET_HEADERS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      var headers = SHEET_HEADERS[name];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#343a40').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      created.push(name);
    } else {
      skipped.push(name);
    }
  });

  // Receivers シートを保護（ADMIN のみ編集）
  var receiversSheet = ss.getSheetByName('Receivers');
  if (receiversSheet) {
    var protection = receiversSheet.protect().setDescription('Receivers - 管理者のみ');
    protection.setWarningOnly(true); // オーナーは常に編集可能なため警告のみ
  }

  var msg = '✅ 作成: ' + created.join(', ') + '\n⏭ スキップ（既存）: ' + skipped.join(', ');
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

/**
 * GAS タイマートリガーの登録（一度だけ実行）
 */
function setupTriggers() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // 毎時: PENDING注文クリーンアップ
  ScriptApp.newTrigger('cleanupPendingOrders')
    .timeBased().everyHours(1).create();

  // 毎日 9:00: 締切過ぎたイベントの差し入れ受付を自動停止
  ScriptApp.newTrigger('closeExpiredEvents')
    .timeBased().everyDays(1).atHour(9).create();

  Logger.log('✅ トリガー設定完了');
}

/**
 * 差し入れ締切日を過ぎた PUBLISHED イベントを CLOSED にする（タイマー実行）
 */
function closeExpiredEvents() {
  var now    = new Date();
  var events = listPublishedEvents();
  events.forEach(function(ev) {
    if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) < now) {
      closeEvent(ev.eventId);
      writeAuditLog('SYSTEM', 'AUTO_CLOSE_EVENT', ENTITY_TYPE.EVENT, ev.eventId,
        { status: EVENT_STATUS.PUBLISHED }, { status: EVENT_STATUS.CLOSED });
      Logger.log('Auto-closed event: ' + ev.eventId + ' ' + ev.title);
    }
  });
}
