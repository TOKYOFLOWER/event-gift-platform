# Event Gift Platform Spec v2 (GAS + GMO-PG)

作成日: 2026-02-28
更新日: 2026-03-01
目的: 「イベント掲載（無料）」×「住所不要の差し入れ（花/酒）」×「主催者に売上10%還元」を、GAS中心で最短MVPとして成立させる。
方針: 公開（閲覧）と管理（登録/運用）を分離し、機微情報は非公開領域に隔離する。決済はGMO-PGリンクタイプPlusに委任し、注文確定は結果通知プログラムで行う。

---

## 0. Glossary

| 用語 | 説明 |
|------|------|
| イベント | コンサート/ライブ/発表会などの開催単位 |
| セッション | 同一イベント内の公演回（昼の部/夜の部など） |
| シリーズ | 定期・連続開催イベントの束（Vol.1, Vol.2, ...） |
| 出演者 | イベントに紐づく差し入れ受領対象 |
| 差し入れ | 花/酒などのギフト商品（セット商品から開始） |
| 住所不要 | 購入者に住所を見せず、内部の受取先コードで配送/受領運用を成立させる |
| 会場受取 | 主催者が当日まとめて受け取り、出演者へ渡す（MVPの基本） |
| 還元 | 当サイト経由売上の10%を主催者へ成果報酬として支払う（後フェーズ） |
| 結果通知 | GMO-PGからの非同期HTTP POST通知（決済完了を確定する唯一の手段） |

---

## 1. Non-Goals (MVPではやらない)

- SEOを最大化するための大規模な記事メディア運用
- 複雑な在庫連動・配送業者APIフル連携
- 還元の完全自動支払い（集計自動 + 支払い手動）
- 酒類の本格展開（MVPは花中心、酒はフェーズ2以降）
- Venuesテーブルの分離（会場情報はEventsに埋め込み）
- genre/categoryのマスタシート化（自由テキストで開始）
- セッション単位の差し入れ管理（イベント単位で統一）

---

## 2. System Architecture

### 2.1 Components

```
┌─────────────────────────────────────────────────────┐
│                    Google Cloud                      │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │ GAS WebApp       │    │ Google Sheets        │   │
│  │ (Public)         │    │ (データストア)         │   │
│  │                  │    │                      │   │
│  │ doGet()          │───>│ Events               │   │
│  │  - イベント一覧  │    │ EventSessions        │   │
│  │  - イベント詳細  │    │ EventSeries          │   │
│  │  - 商品一覧      │    │ TicketTypes          │   │
│  │  - メッセージ入力│    │ Performers           │   │
│  │  - サンクス画面  │    │ EventPerformers      │   │
│  │                  │    │ Products             │   │
│  │ doPost()         │    │ Orders               │   │
│  │  - GMO-PG結果通知│───>│ Receivers (非公開)   │   │
│  │                  │    │ Users                │   │
│  └──────────────────┘    │ AuditLog             │   │
│                          │ Attribution (Ph3)    │   │
│  ┌──────────────────┐    └──────────────────────┘   │
│  │ GAS WebApp       │             │                  │
│  │ (Admin)          │─────────────┘                  │
│  │                  │                                │
│  │ Googleログイン必須│                                │
│  │  - イベント管理  │                                │
│  │  - 出演者管理    │                                │
│  │  - 注文管理      │                                │
│  │  - 受取リスト    │                                │
│  │  - 商品管理      │                                │
│  └──────────────────┘                                │
└─────────────────────────────────────────────────────┘
          │                          ▲
          │ リダイレクト              │ 結果通知POST
          ▼                          │
┌──────────────────┐                 │
│ GMO-PG           │                 │
│ リンクタイプPlus  │─────────────────┘
│                  │
│ - 決済画面ホスト │
│ - カード入力     │
│ - 3Dセキュア     │
│ - 結果通知送信   │
└──────────────────┘
```

### 2.2 WebApp分離方針（重要）

セキュリティのため、**2つの独立したGAS WebApp**としてデプロイする。

| WebApp | アクセス権限 | 実行者 | 用途 |
|--------|------------|--------|------|
| **Public** | 全員がアクセス可能 | 自分（デプロイ者） | 公開ページ + GMO-PG結果通知受信 |
| **Admin** | Googleログイン必須 | アクセスしたユーザー | 管理画面（ADMIN/ORGANIZER/PERFORMER） |

同一スプレッドシートを参照し、コードベースはclasp + Gitで一元管理する。

### 2.3 Tech Stack

