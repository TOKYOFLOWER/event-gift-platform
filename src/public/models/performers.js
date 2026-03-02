/**
 * shared/models/performers.js
 * Performers シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createPerformer(data) {
  requireFields(data, ['displayName']);
  var now = nowISO();
  var row = {
    performerId:  generateUuid(),
    displayName:  data.displayName,
    titleOrGroup: data.titleOrGroup || '',
    bio:          data.bio          || '',
    avatarUrl:    data.avatarUrl    || '',
    snsUrl:       data.snsUrl       || '',
    isActive:     true,
    createdAt:    now,
    updatedAt:    now
  };
  sheetInsert(SHEET.PERFORMERS, row);
  return row;
}

function findPerformerById(performerId) {
  return sheetFindOne(SHEET.PERFORMERS, 'performerId', performerId);
}

function listAllPerformers(activeOnly) {
  var rows = sheetGetAll(SHEET.PERFORMERS).rows;
  return activeOnly ? rows.filter(function(r) { return r.isActive; }) : rows;
}

function updatePerformer(performerId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.PERFORMERS, 'performerId', performerId, updates);
}

function deactivatePerformer(performerId) {
  return sheetSoftDelete(SHEET.PERFORMERS, 'performerId', performerId);
}
