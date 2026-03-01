/**
 * src/public/controllers/eventController.js
 * P1: イベント一覧, P2: イベント詳細
 * 変更履歴: 2026-03-02 Phase3 実装
 */

// ===== P1: Event List =====

function renderEventList() {
  var events = listPublishedEvents();
  var now    = new Date();
  var base   = ScriptApp.getService().getUrl();

  // 直近・今後のイベントを日付順ソート
  events.sort(function(a, b) {
    var da = a.giftDeadlineAt ? new Date(a.giftDeadlineAt) : new Date('2099');
    var db = b.giftDeadlineAt ? new Date(b.giftDeadlineAt) : new Date('2099');
    return da - db;
  });

  var cards = events.map(function(ev) {
    var sessions   = listSessionsByEvent(ev.eventId);
    var performers = listPerformersByEvent(ev.eventId);
    var isOpen     = !ev.giftDeadlineAt || new Date(ev.giftDeadlineAt) > now;
    var firstSess  = sessions[0];

    var coverImg = ev.coverImageUrl
      ? '<img src="' + escHtml(ev.coverImageUrl) + '" class="card-img-top" style="height:200px;object-fit:cover" alt="">'
      : '<div style="height:140px;background:linear-gradient(135deg,#c0392b,#922b21);display:flex;align-items:center;justify-content:center"><span style="font-size:3rem">🌸</span></div>';

    var dateStr = firstSess
      ? formatDateOnlyJST(firstSess.startAt)
      : (ev.giftDeadlineAt ? '締切: ' + formatDateOnlyJST(ev.giftDeadlineAt) : '');

    var perfNames = performers.slice(0, 3).map(function(p) {
      var perf = findPerformerById(p.performerId);
      return perf ? escHtml(perf.displayName) : '';
    }).filter(Boolean).join(' / ');

    var badge = isOpen
      ? '<span class="badge bg-danger">🌸 受付中</span>'
      : '<span class="badge bg-secondary">受付終了</span>';

    return '<div class="col-md-6 col-lg-4">'
      + '<div class="card event-card h-100">'
      + coverImg
      + '<div class="card-body">'
      + '<div class="mb-1">' + badge + '</div>'
      + '<h5 class="card-title fw-bold">' + escHtml(ev.title) + '</h5>'
      + '<p class="text-muted small mb-1">📅 ' + escHtml(dateStr) + '</p>'
      + '<p class="text-muted small mb-1">📍 ' + escHtml(ev.venueName) + (ev.venuePref ? '（' + ev.venuePref + '）' : '') + '</p>'
      + (perfNames ? '<p class="small mb-2">🎤 ' + perfNames + '</p>' : '')
      + '</div>'
      + '<div class="card-footer bg-white border-0">'
      + '<a href="' + base + '?page=eventDetail&eventId=' + escHtml(ev.eventId) + '" class="gift-btn d-block text-center text-decoration-none py-2 rounded-pill">詳細を見る →</a>'
      + '</div></div></div>';
  }).join('');

  var hero = '<div class="hero text-center">'
    + '<h1>🌸 大切な人へ、花の差し入れを</h1>'
    + '<p class="lead mb-0">コンサート・ライブ・発表会の出演者へ。住所不要で贈れます。</p>'
    + '</div>';

  var body = hero
    + '<div class="container py-5">'
    + '<h2 class="section-title">開催中・近日開催のイベント</h2>'
    + (cards
        ? '<div class="row g-4">' + cards + '</div>'
        : '<div class="text-center py-5 text-muted"><p>現在、差し入れ受付中のイベントはありません。</p></div>')
    + '</div>';

  return buildPublicPage('イベント一覧', body);
}

// ===== P2: Event Detail =====

