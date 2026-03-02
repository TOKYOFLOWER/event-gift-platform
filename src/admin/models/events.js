/**
 * shared/models/events.js
 * Events シートの CRUD
 * 変更履歴:
 *   2026-03-01 初版
 *   2026-03-02 listPublishedEvents の比較をロバストに修正（大文字小文字・スペース対応）
 */

function createEvent(data) {
  requireFields(data, ['organizerId', 'title', 'venueName']);
  var now = nowISO();
  var row = {
    eventId:         generateUuid(),
    organizerId:     data.organizerId,
    seriesId:        data.seriesId        || '',
    seriesNumber:    data.seriesNumber    || '',
    title:           data.title,
    description:     data.description    || '',
    genre:           data.genre           || '',
    category:        data.category        || '',
    venueName:       data.venueName,
    venuePref:       data.venuePref       || '',
    venueCity:       data.venueCity       || '',
    venueAddress:    data.venueAddress    || '',
    venuePostalCode: data.venuePostalCode || '',
    venuePhone:      data.venuePhone      || '',
    venueUrl:        data.venueUrl        || '',
    venueAccess:     data.venueAccess     || '',
    ticketUrl:       data.ticketUrl       || '',
    coverImageUrl:   data.coverImageUrl   || '',
    flyerImageUrl:   data.flyerImageUrl   || '',
    contactInfo:     data.contactInfo     || '',
    eventNotes:      data.eventNotes      || '',
    status:          EVENT_STATUS.DRAFT,
    giftDeadlineAt:  data.giftDeadlineAt  || '',
    createdAt:       now,
    updatedAt:       now
  };
  sheetInsert(SHEET.EVENTS, row);
  return row;
}

function findEventById(eventId) {
  return sheetFindOne(SHEET.EVENTS, 'eventId', eventId);
}

/**
 * 公開中のイベント一覧を返す。
 * status の比較は大文字小文字を無視し、前後スペースをトリムして行う。
 * （シートに手動入力された 'published' や ' PUBLISHED ' にも対応）
 */
function listPublishedEvents() {
  return sheetGetAll(SHEET.EVENTS).rows.filter(function(r) {
    return normalizeStatus(r.status) === EVENT_STATUS.PUBLISHED;
  });
}

function listEventsByOrganizer(organizerId) {
  return sheetFindMany(SHEET.EVENTS, 'organizerId', organizerId);
}

function listAllEvents() {
  return sheetGetAll(SHEET.EVENTS).rows;
}

function updateEvent(eventId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.EVENTS, 'eventId', eventId, updates);
}

function publishEvent(eventId) {
  return updateEvent(eventId, { status: EVENT_STATUS.PUBLISHED });
}

function closeEvent(eventId) {
  return updateEvent(eventId, { status: EVENT_STATUS.CLOSED });
}

/**
 * status 値を正規化して大文字文字列で返す。
 * 'published' → 'PUBLISHED', ' Draft ' → 'DRAFT', etc.
 * @param {*} v
 * @returns {string}
 */
function normalizeStatus(v) {
  return String(v === null || v === undefined ? '' : v).trim().toUpperCase();
}
