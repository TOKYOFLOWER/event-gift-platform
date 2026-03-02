/**
 * src/admin/controllers/eventAdminController.js
 * Events / EventSessions / TicketTypes / EventPerformers / Receivers API
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

// ─────────────────────────────────────────────
// GET ハンドラー
// ─────────────────────────────────────────────

/**
 * GET ?action=listEvents
 * ADMIN: 全イベント / ORGANIZER: 自分のイベント
 */
function apiListEvents(user) {
  var events = user.role === ROLE.ADMIN
    ? listAllEvents()
    : listEventsByOrganizer(user.organizerId);
  return events;
}

/**
 * GET ?action=getEvent&id=xxx
 * イベント詳細＋関連データをまとめて返す
 */
function apiGetEvent(eventId, user) {
  if (!eventId) throw badRequest('id は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  return {
    event:       ev,
    sessions:    listSessionsByEvent(eventId),
    ticketTypes: listTicketTypesByEvent(eventId),
    performers:  listPerformersByEvent(eventId),
    receivers:   listReceiversByEvent(eventId)
  };
}

/**
 * GET ?action=listSessions&eventId=xxx
 */
function apiListSessions(eventId, user) {
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  return listSessionsByEvent(eventId);
}

/**
 * GET ?action=listTicketTypes&eventId=xxx
 */
function apiListTicketTypes(eventId, user) {
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  return listTicketTypesByEvent(eventId);
}

/**
 * GET ?action=listEventPerformers&eventId=xxx
 */
function apiListEventPerformers(eventId, user) {
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  var assigned = listPerformersByEvent(eventId);
  // 出演者マスターと結合して表示に必要な情報を付加する
  return assigned.map(function(ep) {
    var p = findPerformerById(ep.performerId);
    return Object.assign({}, ep, {
      displayName:  p ? p.displayName  : ep.performerId,
      titleOrGroup: p ? p.titleOrGroup : '',
      avatarUrl:    p ? p.avatarUrl    : ''
    });
  });
}

/**
 * GET ?action=listReceivers&eventId=xxx
 */
function apiListReceivers(eventId, user) {
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  return listReceiversByEvent(eventId);
}

// ─────────────────────────────────────────────
// POST ハンドラー — イベント CRUD
// ─────────────────────────────────────────────

/**
 * POST ?action=createEvent
 */
function apiCreateEvent(params, user) {
  var data = Object.assign({}, params);
  data.organizerId = (user.role === ROLE.ADMIN && params.organizerId)
    ? params.organizerId
    : (user.organizerId || user.userId);
  var ev = createEvent(data);
  writeAuditLog(user.email, 'CREATE_EVENT', ENTITY_TYPE.EVENT, ev.eventId, null, { title: ev.title });
  return ev;
}

/**
 * POST ?action=updateEvent
 * body: { id, title, ... }
 */
