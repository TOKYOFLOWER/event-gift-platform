/**
 * config.example.js → config.js にコピーして編集してください
 * config.js は .gitignore 対象です
 */
window.GAS_CONFIG = {
  // GAS Public WebApp の URL
  publicUrl: 'https://script.google.com/macros/s/YOUR_PUBLIC_DEPLOYMENT_ID/exec',

  // GAS Admin WebApp の URL
  adminUrl: 'https://script.google.com/macros/s/YOUR_ADMIN_DEPLOYMENT_ID/exec',

  // Google OAuth2 クライアント ID
  // https://console.cloud.google.com/ → 認証情報 → OAuth 2.0 クライアント ID
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',

  // フロントエンドのベース URL（末尾スラッシュなし）
  // GMO-PG の returnUrl / cancelUrl に使用
  frontendBaseUrl: 'https://your-domain.vercel.app',

  // 本番: 'production' / テスト: 'development'
  env: 'development'
};