| 要素 | 技術 |
|------|------|
| サーバーサイド | Google Apps Script |
| データストア | Google Sheets |
| 決済 | GMO-PG リンクタイプPlus |
| バージョン管理 | clasp + Git |
| テンプレートエンジン | GAS HtmlService (テンプレートHTML) |
| メール送信 | GmailApp / MailApp |
| 定期実行 | GASトリガー（時限実行） |

---

## 3. Roles & Permissions

### 3.1 Roles

| ロール | できること |
|--------|-----------|
| **ADMIN** | 全操作。商品マスタ、イベント/出演者/注文管理、監査ログ閲覧 |
| **ORGANIZER** | 自イベントの作成/編集、出演者追加、受取設定、受取リスト出力、注文閲覧（自イベントのみ） |
| **PERFORMER** | 自プロフィール編集、受取注意事項設定、受取予定閲覧 |

### 3.2 Auth（Admin WebApp）

- `Session.getActiveUser().getEmail()` を取得
- Usersシートの許可リスト・ロールで制御
- 未登録ユーザーは「アクセス権限がありません」画面を表示
- 公開WebAppはログイン不要

---

## 4. Data Model (Sheets)

### 4.1 全シート関連図

```
EventSeries (1)
  └── Events (N)
        ├── EventSessions (N)      公演回（昼の部/夜の部）
        ├── TicketTypes (N)         料金区分
        ├── EventPerformers (N:N)
        │     └── Performers (1)
        ├── Receivers (N)           非公開
        └── Orders (N)              アクセス制限
              └── Products (1)

Users ── role → ADMIN / ORGANIZER / PERFORMER
AuditLog（横断）
Attribution（フェーズ3）
```

### 4.2 シート定義

#### 1) Users

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| userId | uuid | ✅ | PK |
| email | string | ✅ | Googleアカウントのメールアドレス |
| displayName | string | ✅ | 表示名 |
| role | enum | ✅ | ADMIN / ORGANIZER / PERFORMER |
| organizerId | uuid | | ORGANIZER の場合、自身を示すID |
| performerId | uuid | | PERFORMER の場合、自身を示すID |
| isActive | bool | ✅ | |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 2) EventSeries（新規）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| seriesId | uuid | ✅ | PK |
| seriesName | string | ✅ | シリーズ名（例: "ColorfulSign ごはんライブ"） |
| organizerId | uuid | ✅ | FK → Users |
| description | text | | シリーズ全体の説明 |
| isActive | bool | ✅ | |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 3) Events

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| eventId | uuid | ✅ | PK |
| organizerId | uuid | ✅ | FK → Users |
| seriesId | uuid | | FK → EventSeries（シリーズ所属時） |
| seriesNumber | int | | シリーズ内通し番号（例: 5） |
| title | string | ✅ | イベント名 |
| description | text | | 説明文 |
| genre | string | | ジャンル（自由入力。例: "打楽器/マリンバ"） |
| category | string | | イベント種別（自由入力。例: "ディナーショー"） |
| venueName | string | ✅ | 会場名 |
| venuePref | string | | 都道府県 |
| venueCity | string | | 市区町村 |
| venueAddress | string | | 番地以降 |
| venuePostalCode | string | | 郵便番号 |
| venuePhone | string | | 会場電話番号 |
| venueUrl | string | | 会場ウェブサイト |
| venueAccess | string | | アクセス情報 |
| ticketUrl | string | | チケット販売URL |
| coverImageUrl | string | | メインビジュアル画像URL |
| flyerImageUrl | string | | フライヤー画像URL |
| contactInfo | string | | 問い合わせ先（公開用） |
| eventNotes | text | | 備考・特記事項（食事情報等） |
| status | enum | ✅ | DRAFT / PUBLISHED / CLOSED |
| giftDeadlineAt | datetime | | 差し入れ受付締切日時 |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 4) EventSessions（新規）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| sessionId | uuid | ✅ | PK |
| eventId | uuid | ✅ | FK → Events |
| sessionLabel | string | ✅ | 表示名（例: "お昼ごはんタイム"） |
| doorsAt | datetime | | 開場/食事開始 |
| startAt | datetime | ✅ | 演奏/公演開始 |
| endAt | datetime | ✅ | 終了 |
| sortOrder | int | ✅ | 表示順 |
| capacityNote | string | | 定員メモ（数値管理はMVP外） |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 5) TicketTypes（新規）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| ticketTypeId | uuid | ✅ | PK |
| eventId | uuid | ✅ | FK → Events |
| label | string | ✅ | 券種名（例: "一般"、"お子様"） |
| priceJPY | int | ✅ | 税込価格 |
| description | string | | 含まれるもの |
| conditions | string | | 条件・注意 |
| sortOrder | int | ✅ | 表示順 |
| createdAt | datetime | ✅ | |

