/**
 * shared/models/products.js
 * Products シートの CRUD
 * 変更履歴: 2026-03-01 初版
 */

function createProduct(data) {
  requireFields(data, ['name', 'category', 'priceJPY', 'sortOrder']);
  validateEnum(data.category, PRODUCT_CATEGORY, 'category');
  validatePositiveInt(data.priceJPY, 'priceJPY');
  var now = nowISO();
  var row = {
    productId:   generateUuid(),
    name:        data.name,
    category:    data.category,
    priceJPY:    Number(data.priceJPY),
    description: data.description || '',
    imageUrl:    data.imageUrl    || '',
    isActive:    true,
    sortOrder:   Number(data.sortOrder),
    createdAt:   now,
    updatedAt:   now
  };
  sheetInsert(SHEET.PRODUCTS, row);
  return row;
}

function findProductById(productId) {
  return sheetFindOne(SHEET.PRODUCTS, 'productId', productId);
}

function listActiveProducts() {
  return sheetGetAll(SHEET.PRODUCTS).rows
    .filter(function(r) { return r.isActive; })
    .sort(function(a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
}

function listAllProducts() {
  return sheetGetAll(SHEET.PRODUCTS).rows
    .sort(function(a, b) { return Number(a.sortOrder) - Number(b.sortOrder); });
}

function updateProduct(productId, updates) {
  updates.updatedAt = nowISO();
  return sheetUpdate(SHEET.PRODUCTS, 'productId', productId, updates);
}

function deactivateProduct(productId) {
  return sheetSoftDelete(SHEET.PRODUCTS, 'productId', productId);
}
