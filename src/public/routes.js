/**
 * src/public/routes.js
 * Public REST API ルーター
 * 変更履歴:
 *   2026-03-02 Phase3 HTML ルーティング実装
 *   2026-03-02 Phase4 JSON API ルーターに書き換え
 *
 * エンドポイント一覧:
 *
 * GET
 *   ?action=listEvents                           公開イベント一覧
 *   ?action=getEvent&id=xxx                      イベント詳細（セッション・券種・出演者込み）
 *   ?action=listProducts[&category=FLOWER]       販売中商品一覧
 *   ?action=inquireOrder&gmoOrderId=xxx&email=xx 注文照会
 *
 * POST
 *   ?action=createOrder                          注文作成 → GMO-PG URL を返す
 *   (action なし & OrderID あり)                 GMO-PG 結果通知（Code.js で処理）
 */

// ─────────────────────────────────────────────
// GET ルーター
// ─────────────────────────────────────────────

function routeGet(action, params) {
  switch (action) {

    case 'listEvents':
      return apiListPublicEvents(params);

    case 'getEvent':
      return apiGetPublicEvent(params.id || params.eventId);

    case 'listProducts':
      return apiListPublicProducts(params);

    case 'inquireOrder':
      return apiInquireOrder(params);

    default:
      throw notFound('Unknown action: ' + action);
  }
}

// ─────────────────────────────────────────────
// POST ルーター
// ─────────────────────────────────────────────

function routePost(action, params) {
  switch (action) {

    case 'createOrder':
      return apiCreatePublicOrder(params);

    default:
      throw badRequest('Unknown action: ' + action);
  }
}

// ─────────────────────────────────────────────
// エラーファクトリ（Public 用）
// ─────────────────────────────────────────────

function notFound(msg)    { var e = new Error(msg || 'NOT_FOUND');   e.message = msg || 'NOT_FOUND';   return e; }
function badRequest(msg)  { var e = new Error(msg || 'BAD_REQUEST'); e.message = msg || 'BAD_REQUEST'; return e; }
function closedError(msg) { var e = new Error(msg || 'CLOSED');      e.message = msg || 'CLOSED';      return e; }
