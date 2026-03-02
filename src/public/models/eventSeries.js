/**
 * shared/models/eventSeries.js
 * EventSeries シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createEventSeries(data) {
  requireFields(data, ['seriesName', 'organizerId']);
  var now = nowISO();
  var row = {
    seriesId:    generateUuid(),
    seriesName:  data.seriesName,
    organizerId: data.organizerId,
    description: data.description || '',
    isActive:    true,
    createdAt:   now,
    updatedAt:   now
  };
  sheetInsert(SHEET.EVENT_SERIES, row);
  return row;
}

function findEventSeriesById(seriesId) {
  return sheetFindOne(SHEET.EVENT_SERIES, 'seriesId', seriesId);
}

function listEventSeriesByOrganizer(organizerId) {
  return sheetFindMany(SHEET.EVENT_SERIES, 'organizerId', organizerId).filter(function(r) { return r.isActive; });
}

function listAllEventSeries() {
  return sheetGetAll(SHEET.EVENT_SERIES).rows.filter(function(r) { return r.isActive; });
}

function updateEventSeries(seriesId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.EVENT_SERIES, 'seriesId', seriesId, updates);
}

function deactivateEventSeries(seriesId) {
  return sheetSoftDelete(SHEET.EVENT_SERIES, 'seriesId', seriesId);
}
