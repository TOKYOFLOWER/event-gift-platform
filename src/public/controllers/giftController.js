/**
 * src/public/controllers/giftController.js
 * P4: 商品一覧, P5: 差し入れチェックアウト（フォーム）,
 * P6: サンクスページ, P7: 注文照会
 * 変更履歴: 2026-03-02 Phase3 実装
 */

// ===== P4: Gift Products =====

function renderGiftProducts(params) {
  var eventId     = params.eventId;
  var performerId = params.performerId;
  if (!eventId || !performerId) {
    return buildPublicPage('エラー', '<div class="container py-5"><p class="text-danger">eventId と performerId が必要です。</p></div>');
  }

  var ev        = findEventById(eventId);
  var performer = findPerformerById(performerId);
  var products  = listActiveProducts().filter(function(p) { return p.category === PRODUCT_CATEGORY.FLOWER; });
  var base      = ScriptApp.getService().getUrl();
  var now       = new Date();

  if (!ev || ev.status !== EVENT_STATUS.PUBLISHED) {
    return buildPublicPage('エラー', '<div class="container py-5"><p>イベントが見つかりません。</p></div>');
  }
  if (ev.giftDeadlineAt && new Date(ev.giftDeadlineAt) <= now) {
    return buildPublicPage('受付終了',
      '<div class="container py-5 text-center"><h3>差し入れの受付は終了しました</h3><a href="' + base + '?page=eventDetail&eventId=' + escHtml(eventId) + '">← イベントに戻る</a></div>');
  }

  var avatarHtml = performer && performer.avatarUrl
    ? '<img src="' + escHtml(performer.avatarUrl) + '" class="performer-avatar" style="width:60px;height:60px">'
    : '<span style="font-size:2rem">🎤</span>';

  var cards = products.map(function(p) {
    return '<div class="col-6 col-md-4">'
      + '<label class="product-card p-2 d-block h-100" style="border:2px solid #ddd;border-radius:12px;cursor:pointer">'
      + '<input type="radio" name="productId" value="' + escHtml(p.productId) + '" class="d-none" onchange="selectProduct(this)" required>'
      + (p.imageUrl
          ? '<img src="' + escHtml(p.imageUrl) + '" class="product-img mb-2" alt="' + escHtml(p.name) + '">'
          : '<div class="product-img mb-2 d-flex align-items-center justify-content-center" style="background:#f9ebea;border-radius:8px;height:140px"><span style="font-size:3rem">🌸</span></div>')
      + '<p class="fw-bold mb-0">' + escHtml(p.name) + '</p>'
      + '<p class="text-danger fw-bold mb-0">¥' + Number(p.priceJPY).toLocaleString() + '</p>'
      + (p.description ? '<p class="small text-muted mb-0">' + escHtml(p.description) + '</p>' : '')
      + '</label></div>';
  }).join('');

  var body = '<div class="container py-4">'
    + '<nav aria-label="breadcrumb"><ol class="breadcrumb small">'
    + '<li class="breadcrumb-item"><a href="' + base + '">TOP</a></li>'
    + '<li class="breadcrumb-item"><a href="' + base + '?page=eventDetail&eventId=' + escHtml(eventId) + '">' + escHtml(ev.title) + '</a></li>'
    + '<li class="breadcrumb-item active">商品選択</li></ol></nav>'

    + '<div class="d-flex align-items-center gap-3 mb-4">'
    + avatarHtml
    + '<div><h2 class="fw-bold mb-0">' + escHtml(performer ? performer.displayName : '') + '</h2>'
    + '<p class="text-muted small mb-0">' + escHtml(ev.title) + ' への差し入れ</p></div>'
    + '</div>'

    + '<h4 class="section-title">🌸 商品を選ぶ</h4>'
    + openPublicForm({ eventId: eventId, performerId: performerId, action: 'giftCheckout' })
    + '<div class="row g-3 mb-4">' + (cards || '<p class="text-muted">現在取り扱い商品がありません。</p>') + '</div>'
    + '<div id="selectedPrice" class="alert alert-success d-none">選択中: <strong id="selectedName"></strong> — <strong id="selectedPriceVal"></strong></div>'
    + '<div class="d-grid"><button type="submit" class="gift-btn btn-lg py-3">次へ：メッセージを入力 →</button></div>'
    + '</form>'
    + '</div>'
    + '<script>'
    + 'var products=' + JSON.stringify(products.map(function(p){ return {id:p.productId,name:p.name,price:p.priceJPY}; })) + ';'
    + 'function selectProduct(el){'
    + '  var p=products.find(function(x){return x.id===el.value;});'
    + '  if(!p)return;'
    + '  document.getElementById("selectedName").textContent=p.name;'
    + '  document.getElementById("selectedPriceVal").textContent="¥"+p.price.toLocaleString();'
    + '  document.getElementById("selectedPrice").classList.remove("d-none");'
    + '  document.querySelectorAll("label.product-card").forEach(function(l){l.style.borderColor="#ddd";l.style.background="";});'
    + '  el.closest("label").style.borderColor="#c0392b";el.closest("label").style.background="#f9ebea";'
    + '}'
    + '</script>';

  return buildPublicPage('商品選択', body);
}

