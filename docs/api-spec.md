# GAS REST API 仕様書

アーキテクチャ変更: 2026-03-02 Phase4

## 概要

GAS WebApp を JSON API 専用として運用する。HTML は返さない。
フロントエンドは `frontend/` ディレクトリに Vanilla JS + Bootstrap5 で構築し、GitHub Pages / Vercel でデプロイする。

---

## 共通仕様

### ベース URL

```
Public API:  https://script.google.com/macros/s/<PUBLIC_DEPLOYMENT_ID>/exec
Admin API:   https://script.google.com/macros/s/<ADMIN_DEPLOYMENT_ID>/exec
```

### レスポンス形式

```json
// 成功
{ "ok": true, "data": <payload> }

// エラー
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "..." }, "status": 404 }
```

### CORS

GAS の `ContentService` は `Access-Control-Allow-Origin: *` を自動付与する。
JSONP が必要な場合は `?callback=fnName` を付与する。

### JSONP

```
GET ?action=listEvents&callback=myFn
→ myFn({"ok":true,"data":[...]})
```

---

## Public API（認証不要）

### GET エンドポイント

| action | パラメータ | 説明 |
|--------|-----------|------|
| `listEvents` | `pref?`, `q?` | 公開イベント一覧（セッション・出演者サマリー付き） |
| `getEvent` | `id` | イベント詳細（セッション・券種・出演者・公開メッセージ） |
| `listProducts` | `eventId?`, `category?` | 販売中商品一覧 |
| `inquireOrder` | `gmoOrderId`, `email` | 注文照会（メールアドレス照合） |

### POST エンドポイント

| action | ボディ | レスポンス |
|--------|--------|-----------|
| `createOrder` | `{ eventId, performerId, productId, buyerName, buyerEmail, buyerPhone?, messageToPerformer?, isMessagePublic?, isAnonymous? }` | `{ orderId, gmoOrderId, redirectUrl }` |

**GMO-PG 結果通知**  
`action` なし + `OrderID` ありの POST はテキスト `0` / `NG` を返す（GMO仕様）。

---

## Admin API（Googleログイン必須）

全エンドポイントはリクエストユーザーの Google アカウントで認証する。
`Session.getActiveUser()` でロールを解決し、権限不足時は 403 を返す。

ロール: `ADMIN` / `ORGANIZER` / `PERFORMER`

### GET エンドポイント

| action | 必要ロール | パラメータ | 説明 |
|--------|-----------|-----------|------|
| `getMe` | 全員 | - | 自分のユーザー情報 |
| `getDashboard` | 全員 | - | 統計・最近のイベント |
| `listEvents` | 全員 | - | イベント一覧（ADMIN: 全件、ORGANIZER: 自分のみ） |
| `getEvent` | 全員 | `id` | イベント詳細＋関連データ |
| `listSessions` | 全員 | `eventId` | 公演回一覧 |
| `listTicketTypes` | 全員 | `eventId` | 券種一覧 |
| `listEventPerformers` | 全員 | `eventId` | 出演者割り当て一覧 |
| `listReceivers` | 全員 | `eventId` | 受取設定一覧 |
| `listPerformers` | ADMIN | - | 全出演者一覧 |
| `getPerformer` | ADMIN | `id` | 出演者詳細 |
| `listProducts` | ADMIN | - | 全商品一覧 |
| `getProduct` | ADMIN | `id` | 商品詳細 |
| `listOrders` | 全員 | `eventId?`, `paymentStatus?`, `fulfillmentStatus?` | 注文一覧 |
| `getOrder` | 全員 | `id` | 注文詳細＋関連データ |
| `getPickupList` | 全員 | `eventId` | 受取リスト（確定済みのみ） |
| `listUsers` | ADMIN | - | ユーザー一覧 |
| `getUser` | ADMIN | `id` | ユーザー詳細 |
| `listAuditLogs` | ADMIN | `limit?` | 監査ログ（デフォルト200件） |

### POST エンドポイント