#### 6) Performers

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| performerId | uuid | ✅ | PK |
| displayName | string | ✅ | |
| titleOrGroup | string | | 肩書き/グループ名 |
| bio | text | | プロフィール |
| avatarUrl | string | | プロフィール画像 |
| snsUrl | string | | SNSリンク |
| isActive | bool | ✅ | |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 7) EventPerformers（多対多）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| eventId | uuid | ✅ | FK → Events |
| performerId | uuid | ✅ | FK → Performers |
| sortOrder | int | ✅ | 表示順 |
| isGiftEnabled | bool | ✅ | この出演者への差し入れ受付ON/OFF |
| createdAt | datetime | ✅ | |

#### 8) Receivers（非公開: 受取設定/住所等）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| receiverId | uuid | ✅ | PK |
| eventId | uuid | ✅ | FK → Events |
| performerId | uuid | | FK → Performers（出演者固有の受取先。nullならイベント全体のデフォルト） |
| receiveType | enum | ✅ | VENUE / AGENCY / PARTNER（MVPはVENUE中心） |
| internalLabel | string | | 内部メモ（例: "会場受取_楽屋渡し"） |
| shippingName | string | | 配送宛名（主催者名など） |
| shippingAddress | string | | 配送先住所（非公開） |
| shippingPhone | string | | 電話番号（非公開） |
| notesInternal | string | | 内部メモ（非公開） |
| isActive | bool | ✅ | |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 9) Products

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| productId | uuid | ✅ | PK |
| name | string | ✅ | 商品名 |
| category | enum | ✅ | FLOWER / ALCOHOL |
| priceJPY | int | ✅ | 税込販売価格 |
| description | text | | 説明 |
| imageUrl | string | | 商品画像 |
| isActive | bool | ✅ | |
| sortOrder | int | ✅ | 表示順 |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

#### 10) Orders（アクセス制限）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| orderId | uuid | ✅ | PK |
| eventId | uuid | ✅ | FK → Events |
| organizerId | uuid | ✅ | 非正規化（還元集計・絞り込み高速化） |
| performerId | uuid | ✅ | FK → Performers |
| receiverId | uuid | ✅ | FK → Receivers |
| productId | uuid | ✅ | FK → Products |
| qty | int | ✅ | 数量 |
| unitPriceJPY | int | ✅ | 注文時の単価（Products変更に影響されない） |
| totalJPY | int | ✅ | unitPriceJPY × qty |
| buyerName | string | | 贈り主名（公開名義） |
| buyerEmail | string | ✅ | 連絡先メール |
| buyerPhone | string | | 連絡先電話番号 |
| messageToPerformer | text | | メッセージ |
| isMessagePublic | bool | ✅ | 出演者への公開メッセージとして表示可か |
| isAnonymous | bool | ✅ | 匿名での差し入れか |
| gmoOrderId | string | ✅ | GMO-PGに渡すOrderID（一意） |
| gmoAccessId | string | | GMO-PGから返されるAccessID |
| gmoAccessPass | string | | GMO-PGから返されるAccessPass |
| gmoTranId | string | | GMO-PGから返されるTranID |
| paymentStatus | enum | ✅ | PENDING / PAID / CANCELED / REFUNDED |
| fulfillmentStatus | enum | ✅ | NEW / PREPARING / SHIPPED / DELIVERED / RECEIVED |
| paidAt | datetime | | 支払い確定日時 |
| createdAt | datetime | ✅ | |
| updatedAt | datetime | ✅ | |

**fulfillmentStatus 定義（会場受取の場合）:**

| ステータス | 意味 |
|-----------|------|
| NEW | 注文確定直後 |
| PREPARING | 花屋で制作中 |
| SHIPPED | 会場へ配送済み |
| DELIVERED | 主催者が受け取り済み |
| RECEIVED | 出演者に渡し済み |

**isMessagePublic の定義:**
出演者本人と運営が閲覧可能。trueの場合、イベント詳細の「応援メッセージ」セクションに匿名/実名で公開される。

#### 11) AuditLog

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| logId | uuid | ✅ | PK |
| actorEmail | string | ✅ | 操作者 |
| action | string | ✅ | 操作内容 |
| entityType | enum | ✅ | EVENT / PERFORMER / ORDER / RECEIVER / PRODUCT |
| entityId | string | ✅ | |
| beforeJson | text | | 変更前（JSON文字列） |
| afterJson | text | | 変更後（JSON文字列） |
| createdAt | datetime | ✅ | |