// ===== P5: Checkout Form =====

function renderGiftCheckout(params) {
  var eventId     = params.eventId;
  var performerId = params.performerId;
  var productId   = params.productId;
  var errorMsg    = params.errorMsg || '';

  var base      = ScriptApp.getService().getUrl();
  var ev        = findEventById(eventId);
  var performer = findPerformerById(performerId);
  var product   = findProductById(productId);

  if (!ev || !performer || !product) {
    return buildPublicPage('エラー',
      '<div class="container py-5"><p class="text-danger">必要な情報が不足しています。</p><a href="' + base + '">← TOP</a></div>');
  }

  var body = '<div class="container py-4" style="max-width:640px">'
    + '<h2 class="fw-bold">🌸 差し入れ情報を入力</h2>'

    // 選択内容サマリー
    + '<div class="card p-3 mb-4 bg-light">'
    + '<div class="row align-items-center">'
    + '<div class="col-auto"><span style="font-size:2rem">🌸</span></div>'
    + '<div class="col">'
    + '<p class="fw-bold mb-0">' + escHtml(product.name) + '</p>'
    + '<p class="text-danger fw-bold mb-0">¥' + Number(product.priceJPY).toLocaleString() + '</p>'
    + '<p class="text-muted small mb-0">宛先: ' + escHtml(performer.displayName) + ' / ' + escHtml(ev.title) + '</p>'
    + '</div></div></div>'

    + (errorMsg ? '<div class="alert alert-danger">' + escHtml(errorMsg) + '</div>' : '')

    // フォーム
    + openPublicForm({ action: 'createOrder', eventId: eventId, performerId: performerId, productId: productId })
    + '<h5 class="fw-bold">贈り主情報</h5>'
    + '<div class="mb-3"><label class="form-label">お名前（公開名義）<span class="text-danger">※</span></label>'
    + '<input type="text" class="form-control" name="buyerName" placeholder="山田 花子" maxlength="50"></div>'
    + '<div class="mb-3"><label class="form-label">メールアドレス<span class="text-danger">※</span></label>'
    + '<input type="email" class="form-control" name="buyerEmail" placeholder="example@email.com" required></div>'
    + '<div class="mb-3"><label class="form-label">電話番号（任意）</label>'
    + '<input type="tel" class="form-control" name="buyerPhone" placeholder="090-xxxx-xxxx"></div>'

    + '<h5 class="fw-bold mt-4">メッセージ</h5>'
    + '<div class="mb-3"><label class="form-label">応援メッセージ（任意・' + escHtml(performer.displayName) + 'さんへ）</label>'
    + '<textarea class="form-control" name="messageToPerformer" rows="4" maxlength="400" placeholder="お疲れさまでした！いつも素敵な演奏をありがとうございます。"></textarea></div>'
    + '<div class="mb-3 form-check">'
    + '<input type="checkbox" class="form-check-input" name="isMessagePublic" id="chkPublic">'
    + '<label class="form-check-label" for="chkPublic">このメッセージをイベントページで公開する</label></div>'
    + '<div class="mb-4 form-check">'
    + '<input type="checkbox" class="form-check-input" name="isAnonymous" id="chkAnon">'
    + '<label class="form-check-label" for="chkAnon">匿名で差し入れる（名前を非表示）</label></div>'

    + '<div class="card p-3 mb-4 bg-light">'
    + '<p class="small text-muted mb-1">⚠️ ご注意</p>'
    + '<ul class="small text-muted mb-0">'
    + '<li>「支払いへ進む」をクリックするとGMO-PG決済画面へ移動します</li>'
    + '<li>決済完了後、確認メールをお送りします</li>'
    + '<li>差し入れは会場でまとめて出演者にお渡しします</li>'
    + '</ul></div>'

    + '<div class="d-grid"><button type="submit" class="gift-btn btn-lg py-3">💳 支払いへ進む</button></div>'
    + '</form></div>';

  return buildPublicPage('差し入れ情報入力', body);
}

