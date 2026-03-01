/**
 * shared/models/receivers.js
 * Receivers シートの CRUD（非公開: 住所・配送情報）
 * 変更履歴: 2026-03-01 初版
 * セキュリティ注意: このモデルの情報を Public WebApp から返してはならない
 */

function createReceiver(data) {
  requireFields(data, ['eventId', 'receiveType']);
  validateEnum(data.receiveType, RECEIVE_TYPE, 'receiveType');
  var now = nowISO();
  var row = {
    receiverId:      generateUuid(),
    eventId:         data.eventId,
    performerId:     data.performerId     || '',
    receiveType:     data.receiveType,
    internalLabel:   data.internalLabel   || '',
    shippingName:    data.shippingName    || '',
    shippingAddress: data.shippingAddress || '',
    shippingPhone:   data.shippingPhone   || '',
    notesInternal:   data.notesInternal   || '',
    isActive:        true,
    createdAt:       now,
    updatedAt:       now
  };
  sheetInsert(SHEET.RECEIVERS, row);
  return row;
}

function findReceiverById(receiverId) {
  return sheetFindOne(SHEET.RECEIVERS, 'receiverId', receiverId);
}

function listReceiversByEvent(eventId) {
  return sheetFindMany(SHEET.RECEIVERS, 'eventId', eventId).filter(function(r) { return r.isActive; });
}

function getDefaultReceiverForEvent(eventId) {
  var receivers = listReceiversByEvent(eventId);
  return receivers.find(function(r) { return !r.performerId; }) || receivers[0] || null;
}

function updateReceiver(receiverId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.RECEIVERS, 'receiverId', receiverId, updates);
}

function deactivateReceiver(receiverId) {
  return sheetSoftDelete(SHEET.RECEIVERS, 'receiverId', receiverId);
}
