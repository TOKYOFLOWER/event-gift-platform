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

// ─────────────────────────────────────────────
// デバッグ関数（GASエディタから手動実行）
// ─────────────────────────────────────────────

/**
 * Events シートのデータを読んで Logger に出力する。
 * GAS エディタから直接実行してデバッグに使用する。
 *
 * 確認ポイント:
 *   1. SPREADSHEET_ID が Script Properties に設定されているか
 *   2. Events シートが存在するか
 *   3. ヘッダー行の列名が正しいか（スペース・大文字小文字）
 *   4. status の値が 'PUBLISHED' かどうか
 *   5. listPublishedEvents() が正しく動くか
 */
function debugListEvents() {
  Logger.log('========== debugListEvents 開始 ==========');

  // 1. SPREADSHEET_ID 確認
  var ssId = getScriptProperty(PROP.SPREADSHEET_ID);
  Logger.log('[1] SPREADSHEET_ID: ' + (ssId ? ssId : '⚠️ 未設定！'));
  if (!ssId) { Logger.log('Script Properties に SPREADSHEET_ID を設定してください。'); return; }

  // 2. シート存在確認
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET.EVENTS);
  Logger.log('[2] Events シート: ' + (sheet ? '✅ 存在' : '⚠️ 見つかりません！'));
  if (!sheet) return;

  // 3. 生データ確認
  var debugResult = sheetDebug(SHEET.EVENTS);

  // 4. listPublishedEvents の動作確認
  var published = listPublishedEvents();
  Logger.log('[4] listPublishedEvents() 件数: ' + published.length);
  if (published.length === 0) {
    Logger.log('    ⚠️ 0件です。以下を確認してください:');
    Logger.log('    - Eventsシートの "status" 列の値が "PUBLISHED" になっているか');
    Logger.log('    - 現在の全 status 値:');
    sheetGetAll(SHEET.EVENTS).rows.forEach(function(r, i) {
      Logger.log('      行' + (i + 1) + ' eventId=' + r.eventId + ' status=[' + r.status + '] title=' + r.title);
    });
  } else {
    published.forEach(function(ev) {
      Logger.log('    ✅ eventId=' + ev.eventId + ' title=' + ev.title + ' status=' + ev.status);
    });
  }

  // 5. 全イベント件数
  var all = listAllEvents();
  Logger.log('[5] listAllEvents() 件数: ' + all.length);
  all.forEach(function(ev, i) {
    Logger.log('    行' + (i + 1) + ': id=' + ev.eventId + ' status=[' + ev.status + '] title=' + ev.title);
  });

  Logger.log('========== debugListEvents 終了 ==========');
}

/**
 * SPREADSHEET_ID と主要 Script Properties を確認する。
 * GAS エディタから手動実行。
 */
function debugScriptProperties() {
  Logger.log('========== Script Properties ==========');
  var keys = [PROP.SPREADSHEET_ID, PROP.GMO_SHOP_ID, PROP.APP_ENV, PROP.ADMIN_NOTIFICATION_EMAIL];
  keys.forEach(function(k) {
    var v = getScriptProperty(k);
    Logger.log(k + ' = ' + (v ? (k === PROP.GMO_SHOP_PASS ? '***' : v) : '(未設定)'));
  });
  Logger.log('=======================================');
}

/**
 * Public API の doGet をシミュレートしてテストする。
 * GAS エディタから手動実行。
 * 実行後 Execution log に結果が表示される。
 */
function debugPublicListEvents() {
  Logger.log('========== debugPublicListEvents ==========');
  var events = listPublishedEvents();
  Logger.log('listPublishedEvents() → ' + events.length + ' 件');

  var result = {
    ok:   true,
    data: events.map(function(ev) { return { eventId: ev.eventId, title: ev.title, status: ev.status }; })
  };
  Logger.log(JSON.stringify(result));
  Logger.log('===========================================');
}

// ─────────────────────────────────────────────
// タイマー処理
// ─────────────────────────────────────────────

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