function renderEventDetail(eventId) {
  if (!eventId) return renderEventList();
  var ev = findEventById(eventId);
  if (!ev || ev.status !== EVENT_STATUS.PUBLISHED) {
    return buildPublicPage('イベントが見つかりません',
      '<div class="container py-5 text-center"><h3>このイベントは見つかりません</h3><a href="' + ScriptApp.getService().getUrl() + '">← イベント一覧</a></div>');
  }

  var now        = new Date();
  var isGiftOpen = !ev.giftDeadlineAt || new Date(ev.giftDeadlineAt) > now;
  var sessions   = listSessionsByEvent(eventId);
  var tickets    = listTicketTypesByEvent(eventId);
  var epList     = listPerformersByEvent(eventId);
  var base       = ScriptApp.getService().getUrl();

  // ---- カバー画像 ----
  var cover = ev.coverImageUrl
    ? '<div style="height:320px;overflow:hidden"><img src="' + escHtml(ev.coverImageUrl) + '" class="w-100 h-100" style="object-fit:cover" alt="' + escHtml(ev.title) + '"></div>'
    : '<div style="height:200px;background:linear-gradient(135deg,#c0392b,#922b21);display:flex;align-items:center;justify-content:center"><span style="font-size:5rem">🌸</span></div>';

  // ---- セッション一覧 ----
  var sessionHtml = sessions.map(function(s) {
    return '<div class="d-flex gap-3 align-items-start mb-2">'
      + '<span style="font-size:1.2rem">🍽</span>'
      + '<div><strong>' + escHtml(s.sessionLabel) + '</strong><br>'
      + '<span class="text-muted small">'
      + (s.doorsAt ? 'open ' + formatDateJST(s.doorsAt).slice(-5) + ' / ' : '')
      + 'start ' + formatDateJST(s.startAt).slice(-5)
      + (s.endAt ? ' / close ' + formatDateJST(s.endAt).slice(-5) : '')
      + '</span></div></div>';
  }).join('');

  // ---- チケット料金 ----
  var ticketHtml = tickets.map(function(t) {
    return '<li class="list-group-item d-flex justify-content-between align-items-center">'
      + '<div><strong>' + escHtml(t.label) + '</strong>'
      + (t.description ? '<br><small class="text-muted">' + escHtml(t.description) + '</small>' : '')
      + (t.conditions   ? '<br><small class="text-danger">' + escHtml(t.conditions) + '</small>' : '')
      + '</div>'
      + '<span class="fw-bold">¥' + Number(t.priceJPY).toLocaleString() + '</span>'
      + '</li>';
  }).join('');

  // ---- 会場情報 ----
  var mapQuery = encodeURIComponent([ev.venueName, ev.venuePref, ev.venueCity, ev.venueAddress].filter(Boolean).join(' '));
  var venueHtml = '<p class="mb-1"><strong>' + escHtml(ev.venueName) + '</strong></p>'
    + [ev.venuePostalCode ? '〒' + ev.venuePostalCode : '',
       [ev.venuePref, ev.venueCity, ev.venueAddress].filter(Boolean).join('')].filter(Boolean).map(function(s) {
      return '<p class="text-muted small mb-0">' + escHtml(s) + '</p>';
    }).join('')
    + (ev.venueAccess ? '<p class="small mt-1">🚃 ' + escHtml(ev.venueAccess) + '</p>' : '')
    + '<a href="https://maps.google.com/?q=' + mapQuery + '" target="_blank" class="btn btn-outline-secondary btn-sm mt-1">Google Maps で見る</a>';

  // ---- 出演者・差し入れボタン ----
  var performersHtml = epList.map(function(ep) {
    var p = findPerformerById(ep.performerId);
    if (!p) return '';

    var avatar = p.avatarUrl
      ? '<img src="' + escHtml(p.avatarUrl) + '" class="performer-avatar" alt="' + escHtml(p.displayName) + '">'
      : '<div class="performer-avatar-placeholder">🎤</div>';

    var giftBtn = '';
    if (ep.isGiftEnabled) {
      if (isGiftOpen) {
        giftBtn = '<a href="' + base + '?page=giftProducts&eventId=' + escHtml(eventId) + '&performerId=' + escHtml(ep.performerId) + '"'
          + ' class="gift-btn d-inline-block text-decoration-none mt-2 px-3 py-2">🌸 差し入れを贈る</a>';
      } else {
        giftBtn = '<span class="badge bg-secondary mt-2">受付終了</span>';
      }
    }

    return '<div class="col-6 col-md-4 col-lg-3">'
      + '<div class="performer-card">'
      + avatar
      + '<p class="fw-bold mb-0 mt-2">' + escHtml(p.displayName) + '</p>'
      + (p.titleOrGroup ? '<p class="text-muted small mb-1">' + escHtml(p.titleOrGroup) + '</p>' : '')
      + (p.snsUrl ? '<a href="' + escHtml(p.snsUrl) + '" target="_blank" class="small text-muted">SNS</a>' : '')
      + '<div>' + giftBtn + '</div>'
      + '</div></div>';
  }).join('');

  // ---- 公開メッセージ ----
  var pubMessages = listOrdersByEvent(eventId).filter(function(o) {
    return o.paymentStatus === PAYMENT_STATUS.PAID && o.isMessagePublic && o.messageToPerformer;
  });
  var messagesHtml = pubMessages.slice(0, 20).map(function(o) {
    var perf = findPerformerById(o.performerId);
    var name = o.isAnonymous ? '匿名' : escHtml(o.buyerName || '匿名');
    return '<div class="border rounded p-3 mb-2">'
      + '<p class="mb-1">' + escHtml(o.messageToPerformer) + '</p>'
      + '<small class="text-muted">— ' + name
      + (perf ? ' → ' + escHtml(perf.displayName) : '') + '</small>'
      + '</div>';
  }).join('');

  // ---- 差し入れ締切バナー ----
  var deadlineBanner = '';
  if (ev.giftDeadlineAt) {
    if (isGiftOpen) {
      deadlineBanner = '<div class="alert alert-warning d-flex align-items-center gap-2">'
        + '⏰ <strong>差し入れ受付締切:</strong> ' + formatDateJST(ev.giftDeadlineAt) + '</div>';
    } else {
      deadlineBanner = '<div class="alert alert-secondary">差し入れの受付は終了しました。</div>';
    }
  }

  var body = cover
    + '<div class="container py-4">'
    + '<nav aria-label="breadcrumb"><ol class="breadcrumb small"><li class="breadcrumb-item"><a href="' + base + '">イベント一覧</a></li><li class="breadcrumb-item active">' + escHtml(ev.title) + '</li></ol></nav>'

    + '<div class="row">'
    + '<div class="col-lg-8">'
    + '<h1 class="fw-bold">' + escHtml(ev.title) + '</h1>'
    + (ev.genre || ev.category ? '<p class="text-muted">' + [ev.genre, ev.category].filter(Boolean).map(escHtml).join(' / ') + '</p>' : '')

    // 公演日時
    + (sessions.length ? '<div class="section-title">📅 公演日時</div>' + sessionHtml : '')

    // チケット料金
    + (tickets.length ? '<div class="section-title">🎫 チケット料金</div><ul class="list-group mb-3">' + ticketHtml + '</ul>' : '')
    + (ev.ticketUrl ? '<a href="' + escHtml(ev.ticketUrl) + '" target="_blank" class="btn btn-outline-danger mb-3">チケット購入サイトへ</a>' : '')

    // 備考
    + (ev.eventNotes ? '<div class="section-title">📝 備考</div><p class="text-muted" style="white-space:pre-line">' + escHtml(ev.eventNotes) + '</p>' : '')
    + (ev.description ? '<p style="white-space:pre-line">' + escHtml(ev.description) + '</p>' : '')
    + '</div>'

    // サイドバー（会場情報）
    + '<div class="col-lg-4 mt-4 mt-lg-0">'
    + '<div class="card p-3 mb-3"><h6 class="fw-bold">📍 会場情報</h6>' + venueHtml + '</div>'
    + (ev.contactInfo ? '<div class="card p-3"><h6 class="fw-bold">📧 お問い合わせ</h6><p class="small mb-0">' + escHtml(ev.contactInfo) + '</p></div>' : '')
    + '</div></div>'

    // 差し入れセクション
    + '<div class="section-title">🌸 差し入れを贈る</div>'
    + deadlineBanner
    + (epList.length ? '<div class="row g-3">' + performersHtml + '</div>'
        : '<p class="text-muted">出演者情報は準備中です。</p>')

    // 応援メッセージ
    + (pubMessages.length ? '<div class="section-title">💬 応援メッセージ</div>' + messagesHtml : '')
    + '</div>';

  return buildPublicPage(ev.title, body, { ogDescription: ev.description });
}
