/**
 * src/admin/controllers/productAdminController.js
 * A13: Products管理（ADMIN専用）
 * 変更履歴: 2026-03-01 Phase2 実装
 */

function renderProductList(user) {
  requireRole([ROLE.ADMIN]);
  var products = listAllProducts();
  var base     = ScriptApp.getService().getUrl() + '?page=';

  var rows = products.map(function(p) {
    return '<tr>'
      + '<td>' + (p.imageUrl ? '<img src="' + escHtml(p.imageUrl) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px"> ' : '')
      +           escHtml(p.name) + '</td>'
      + '<td><span class="badge bg-' + (p.category === 'FLOWER' ? 'success' : 'warning') + '">' + escHtml(p.category) + '</span></td>'
      + '<td>¥' + Number(p.priceJPY).toLocaleString() + '</td>'
      + '<td>' + Number(p.sortOrder) + '</td>'
      + '<td>' + (p.isActive ? '<span class="badge bg-success">販売中</span>' : '<span class="badge bg-secondary">非表示</span>') + '</td>'
      + '<td><a href="' + base + 'productForm&productId=' + escHtml(p.productId) + '" class="btn btn-sm btn-outline-primary">編集</a> '
      +       postBtn('toggleProduct', { productId: p.productId, isActive: String(!p.isActive) },
                      p.isActive ? '非表示' : '表示', 'btn-sm btn-outline-secondary')
      + '</td></tr>';
  }).join('');

  var body = btnLink(base + 'productForm', '+ 商品追加', 'btn-primary mb-3')
    + '<table class="table table-hover table-sm"><thead><tr><th>商品名</th><th>カテゴリ</th><th>価格</th><th>順序</th><th>状態</th><th>操作</th></tr></thead>'
    + '<tbody>' + (rows || '<tr><td colspan="6" class="text-center text-muted">商品がありません</td></tr>') + '</tbody></table>';

  return buildPage('商品管理', body, user);
}

function renderProductForm(user, productId) {
  requireRole([ROLE.ADMIN]);
  var p    = productId ? findProductById(productId) : null;
  var isNew = !p;
  var base  = ScriptApp.getService().getUrl() + '?page=';

  var catOpts = [
    { value: PRODUCT_CATEGORY.FLOWER,  label: '🌸 フラワー' },
    { value: PRODUCT_CATEGORY.ALCOHOL, label: '🍶 お酒' }
  ];

  var body = openForm(isNew ? 'createProduct' : 'updateProduct', isNew ? {} : { productId: productId })
    + inputText('name', '商品名', p ? p.name : '', true)
    + inputSelect('category', 'カテゴリ', catOpts, p ? p.category : PRODUCT_CATEGORY.FLOWER, true)
    + inputNumber('priceJPY', '税込価格（円）', p ? p.priceJPY : 0, true, 0)
    + inputTextarea('description', '説明文', p ? p.description : '', 3)
    + inputText('imageUrl', '商品画像URL', p ? p.imageUrl : '')
    + inputNumber('sortOrder', '表示順', p ? p.sortOrder : 1, true, 1)
    + (p ? inputCheckbox('isActive', '販売中（公開）', p.isActive) : '')
    + btnPrimary(isNew ? '商品を追加' : '変更を保存')
    + btnLink(base + 'productList', 'キャンセル')
    + closeForm();

  return buildPage(isNew ? '商品追加' : '商品編集: ' + (p ? p.name : ''), body, user);
}

function postCreateProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  var p = createProduct({
    name:        params.name,
    category:    params.category,
    priceJPY:    Number(params.priceJPY),
    description: params.description || '',
    imageUrl:    params.imageUrl    || '',
    sortOrder:   Number(params.sortOrder) || 1
  });
  writeAuditLog(user.email, 'CREATE_PRODUCT', ENTITY_TYPE.PRODUCT, p.productId, null, { name: p.name, priceJPY: p.priceJPY });
  return { redirect: ScriptApp.getService().getUrl() + '?page=productList' };
}

function postUpdateProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  var before = findProductById(params.productId);
  updateProduct(params.productId, {
    name:        params.name,
    category:    params.category,
    priceJPY:    Number(params.priceJPY),
    description: params.description || '',
    imageUrl:    params.imageUrl    || '',
    sortOrder:   Number(params.sortOrder) || 1,
    isActive:    params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_PRODUCT', ENTITY_TYPE.PRODUCT, params.productId, before, { name: params.name, priceJPY: params.priceJPY });
  return { redirect: ScriptApp.getService().getUrl() + '?page=productList' };
}

function postToggleProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  var isActive = params.isActive === 'true';
  updateProduct(params.productId, { isActive: isActive });
  writeAuditLog(user.email, isActive ? 'ACTIVATE_PRODUCT' : 'DEACTIVATE_PRODUCT', ENTITY_TYPE.PRODUCT, params.productId);
  return { redirect: ScriptApp.getService().getUrl() + '?page=productList' };
}
