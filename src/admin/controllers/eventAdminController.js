/**
 * src/admin/controllers/eventAdminController.js
 * A2: Events一覧, A3: Events作成/編集,
 * A4: EventSessions管理, A5: TicketTypes管理,
 * A8: EventPerformers紐付け, A9: Receivers設定
 * 変更履歴: 2026-03-01 Phase2 実装
 */

// ===== A2: Event List =====

function renderEventList(user) {
  var events = user.role === ROLE.ADMIN
    ? listAllEvents()
    : listEventsByOrganizer(user.organizerId);
  var base = ScriptApp.getService().getUrl() + '?page=';

  var rows = events.map(function(ev) {
    var actions = '<a href="' + base + 'eventForm&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-primary">編集</a> '
      + '<a href="' + base + 'sessionManage&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-secondary">セッション</a> '
      + '<a href="' + base + 'ticketManage&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-secondary">券種</a> '
      + '<a href="' + base + 'performerAssign&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-secondary">出演者</a> '
      + '<a href="' + base + 'receiverSetup&eventId=' + escHtml(ev.eventId) + '" class="btn btn-sm btn-outline-secondary">受取</a>';

    if (ev.status === EVENT_STATUS.DRAFT) {
      actions += ' ' + postBtn('publishEvent', { eventId: ev.eventId }, '公開', 'btn-sm btn-success');
    } else if (ev.status === EVENT_STATUS.PUBLISHED) {
      actions += ' ' + postBtn('closeEvent', { eventId: ev.eventId }, '終了', 'btn-sm btn-warning');
    }

    return '<tr>'
      + '<td>' + escHtml(ev.title) + '</td>'
      + '<td>' + statusBadge(ev.status) + '</td>'
      + '<td>' + escHtml(ev.venueName) + '</td>'
      + '<td>' + escHtml(ev.giftDeadlineAt ? ev.giftDeadlineAt.slice(0,10) : '-') + '</td>'
      + '<td>' + actions + '</td>'
      + '</tr>';
  }).join('');

  var body = btnLink(base + 'eventForm', '+ イベント作成', 'btn-primary mb-3')
    + '<table class="table table-hover table-sm"><thead><tr><th>タイトル</th><th>状態</th><th>会場</th><th>差し入れ締切</th><th>操作</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="5" class="text-center text-muted">イベントがありません</td></tr>') + '</tbody></table>';

  return buildPage('イベント管理', body, user);
}

// ===== A3: Event Form =====

function renderEventForm(user, eventId) {
  var ev   = eventId ? findEventById(eventId) : null;
  var isNew = !ev;
  if (ev) { requireOwnership(user, ev.organizerId); }
  var base = ScriptApp.getService().getUrl() + '?page=';

  var body = openForm(isNew ? 'createEvent' : 'updateEvent', isNew ? {} : { eventId: eventId })
    + '<div class="row">'
    + '<div class="col-md-8">'
    + inputText('title', 'イベントタイトル', ev ? ev.title : '', true)
    + inputText('genre', 'ジャンル（例: 打楽器/マリンバ）', ev ? ev.genre : '')
    + inputText('category', 'イベント種別（例: ディナーショー）', ev ? ev.category : '')
    + inputTextarea('description', '説明文', ev ? ev.description : '', 4)
    + inputTextarea('eventNotes', '備考・特記事項', ev ? ev.eventNotes : '', 3)
    + inputText('contactInfo', '問い合わせ先（公開）', ev ? ev.contactInfo : '')
    + inputDateTime('giftDeadlineAt', '差し入れ受付締切日時', ev ? ev.giftDeadlineAt : '')
    + '</div>'
    + '<div class="col-md-4">'
    + '<h6 class="fw-bold">会場情報</h6>'
    + inputText('venueName', '会場名', ev ? ev.venueName : '', true)
    + inputText('venuePref', '都道府県', ev ? ev.venuePref : '')
    + inputText('venueCity', '市区町村', ev ? ev.venueCity : '')
    + inputText('venueAddress', '番地以降', ev ? ev.venueAddress : '')
    + inputText('venuePostalCode', '郵便番号', ev ? ev.venuePostalCode : '')
    + inputText('venuePhone', '会場電話番号', ev ? ev.venuePhone : '')
    + inputText('venueUrl', '会場ウェブサイト', ev ? ev.venueUrl : '')
    + inputText('venueAccess', 'アクセス情報', ev ? ev.venueAccess : '')
    + '<h6 class="fw-bold mt-3">画像・リンク</h6>'
    + inputText('coverImageUrl', 'カバー画像URL', ev ? ev.coverImageUrl : '')
    + inputText('flyerImageUrl', 'フライヤー画像URL', ev ? ev.flyerImageUrl : '')
    + inputText('ticketUrl', 'チケット販売URL', ev ? ev.ticketUrl : '')
    + '</div></div>'
    + btnPrimary(isNew ? 'イベントを作成' : '変更を保存')
    + btnLink(base + 'eventList', 'キャンセル')
    + closeForm();

  return buildPage(isNew ? 'イベント作成' : 'イベント編集: ' + (ev ? ev.title : ''), body, user);
}

