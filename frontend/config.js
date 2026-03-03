window.GAS_CONFIG = {
  // Public GAS WebApp URL（閲覧・注文作成・照会）
  publicUrl: 'https://script.google.com/macros/s/AKfycbz7iZFjF6JXnnvUNWZ8_TwbAa1UfW5xeYz3ndEpg17HhWnEbR6qXVUyfCsG9eyBaVtUAQ/exec',

  // Admin GAS WebApp URL（管理画面 API）
  // TODO: Admin GAS をデプロイ後、ここに URL を設定してください
  //   clasp deploy で取得した Admin WebApp URL を貼る
  adminUrl: 'https://script.google.com/macros/s/AKfycbz7iZFjF6JXnnvUNWZ8_TwbAa1UfW5xeYz3ndEpg17HhWnEbR6qXVUyfCsG9eyBaVtUAQ/exec',

  // 後方互換: publicUrl のフォールバック
  apiUrl: 'https://script.google.com/macros/s/AKfycbz7iZFjF6JXnnvUNWZ8_TwbAa1UfW5xeYz3ndEpg17HhWnEbR6qXVUyfCsG9eyBaVtUAQ/exec',

  // GMO-PG OpenAPIタイプ token.js URL（テスト環境）
  gmoTokenJsUrl: 'https://stg.openapi.mul-pay.jp/ext/js/token.js',

  // フロントエンドのベース URL（GMO コールバック先）
  // Vercel root = frontend/ のため /public サブパスが必要
  frontendBaseUrl: 'https://hanataba.tokyoflower.jp/public'
};
