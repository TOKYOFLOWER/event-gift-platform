/**
 * config.example.js → config.js にコピーして編集してください
 * config.js は .gitignore 対象です
 *
 * cp config.example.js config.js
 */
window.GAS_CONFIG = {
  // ── GAS WebApp URL ─────────────────────────────────────────────
  // GAS エディタ → デプロイ → ウェブアプリ → URL
  publicUrl: 'https://script.google.com/macros/s/YOUR_PUBLIC_DEPLOYMENT_ID/exec',
  adminUrl:  'https://script.google.com/macros/s/YOUR_ADMIN_DEPLOYMENT_ID/exec',

  // ── Google OAuth2 クライアント ID ──────────────────────────────
  // https://console.cloud.google.com/ → 認証情報 → OAuth 2.0 クライアント ID
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

  // ── GMO-PG token.js URL ─────────────────────────────────────────
  gmoTokenJsUrl: 'https://static.mul-pay.jp/ext/js/token.js',

  // ── フロントエンド ベース URL ──────────────────────────────────
  // GMO-PG のコールバック URL に使用（末尾スラッシュなし）
  // 例: 'https://hanataba.tokyoflower.jp/public'
  frontendBaseUrl: 'https://your-domain.vercel.app/public',

  // ── 環境 ───────────────────────────────────────────────────────
  // 'development' | 'staging' | 'production'
  env: 'development'
};