#### 12) Attribution（フェーズ3: 還元用）

| 列名 | 型 | 必須 | 説明 |
|------|---|------|------|
| attributionId | uuid | ✅ | PK |
| organizerId | uuid | ✅ | |
| eventId | uuid | ✅ | |
| code | string | ✅ | 短縮コード |
| source | enum | ✅ | QR / URL |
| createdAt | datetime | ✅ | |

---

## 5. GMO-PG 決済フロー（リンクタイプPlus）

### 5.1 全体フロー

```
購入者                  GAS (Public)              GMO-PG                    GAS (Public doPost)
  │                        │                        │                          │
  │ 1. 商品選択・情報入力  │                        │                          │
  │───────────────────────>│                        │                          │
  │                        │                        │                          │
  │                        │ 2. Orders作成(PENDING)  │                          │
  │                        │    gmoOrderId生成      │                          │
  │                        │                        │                          │
  │                        │ 3. GetLinkplusUrl      │                          │
  │                        │    Payment.json        │                          │
  │                        │───────────────────────>│                          │
  │                        │                        │                          │
  │                        │ 4. LinkUrl返却         │                          │
  │                        │<───────────────────────│                          │
  │                        │                        │                          │
  │ 5. 決済画面へリダイレクト                       │                          │
  │<───────────────────────│                        │                          │
  │                        │                        │                          │
  │ 6. カード入力・3Dセキュア                       │                          │
  │───────────────────────────────────────────────>│                          │
  │                        │                        │                          │
  │                        │                        │ 7. 結果通知POST          │
  │                        │                        │─────────────────────────>│
  │                        │                        │                          │
  │                        │                        │          8. PENDING→PAID │
  │                        │                        │             冪等性チェック│
  │                        │                        │             メール送信   │
  │                        │                        │                          │
  │ 9. 戻り先画面（サンクス）                       │                          │
  │<──────────────────────────────────────────────│                          │
  │   ※戻りボタン押下 or 自動遷移                  │                          │
```

### 5.2 GMO-PG API呼び出し

**決済URL取得（ステップ3）:**

```javascript
// GAS側の実装イメージ
function createGmoCheckoutUrl(order) {
  const endpoint = 'https://pt01.mul-pay.jp/payment/GetLinkplusUrlPayment.json';
  // 本番: https://p01.mul-pay.jp/payment/GetLinkplusUrlPayment.json

  const payload = {
    geturlparam: {
      ShopID: SHOP_ID,          // Script Properties
      ShopPass: SHOP_PASS       // Script Properties
    },
    configid: CONFIG_ID,        // リンクタイプPlus設定ID
    transaction: {
      OrderID: order.gmoOrderId,
      Amount: order.totalJPY,
      Tax: 0                    // 内税の場合0
    },
    credit: {
      JobCd: 'CAPTURE',         // 即時売上
      Method: '1'               // 一括払い
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json;charset=utf-8',
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const result = JSON.parse(response.getContentText());
  return result.LinkUrl;
}
```

### 5.3 結果通知プログラム（doPost）

```javascript
// GAS Public WebApp の doPost()
function doPost(e) {
  try {
    const params = e.parameter;

    // 1. 必須パラメータの存在確認
    if (!params.OrderID || !params.Status) {
      return createResponse('NG');
    }

    // 2. ShopID検証（最低限のなりすまし対策）
    if (params.ShopID !== getScriptProperty('GMO_SHOP_ID')) {
      logSecurity('INVALID_SHOP_ID', params);
      return createResponse('NG');
    }

    // 3. 冪等性チェック: 既にPAIDなら何もしない
    const order = findOrderByGmoOrderId(params.OrderID);
    if (!order) {
      return createResponse('NG');
    }
    if (order.paymentStatus === 'PAID') {
      return createResponse('0');  // 正常応答（重複通知）
    }

    // 4. ステータスに応じた処理
    if (params.Status === 'CAPTURE' || params.Status === 'SALES') {
      // 決済成功
      updateOrderPayment(order.orderId, {
        paymentStatus: 'PAID',
        gmoAccessId: params.AccessID || '',
        gmoTranId: params.TranID || '',
        paidAt: new Date()
      });

      // 5. メール送信
      sendOrderConfirmationEmail(order);
      sendNewOrderNotificationToAdmin(order);

      // 6. 監査ログ
      writeAuditLog('SYSTEM', 'PAYMENT_CONFIRMED', 'ORDER', order.orderId);
    }

    // GMO-PGへ正常応答
    return createResponse('0');

  } catch (error) {
    Logger.log('doPost error: ' + error.message);
    return createResponse('NG');
  }
}

function createResponse(body) {
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.TEXT);
}
```

