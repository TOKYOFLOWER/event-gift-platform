/**
 * shared/utils/uuid.js
 * UUID生成ユーティリティ。GAS の Utilities.getUuid() を使用。
 * 変更履歴: 2026-03-01 初版
 */

/**
 * 新しい UUID v4 を返す。
 * @returns {string}
 */
function generateUuid() {
  return Utilities.getUuid();
}
