/**
 * shared/config.js
 * 定数・シート名の定義
 * 変更履歴: 2026-03-01 初版
 */

// ---- シート名 ----
var SHEET = {
  USERS:            'Users',
  EVENT_SERIES:     'EventSeries',
  EVENTS:           'Events',
  EVENT_SESSIONS:   'EventSessions',
  TICKET_TYPES:     'TicketTypes',
  PERFORMERS:       'Performers',
  EVENT_PERFORMERS: 'EventPerformers',
  RECEIVERS:        'Receivers',
  PRODUCTS:         'Products',
  ORDERS:           'Orders',
  AUDIT_LOG:        'AuditLog',
  ATTRIBUTION:      'Attribution'
};

// ---- Enum 定義 ----
var ROLE = { ADMIN: 'ADMIN', ORGANIZER: 'ORGANIZER', PERFORMER: 'PERFORMER' };

var EVENT_STATUS = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', CLOSED: 'CLOSED' };

var PAYMENT_STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELED: 'CANCELED', REFUNDED: 'REFUNDED' };

var FULFILLMENT_STATUS = { NEW: 'NEW', PREPARING: 'PREPARING', SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED', RECEIVED: 'RECEIVED' };

var PRODUCT_CATEGORY = { FLOWER: 'FLOWER', ALCOHOL: 'ALCOHOL' };

var RECEIVE_TYPE = { VENUE: 'VENUE', AGENCY: 'AGENCY', PARTNER: 'PARTNER' };

var ENTITY_TYPE = { EVENT: 'EVENT', PERFORMER: 'PERFORMER', ORDER: 'ORDER', RECEIVER: 'RECEIVER', PRODUCT: 'PRODUCT' };

// ---- Script Properties キー ----
var PROP = {
  GMO_SHOP_ID:              'GMO_SHOP_ID',
  GMO_SHOP_PASS:            'GMO_SHOP_PASS',
  GMO_CONFIG_ID:            'GMO_CONFIG_ID',
  GMO_API_ENDPOINT:         'GMO_API_ENDPOINT',
  SPREADSHEET_ID:           'SPREADSHEET_ID',
  ADMIN_NOTIFICATION_EMAIL: 'ADMIN_NOTIFICATION_EMAIL',
  APP_ENV:                  'APP_ENV'
};

function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getSpreadsheet() {
  var id = getScriptProperty(PROP.SPREADSHEET_ID);
  if (!id) throw new Error('SPREADSHEET_ID is not set in Script Properties');
  return SpreadsheetApp.openById(id);
}

function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}