### 5.4 GMO-PG管理画面での設定

| 設定項目 | 値 |
|---------|---|
| 結果通知プログラムURL | Public WebAppのデプロイURL |
| 結果通知方式 | 非同期 |
| リトライ | 60分おき × 最大5回 |
| 設定ID | 任意（Script Propertiesと一致させる） |

### 5.5 セキュリティ対策

| 脅威 | 対策 |
|------|------|
| 偽の結果通知 | ShopID検証 + OrderID存在確認 + ステータス遷移チェック |
| 二重課金/二重処理 | 冪等性チェック（既にPAIDなら無視） |
| 金額改ざん | 結果通知のAmountとOrders.totalJPYを照合 |
| PENDING放置 | GASトリガーで24時間経過PENDINGをCANCELED化 |
| ログ漏洩 | 結果通知のカード情報系パラメータはログ出力しない |

---

## 6. Pages / Screens

### 6.1 Public（閲覧者向け）

| ID | ページ名 | 説明 | MVP |
|----|---------|------|-----|
| P1 | Event List | 近日開催の一覧。日付/エリアで簡易フィルタ | SHOULD |
| P2 | Event Detail | イベント情報 + セッション時間 + チケット料金 + 出演者カード + 差し入れ導線 | MUST |
| P3 | Performer Profile | 表示名/プロフィール/出演イベント一覧 | SHOULD |
| P4 | Gift Products | 固定セット商品一覧（FLOWER中心）+ 価格 | MUST |
| P5 | Gift Message / Checkout | 名義/メール/メッセージ入力 → GMO-PG決済画面へリダイレクト | MUST |
| P6 | Thank You | 「メールで確定連絡」表示 + 注文照会案内 | MUST |
| P7 | Order Inquiry | メールアドレス + gmoOrderIdで注文状況を照会（簡易） | SHOULD |

**P2: Event Detail 表示要素:**

```
[カバー画像]

# ColorfulSign ごはんライブ ⑤
Percussion & Marimba Quartet

📅 2026年6月6日（土）
  🍽 お昼ごはんタイム  12:30 open / 13:30 start / 15:00 close
  🍽 夜ごはんタイム    17:30 open / 18:30 start / 20:00 close

📍 池之端ライブスペース Qui
   東京都台東区上野2-13-2 パークサイドビル4F
   [Google Mapsリンク]

🎫 チケット
   一般 ¥13,000（会席弁当付き・1ドリンク付き）
   お子様 ¥4,000（お食事なし・1ドリンク付き）
   [チケット購入リンク]

📝 備考
   ・音楽大好きなお子様も大歓迎
   ・亀屋一睦の会席弁当または制菜弁当付き

─── 🌸 差し入れを送る（○月○日まで）───

[出演者カード1] [差し入れを送る]
[出演者カード2] [差し入れを送る]
...

─── 💬 応援メッセージ ───
（isMessagePublic=true のメッセージ一覧）
```

**giftDeadlineAt 過ぎた場合:**
差し入れボタンを非表示にし、「差し入れの受付は終了しました」と表示。

### 6.2 Admin WebApp

| ID | 画面名 | 対象ロール | MVP |
|----|--------|-----------|-----|
| A0 | Login / Access Denied | 全員 | MUST |
| A1 | Dashboard | ADMIN | SHOULD |
| A2 | Events: List | ADMIN, ORGANIZER(自分のみ) | MUST |
| A3 | Events: Create/Edit | ADMIN, ORGANIZER(自分のみ) | MUST |
| A4 | EventSessions: Manage | ADMIN, ORGANIZER | MUST |
| A5 | TicketTypes: Manage | ADMIN, ORGANIZER | MUST |
| A6 | Performers: List | ADMIN | MUST |
| A7 | Performers: Add/Edit | ADMIN | MUST |
| A8 | EventPerformers: Assign | ADMIN, ORGANIZER | MUST |
| A9 | Receivers: Setup | ADMIN, ORGANIZER | MUST |
| A10 | Orders: List | ADMIN, ORGANIZER(自イベントのみ) | MUST |
| A11 | Orders: Detail | ADMIN | MUST |
| A12 | Pickup List Export | ADMIN, ORGANIZER(自イベントのみ) | MUST |
| A13 | Products: Manage | ADMIN | MUST |
| A14 | Audit Log Viewer | ADMIN | SHOULD |
| A15 | Users: Manage | ADMIN | MUST |

