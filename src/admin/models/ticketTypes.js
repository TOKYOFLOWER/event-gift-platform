/**
 * shared/models/ticketTypes.js
 * TicketTypes シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createTicketType(data) {
  requireFields(data, ['eventId', 'label', 'priceJPY', 'sortOrder']);
  validatePositiveInt(data.priceJPY, 'priceJPY');
  var now = nowISO();
  var row = {
    ticketTypeId: generateUuid(),
    eventId:      data.eventId,
    label:        data.label,
    priceJPY:     Number(data.priceJPY),
    description:  data.description  || '',
    conditions:   data.conditions   || '',
    sortOrder:    Number(data.sortOrder),
    createdAt:    now
  };
  sheetInsert(SHEET.TICKET_TYPES, row);
  return row;
}

function findTicketTypeById(ticketTypeId) {
  return sheetFindOne(SHEET.TICKET_TYPES, 'ticketTypeId', ticketTypeId);
}

function listTicketTypesByEvent(eventId) {
  return sheetFindMany(SHEET.TICKET_TYPES, 'eventId', eventId)
    .sort(function(a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
}

function updateTicketType(ticketTypeId, updates) {
  return sheetUpdate(SHEET.TICKET_TYPES, 'ticketTypeId', ticketTypeId, updates);
}

function deleteTicketType(ticketTypeId) {
  var sheet = getSheet(SHEET.TICKET_TYPES);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = headers.indexOf('ticketTypeId');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(ticketTypeId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function replaceTicketTypes(eventId, types) {
  var sheet = getSheet(SHEET.TICKET_TYPES);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var eventIdIdx = headers.indexOf('eventId');
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][eventIdIdx]) === String(eventId)) sheet.deleteRow(i + 1);
  }
  types.forEach(function(t, idx) {
    t.eventId = eventId;
    t.sortOrder = t.sortOrder || idx + 1;
    createTicketType(t);
  });
}
