/**
 * src/admin/controllers/userAdminController.js
 * A15: Users 管理（ADMIN 専用）
 * 変更履歴: 2026-03-01 Phase2 実装
 */

function renderUserList(user) {
  requireRole([ROLE.ADMIN]);
  var users = listUsers(false);
  var base  = ScriptApp.getService().getUrl() + '?page=';

  var rows = users.map(function(u) {
    return '<tr>'
      + '<td>' + escHtml(u.displayName) + '</td>'
      + '<td>' + escHtml(u.email) + '</td>'
      + '<td><span class="badge bg-secondary">' + escHtml(u.role) + '</span></td>'
      + '<td>' + (u.isActive ? '<span class="badge bg-success">有効</span>' : '<span class="badge bg-danger">無効</span>') + '</td>'
      + '<td><a href="' + base + 'userForm&userId=' + escHtml(u.userId) + '" class="btn btn-sm btn-outline-primary">編集</a> '
      +       postBtn('deactivateUser', { userId: u.userId }, '無効化', 'btn-outline-danger btn-sm', !u.isActive)
      + '</td></tr>';
  }).join('');

  var body = btnLink(base + 'userForm', '+ ユーザー追加', 'btn-primary mb-3')
    + '<table class="table table-hover"><thead><tr><th>名前</th><th>メール</th><th>ロール</th><th>状態</th><th></th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>';

  return buildPage('ユーザー管理', body, user);
}

function renderUserForm(user, userId) {
  requireRole([ROLE.ADMIN]);
  var base = ScriptApp.getService().getUrl() + '?page=';
  var u    = userId ? findUserById(userId) : null;
  var isNew = !u;

  var roleOpts = [
    { value: ROLE.ADMIN,     label: 'ADMIN（全操作）' },
    { value: ROLE.ORGANIZER, label: 'ORGANIZER（主催者）' },
    { value: ROLE.PERFORMER, label: 'PERFORMER（出演者）' }
  ];

  var body = openForm(isNew ? 'createUser' : 'updateUser', isNew ? {} : { userId: userId })
    + inputText('displayName', '表示名', u ? u.displayName : '', true)
    + inputText('email', 'メールアドレス（Googleアカウント）', u ? u.email : '', true)
    + inputSelect('role', 'ロール', roleOpts, u ? u.role : ROLE.ORGANIZER, true)
    + inputText('organizerId', '主催者ID（ORGANIZERの場合）', u ? u.organizerId : '')
    + inputText('performerId', '出演者ID（PERFORMERの場合）', u ? u.performerId : '')
    + (u ? inputCheckbox('isActive', '有効', u.isActive) : '')
    + btnPrimary(isNew ? 'ユーザーを作成' : '変更を保存')
    + btnLink(base + 'userList', 'キャンセル')
    + closeForm();

  return buildPage(isNew ? 'ユーザー追加' : 'ユーザー編集', body, user);
}

// ---- POST handlers ----

function postCreateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  createUser({
    displayName: params.displayName,
    email:       params.email,
    role:        params.role,
    organizerId: params.organizerId || '',
    performerId: params.performerId || ''
  });
  writeAuditLog(user.email, 'CREATE_USER', ENTITY_TYPE.EVENT, params.email);
  return { redirect: ScriptApp.getService().getUrl() + '?page=userList&msg=created' };
}

function postUpdateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  updateUser(params.userId, {
    displayName: params.displayName,
    email:       params.email,
    role:        params.role,
    organizerId: params.organizerId || '',
    performerId: params.performerId || '',
    isActive:    params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_USER', ENTITY_TYPE.EVENT, params.userId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=userList&msg=updated' };
}

function postDeactivateUser(params, user) {
  requireRole([ROLE.ADMIN]);
  deactivateUser(params.userId);
  writeAuditLog(user.email, 'DEACTIVATE_USER', ENTITY_TYPE.EVENT, params.userId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=userList' };
}

/** 確認なしで POST を送るミニフォームボタン */
function postBtn(action, hiddens, label, cls, disabled) {
  var url = ScriptApp.getService().getUrl();
  var inputs = Object.keys(hiddens).map(function(k) {
    return '<input type="hidden" name="' + escHtml(k) + '" value="' + escHtml(hiddens[k]) + '">';
  }).join('');
  return '<form method="POST" action="' + url + '" style="display:inline">'
    + '<input type="hidden" name="action" value="' + escHtml(action) + '">'
    + inputs
    + '<button type="submit" class="btn ' + (cls || 'btn-secondary') + '"' + (disabled ? ' disabled' : '') + '>' + escHtml(label) + '</button>'
    + '</form>';
}
