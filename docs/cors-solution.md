# CORS 回避策（GAS WebApp）

## 問題

GAS WebApp は `Access-Control-Allow-Origin` ヘッダーを自在に制御できない。  
フロントエンド（Vercel / GitHub Pages）から `fetch()` で GAS を呼ぶと CORS エラーになる。

## 解決策

全リクエストを **JSONP（`<script>` タグ）** で送信する。

```
フロントエンド → <script src="GAS_URL?action=xxx&callback=__gasCb_xxx"> → GAS
GAS           → __gasCb_xxx({"ok":true,"data":{...}}) を返す（JS として実行）
フロントエンド → window.__gasCb_xxx が呼ばれ Promise が resolve する
```

## 通信パターン

| 操作 | 方式 | 備考 |
|------|------|------|
| 読み取り（GET） | JSONP | `?action=listEvents&callback=__gasCb_xxx` |
| 書き込み（POST） | JSONP + `?_m=post` | doGet で `_m=post` を検知して routePost を呼ぶ |
| Admin 認証 | `?_token=<GoogleAccessToken>` | GAS が Google tokeninfo API で検証 |
| GMO-PG 結果通知 | doPost のまま（TEXT応答） | GMO サーバーからの通知は GAS 直呼び |

## GAS 側の変更点

### src/admin/Code.js — doGet に `_m=post` 処理を追加

```javascript
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || '';
  try {
    var user = requireRole([...], params);   // params を渡す（_token 解決用）
    var data = params._m === 'post'
      ? routePost(action, params, user)      // ← 追加
      : routeGet(action, params, user);
    return jsonOk(data, params.callback);
  } catch (err) {
    return jsonError(err, params.callback);
  }
}
```

### src/admin/utils/auth.js — `_token` 認証を追加

```javascript
function requireRole(allowedRoles, params) {
  var email;
  if (params && params._token) {
    // Google tokeninfo API でトークン検証 → email 取得
    var info = JSON.parse(UrlFetchApp.fetch(TOKENINFO_URL + params._token).getContentText());
    email = info.email;
  } else {
    email = Session.getActiveUser().getEmail();
  }
  ...
}
```

## フロントエンド側（api.js）

### JSONP コア実装

```javascript
function _jsonp(baseUrl, params, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const cbName = '__gasCb_' + Date.now() + '_' + randomStr();

    window[cbName] = (payload) => { cleanup(); resolve(payload); };

    const timer = setTimeout(() => { cleanup(); reject(new ApiError('TIMEOUT', '...')); }, timeout);

    const script = document.createElement('script');
    const url = new URL(baseUrl);
    url.searchParams.set('callback', cbName);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    script.src = url.toString();
    script.onerror = () => { cleanup(); reject(new ApiError('NETWORK_ERROR', '...')); };
    document.head.appendChild(script);

    function cleanup() { clearTimeout(timer); delete window[cbName]; script.remove(); }
  });
}
```

### POST → JSONP GET 変換

```javascript
// POST 操作（書き込み）もすべて JSONP GET として送信
post(action, body = {}) {
  return _callJsonp(this.baseUrl, {
    action,
    _m: 'post',     // GAS が POST として処理するフラグ
    ...flatBody,    // body をフラットな string に変換
    _token: this._token   // Admin 認証トークン
  });
}
```

## セキュリティ考慮

| 項目 | 対応 |
|------|------|
| `_token` が URL に露出 | HTTPS 必須 / GAS ログには action と code のみ記録 |
| JSONP XSS | callback 名を `[a-zA-Z0-9_.]` のみ許可（sanitizeCallback） |
| なりすまし POST | tokeninfo で `email` を取得 → Users シートでロールを確認 |
| GET キャッシュ | GAS は毎回実行される（キャッシュなし） |
| URL 長制限 | messageToPerformer (max 400文字) 含め ~1500文字 → 問題なし |

## トラブルシューティング

**JSONP が呼ばれない（script.onerror が発火）**  
→ GAS URL が正しいか確認。デプロイが「全員」アクセス可能か確認。

**callback が呼ばれずタイムアウト**  
→ GAS 側で例外が発生しているかもしれない。GAS の Execution log を確認。  
→ `callback` パラメータが GAS の `sanitizeCallback` で除去されていないか確認。

**LOGIN_REQUIRED エラー（Admin）**  
→ `_token` が正しく渡されているか確認。  
→ トークンの有効期限（1時間）が切れていないか確認。Auth.getToken() が null を返す場合は再ログイン。

**_m=post が動かない（読み取り専用エラー）**  
→ Admin/Public 両方の Code.js を再デプロイしたか確認。  
→ GAS のデプロイは「新しいデプロイ」を作成すること（バージョン更新が必要）。