function apiUpdateEvent(params, user) {
  var eventId = params.id || params.eventId;
  if (!eventId) throw badRequest('id は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var updated = updateEvent(eventId, params);
  writeAuditLog(user.email, 'UPDATE_EVENT', ENTITY_TYPE.EVENT, eventId);
  return updated;
}

/**
 * POST ?action=publishEvent
 * body: { id }
 */
function apiPublishEvent(params, user) {
  var eventId = params.id || params.eventId;
  if (!eventId) throw badRequest('id は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var before = { status: ev.status };
  publishEvent(eventId);
  writeAuditLog(user.email, 'PUBLISH_EVENT', ENTITY_TYPE.EVENT, eventId, before, { status: EVENT_STATUS.PUBLISHED });
  return { eventId: eventId, status: EVENT_STATUS.PUBLISHED };
}

/**
 * POST ?action=closeEvent
 * body: { id }
 */
function apiCloseEvent(params, user) {
  var eventId = params.id || params.eventId;
  if (!eventId) throw badRequest('id は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var before = { status: ev.status };
  closeEvent(eventId);
  writeAuditLog(user.email, 'CLOSE_EVENT', ENTITY_TYPE.EVENT, eventId, before, { status: EVENT_STATUS.CLOSED });
  return { eventId: eventId, status: EVENT_STATUS.CLOSED };
}

// ─────────────────────────────────────────────
// POST ハンドラー — EventSessions
// ─────────────────────────────────────────────

/**
 * POST ?action=createSession
 * body: { eventId, sessionLabel, doorsAt, startAt, endAt, capacityNote }
 */
function apiCreateSession(params, user) {
  var eventId = params.eventId;
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  if (!params.sessionLabel) throw badRequest('sessionLabel は必須です');
  if (!params.startAt)      throw badRequest('startAt は必須です');

  var session = createEventSession({
    eventId:      eventId,
    sessionLabel: params.sessionLabel,
    doorsAt:      params.doorsAt ? toISO8601(params.doorsAt) : '',
    startAt:      toISO8601(params.startAt),
    endAt:        params.endAt ? toISO8601(params.endAt) : '',
    sortOrder:    listSessionsByEvent(eventId).length + 1,
    capacityNote: params.capacityNote || ''
  });
  return session;
}

/**
 * POST ?action=deleteSession
 * body: { sessionId, eventId }
 */
function apiDeleteSession(params, user) {
  var eventId = params.eventId;
  if (!eventId || !params.sessionId) throw badRequest('eventId と sessionId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  deleteEventSession(params.sessionId);
  return { deleted: true, sessionId: params.sessionId };
}

// ─────────────────────────────────────────────
// POST ハンドラー — TicketTypes
// ─────────────────────────────────────────────

/**
 * POST ?action=createTicketType
 * body: { eventId, label, priceJPY, description, conditions }
 */
function apiCreateTicketType(params, user) {
  var eventId = params.eventId;
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  if (!params.label)         throw badRequest('label は必須です');
  if (params.priceJPY == null) throw badRequest('priceJPY は必須です');

  var tt = createTicketType({
    eventId:     eventId,
    label:       params.label,
    priceJPY:    Number(params.priceJPY),
    description: params.description || '',
    conditions:  params.conditions  || '',
    sortOrder:   listTicketTypesByEvent(eventId).length + 1
  });
  return tt;
}

/**
 * POST ?action=deleteTicketType
 * body: { ticketTypeId, eventId }
 */
function apiDeleteTicketType(params, user) {
  var eventId = params.eventId;
  if (!eventId || !params.ticketTypeId) throw badRequest('eventId と ticketTypeId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  deleteTicketType(params.ticketTypeId);
  return { deleted: true, ticketTypeId: params.ticketTypeId };
}

// ─────────────────────────────────────────────
// POST ハンドラー — EventPerformers
// ─────────────────────────────────────────────

/**
 * POST ?action=assignPerformer
 * body: { eventId, performerId, sortOrder, isGiftEnabled }
 */
function apiAssignPerformer(params, user) {
  var eventId = params.eventId;
  if (!eventId || !params.performerId) throw badRequest('eventId と performerId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  var ep = assignPerformerToEvent({
    eventId:       eventId,
    performerId:   params.performerId,
    sortOrder:     Number(params.sortOrder) || (listPerformersByEvent(eventId).length + 1),
    isGiftEnabled: params.isGiftEnabled === true || params.isGiftEnabled === 'true' || params.isGiftEnabled === 'on'
  });
  return ep;
}

/**
 * POST ?action=removePerformer
 * body: { eventId, performerId }
 */
function apiRemovePerformer(params, user) {
  var eventId = params.eventId;
  if (!eventId || !params.performerId) throw badRequest('eventId と performerId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  removePerformerFromEvent(eventId, params.performerId);
  return { removed: true, eventId: eventId, performerId: params.performerId };
}

// ─────────────────────────────────────────────
// POST ハンドラー — Receivers
// ─────────────────────────────────────────────

/**
 * POST ?action=createReceiver
 */
function apiCreateReceiver(params, user) {
  var eventId = params.eventId;
  if (!eventId) throw badRequest('eventId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  if (!params.receiveType)  throw badRequest('receiveType は必須です');
  if (!params.shippingName) throw badRequest('shippingName は必須です');

  var receiver = createReceiver({
    eventId:         eventId,
    receiveType:     params.receiveType,
    internalLabel:   params.internalLabel   || '',
    shippingName:    params.shippingName,
    shippingAddress: params.shippingAddress || '',
    shippingPhone:   params.shippingPhone   || '',
    notesInternal:   params.notesInternal   || ''
  });
  return receiver;
}

/**
 * POST ?action=updateReceiver
 */
function apiUpdateReceiver(params, user) {
  var eventId    = params.eventId;
  var receiverId = params.receiverId;
  if (!eventId || !receiverId) throw badRequest('eventId と receiverId は必須です');
  var ev = findEventById(eventId);
  if (!ev) throw notFound('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);

  var updated = updateReceiver(receiverId, params);
  return updated;
}