| action | 必要ロール | 主なボディフィールド |
|--------|-----------|-------------------|
| `createEvent` | ORGANIZER+ | `title`, `venueName`, `giftDeadlineAt`, ... |
| `updateEvent` | ORGANIZER+ | `id`, + 更新フィールド |
| `publishEvent` | ORGANIZER+ | `id` |
| `closeEvent` | ORGANIZER+ | `id` |
| `createSession` | ORGANIZER+ | `eventId`, `sessionLabel`, `startAt`, `endAt?` |
| `deleteSession` | ORGANIZER+ | `eventId`, `sessionId` |
| `createTicketType` | ORGANIZER+ | `eventId`, `label`, `priceJPY` |
| `deleteTicketType` | ORGANIZER+ | `eventId`, `ticketTypeId` |
| `assignPerformer` | ORGANIZER+ | `eventId`, `performerId`, `isGiftEnabled` |
| `removePerformer` | ORGANIZER+ | `eventId`, `performerId` |
| `createReceiver` | ORGANIZER+ | `eventId`, `receiveType`, `shippingName` |
| `updateReceiver` | ORGANIZER+ | `eventId`, `receiverId`, + 更新フィールド |
| `createPerformer` | ADMIN | `displayName` |
| `updatePerformer` | ADMIN / PERFORMER(自分) | `id`, + 更新フィールド |
| `createProduct` | ADMIN | `name`, `category`, `priceJPY` |
| `updateProduct` | ADMIN | `id`, + 更新フィールド |
| `toggleProduct` | ADMIN | `id`, `isActive` |
| `updateFulfillment` | ADMIN | `id`, `fulfillmentStatus` |
| `createUser` | ADMIN | `displayName`, `email`, `role` |
| `updateUser` | ADMIN | `id`, + 更新フィールド |
| `deactivateUser` | ADMIN | `id` |

---

## フロントエンド構成

```
frontend/
  public/                    # 一般ユーザー向け
    pages/
      index.html             # イベント一覧 (P1)
      event-detail.html      # イベント詳細 (P2)
      gift-products.html     # 商品選択 (P3)
      gift-checkout.html     # 差し入れ情報入力 (P4)
      thank-you.html         # 完了ページ (P5)
      order-inquiry.html     # 注文照会 (P6)
  admin/                     # 管理者向け
    pages/
      dashboard.html         # ダッシュボード (A1)
      events.html            # イベント一覧・編集 (A2-A5)
      performers.html        # 出演者管理 (A6-A8)
      products.html          # 商品管理 (A13)
      orders.html            # 注文管理 (A10-A12)
      users.html             # ユーザー管理 (A15)
      audit-log.html         # 監査ログ (A14)
  shared/
    js/
      api.js                 # GAS API クライアント（GasApi クラス）
      auth.js                # Google OAuth2 ヘルパー
      utils.js               # 共通ユーティリティ
    css/
      style.css              # 共通スタイル
```

### 環境変数

`frontend/` ルートに `.env` を作成（Vercel / GitHub Actions でも設定する）：

```
PUBLIC_GAS_URL=https://script.google.com/macros/s/<ID>/exec
ADMIN_GAS_URL=https://script.google.com/macros/s/<ID>/exec
GOOGLE_CLIENT_ID=<OAuth2_Client_ID>
FRONTEND_BASE_URL=https://your-domain.vercel.app
```

### Admin 認証フロー

1. Google One Tap / `gapi.auth2` でアクセストークンを取得
2. `api.admin.setToken(token)` でクライアントにセット
3. 各 API コール時に `Authorization: Bearer <token>` ヘッダーを付与
4. GAS 側は `Session.getActiveUser()` でユーザーを解決

---

## GMO-PG 注文フロー

```
[フロントエンド]                    [GAS Public API]        [GMO-PG]
      |                                   |                     |
      |--- POST createOrder ----------->  |                     |
      |                                   |-- GetLinkplusUrl -->|
      |                                   |<-- { LinkUrl } -----|
      |<-- { redirectUrl } -------------- |                     |
      |                                   |                     |
      |--- window.location = redirectUrl  |                     |
      |                                                         |
      |<===================== 決済画面 =========================>|
      |                                                         |
      |                                   |<-- 結果通知 (POST) --|
      |                                   |-- 0 or NG --------->|
      |                                   |                     |
      |<-- リダイレクト /thank-you?gmoOrderId=xxx              |
```
