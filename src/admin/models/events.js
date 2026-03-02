/**
 * shared/models/events.js
 * Events シートの CRUD
 * 変更履歴: 2026-03-01 初版
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

function listPublishedEvents() {
  return sheetGetAll(SHEET.EVENTS).rows.filter(function(r) {
    return r.status === EVENT_STATUS.PUBLISHED;
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
