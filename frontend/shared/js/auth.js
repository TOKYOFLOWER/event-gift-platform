/**
 * shared/js/auth.js
 * Google Identity Services (GIS) を使った Admin 認証ヘルパー
 *
 * 使い方:
 *   1. <script src="https://accounts.google.com/gsi/client" async></script>
 *   2. initAdminAuth({ onLogin, onLogout })
 */

const Auth = (() => {
  let _tokenClient = null;
  let _token = null;
  let _userInfo = null;

  const SCOPES = 'openid email profile';
  const TOKEN_KEY = 'admin_gis_token';
  const USER_KEY  = 'admin_user_info';

  // ── 初期化 ────────────────────────────────────────

  /**
   * Admin 認証を初期化する。
   * @param {{ onLogin: fn, onLogout: fn }} callbacks
   */
  function init(callbacks = {}) {
    const { onLogin, onLogout } = callbacks;

    // セッションストレージから復元
    const saved = store.get(TOKEN_KEY);
    const savedUser = store.get(USER_KEY);
    if (saved && savedUser && saved.expires_at > Date.now()) {
      _token    = saved;
      _userInfo = savedUser;
      onLogin && onLogin(savedUser, saved.access_token);
      return;
    }

    // GIS 初期化
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: getConfig().googleClientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          console.error('GIS error:', resp.error);
          onLogout && onLogout();
          return;
        }
        // トークン保存
        _token = {
          access_token: resp.access_token,
          expires_at:   Date.now() + (resp.expires_in - 60) * 1000
        };

        // ユーザー情報取得
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + resp.access_token }
          });
          _userInfo = await res.json();
          store.set(TOKEN_KEY, _token);
          store.set(USER_KEY, _userInfo);
          onLogin && onLogin(_userInfo, resp.access_token);
        } catch (e) {
          console.error('userinfo fetch error:', e);
        }
      }
    });
  }

  // ── ログイン ──────────────────────────────────────

  function login() {
    if (_tokenClient) _tokenClient.requestAccessToken({ prompt: '' });
  }

  // ── ログアウト ────────────────────────────────────

  function logout(callback) {
    const token = _token && _token.access_token;
    _token    = null;
    _userInfo = null;
    store.del(TOKEN_KEY);
    store.del(USER_KEY);
    if (token) {
      google.accounts.oauth2.revoke(token, () => {
        callback && callback();
      });
    } else {
      callback && callback();
    }
  }

  // ── ゲッター ──────────────────────────────────────

  function getToken() {
    if (!_token) return null;
    if (_token.expires_at <= Date.now()) { _token = null; return null; }
    return _token.access_token;
  }

  function getUser() { return _userInfo; }

  function isLoggedIn() { return !!getToken(); }

  // ── ページ保護（未ログインなら login.html へ） ─────

  function requireAuth(loginPagePath = '../admin/index.html') {
    if (!isLoggedIn()) {
      store.set('admin_redirect', location.pathname + location.search);
      location.href = loginPagePath;
      return false;
    }
    return true;
  }

  return { init, login, logout, getToken, getUser, isLoggedIn, requireAuth };
})();
