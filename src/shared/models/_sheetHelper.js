/**
 * shared/models/_sheetHelper.js
 * Google Sheets CRUD の共通ヘルパー関数群
 * 変更履歴: 2026-03-01 初版
 */

/**
 * シートの全データを {headers, rows} として返す。
 * @param {string} sheetName
 * @returns {{headers: string[], rows: Object[]}}
 */
function sheetGetAll(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { headers: data[0] || [], rows: [] };
  var headers = data[0];
  var rows = data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
  return { headers: headers, rows: rows };
}

/**
 * 条件に一致する最初の行を返す。
 * @param {string} sheetName
 * @param {string} keyCol
 * @param {*} keyVal
 * @returns {Object|null}
 */
function sheetFindOne(sheetName, keyCol, keyVal) {
  var result = sheetGetAll(sheetName);
  for (var i = 0; i < result.rows.length; i++) {
    if (String(result.rows[i][keyCol]) === String(keyVal)) return result.rows[i];
  }
  return null;
}

/**
 * 条件に一致する全行を返す。
 * @param {string} sheetName
 * @param {string} keyCol
 * @param {*} keyVal
 * @returns {Object[]}
 */
function sheetFindMany(sheetName, keyCol, keyVal) {
  var result = sheetGetAll(sheetName);
  return result.rows.filter(function(r) {
    return String(r[keyCol]) === String(keyVal);
  });
}

/**
 * 新しい行を末尾に追加する。
 * @param {string} sheetName
 * @param {Object} rowData - ヘッダーに対応するキーを持つオブジェクト
 */
function sheetInsert(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) {
    var v = rowData[h];
    return v === undefined || v === null ? '' : v;
  });
  sheet.appendRow(row);
}

/**
 * keyCol = keyVal に一致する行を更新する。
 * @param {string} sheetName
 * @param {string} keyCol
 * @param {*} keyVal
 * @param {Object} updates - 更新するフィールドのみ
 * @returns {boolean} 更新できた場合 true
 */
function sheetUpdate(sheetName, keyCol, keyVal, updates) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('Column not found: ' + keyCol);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      Object.keys(updates).forEach(function(field) {
        var colIdx = headers.indexOf(field);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[field]);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * keyCol = keyVal に一致する行を「論理削除」する（isActive = false）。
 * @param {string} sheetName
 * @param {string} keyCol
 * @param {*} keyVal
 * @returns {boolean}
 */
function sheetSoftDelete(sheetName, keyCol, keyVal) {
  return sheetUpdate(sheetName, keyCol, keyVal, {
    isActive: false,
    updatedAt: nowISO()
  });
}

/**
 * 複数条件でフィルタリングする。
 * @param {string} sheetName
 * @param {Object} filters - { col: val, ... }
 * @returns {Object[]}
 */
function sheetFilter(sheetName, filters) {
  var result = sheetGetAll(sheetName);
  return result.rows.filter(function(row) {
    return Object.keys(filters).every(function(col) {
      if (filters[col] === undefined || filters[col] === null) return true;
      return String(row[col]) === String(filters[col]);
    });
  });
}