// ===== P6: Thank You =====

function renderThankYou(params) {
  var gmoOrderId = params.gmoOrderId || '';
  var base       = ScriptApp.getService().getUrl();

  var body = '<div class="container py-5 text-center" style="max-width:600px;margin:auto">'
    + '<div style="font-size:5rem">🌸</div>'
    + '<h2 class="fw-bold mt-3">ありがとうございます！</h2>'
    + '<p class="lead text-muted">差し入れのご注文を受け付けました。</p>'

    + '<div class="card p-4 my-4 text-start">'
    + '<p class="mb-1"><strong>注文番号:</strong></p>'
    + '<p class="font-monospace text-muted mb-3">' + escHtml(gmoOrderId) + '</p>'
    + '<p class="small text-muted mb-0">📧 決済完了後、ご登録のメールアドレスへ確認メールをお送りします。<br>'
    + 'メールが届かない場合は、注文照会ページからご確認ください。</p>'
    + '</div>'

    + '<div class="d-flex gap-3 justify-content-center flex-wrap">'
    + '<a href="' + base + '?page=orderInquiry&gmoOrderId=' + escHtml(gmoOrderId) + '" class="btn btn-outline-secondary">注文状況を確認する</a>'
    + '<a href="' + base + '" class="gift-btn text-decoration-none px-4 py-2 rounded-pill">イベント一覧へ戻る</a>'
    + '</div></div>';

  return buildPublicPage('ご注文ありがとうございました', body);
}

// ===== P7: Order Inquiry =====

function renderOrderInquiry(params) {
  var base = ScriptApp.getService().getUrl();
  var resultHtml = '';

  if (params.email && params.gmoOrderId) {
    var order = findOrderByGmoOrderId(params.gmoOrderId);
    if (order && order.buyerEmail === params.email) {
      var product  = findProductById(order.productId);
      var ev       = findEventById(order.eventId);
      var performer = findPerformerById(order.performerId);
      resultHtml = '<div class="card p-4 mt-4">'
        + '<h5 class="fw-bold">注文情報</h5>'
        + '<table class="table table-sm"><tbody>'
        + '<tr><th class="text-muted" style="width:40%">注文番号</th><td class="font-monospace">' + escHtml(order.gmoOrderId) + '</td></tr>'
        + '<tr><th class="text-muted">決済状況</th><td><span class="status-badge badge-' + escHtml(order.paymentStatus) + '">' + escHtml(order.paymentStatus) + '</span></td></tr>'
        + '<tr><th class="text-muted">お届け状況</th><td>' + escHtml(order.fulfillmentStatus) + '</td></tr>'
        + '<tr><th class="text-muted">商品</th><td>' + escHtml(product ? product.name : order.productId) + '</td></tr>'
        + '<tr><th class="text-muted">金額</th><td>¥' + Number(order.totalJPY).toLocaleString() + '</td></tr>'
        + '<tr><th class="text-muted">イベント</th><td>' + escHtml(ev ? ev.title : order.eventId) + '</td></tr>'
        + '<tr><th class="text-muted">宛先</th><td>' + escHtml(performer ? performer.displayName : order.performerId) + '</td></tr>'
        + '</tbody></table></div>';
    } else {
      resultHtml = '<div class="alert alert-warning mt-4">注文が見つかりませんでした。メールアドレスと注文番号をご確認ください。</div>';
    }
  }

  var body = '<div class="container py-4" style="max-width:540px;margin:auto">'
    + '<h2 class="fw-bold">📦 注文照会</h2>'
    + '<p class="text-muted">注文時に入力したメールアドレスと注文番号を入力してください。</p>'
    + openPublicForm({ action: 'inquireOrder' })
    + '<div class="mb-3"><label class="form-label">メールアドレス</label>'
    + '<input type="email" class="form-control" name="email" value="' + escHtml(params.email || '') + '" required></div>'
    + '<div class="mb-3"><label class="form-label">注文番号</label>'
    + '<input type="text" class="form-control font-monospace" name="gmoOrderId" value="' + escHtml(params.gmoOrderId || '') + '" placeholder="ORD-..." required></div>'
    + '<button type="submit" class="gift-btn px-4 py-2">照会する</button>'
    + '</form>'
    + resultHtml
    + '</div>';

  return buildPublicPage('注文照会', body);
}
