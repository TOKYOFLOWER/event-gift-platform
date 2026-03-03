/**
 * shared/js/api.js
 * GAS REST API クライアント — CORS 回避版
 *
 * 背景:
 *   GAS WebApp は Access-Control-Allow-Origin ヘッダーを制御できないため
 *   通常の fetch は CORS でブロックされる。
 *
 * 解決策:
 *   ┌─────────────┬──────────────────────────────────────────────┐
 *   │ GET         │ JSONP（script タグ挿入 + ?callback=cbName）   │
 *   │ POST (書込) │ ?_m=post を付けて GET+JSONP として送信        │
 *   │ 認証トークン│ ?_token=xxx を URL パラメータで渡す           │
 *   └─────────────┴──────────────────────────────────────────────┘
 *
 * GAS 側の対応（Code.js に1行追加済み）:
 *   doGet で params._m === 'post' のとき routePost を呼び出す
 *   params._token がある場合は Session 代わりにトークン検証
 *
 * 使い方:
 *   const api = new GasApi({ publicUrl: '...', adminUrl: '...' });
 *   const events = await api.public.listEvents();
 *   api.admin.setToken(accessToken);
 *   const dash = await api.admin.getDashboard();
 */

// ─────────────────────────────────────────────
// JSONP コア
// ─────────────────────────────────────────────

/**
 * JSONP リクエストを発行して Promise で結果を返す。
 *
 * @param {string} baseUrl   - GAS WebApp URL
 * @param {Object} params    - クエリパラメータ（全て string に変換される）
 * @param {number} [timeout] - タイムアウト ms（デフォルト 30 秒）
 * @returns {Promise<{ ok, data?, error?, status? }>} GAS レスポンス全体
 */
function _jsonp(baseUrl, params, timeout = 30000) {
  return new Promise((resolve, reject) => {
    // ── コールバック名（衝突しないよう一意に） ──────────────
    const cbName = '__gasCb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    let timer, script;

    const cleanup = () => {
      clearTimeout(timer);
      delete window[cbName];
      script && script.parentNode && script.parentNode.removeChild(script);
    };

    // ── GAS からのコールバック ──────────────────────────────
    window[cbName] = (payload) => {
      cleanup();
      resolve(payload);   // { ok, data } or { ok:false, error, status }
    };

    // ── タイムアウト ────────────────────────────────────────
    timer = setTimeout(() => {
      cleanup();
      reject(new ApiError('TIMEOUT', 'リクエストがタイムアウトしました（30秒）'));
    }, timeout);

    // ── script タグ生成 ─────────────────────────────────────
    const url = new URL(baseUrl);
    url.searchParams.set('callback', cbName);

    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });

    script = document.createElement('script');
    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new ApiError('NETWORK_ERROR', 'ネットワークエラーが発生しました。GAS URL を確認してください。'));
    };

    document.head.appendChild(script);
  });
}

/**
 * JSONP レスポンスを解釈して data を返す。エラー時は ApiError をスロー。
 */
async function _callJsonp(baseUrl, params, timeout) {
  let payload;
  try {
    payload = await _jsonp(baseUrl, params, timeout);
  } catch (e) {
    throw e; // ApiError はそのまま再スロー
  }

  if (!payload || typeof payload !== 'object') {
    throw new ApiError('PARSE_ERROR', '不正なレスポンスを受け取りました');
  }

  if (!payload.ok) {
    const err = payload.error || {};
    throw new ApiError(err.code || 'API_ERROR', err.message || '不明なエラー', payload.status);
  }

  return payload.data;
}

// ─────────────────────────────────────────────
// 基底クライアント
// ─────────────────────────────────────────────

class GasClient {
  /**
   * @param {string} baseUrl
   */
  constructor(baseUrl) {
    this.baseUrl  = baseUrl;
    this._token   = null;
    this._timeout = 30000;
  }

  /**
   * GET リクエスト（JSONP）
   * @param {string} action
   * @param {Object} [params]
   */
  get(action, params = {}) {
    return _callJsonp(this.baseUrl, {
      action,
      ...params,
      ...this._authParams()
    }, this._timeout);
  }

  /**
   * POST リクエスト（GAS doGet に _m=post を付けて JSONP GET で送信）
   *
   * ボディのネスト値は JSON 文字列化せず、フラットに展開して渡す。
   * GAS 側 Code.js: doGet で params._m === 'post' のとき routePost を呼ぶ。
   *
   * @param {string} action
   * @param {Object} [body]
   */
  post(action, body = {}) {
    // 配列・真偽値などを string に正規化
    const flat = {};
    Object.entries(body).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    });

    return _callJsonp(this.baseUrl, {
      action,
      _m: 'post',           // GAS 側が POST として処理するためのフラグ
      ...flat,
      ...this._authParams()
    }, this._timeout);
  }

  /** @returns {Object} 認証パラメータ */
  _authParams() {
    return this._token ? { _token: this._token } : {};
  }
}

// ─────────────────────────────────────────────
// Public クライアント（認証不要）
// ─────────────────────────────────────────────

class GasPublicClient extends GasClient {
  /** 公開イベント一覧 */
  listEvents(params = {})          { return this.get('listEvents', params); }

  /** イベント詳細（セッション・出演者・公開メッセージ込み） */
  getEvent(eventId)                { return this.get('getEvent', { id: eventId }); }

