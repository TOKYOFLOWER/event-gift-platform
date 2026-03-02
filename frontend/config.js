window.GAS_CONFIG = {
  // 公開した GAS の WebアプリURL（Public / Admin 共通）
  apiUrl: 'https://script.google.com/macros/s/AKfycbz7iZFjF6JXnnvUNWZ8_TwbAa1UfW5xeYz3ndEpg17HhWnEbR6qXVUyfCsG9eyBaVtUAQ/exec',

  // GMO テスト環境のショップID（token.js 初期化用）
  gmoShopId: '1103408000001',

  // トークン取得用 JS（テスト環境）
  gmoTokenJsUrl: 'https://stg.static.mul-pay.jp/token.js',

  // フロントエンドのベース URL（GMO コールバック先）
  // Vercel root = frontend/ のため /public サブパスが必要
  frontendBaseUrl: 'https://hanataba.tokyoflower.jp/public'
};
