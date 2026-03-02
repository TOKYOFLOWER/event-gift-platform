/**
 * shared/utils/validation.js
 * 入力バリデーションユーティリティ
 * 変更履歴: 2026-03-01 初版
 */

/**
 * 必須フィールドが存在するか検証する。
 * @param {Object} data
 * @param {string[]} fields
 * @throws {Error} 不足フィールドがある場合
 */
function requireFields(data, fields) {
  var missing = fields.filter(function(f) {
    return data[f] === undefined || data[f] === null || data[f] === '';
  });
  if (missing.length > 0) {
    throw new Error('MISSING_FIELDS: ' + missing.join(', '));
  }
}

/**
 * 文字列の最大長を検証する。
 * @param {string} value
 * @param {number} maxLen
 * @param {string} fieldName
 */
function validateMaxLength(value, maxLen, fieldName) {
  if (typeof value === 'string' && value.length > maxLen) {
    throw new Error('TOO_LONG: ' + fieldName + ' must be <= ' + maxLen + ' chars');
  }
}

/**
 * Enum 値の妥当性を検証する。
 * @param {string} value
 * @param {Object} enumObj - 例: ROLE, EVENT_STATUS
 * @param {string} fieldName
 */
function validateEnum(value, enumObj, fieldName) {
  var valid = Object.keys(enumObj).map(function(k) { return enumObj[k]; });
  if (valid.indexOf(value) === -1) {
    throw new Error('INVALID_ENUM: ' + fieldName + ' must be one of ' + valid.join(', '));
  }
}

/**
 * メールアドレスの簡易検証。
 * @param {string} email
 */
function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_EMAIL: ' + email);
  }
}

/**
 * 正の整数であることを検証する。
 * @param {*} value
 * @param {string} fieldName
 */
function validatePositiveInt(value, fieldName) {
  var n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('INVALID_INT: ' + fieldName + ' must be a non-negative integer');
  }
}

/**
 * ISO 8601 日時文字列を検証する。
 * @param {string} value
 * @param {string} fieldName
 */
function validateISO8601(value, fieldName) {
  if (value && isNaN(Date.parse(value))) {
    throw new Error('INVALID_DATETIME: ' + fieldName + ' must be ISO 8601 format');
  }
}

/**
 * 日時を ISO 8601 文字列（UTC）に変換する。
 * @param {Date|string} dt
 * @returns {string}
 */
function toISO8601(dt) {
  if (!dt) return '';
  var d = dt instanceof Date ? dt : new Date(dt);
  return d.toISOString();
}

/**
 * 現在時刻を ISO 8601 で返す。
 * @returns {string}
 */
function nowISO() {
  return new Date().toISOString();
}
