/**
 * shared/models/eventSessions.js
 * EventSessions シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createEventSession(data) {
  requireFields(data, ['eventId', 'sessionLabel', 'startAt', 'endAt', 'sortOrder']);
  validateISO8601(data.startAt, 'startAt');
  validateISO8601(data.endAt, 'endAt');
  var now = nowISO();
  var row = {
    sessionId:    generateUuid(),
    eventId:      data.eventId,
    sessionLabel: data.sessionLabel,
    doorsAt:      data.doorsAt    || '',
    startAt:      data.startAt,
    endAt:        data.endAt,
    sortOrder:    data.sortOrder,
    capacityNote: data.capacityNote || '',
    createdAt:    now,
    updatedAt:    now
  };
  sheetInsert(SHEET.EVENT_SESSIONS, row);
  return row;
}

function findEventSessionById(sessionId) {
  return sheetFindOne(SHEET.EVENT_SESSIONS, 'sessionId', sessionId);
}

function listSessionsByEvent(eventId) {
  return sheetFindMany(SHEET.EVENT_SESSIONS, 'eventId', eventId)
    .sort(function(a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
}

function updateEventSession(sessionId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.EVENT_SESSIONS, 'sessionId', sessionId, updates);
}

function deleteEventSession(sessionId) {
  // 物理削除（セッションは論理削除不要）
  var sheet = getSheet(SHEET.EVENT_SESSIONS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = headers.indexOf('sessionId');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(sessionId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * イベントの全セッションを一括置換（削除→再挿入）
 * @param {string} eventId
 * @param {Object[]} sessions
 */
function replaceEventSessions(eventId, sessions) {
  var sheet = getSheet(SHEET.EVENT_SESSIONS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var eventIdIdx = headers.indexOf('eventId');

  // 既存行を後ろから削除
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][eventIdIdx]) === String(eventId)) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新規挿入
  sessions.forEach(function(s, idx) {
    s.eventId = eventId;
    s.sortOrder = s.sortOrder || idx + 1;
    createEventSession(s);
  });
}
