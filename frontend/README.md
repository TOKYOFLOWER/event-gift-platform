# フロントエンド

Vanilla JS + Bootstrap 5 で構築した静的サイト。  
GAS REST API を呼び出し、GitHub Pages または Vercel でホストする。

## セットアップ

```bash
# 1. config.js を作成
cp config.example.js config.js

# 2. config.js を編集（GAS URL、Google Client ID を設定）
# PUBLIC_GAS_URL=...
# ADMIN_GAS_URL=...
# GOOGLE_CLIENT_ID=...
```

## ディレクトリ構成

```
frontend/
  public/              一般ユーザー向けページ
    index.html         イベント一覧
    event-detail.html  イベント詳細
    gift-products.html 商品選択
    gift-checkout.html 差し入れ情報入力
    thank-you.html     注文完了
    order-inquiry.html 注文照会

  admin/               管理者向けページ（Google ログイン必須）
    index.html         ログイン
    dashboard.html     ダッシュボード
    events.html        イベント管理
    performers.html    出演者管理
    products.html      商品管理
    orders.html        注文管理
    users.html         ユーザー管理
    audit-log.html     監査ログ

  shared/
    css/style.css      共通スタイル
    js/api.js          GAS API クライアント
    js/auth.js         Google OAuth2 ヘルパー
    js/utils.js        共通ユーティリティ
    js/admin-layout.js Admin サイドバー・トップバー

  config.example.js    設定テンプレート（コピーして config.js に）
  vercel.json          Vercel デプロイ設定
```

## ローカル確認

```bash
# Python の簡易サーバー（ルートを frontend/ に）
cd frontend
python -m http.server 8080

# ブラウザで開く
open http://localhost:8080/public/index.html
open http://localhost:8080/admin/index.html
```

## Vercel デプロイ

1. GitHub にプッシュ
2. Vercel でプロジェクト作成 → Root Directory を `frontend` に設定
3. 環境変数は `config.js` で管理（gitignore 済み）

## GitHub Pages デプロイ

1. リポジトリの Settings → Pages → Source: `main` branch, `/ (root)`
2. `frontend/` 配下がそのまま公開される（パス: `/frontend/public/...`）

## Admin 認証

Google Identity Services (GIS) を使用。  
`config.js` の `googleClientId` に OAuth2 クライアント ID を設定すること。

Google Cloud Console での設定:
1. 認証情報 → OAuth 2.0 クライアント ID を作成
2. 承認済みの JavaScript 生成元に `https://your-domain.vercel.app` を追加
3. スコープ: `openid email profile`
