/**
 * shared/js/admin-layout.js
 * Admin 共通レイアウト（サイドバー・トップバー）の注入
 *
 * 使い方:
 *   initAdminLayout({ pageTitle: 'ダッシュボード', activeNav: 'dashboard' });
 */

const NAV_ITEMS = [
  { section: 'メイン' },
  { id: 'dashboard',  href: 'dashboard.html',  icon: '📊', label: 'ダッシュボード' },
  { section: 'イベント管理' },
  { id: 'events',     href: 'events.html',     icon: '🎪', label: 'イベント' },
  { id: 'performers', href: 'performers.html', icon: '🎤', label: '出演者' },
  { id: 'products',   href: 'products.html',   icon: '🌸', label: '商品' },
  { section: '注文・ユーザー' },
  { id: 'orders',     href: 'orders.html',     icon: '📦', label: '注文管理' },
  { id: 'users',      href: 'users.html',      icon: '👥', label: 'ユーザー管理' },
  { id: 'audit-log',  href: 'audit-log.html',  icon: '📋', label: '監査ログ' },
];

function buildSidebar(activeId) {
  const items = NAV_ITEMS.map(item => {
    if (item.section) {
      return `<div class="nav-section">${esc(item.section)}</div>`;
    }
    const active = item.id === activeId ? ' active' : '';
    return `<div class="nav-item"><a href="${esc(item.href)}" class="${active}">${item.icon} ${esc(item.label)}</a></div>`;
  }).join('');

  return `
    <aside class="admin-sidebar" id="sidebar">
      <a class="sidebar-brand" href="dashboard.html">🌸 はなたば Admin</a>
      ${items}
    </aside>`;
}

function buildTopbar(pageTitle) {
  return `
    <div class="admin-topbar">
      <div class="d-flex align-items-center gap-3">
        <button class="btn btn-sm btn-outline-secondary d-md-none" onclick="toggleSidebar()">☰</button>
        <h1 class="page-title">${esc(pageTitle)}</h1>
      </div>
      <div class="d-flex align-items-center gap-3">
        <span class="small text-muted" id="topbarUser"></span>
        <button class="btn btn-sm btn-outline-danger" onclick="adminLogout()">ログアウト</button>
      </div>
    </div>`;
}

/**
 * Admin レイアウトを初期化する
 * @param {{ pageTitle: string, activeNav: string }} opts
 */
function initAdminLayout(opts = {}) {
  const { pageTitle = 'Admin', activeNav = '' } = opts;

  // body に admin-layout 構造を注入
  const originalContent = document.getElementById('pageContent');
  const html = originalContent ? originalContent.outerHTML : '<div id="pageContent"></div>';

  document.body.innerHTML = `
    <div class="admin-layout">
      ${buildSidebar(activeNav)}
      <div class="admin-main">
        ${buildTopbar(pageTitle)}
        <div class="admin-content">
          ${html}
        </div>
      </div>
    </div>`;

  // サイドバーモバイル対応
  window.toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  };
}

/**
 * Auth 認証後にユーザー情報をトップバーに表示する
 * @param {Object} userInfo - Google userinfo
 */
function setTopbarUser(userInfo) {
  const el = document.getElementById('topbarUser');
  if (el && userInfo) {
    el.textContent = userInfo.name || userInfo.email || '';
  }
}

/**
 * ログアウト処理
 */
function adminLogout() {
  Auth.logout(() => { location.href = 'index.html'; });
}