// ===== A4: EventSessions =====

function renderSessionManage(user, eventId) {
  if (!eventId) throw new Error('eventId が必要です');
  var ev       = findEventById(eventId);
  if (!ev) throw new Error('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var sessions = listSessionsByEvent(eventId);
  var base     = ScriptApp.getService().getUrl() + '?page=';

  // 既存セッション表示 + 追加フォーム
  var existRows = sessions.map(function(s, i) {
    return '<tr>'
      + '<td>' + escHtml(s.sessionLabel) + '</td>'
      + '<td>' + escHtml(s.startAt ? s.startAt.slice(0,16) : '') + '</td>'
      + '<td>' + escHtml(s.endAt   ? s.endAt.slice(0,16)   : '') + '</td>'
      + '<td>' + postBtn('saveSessions', { eventId: eventId, deleteSessionId: s.sessionId }, '削除', 'btn-sm btn-outline-danger') + '</td>'
      + '</tr>';
  }).join('');

  var body = '<h6>公演回一覧（イベント: ' + escHtml(ev.title) + '）</h6>'
    + '<table class="table table-sm mb-4"><thead><tr><th>ラベル</th><th>開始</th><th>終了</th><th></th></tr></thead>'
    + '<tbody>' + (existRows || '<tr><td colspan="4" class="text-muted text-center">セッションがありません</td></tr>') + '</tbody></table>'
    + '<h6>セッション追加</h6>'
    + openForm('saveSessions', { eventId: eventId })
    + inputText('sessionLabel', '表示名（例: お昼ごはんタイム）', '', true)
    + '<div class="row">'
    + '<div class="col">' + inputDateTime('doorsAt', '開場時刻', '') + '</div>'
    + '<div class="col">' + inputDateTime('startAt', '開始時刻', '') + '</div>'
    + '<div class="col">' + inputDateTime('endAt',   '終了時刻', '') + '</div>'
    + '</div>'
    + inputText('capacityNote', '定員メモ（任意）', '')
    + btnPrimary('追加')
    + btnLink(base + 'eventList', '← イベント一覧に戻る')
    + closeForm();

  return buildPage('セッション管理', body, user);
}

// ===== A5: TicketTypes =====

function renderTicketManage(user, eventId) {
  if (!eventId) throw new Error('eventId が必要です');
  var ev    = findEventById(eventId);
  if (!ev)  throw new Error('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var types = listTicketTypesByEvent(eventId);
  var base  = ScriptApp.getService().getUrl() + '?page=';

  var rows = types.map(function(t) {
    return '<tr>'
      + '<td>' + escHtml(t.label) + '</td>'
      + '<td>¥' + Number(t.priceJPY).toLocaleString() + '</td>'
      + '<td>' + escHtml(t.description) + '</td>'
      + '<td>' + postBtn('saveTickets', { eventId: eventId, deleteTicketTypeId: t.ticketTypeId }, '削除', 'btn-sm btn-outline-danger') + '</td>'
      + '</tr>';
  }).join('');

  var body = '<h6>券種一覧（イベント: ' + escHtml(ev.title) + '）</h6>'
    + '<table class="table table-sm mb-4"><thead><tr><th>券種名</th><th>価格</th><th>説明</th><th></th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="4" class="text-muted text-center">券種がありません</td></tr>') + '</tbody></table>'
    + '<h6>券種追加</h6>'
    + openForm('saveTickets', { eventId: eventId })
    + inputText('label', '券種名（例: 一般）', '', true)
    + inputNumber('priceJPY', '税込価格（円）', 0, true, 0)
    + inputText('description', '含まれるもの（例: 会席弁当付き）', '')
    + inputText('conditions', '条件・注意', '')
    + btnPrimary('追加')
    + btnLink(base + 'eventList', '← イベント一覧に戻る')
    + closeForm();

  return buildPage('券種管理', body, user);
}

// ===== A8: Performer Assign =====

function renderPerformerAssign(user, eventId) {
  if (!eventId) throw new Error('eventId が必要です');
  var ev        = findEventById(eventId);
  if (!ev)      throw new Error('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var assigned  = listPerformersByEvent(eventId);
  var assignedIds = assigned.map(function(a) { return String(a.performerId); });
  var allPerfs  = listAllPerformers(true);
  var base      = ScriptApp.getService().getUrl() + '?page=';

  var assignedRows = assigned.map(function(a) {
    var p = findPerformerById(a.performerId);
    return '<tr>'
      + '<td>' + escHtml(p ? p.displayName : a.performerId) + '</td>'
      + '<td>' + (a.isGiftEnabled ? '✅' : '❌') + '</td>'
      + '<td>' + postBtn('removePerformer', { eventId: eventId, performerId: a.performerId }, '解除', 'btn-sm btn-outline-danger') + '</td>'
      + '</tr>';
  }).join('');

  var availPerfs = allPerfs.filter(function(p) { return assignedIds.indexOf(String(p.performerId)) === -1; });
  var perfOpts   = availPerfs.map(function(p) { return { value: p.performerId, label: p.displayName }; });

  var body = '<h6>出演者割り当て（イベント: ' + escHtml(ev.title) + '）</h6>'
    + '<table class="table table-sm mb-4"><thead><tr><th>出演者</th><th>差し入れ受付</th><th></th></tr></thead>'
    + '<tbody>' + (assignedRows || '<tr><td colspan="3" class="text-muted text-center">出演者が割り当てられていません</td></tr>') + '</tbody></table>';

  if (perfOpts.length) {
    body += '<h6>出演者を追加</h6>'
      + openForm('assignPerformer', { eventId: eventId })
      + inputSelect('performerId', '出演者', perfOpts, '', true)
      + inputCheckbox('isGiftEnabled', '差し入れを受け付ける', true)
      + inputNumber('sortOrder', '表示順', assigned.length + 1, false, 1)
      + btnPrimary('割り当て')
      + closeForm();
  } else {
    body += '<p class="text-muted">追加できる出演者がいません。先に出演者を登録してください。</p>';
  }
  body += btnLink(base + 'eventList', '← イベント一覧に戻る');

  return buildPage('出演者割り当て', body, user);
}

// ===== A9: Receiver Setup =====

function renderReceiverSetup(user, eventId) {
  if (!eventId) throw new Error('eventId が必要です');
  var ev        = findEventById(eventId);
  if (!ev)      throw new Error('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  var receivers = listReceiversByEvent(eventId);
  var base      = ScriptApp.getService().getUrl() + '?page=';

  var rows = receivers.map(function(r) {
    return '<tr>'
      + '<td>' + escHtml(r.internalLabel || '-') + '</td>'
      + '<td>' + escHtml(r.receiveType) + '</td>'
      + '<td>' + escHtml(r.shippingName) + '</td>'
      + '<td>' + escHtml(r.shippingAddress ? '設定済み' : '-') + '</td>'
      + '<td>' + (r.isActive ? '<span class="badge bg-success">有効</span>' : '<span class="badge bg-secondary">無効</span>') + '</td>'
      + '</tr>';
  }).join('');

  var typeOpts = Object.keys(RECEIVE_TYPE).map(function(k) { return { value: RECEIVE_TYPE[k], label: RECEIVE_TYPE[k] }; });

  var body = '<div class="alert alert-warning">⚠️ 住所・電話番号は非公開情報です。このページへのアクセスは管理者・主催者のみ。</div>'
    + '<h6>受取設定一覧（イベント: ' + escHtml(ev.title) + '）</h6>'
    + '<table class="table table-sm mb-4"><thead><tr><th>内部ラベル</th><th>受取種別</th><th>宛名</th><th>住所</th><th>状態</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="5" class="text-muted text-center">受取設定がありません</td></tr>') + '</tbody></table>'
    + '<h6>受取先を追加</h6>'
    + openForm('saveReceiver', { eventId: eventId })
    + inputSelect('receiveType', '受取種別', typeOpts, RECEIVE_TYPE.VENUE, true)
    + inputText('internalLabel', '内部ラベル（例: 会場受取_楽屋渡し）', '')
    + inputText('shippingName',  '配送宛名', '', true)
    + inputText('shippingAddress', '配送先住所', '')
    + inputText('shippingPhone',   '電話番号', '')
    + inputTextarea('notesInternal', '内部メモ', '', 2)
    + btnPrimary('保存')
    + btnLink(base + 'eventList', '← イベント一覧に戻る')
    + closeForm();

  return buildPage('受取設定', body, user);
}

// ===== POST handlers =====

function postCreateEvent(params, user) {
  var data = Object.assign({}, params);
  data.organizerId = (user.role === ROLE.ADMIN && params.organizerId) ? params.organizerId : user.organizerId || user.userId;
  var ev = createEvent(data);
  writeAuditLog(user.email, 'CREATE_EVENT', ENTITY_TYPE.EVENT, ev.eventId, null, { title: ev.title });
  return { redirect: ScriptApp.getService().getUrl() + '?page=eventList' };
}

function postUpdateEvent(params, user) {
  var ev = findEventById(params.eventId);
  if (!ev) throw new Error('イベントが見つかりません');
  requireOwnership(user, ev.organizerId);
  updateEvent(params.eventId, params);
  writeAuditLog(user.email, 'UPDATE_EVENT', ENTITY_TYPE.EVENT, params.eventId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=eventList' };
}

function postPublishEvent(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  var before = { status: ev.status };
  publishEvent(params.eventId);
  writeAuditLog(user.email, 'PUBLISH_EVENT', ENTITY_TYPE.EVENT, params.eventId, before, { status: EVENT_STATUS.PUBLISHED });
  return { redirect: ScriptApp.getService().getUrl() + '?page=eventList' };
}

function postCloseEvent(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  var before = { status: ev.status };
  closeEvent(params.eventId);
  writeAuditLog(user.email, 'CLOSE_EVENT', ENTITY_TYPE.EVENT, params.eventId, before, { status: EVENT_STATUS.CLOSED });
  return { redirect: ScriptApp.getService().getUrl() + '?page=eventList' };
}

function postSaveSessions(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  if (params.deleteSessionId) {
    deleteEventSession(params.deleteSessionId);
  } else {
    createEventSession({
      eventId:      params.eventId,
      sessionLabel: params.sessionLabel,
      doorsAt:      params.doorsAt   ? toISO8601(params.doorsAt) : '',
      startAt:      toISO8601(params.startAt),
      endAt:        toISO8601(params.endAt),
      sortOrder:    listSessionsByEvent(params.eventId).length + 1,
      capacityNote: params.capacityNote || ''
    });
  }
  return { redirect: ScriptApp.getService().getUrl() + '?page=sessionManage&eventId=' + params.eventId };
}

function postSaveTickets(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  if (params.deleteTicketTypeId) {
    deleteTicketType(params.deleteTicketTypeId);
  } else {
    createTicketType({
      eventId:     params.eventId,
      label:       params.label,
      priceJPY:    Number(params.priceJPY),
      description: params.description || '',
      conditions:  params.conditions  || '',
      sortOrder:   listTicketTypesByEvent(params.eventId).length + 1
    });
  }
  return { redirect: ScriptApp.getService().getUrl() + '?page=ticketManage&eventId=' + params.eventId };
}

function postAssignPerformer(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  assignPerformerToEvent({
    eventId:       params.eventId,
    performerId:   params.performerId,
    sortOrder:     Number(params.sortOrder) || 1,
    isGiftEnabled: params.isGiftEnabled === 'on'
  });
  return { redirect: ScriptApp.getService().getUrl() + '?page=performerAssign&eventId=' + params.eventId };
}

function postRemovePerformer(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  removePerformerFromEvent(params.eventId, params.performerId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=performerAssign&eventId=' + params.eventId };
}

function postSaveReceiver(params, user) {
  var ev = findEventById(params.eventId);
  requireOwnership(user, ev.organizerId);
  createReceiver({
    eventId:         params.eventId,
    receiveType:     params.receiveType,
    internalLabel:   params.internalLabel || '',
    shippingName:    params.shippingName,
    shippingAddress: params.shippingAddress || '',
    shippingPhone:   params.shippingPhone   || '',
    notesInternal:   params.notesInternal   || ''
  });
  return { redirect: ScriptApp.getService().getUrl() + '?page=receiverSetup&eventId=' + params.eventId };
}