---

## 7. Core User Flows

### 7.1 Buyer（購入者）Flow

```
1. Event List or 直接URLでアクセス
2. Event Detail を閲覧
3. 出演者を選んで「差し入れを送る」
4. Gift Products から商品を選択
5. Gift Message: 名義/メール/メッセージ/匿名/公開可否を入力
6. GAS が Order(PENDING)作成 → GMO-PG決済URL取得 → リダイレクト
7. GMO-PG決済画面でカード入力 → 3Dセキュア認証
8. 結果通知で GAS が Order を PAID に更新
9. Thank You ページ表示
10. 確認メール受信
```

### 7.2 Organizer（主催者）Flow

```
1. Admin WebApp にGoogleログイン
2. Create Event（基本情報 + 会場情報 + 備考）
3. Add EventSessions（昼の部/夜の部）
4. Add TicketTypes（一般/お子様等）
5. Assign Performers → EventPerformers
6. Setup Receiver（会場受取先情報）
7. Publish Event（status: DRAFT → PUBLISHED）
8. 注文を確認、Pickup List を出力
9. 当日: 花を受け取り、出演者へ配布
```

### 7.3 Admin（運営）Flow

```
- Product管理（花セット商品の登録/価格変更/ON-OFF）
- Order監視（paymentStatus/fulfillmentStatus更新）
- イベント全体の管理・サポート
- Audit Log確認
```

---

## 8. API / Server Actions (GAS)

### 8.1 Public WebApp

| 関数 | HTTP | 説明 |
|------|------|------|
| doGet(e) | GET | ルーティング。e.parameter.page で画面振り分け |
| doPost(e) | POST | GMO-PG結果通知受信 + フォームPOST受信 |
| getPublishedEvents() | - | PUBLISHED状態のイベント一覧取得 |
| getEventDetail(eventId) | - | イベント詳細（Sessions, TicketTypes, Performers含む） |
| getProducts() | - | 有効な商品一覧 |
| createOrderAndRedirect(data) | - | Order(PENDING)作成 → GMO-PG決済URL取得 → リダイレクト |
| handleGmoNotification(params) | - | 結果通知処理（冪等性チェック含む） |
| inquireOrder(email, gmoOrderId) | - | 注文照会 |

### 8.2 Admin WebApp

| 関数 | ロール | 説明 |
|------|--------|------|
| createEvent(data) | ADMIN, ORGANIZER | |
| updateEvent(eventId, data) | ADMIN, ORGANIZER(自分) | |
| publishEvent(eventId) | ADMIN, ORGANIZER(自分) | status → PUBLISHED, AuditLog |
| closeEvent(eventId) | ADMIN, ORGANIZER(自分) | status → CLOSED, AuditLog |
| manageEventSessions(eventId, sessions) | ADMIN, ORGANIZER | セッションCRUD |
| manageTicketTypes(eventId, types) | ADMIN, ORGANIZER | 料金区分CRUD |
| addPerformer(data) | ADMIN | |
| updatePerformer(performerId, data) | ADMIN, PERFORMER(自分) | |
| assignPerformerToEvent(eventId, performerId) | ADMIN, ORGANIZER | |
| setupReceiver(eventId, data) | ADMIN, ORGANIZER | |
| listOrders(filters) | ADMIN, ORGANIZER(自イベント) | |
| updateFulfillmentStatus(orderId, status) | ADMIN | AuditLog |
| exportPickupList(eventId) | ADMIN, ORGANIZER(自イベント) | CSV出力 |
| manageProducts(data) | ADMIN | |
| manageUsers(data) | ADMIN | |

### 8.3 権限チェック共通関数

```javascript
function requireRole(allowedRoles) {
  const email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('LOGIN_REQUIRED');

  const user = findUserByEmail(email);
  if (!user || !user.isActive) throw new Error('ACCESS_DENIED');
  if (!allowedRoles.includes(user.role)) throw new Error('FORBIDDEN');

  return user;
}

function requireOwnership(user, resourceOrganizerId) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'ORGANIZER' && user.organizerId === resourceOrganizerId) return true;
  throw new Error('FORBIDDEN');
}
```

---

## 9. Email / Notifications (MVP)

