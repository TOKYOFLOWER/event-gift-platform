/**
 * src/admin/controllers/performerAdminController.js
 * A6: Performers一覧, A7: Performer作成/編集（ADMIN）
 * 変更履歴: 2026-03-01 Phase2 実装
 */

function renderPerformerList(user) {
  requireRole([ROLE.ADMIN]);
  var performers = listAllPerformers(false);
  var base = ScriptApp.getService().getUrl() + '?page=';

  var rows = performers.map(function(p) {
    return '<tr>'
      + '<td>' + (p.avatarUrl ? '<img src="' + escHtml(p.avatarUrl) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover"> ' : '')
      +           escHtml(p.displayName) + '</td>'
      + '<td>' + escHtml(p.titleOrGroup) + '</td>'
      + '<td>' + (p.isActive ? '<span class="badge bg-success">有効</span>' : '<span class="badge bg-secondary">無効</span>') + '</td>'
      + '<td><a href="' + base + 'performerForm&performerId=' + escHtml(p.performerId) + '" class="btn btn-sm btn-outline-primary">編集</a> '
      +       postBtn('deactivateUser', { performerId: p.performerId }, '無効化', 'btn-sm btn-outline-danger', !p.isActive)
      + '</td></tr>';
  }).join('');

  var body = btnLink(base + 'performerForm', '+ 出演者登録', 'btn-primary mb-3')
    + '<table class="table table-hover table-sm"><thead><tr><th>出演者名</th><th>肩書き/グループ</th><th>状態</th><th>操作</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="4" class="text-center text-muted">出演者がいません</td></tr>') + '</tbody></table>';

  return buildPage('出演者管理', body, user);
}

function renderPerformerForm(user, performerId) {
  requireRole([ROLE.ADMIN]);
  var p    = performerId ? findPerformerById(performerId) : null;
  var isNew = !p;
  var base  = ScriptApp.getService().getUrl() + '?page=';

  var body = openForm(isNew ? 'createPerformer' : 'updatePerformer', isNew ? {} : { performerId: performerId })
    + inputText('displayName',  '表示名', p ? p.displayName : '', true)
    + inputText('titleOrGroup', '肩書き・グループ名', p ? p.titleOrGroup : '')
    + inputTextarea('bio', 'プロフィール', p ? p.bio : '', 5)
    + inputText('avatarUrl', 'プロフィール画像URL', p ? p.avatarUrl : '')
    + inputText('snsUrl',    'SNSリンク', p ? p.snsUrl : '')
    + (p ? inputCheckbox('isActive', '有効', p.isActive) : '')
    + btnPrimary(isNew ? '出演者を登録' : '変更を保存')
    + btnLink(base + 'performerList', 'キャンセル')
    + closeForm();

  return buildPage(isNew ? '出演者登録' : '出演者編集: ' + (p ? p.displayName : ''), body, user);
}

function postCreatePerformer(params, user) {
  requireRole([ROLE.ADMIN]);
  var p = createPerformer({
    displayName:  params.displayName,
    titleOrGroup: params.titleOrGroup || '',
    bio:          params.bio          || '',
    avatarUrl:    params.avatarUrl    || '',
    snsUrl:       params.snsUrl       || ''
  });
  writeAuditLog(user.email, 'CREATE_PERFORMER', ENTITY_TYPE.PERFORMER, p.performerId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=performerList' };
}

function postUpdatePerformer(params, user) {
  // ADMIN or 本人 (PERFORMER)
  requireSelfOrAdmin(user, params.performerId);
  var before = findPerformerById(params.performerId);
  updatePerformer(params.performerId, {
    displayName:  params.displayName,
    titleOrGroup: params.titleOrGroup || '',
    bio:          params.bio          || '',
    avatarUrl:    params.avatarUrl    || '',
    snsUrl:       params.snsUrl       || '',
    isActive:     params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_PERFORMER', ENTITY_TYPE.PERFORMER, params.performerId, before);
  return { redirect: ScriptApp.getService().getUrl() + '?page=performerList' };
}
