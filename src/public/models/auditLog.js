/**
 * shared/models/auditLog.js
 * AuditLog シートへの書き込み（読み取り専用リスト付き）
 * 変更履歴: 2026-03-01 初版
 * セキュリティ注意: beforeJson/afterJson に個人情報・秘密情報を含めない
 */

/**
 * 監査ログを記録する。
 * @param {string} actorEmail - 操作者メールアドレス（"SYSTEM" も可）
 * @param {string} action     - 操作内容（例: "PAYMENT_CONFIRMED"）
 * @param {string} entityType - ENTITY_TYPE の値
 * @param {string} entityId
 * @param {Object} [before]   - 変更前オブジェクト（省略可）
 * @param {Object} [after]    - 変更後オブジェクト（省略可）
 */
function writeAuditLog(actorEmail, action, entityType, entityId, before, after) {
  validateEnum(entityType, ENTITY_TYPE, 'entityType');
  var row = {
    logId:      generateUuid(),
    actorEmail: actorEmail,
    action:     action,
    entityType: entityType,
    entityId:   entityId,
    beforeJson: before ? JSON.stringify(before) : '',
    afterJson:  after  ? JSON.stringify(after)  : '',
    createdAt:  nowISO()
  };
  sheetInsert(SHEET.AUDIT_LOG, row);
  return row;
}

/**
 * 全監査ログを降順で返す（ADMIN 専用）。
 * @param {number} [limit=200]
 * @returns {Object[]}
 */
function listAuditLog(limit) {
  var rows = sheetGetAll(SHEET.AUDIT_LOG).rows;
  rows.sort(function(a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
  return limit ? rows.slice(0, limit) : rows.slice(0, 200);
}

/**
 * エンティティ単位の監査ログを返す。
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Object[]}
 */
function listAuditLogByEntity(entityType, entityId) {
  return sheetFilter(SHEET.AUDIT_LOG, { entityType: entityType, entityId: entityId })
    .sort(function(a, b) { return b.createdAt > a.createdAt ? 1 : -1; });
}