| トリガー | 宛先 | 内容 |
|---------|------|------|
| 結果通知で PAID 確定 | buyerEmail | 注文確定メール（注文番号, 商品, メッセージ内容, イベント名, 出演者名） |
| 結果通知で PAID 確定 | ADMIN | 新規差し入れ通知（注文概要） |
| 結果通知で PAID 確定 | ORGANIZER | 新規差し入れ通知（自イベントの場合） |
| fulfillmentStatus 更新 | buyerEmail | ステータス変更通知（SHIPPED時など） |

メール送信は GmailApp.sendEmail() を使用。
HTML メールテンプレートは HtmlService.createTemplateFromFile() で管理。

---

## 10. Scheduled Tasks (GAS Triggers)

| トリガー | 間隔 | 処理 |
|---------|------|------|
| cleanupPendingOrders | 毎時 | 24時間経過したPENDING OrderをCANCELEDに更新 |
| closeExpiredEvents | 毎日 | giftDeadlineAt過ぎたPUBLISHEDイベントの差し入れ受付を自動停止 |
| dailyOrderSummary | 毎日9:00 | 前日の注文サマリーをADMINへメール（SHOULD） |

---

## 11. Security Requirements

### 11.1 必須

| 領域 | 要件 |
|------|------|
| Admin WebApp | whitelistメール + ロールチェック。全関数で requireRole() |
| Public WebApp | 参照はEvents/Performers/Productsのみ。Receivers/Ordersの個人情報は非公開 |
| Secrets | GMO ShopID/ShopPass は Script Properties に格納。Gitに入れない |
| 結果通知 | ShopID検証 + OrderID存在確認 + 金額照合 + 冪等性チェック |
| 監査ログ | publish/close/editPrice/refund/fulfillmentStatus変更は必ずAuditLogへ |
| ログ出力 | 個人情報・カード情報系パラメータは絶対にログ出力しない |

### 11.2 推奨（MVP後）

- doPost の IP 制限（GMO-PG のIPレンジのみ許可 — GASでは完全な制限は困難だが、チェックは可能）
- CSRF 対策: フォーム送信にワンタイムトークンを付与
- レート制限: PropertiesService でカウンター管理

---

## 12. Project Structure (clasp + Git)

```
event-gift-platform/
├── .clasp-public.json       # Public WebApp の clasp設定
├── .clasp-admin.json        # Admin WebApp の clasp設定
├── .gitignore
├── README.md
├── docs/
│   ├── spec.md              # この仕様書
│   └── schema.md            # シート列の変更履歴
├── src/
│   ├── shared/              # 両WebApp共通コード
│   │   ├── config.js        # 定数、シート名
│   │   ├── models/
│   │   │   ├── events.js
│   │   │   ├── eventSessions.js
│   │   │   ├── eventSeries.js
│   │   │   ├── ticketTypes.js
│   │   │   ├── performers.js
│   │   │   ├── eventPerformers.js
│   │   │   ├── receivers.js
│   │   │   ├── products.js
│   │   │   ├── orders.js
│   │   │   ├── users.js
│   │   │   └── auditLog.js
│   │   └── utils/
│   │       ├── uuid.js
│   │       ├── auth.js       # requireRole, requireOwnership
│   │       ├── validation.js
│   │       └── email.js
│   ├── public/               # Public WebApp
│   │   ├── Code.js           # doGet, doPost
│   │   ├── routes.js         # URLルーティング
│   │   ├── controllers/
│   │   │   ├── eventController.js
│   │   │   ├── giftController.js
│   │   │   └── gmoController.js    # 結果通知処理
│   │   └── views/            # HTMLテンプレート
│   │       ├── eventList.html
│   │       ├── eventDetail.html
│   │       ├── giftProducts.html
│   │       ├── giftCheckout.html
│   │       ├── thankYou.html
│   │       ├── orderInquiry.html
│   │       └── partials/
│   │           ├── header.html
│   │           ├── footer.html
│   │           └── sessionCard.html
│   └── admin/                # Admin WebApp
│       ├── Code.js           # doGet
│       ├── routes.js
│       ├── controllers/
│       │   ├── dashboardController.js
│       │   ├── eventAdminController.js
│       │   ├── performerAdminController.js
│       │   ├── orderAdminController.js
│       │   ├── productAdminController.js
│       │   └── userAdminController.js
│       └── views/
│           ├── dashboard.html
│           ├── eventForm.html
│           ├── eventList.html
│           ├── orderList.html
│           ├── pickupList.html
│           └── partials/
│               ├── adminHeader.html
│               ├── adminNav.html
│               └── adminFooter.html
└── scripts/
    ├── deploy-public.sh      # clasp push & deploy (public)
    └── deploy-admin.sh       # clasp push & deploy (admin)
```