  /** 販売中商品一覧 */
  listProducts(params = {})        { return this.get('listProducts', params); }

  /** 注文照会（メール照合あり） */
  inquireOrder(gmoOrderId, email)  { return this.get('inquireOrder', { gmoOrderId, email }); }

  /** GMO ShopID 取得（token.js 初期化用） */
  getShopId()                      { return this.get('getShopId'); }

  /**
   * 注文作成 → GMO-PG トークン決済
   * レスポンス: { orderId, gmoOrderId, status, redirectUrl? }
   */
  createOrder(body)                { return this.post('createOrder', body); }
}

// ─────────────────────────────────────────────
// Admin クライアント（Google OAuth2 トークン必須）
// ─────────────────────────────────────────────

class GasAdminClient extends GasClient {
  /**
   * Google アクセストークンをセット。
   * 以降の全リクエストに ?_token=xxx として付与される。
   * GAS 側で tokeninfo エンドポイントによりユーザーを特定する。
   */
  setToken(token) { this._token = token; return this; }

  // ── ダッシュボード ──────────────────────────
  getDashboard()          { return this.get('getDashboard'); }

  // ── イベント ────────────────────────────────
  listEvents()            { return this.get('listEvents'); }
  getEvent(id)            { return this.get('getEvent', { id }); }
  listSessions(eventId)   { return this.get('listSessions', { eventId }); }
  listTicketTypes(eventId){ return this.get('listTicketTypes', { eventId }); }
  listEventPerformers(eid){ return this.get('listEventPerformers', { eventId: eid }); }
  listReceivers(eventId)  { return this.get('listReceivers', { eventId }); }

  createEvent(body)       { return this.post('createEvent', body); }
  updateEvent(body)       { return this.post('updateEvent', body); }
  publishEvent(id)        { return this.post('publishEvent', { id }); }
  closeEvent(id)          { return this.post('closeEvent', { id }); }

  createSession(body)     { return this.post('createSession', body); }
  deleteSession(body)     { return this.post('deleteSession', body); }
  createTicketType(body)  { return this.post('createTicketType', body); }
  deleteTicketType(body)  { return this.post('deleteTicketType', body); }

  assignPerformer(body)   { return this.post('assignPerformer', body); }
  removePerformer(body)   { return this.post('removePerformer', body); }
  createReceiver(body)    { return this.post('createReceiver', body); }
  updateReceiver(body)    { return this.post('updateReceiver', body); }

  // ── 出演者 ──────────────────────────────────
  listPerformers()         { return this.get('listPerformers'); }
  getPerformer(id)         { return this.get('getPerformer', { id }); }
  createPerformer(body)    { return this.post('createPerformer', body); }
  updatePerformer(body)    { return this.post('updatePerformer', body); }

  // ── 商品 ────────────────────────────────────
  listProducts()           { return this.get('listProducts'); }
  getProduct(id)           { return this.get('getProduct', { id }); }
  createProduct(body)      { return this.post('createProduct', body); }
  updateProduct(body)      { return this.post('updateProduct', body); }
  toggleProduct(id, isActive) { return this.post('toggleProduct', { id, isActive }); }

  // ── 注文 ────────────────────────────────────
  listOrders(params = {}) { return this.get('listOrders', params); }
  getOrder(id)            { return this.get('getOrder', { id }); }
  getPickupList(eventId)  { return this.get('getPickupList', { eventId }); }
  updateFulfillment(id, fulfillmentStatus) {
    return this.post('updateFulfillment', { id, fulfillmentStatus });
  }

  // ── ユーザー ────────────────────────────────
  listUsers()              { return this.get('listUsers'); }
  getUser(id)              { return this.get('getUser', { id }); }
  createUser(body)         { return this.post('createUser', body); }
  updateUser(body)         { return this.post('updateUser', body); }
  deactivateUser(id)       { return this.post('deactivateUser', { id }); }

  // ── 監査ログ ────────────────────────────────
  listAuditLogs(limit)    { return this.get('listAuditLogs', { limit }); }

  // ── 自分自身 ────────────────────────────────
  getMe()                 { return this.get('getMe'); }
}

// ─────────────────────────────────────────────
// ファサード
// ─────────────────────────────────────────────

class GasApi {
  /**
   * @param {{ publicUrl: string, adminUrl: string }} config
   */
  constructor(config) {
    if (!config.publicUrl) throw new Error('GasApi: publicUrl が未設定です');
    if (!config.adminUrl)  throw new Error('GasApi: adminUrl が未設定です');

    this.public = new GasPublicClient(config.publicUrl);
    this.admin  = new GasAdminClient(config.adminUrl);
  }
}

// ─────────────────────────────────────────────
// エラークラス
// ─────────────────────────────────────────────

class ApiError extends Error {
  /**
   * @param {string} code    - 'NOT_FOUND' | 'FORBIDDEN' | 'TIMEOUT' | 'NETWORK_ERROR' | ...
   * @param {string} message - 人間可読なメッセージ
   * @param {number} [status]
   */
  constructor(code, message, status) {
    super(message);
    this.name   = 'ApiError';
    this.code   = code;
    this.status = status || 0;
  }
}

// ─────────────────────────────────────────────
// グローバルエクスポート
// ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.GasApi   = GasApi;
  window.ApiError = ApiError;
}
if (typeof module !== 'undefined') {
  module.exports = { GasApi, ApiError, _jsonp };
}
