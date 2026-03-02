/**
 * src/public/controllers/eventController.js
 * Public イベント API
 * 変更履歴:
 *   2026-03-02 Phase3 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=listEvents[&pref=xxx][&q=xxx]
 * 公開中イベント一覧。差し入れ締切順ソート。
 * @returns {Array<Object>}
 */
function apiListPublicEvents(params) {
  var events = listPublishedEvents();
  var now    = new Date();

  // 任意フィルタ: 都道府県
  if (params.pref) {
    events = events.filter(function(ev) { return ev.venuePref === params.pref; });
  }
  // 任意フィルタ: キーワード（タイトル・会場名）
  if (params.q) {
    var q = params.q.toLowerCase();
    events = events.filter(function(ev) {
      return (ev.title      || '').toLowerCase().indexOf(q) !== -1
          || (ev.venueName  || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  // 締切日順ソート（null は末尾）
  events.sort(function(a, b) {
    var da = a.giftDeadlineAt ? new Date(a.giftDeadlineAt) : new Date('2099-12-31');
    var db = b.giftDeadlineAt ? new Date(b.giftDeadlineAt) : new Date('2099-12-31');
    return da - db;
  });

  // セッション・出演者サマリーを付加
  return events.map(function(ev) {
    var sessions   = listSessionsByEvent(ev.eventId);
    var performers = listPerformersByEvent(ev.eventId);
    var isGiftOpen = !ev.giftDeadlineAt || new Date(ev.giftDeadlineAt) > now;

    var performerSummary = performers.map(function(ep) {
      var p = findPerformerById(ep.performerId);
      return {
        performerId:   ep.performerId,
        displayName:   p ? p.displayName   : ep.performerId,
        titleOrGroup:  p ? p.titleOrGroup  : '',
        avatarUrl:     p ? p.avatarUrl     : '',
        isGiftEnabled: ep.isGiftEnabled
      };
    });

    var firstSession = sessions.length > 0 ? sessions[0] : null;

    return {
      eventId:         ev.eventId,
      title:           ev.title,
      genre:           ev.genre,
      category:        ev.category,
      venueName:       ev.venueName,
      venuePref:       ev.venuePref,
      coverImageUrl:   ev.coverImageUrl,
      giftDeadlineAt:  ev.giftDeadlineAt,
      isGiftOpen:      isGiftOpen,
      firstSessionAt:  firstSession ? firstSession.startAt : null,
      performers:      performerSummary
    };
  });
}

/**
 * GET ?action=getEvent&id=xxx
 * イベント詳細＋全関連データ＋公開メッセージ
 * @param {string} eventId
 * @returns {Object}
 */
function apiGetPublicEvent(eventId) {
  if (!eventId) throw badRequest('id は必須です');

  var ev = findEventById(eventId);
  if (!ev || normalizeStatus(ev.status) !== EVENT_STATUS.PUBLISHED) {
    throw notFound('イベントが見つかりません');
  }

  var now      = new Date();
  var isGiftOpen = !ev.giftDeadlineAt || new Date(ev.giftDeadlineAt) > now;

  // セッション一覧
  var sessions = listSessionsByEvent(eventId);

  // 券種一覧
  var ticketTypes = listTicketTypesByEvent(eventId);

  // 出演者一覧（詳細付き）
  var epList = listPerformersByEvent(eventId);
  var performers = epList.map(function(ep) {
    var p = findPerformerById(ep.performerId);
    return {
      performerId:   ep.performerId,
      displayName:   p ? p.displayName   : ep.performerId,
      titleOrGroup:  p ? p.titleOrGroup  : '',
      bio:           p ? p.bio           : '',
      avatarUrl:     p ? p.avatarUrl     : '',
      snsUrl:        p ? p.snsUrl        : '',
      isGiftEnabled: ep.isGiftEnabled,
      sortOrder:     ep.sortOrder
    };
  });

  // 公開メッセージ（決済済み & 公開設定のもの）
  var publicMessages = listOrdersByEvent(eventId)
    .filter(function(o) {
      return o.paymentStatus === PAYMENT_STATUS.PAID
          && o.isMessagePublic
          && o.messageToPerformer;
    })
    .slice(0, 50)
    .map(function(o) {
      var perf = findPerformerById(o.performerId);
      return {
        orderId:          o.orderId,
        performerId:      o.performerId,
        performerName:    perf ? perf.displayName : o.performerId,
        message:          o.messageToPerformer,
        buyerName:        o.isAnonymous ? null : (o.buyerName || null),
        isAnonymous:      o.isAnonymous,
        paidAt:           o.paidAt
      };
    });

  return {
    event: {
      eventId:        ev.eventId,
      title:          ev.title,
      genre:          ev.genre,
      category:       ev.category,
      description:    ev.description,
      eventNotes:     ev.eventNotes,
      contactInfo:    ev.contactInfo,
      venueName:      ev.venueName,
      venuePref:      ev.venuePref,
      venueCity:      ev.venueCity,
      venueAddress:   ev.venueAddress,
      venuePostalCode: ev.venuePostalCode,
      venuePhone:     ev.venuePhone,
      venueUrl:       ev.venueUrl,
      venueAccess:    ev.venueAccess,
      coverImageUrl:  ev.coverImageUrl,
      flyerImageUrl:  ev.flyerImageUrl,
      ticketUrl:      ev.ticketUrl,
      giftDeadlineAt: ev.giftDeadlineAt,
      isGiftOpen:     isGiftOpen
    },
    sessions:       sessions,
    ticketTypes:    ticketTypes,
    performers:     performers,
    publicMessages: publicMessages
  };
}
