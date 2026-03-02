/**
 * src/admin/controllers/productAdminController.js
 * Products API（ADMIN専用）
 * 変更履歴:
 *   2026-03-01 Phase2 HTML実装
 *   2026-03-02 Phase4 JSON API化
 */

/**
 * GET ?action=listProducts
 */
function apiListProducts(user) {
  requireRole([ROLE.ADMIN]);
  return listAllProducts();
}

/**
 * GET ?action=getProduct&id=xxx
 */
function apiGetProduct(productId, user) {
  if (!productId) throw badRequest('id は必須です');
  requireRole([ROLE.ADMIN]);
  var p = findProductById(productId);
  if (!p) throw notFound('商品が見つかりません');
  return p;
}

/**
 * POST ?action=createProduct
 * body: { name, category, priceJPY, description, imageUrl, sortOrder }
 */
function apiCreateProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  if (!params.name)            throw badRequest('name は必須です');
  if (!params.category)        throw badRequest('category は必須です');
  if (params.priceJPY == null) throw badRequest('priceJPY は必須です');

  var p = createProduct({
    name:        params.name,
    category:    params.category,
    priceJPY:    Number(params.priceJPY),
    description: params.description || '',
    imageUrl:    params.imageUrl    || '',
    sortOrder:   Number(params.sortOrder) || 1
  });
  writeAuditLog(user.email, 'CREATE_PRODUCT', ENTITY_TYPE.PRODUCT, p.productId, null, { name: p.name, priceJPY: p.priceJPY });
  return p;
}

/**
 * POST ?action=updateProduct
 * body: { id, name, category, priceJPY, description, imageUrl, sortOrder, isActive }
 */
function apiUpdateProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  var productId = params.id || params.productId;
  if (!productId) throw badRequest('id は必須です');

  var before = findProductById(productId);
  if (!before) throw notFound('商品が見つかりません');

  var updated = updateProduct(productId, {
    name:        params.name,
    category:    params.category,
    priceJPY:    Number(params.priceJPY),
    description: params.description || '',
    imageUrl:    params.imageUrl    || '',
    sortOrder:   Number(params.sortOrder) || before.sortOrder,
    isActive:    params.isActive === true || params.isActive === 'true' || params.isActive === 'on'
  });
  writeAuditLog(user.email, 'UPDATE_PRODUCT', ENTITY_TYPE.PRODUCT, productId, before);
  return updated;
}

/**
 * POST ?action=toggleProduct
 * body: { id, isActive }
 */
function apiToggleProduct(params, user) {
  requireRole([ROLE.ADMIN]);
  var productId = params.id || params.productId;
  if (!productId)              throw badRequest('id は必須です');
  if (params.isActive == null) throw badRequest('isActive は必須です');

  var isActive = params.isActive === true || params.isActive === 'true';
  updateProduct(productId, { isActive: isActive });
  writeAuditLog(user.email, isActive ? 'ACTIVATE_PRODUCT' : 'DEACTIVATE_PRODUCT', ENTITY_TYPE.PRODUCT, productId);
  return { productId: productId, isActive: isActive };
}
