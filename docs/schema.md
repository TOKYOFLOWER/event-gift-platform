# Schema Change Log

データストア（Google Sheets）の列変更履歴。列を追加/削除/変更した場合はここに記録する。

## 2026-03-01 初版 (v2)

### 新規シート一覧

| シート名 | 説明 |
|---------|------|
| Users | ユーザー・ロール管理 |
| EventSeries | イベントシリーズ |
| Events | イベント基本情報（会場情報含む） |
| EventSessions | 公演回（昼の部/夜の部） |
| TicketTypes | 料金区分 |
| Performers | 出演者プロフィール |
| EventPerformers | イベント↔出演者 多対多 |
| Receivers | 受取先設定（非公開） |
| Products | 差し入れ商品マスタ |
| Orders | 注文・決済情報 |
| AuditLog | 操作ログ |

### 各シートのヘッダー行（コピー用）

#### Users
userId | email | displayName | role | organizerId | performerId | isActive | createdAt | updatedAt

#### EventSeries
seriesId | seriesName | organizerId | description | isActive | createdAt | updatedAt

#### Events
eventId | organizerId | seriesId | seriesNumber | title | description | genre | category | venueName | venuePref | venueCity | venueAddress | venuePostalCode | venuePhone | venueUrl | venueAccess | ticketUrl | coverImageUrl | flyerImageUrl | contactInfo | eventNotes | status | giftDeadlineAt | createdAt | updatedAt

#### EventSessions
sessionId | eventId | sessionLabel | doorsAt | startAt | endAt | sortOrder | capacityNote | createdAt | updatedAt

#### TicketTypes
ticketTypeId | eventId | label | priceJPY | description | conditions | sortOrder | createdAt

#### Performers
performerId | displayName | titleOrGroup | bio | avatarUrl | snsUrl | isActive | createdAt | updatedAt

#### EventPerformers
eventId | performerId | sortOrder | isGiftEnabled | createdAt

#### Receivers
receiverId | eventId | performerId | receiveType | internalLabel | shippingName | shippingAddress | shippingPhone | notesInternal | isActive | createdAt | updatedAt

#### Products
productId | name | category | priceJPY | description | imageUrl | isActive | sortOrder | createdAt | updatedAt

#### Orders
orderId | eventId | organizerId | performerId | receiverId | productId | qty | unitPriceJPY | totalJPY | buyerName | buyerEmail | buyerPhone | messageToPerformer | isMessagePublic | isAnonymous | gmoOrderId | gmoAccessId | gmoAccessPass | gmoTranId | paymentStatus | fulfillmentStatus | paidAt | createdAt | updatedAt

#### AuditLog
logId | actorEmail | action | entityType | entityId | beforeJson | afterJson | createdAt
