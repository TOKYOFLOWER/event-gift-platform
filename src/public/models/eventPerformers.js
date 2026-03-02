/**
 * shared/models/eventPerformers.js
 * EventPerformers 多対多テーブルの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function assignPerformerToEvent(data) {
  requireFields(data, ['eventId', 'performerId', 'sortOrder']);
  var now = nowISO();
  var row = {
    eventId:        data.eventId,
    performerId:    data.performerId,
    sortOrder:      Number(data.sortOrder),
    isGiftEnabled:  data.isGiftEnabled !== false,  // デフォルト true
    createdAt:      now
  };
  sheetInsert(SHEET.EVENT_PERFORMERS, row);
  return row;
}

function listPerformersByEvent(eventId) {
  return sheetFindMany(SHEET.EVENT_PERFORMERS, 'eventId', eventId)
    .sort(function(a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
}

function listEventsByPerformer(performerId) {
  return sheetFindMany(SHEET.EVENT_PERFORMERS, 'performerId', performerId);
}

function updateEventPerformer(eventId, performerId, updates) {
  var sheet = getSheet(SHEET.EVENT_PERFORMERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var eIdx = headers.indexOf('eventId');
  var pIdx = headers.indexOf('performerId');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][eIdx]) === String(eventId) && String(data[i][pIdx]) === String(performerId)) {
      Object.keys(updates).forEach(function(field) {
        var colIdx = headers.indexOf(field);
        if (colIdx !== -1) sheet.getRange(i + 1, colIdx + 1).setValue(updates[field]);
      });
      return true;
    }
  }
  return false;
}

function removePerformerFromEvent(eventId, performerId) {
  var sheet = getSheet(SHEET.EVENT_PERFORMERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var eIdx = headers.indexOf('eventId');
  var pIdx = headers.indexOf('performerId');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][eIdx]) === String(eventId) && String(data[i][pIdx]) === String(performerId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}
