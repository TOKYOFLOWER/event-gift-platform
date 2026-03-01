/**
 * shared/models/users.js
 * Users シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createUser(data) {
  requireFields(data, ['email', 'displayName', 'role']);
  validateEnum(data.role, ROLE, 'role');
  validateEmail(data.email);

  var now = nowISO();
  var row = {
    userId:      generateUuid(),
    email:       data.email,
    displayName: data.displayName,
    role:        data.role,
    organizerId: data.organizerId || '',
    performerId: data.performerId || '',
    isActive:    true,
    createdAt:   now,
    updatedAt:   now
  };
  sheetInsert(SHEET.USERS, row);
  return row;
}

function findUserById(userId) {
  return sheetFindOne(SHEET.USERS, 'userId', userId);
}

function findUserByEmail(email) {
  return sheetFindOne(SHEET.USERS, 'email', email);
}

function listUsers(activeOnly) {
  var result = sheetGetAll(SHEET.USERS);
  if (activeOnly) return result.rows.filter(function(r) { return r.isActive; });
  return result.rows;
}

function updateUser(userId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.USERS, 'userId', userId, updates);
}

function deactivateUser(userId) {
  return sheetSoftDelete(SHEET.USERS, 'userId', userId);
}
