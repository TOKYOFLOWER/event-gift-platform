# Event Gift Platform

イベント向けギフト（花の差し入れ）プラットフォーム。  
**GAS + Google Sheets + GMO-PG リンクタイプPlus** で構成される MVP。

## 概要

- 公開 WebApp: イベント一覧・詳細・差し入れ購入フロー
- 管理 WebApp: イベント/出演者/注文の管理（Google ログイン必須）
- データストア: Google Sheets
- 決済: GMO-PG リンクタイプPlus（非同期結果通知）

## セットアップ

### 1. Google Sheets 作成

以下のシートを手動で作成し、各シートにヘッダー行を追加してください（`docs/schema.md` 参照）:

`Users`, `EventSeries`, `Events`, `EventSessions`, `TicketTypes`,  
`Performers`, `EventPerformers`, `Receivers`, `Products`, `Orders`, `AuditLog`

### 2. clasp セットアップ

```bash
npm install -g @google/clasp
clasp login

# Public WebApp
clasp create --title "EventGift Public" --type webapp
cp .clasp.json .clasp-public.json

# Admin WebApp
clasp create --title "EventGift Admin" --type webapp
cp .clasp.json .clasp-admin.json
```

`.clasp-public.json` と `.clasp-admin.json` の `scriptId` を設定してください。

### 3. Script Properties 設定

GAS エディタ > プロジェクトの設定 > スクリプト プロパティ に以下を追加:

| キー | 説明 |
|------|------|
| `GMO_SHOP_ID` | GMO-PG ショップID |
| `GMO_SHOP_PASS` | GMO-PG ショップパスワード |
| `GMO_CONFIG_ID` | リンクタイプPlus 設定ID |
| `GMO_API_ENDPOINT` | テスト: `https://pt01.mul-pay.jp` / 本番: `https://p01.mul-pay.jp` |
| `SPREADSHEET_ID` | データストアのスプレッドシートID |
| `ADMIN_NOTIFICATION_EMAIL` | 運営通知先メール |
| `APP_ENV` | `development` または `production` |

### 4. デプロイ

```bash
# Public
bash scripts/deploy-public.sh

# Admin
bash scripts/deploy-admin.sh
```

## プロジェクト構造

```
src/
  shared/        # 両 WebApp 共通（models, utils, config）
  public/        # 公開 WebApp
  admin/         # 管理 WebApp
docs/
  spec-v2.md     # 仕様書
  schema.md      # シート列変更履歴
scripts/
  deploy-public.sh
  deploy-admin.sh
```

## 仕様書

`docs/spec-v2.md` を参照。実装時は必ずコミットメッセージに差分と理由を記載する。

## 開発フェーズ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | 基盤（models, utils, config） | ✅ 完了 |
| 2 | 管理画面コア | 🔲 未着手 |
| 3 | 公開ページ + 決済 | 🔲 未着手 |
| 4 | 運用機能 | 🔲 未着手 |
| 5 | テスト + 本番公開 | 🔲 未着手 |

## セキュリティ注意事項

- `Script Properties` の値は **絶対に Git にコミットしない**
- GMO-PG 結果通知のパラメータをログ出力しない
- `Receivers` シートの情報は Public WebApp から返さない
