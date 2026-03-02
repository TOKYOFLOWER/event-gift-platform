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

  // ── フロントエンド ベース URL ──────────────────────────────────
  // GMO-PG のコールバック URL に使用（末尾スラッシュなし）
  // 例: 'https://hanataba.tokyoflower.jp/public'
  frontendBaseUrl: 'https://your-domain.vercel.app/public',

  // ── GMO-PG OpenAPIタイプ 設定 ──────────────────────────────────
  //
  // GMO 加盟店管理画面 → ショップ設定 → ショップID
  // ★ この値はフロントエンドに公開されます（token.js 初期化に必要）
  // ★ ShopPassword はフロントエンドに含めないでください（GAS側に設定）
  gmoShopId: 'YOUR_GMO_SHOP_ID',

  // GMO token.js の URL
  //   テスト環境: 'https://stg.static.mul-pay.jp/token.js'
  //   本番環境:   'https://static.mul-pay.jp/token.js'
  gmoTokenJsUrl: 'https://stg.static.mul-pay.jp/token.js',

  // ── 環境 ───────────────────────────────────────────────────────
  // 'development' | 'staging' | 'production'
  env: 'development'
};
