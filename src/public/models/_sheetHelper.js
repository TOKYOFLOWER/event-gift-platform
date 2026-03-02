/**
 * shared/models/_sheetHelper.js
 * Google Sheets CRUD の共通ヘルパー関数群
 * 変更履歴:
 *   2026-03-01 初版
 *   2026-03-02 デバッグ修正
 *     - ヘッダー名をトリム（手動入力の空白対策）
 *     - 文字列セル値をトリム
 *     - 全列空の行をスキップ（Sheets の余分な空行対策）
 *     - isActive 等の boolean 文字列を JS boolean に正規化
 */

// ─────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────

/**
 * Sheets の getValues() が返す生の値を正規化する。
 *   - 文字列: 前後スペースをトリム
 *   - "TRUE"/"FALSE" 文字列: JS boolean に変換（手動入力対策）
 *   - Date オブジェクト: ISO 文字列に変換（セルが日付型の場合）
 *   - その他: そのまま
 * @param {*} v
 * @returns {*}
 */
function normalizeCell(v) {
  // null / undefined → 空文字列
  if (v === null || v === undefined) return '';

  // Date オブジェクト（Sheets の日付セル）→ ISO 文字列
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? '' : v.toISOString();
  }

  // boolean（Sheets のチェックボックスや =TRUE() セル）→ そのまま
  if (typeof v === 'boolean') return v;

  // number → そのまま
  if (typeof v === 'number') return v;

  // string → トリム + "TRUE"/"FALSE" を boolean に変換
  var s = String(v).trim();
  if (s === 'TRUE')  return true;
  if (s === 'FALSE') return false;
  return s;
}

/**
 * 行データが「完全に空」かどうか判定する（空行スキップ用）。
 * @param {Array} row - sheet.getValues() の1行
 * @returns {boolean}
 */
function isEmptyRow(row) {
  return row.every(function(v) {
    return v === '' || v === null || v === undefined;
  });
}

// ─────────────────────────────────────────────
// 公開 API
// ─────────────────────────────────────────────

/**
 * シートの全データを {headers, rows} として返す。
 * - ヘッダー名はトリム済み
 * - 完全に空の行はスキップ
 * - 各セル値は normalizeCell() で正規化
 *
 * @param {string} sheetName
 * @returns {{headers: string[], rows: Object[]}}
 */
function sheetGetAll(sheetName) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();

  if (!data || data.length < 1) return { headers: [], rows: [] };

  // ヘッダー行: トリムして正規化
  var headers = data[0].map(function(h) { return String(h).trim(); });

  if (data.length < 2) return { headers: headers, rows: [] };

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var rawRow = data[i];

    // 完全に空の行はスキップ（Sheets に余分な行がある場合の対策）
    if (isEmptyRow(rawRow)) continue;

    var obj = {};
    headers.forEach(function(h, idx) {
      // ヘッダーが空の列は無視
      if (h !== '') {
        obj[h] = normalizeCell(rawRow[idx]);
      }
    });
    rows.push(obj);
  }

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
  var target = String(keyVal).trim();
  for (var i = 0; i < result.rows.length; i++) {
    if (String(result.rows[i][keyCol]).trim() === target) return result.rows[i];
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
  var target = String(keyVal).trim();
  return result.rows.filter(function(r) {
    return String(r[keyCol]).trim() === target;
  });
}

/**
 * 新しい行を末尾に追加する。
 * @param {string} sheetName
 * @param {Object} rowData - ヘッダーに対応するキーを持つオブジェクト
 */
function sheetInsert(sheetName, rowData) {
  var sheet   = getSheet(sheetName);
  // ヘッダーを毎回トリムして読む
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
                     .map(function(h) { return String(h).trim(); });
  var row = headers.map(function(h) {
    if (h === '') return '';
    var v = rowData[h];
    return (v === undefined || v === null) ? '' : v;
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
  var sheet   = getSheet(sheetName);
  var data    = sheet.getDataRange().getValues();
  // ヘッダーをトリム
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('Column not found: ' + keyCol + ' in sheet: ' + sheetName);

  var target = String(keyVal).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]).trim() === target) {
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
    isActive:  false,
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
      return String(row[col]).trim() === String(filters[col]).trim();
    });
  });
}

/**
 * シートの生データをそのまま返す（デバッグ用）。
 * GAS エディタから直接呼び出して Logger で確認する。
 * @param {string} sheetName
 * @returns {{raw: Array[][], headers: string[], rows: Object[], rowCount: number}}
 */
function sheetDebug(sheetName) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  var result = sheetGetAll(sheetName);

  Logger.log('=== sheetDebug: ' + sheetName + ' ===');
  Logger.log('生データ行数: ' + data.length + ' (ヘッダー含む)');
  Logger.log('ヘッダー: ' + JSON.stringify(result.headers));
  Logger.log('有効データ行数: ' + result.rows.length);

  result.rows.forEach(function(row, i) {
    Logger.log('行' + (i + 1) + ': ' + JSON.stringify(row));
  });

  if (data.length > 1) {
    Logger.log('--- 生の2行目 (正規化前) ---');
    Logger.log(JSON.stringify(data[1]));
    Logger.log('--- 正規化後 ---');
    Logger.log(JSON.stringify(result.rows[0] || '(empty)'));
  }

  return {
    raw:      data,
    headers:  result.headers,
    rows:     result.rows,
    rowCount: result.rows.length
  };
}