### 12.1 clasp 設定

```json
// .clasp-public.json
{
  "scriptId": "PUBLIC_SCRIPT_ID",
  "rootDir": "./src/public",
  "fileExtension": "js"
}

// .clasp-admin.json
{
  "scriptId": "ADMIN_SCRIPT_ID",
  "rootDir": "./src/admin",
  "fileExtension": "js"
}
```

※ shared/ のコードは deploy スクリプトで public/ と admin/ にコピーしてから clasp push する。

### 12.2 Script Properties（環境変数）

| キー | 説明 |
|------|------|
| GMO_SHOP_ID | GMO-PGショップID |
| GMO_SHOP_PASS | GMO-PGショップパスワード |
| GMO_CONFIG_ID | リンクタイプPlus設定ID |
| GMO_API_ENDPOINT | `https://pt01.mul-pay.jp`(テスト) / `https://p01.mul-pay.jp`(本番) |
| SPREADSHEET_ID | データストアのスプレッドシートID |
| ADMIN_NOTIFICATION_EMAIL | 運営通知先メール |
| APP_ENV | development / production |

---

## 13. Implementation Order (MVP)

### Phase 1: 基盤（Week 1-2）

1. Googleスプレッドシートにシートを全て作成（ヘッダ行）
2. clasp プロジェクト × 2（Public / Admin）をセットアップ
3. shared/models/ のCRUD関数を実装
4. shared/utils/ (uuid, auth, validation) を実装
5. Admin WebApp: ログイン + ロールチェック + A0

### Phase 2: 管理画面 コア（Week 3-4）

6. A15: Users管理（ADMIN がユーザー追加/ロール設定）
7. A2-A3: Events CRUD
8. A4: EventSessions 管理
9. A5: TicketTypes 管理
10. A6-A8: Performers CRUD + EventPerformers 紐付け
11. A13: Products 管理
12. A9: Receivers 設定

### Phase 3: 公開ページ + 決済（Week 5-7）

13. P2: Event Detail ページ
14. P4: Gift Products ページ
15. P5: Gift Checkout（Order作成 + GMO-PG連携）
16. P6: Thank You ページ
17. doPost: GMO-PG結果通知受信 → PAID確定
18. メール送信（注文確定、運営通知）
19. P1: Event List（簡易）

### Phase 4: 運用機能（Week 8）

20. A10-A11: Orders 一覧/詳細
21. A12: Pickup List Export
22. A14: Audit Log Viewer
23. GASトリガー設定（PENDINGクリーンアップ、締切自動停止）
24. P7: Order Inquiry（簡易）

### Phase 5: テスト + 公開（Week 9-10）

25. GMO-PGテスト環境での決済テスト
26. 結果通知のリトライ・冪等性テスト
27. 本番環境切り替え（API endpoint, Script Properties）
28. 本番デプロイ

---

## 14. Open Questions (Decisions)

| # | 質問 | 推奨 | 状態 |
|---|------|------|------|
| 1 | 酒類をMVPから扱うか | 花中心、酒はフェーズ2 | 未決定 |
| 2 | 画像ホスティング先 | Google Drive公開リンク or Cloudflare R2 | 未決定 |
| 3 | 公開ページのCSS/デザイン方針 | Tailwind CDN or シンプルなCSS | 未決定 |
| 4 | GMO-PG契約状況 | テスト環境アクセス可能か確認が必要 | 未確認 |
| 5 | 独自ドメイン設定 | GAS WebAppのカスタムドメインは不可。別途LP検討 | 未決定 |

---

## 15. Implementation Notes (Claude Code向け)

- この spec.md を唯一の仕様として参照し、実装時は必ず「差分」と「理由」をコミットメッセージに残す
- シート列を変更する場合は docs/schema.md を更新し差分を記録する
- 個人情報・秘密情報をログ出力しない（特にGMO-PG結果通知のパラメータ）
- GASの6分実行制限に注意。重い処理はバッチに分割する
- UUID生成は Utilities.getUuid() を使用
- 日時は全て ISO 8601 形式で保存し、表示時にJSTへ変換する
- Script Properties への書き込みはデプロイ時に手動設定。コードからの自動設定は避ける

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-28 | v1 | 初版（Stripe前提） |
| 2026-03-01 | v2 | GMO-PGリンクタイプPlusに変更。EventSessions/EventSeries/TicketTypes追加。Events拡張。レビュー指摘反映（冪等性、PENDING cleanup、金額分離、fulfillmentStatus定義、WebApp分離） |
