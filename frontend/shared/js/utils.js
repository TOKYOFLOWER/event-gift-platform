/**
 * shared/js/utils.js
 * 共通ユーティリティ
 */

// ─────────────────────────────────────────────
// URL / パラメータ
// ─────────────────────────────────────────────

const qs = {
  get: (key) => new URLSearchParams(location.search).get(key),
  getAll: () => Object.fromEntries(new URLSearchParams(location.search)),
  build: (base, params = {}) => {
    const u = new URL(base, location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') u.searchParams.set(k, v);
    });
    return u.pathname + u.search;
  }
};

// ─────────────────────────────────────────────
// 日付フォーマット
// ─────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo'
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function isExpired(iso) {
  if (!iso) return false;
  return new Date(iso) <= new Date();
}

// ─────────────────────────────────────────────
// 金額フォーマット
// ─────────────────────────────────────────────

function fmtJPY(v) {
  return '¥' + Number(v || 0).toLocaleString('ja-JP');
}

// ─────────────────────────────────────────────
// HTML エスケープ
// ─────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────
// ステータスバッジ
// ─────────────────────────────────────────────

const STATUS_LABEL = {
  DRAFT:     '下書き',
  PUBLISHED: '公開中',
  CLOSED:    '終了',
  PENDING:   '保留中',
  PAID:      '確定',
  CANCELED:  'キャンセル',
  REFUNDED:  '返金済み',
  PENDING_DELIVERY: '未発送',
  DELIVERED:        '発送済み',
  COMPLETED:        '完了',
};

function statusBadge(status) {
  const label = STATUS_LABEL[status] || status;
  return `<span class="badge badge-${esc(status)}">${esc(label)}</span>`;
}

// ─────────────────────────────────────────────
// DOM ヘルパー
// ─────────────────────────────────────────────

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function setHtml(sel, html, ctx = document) {
  const el = $(sel, ctx);
  if (el) el.innerHTML = html;
}

function setText(sel, text, ctx = document) {
  const el = $(sel, ctx);
  if (el) el.textContent = text;
}

function show(sel, ctx = document) {
  const el = $(sel, ctx);
  if (el) el.classList.remove('d-none');
}

function hide(sel, ctx = document) {
  const el = $(sel, ctx);
  if (el) el.classList.add('d-none');
}

// ─────────────────────────────────────────────
// エラー表示
// ─────────────────────────────────────────────

function showError(sel, msg, ctx = document) {
  setHtml(sel, `<div class="error-banner">${esc(msg)}</div>`, ctx);
  show(sel, ctx);
}

function showLoading(sel, ctx = document) {
  setHtml(sel, `<div class="loading-spinner"><span class="spinner-border spinner-border-sm me-2"></span>読み込み中...</div>`, ctx);
}

// ─────────────────────────────────────────────
// フォームデータ → Object
// ─────────────────────────────────────────────

function formToObj(form) {
  const data = {};
  const fd = new FormData(form);
  for (const [k, v] of fd.entries()) {
    // チェックボックスは複数ある可能性
    if (k in data) {
      data[k] = [].concat(data[k], v);
    } else {
      data[k] = v;
    }
  }
  // チェックボックス: checked な名前だけ残るので true に変換
  $$('input[type=checkbox]', form).forEach(el => {
    if (!(el.name in data)) data[el.name] = false;
    else data[el.name] = true;
  });
  return data;
}

// ─────────────────────────────────────────────
// テーブルレンダラー
// ─────────────────────────────────────────────

/**
 * テーブルを生成する
 * @param {{ cols: {key: string, label: string, render?: fn}[], rows: any[], emptyMsg?: string }} opts
 */
function renderTable({ cols, rows, emptyMsg = 'データがありません' }) {
  const ths = cols.map(c => `<th>${esc(c.label)}</th>`).join('');
  if (!rows.length) {
    return `
      <div class="data-table">
        <table class="table mb-0"><thead><tr>${ths}</tr></thead>
        <tbody><tr><td colspan="${cols.length}" class="text-center text-muted py-4">${esc(emptyMsg)}</td></tr></tbody>
        </table></div>`;
  }
  const trs = rows.map(row => {
    const tds = cols.map(c => {
      const val = c.render ? c.render(row) : esc(row[c.key] ?? '—');
      return `<td>${val}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `
    <div class="data-table">
      <table class="table mb-0">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table></div>`;
}

// ─────────────────────────────────────────────
// モーダル (Bootstrap 5)
// ─────────────────────────────────────────────

function confirm(msg) {
  return window.confirm(msg);
}

/**
 * シンプルなアラートトースト
 */
function toast(msg, type = 'success') {
  const id = 'toast-' + Date.now();
  const colors = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning', info: 'bg-info' };
  const color  = colors[type] || 'bg-secondary';
  const el = document.createElement('div');
  el.innerHTML = `
    <div id="${id}" class="toast align-items-center text-white ${color} border-0 mb-2" role="alert" aria-live="assertive" style="min-width:260px">
      <div class="d-flex">
        <div class="toast-body">${esc(msg)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999';
    document.body.appendChild(container);
  }
  container.appendChild(el.firstElementChild);
  const t = new bootstrap.Toast(document.getElementById(id), { delay: 3500 });
  t.show();
}

// ─────────────────────────────────────────────
// セッションストレージ簡易ラッパー
// ─────────────────────────────────────────────

const store = {
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  get(k, def = null) {
    try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (_) { return def; }
  },
  del(k) { try { sessionStorage.removeItem(k); } catch (_) {} }
};

// ─────────────────────────────────────────────
// config ヘルパー
// ─────────────────────────────────────────────

function getConfig() {
  if (!window.GAS_CONFIG) {
    throw new Error('config.js が読み込まれていません。config.example.js を参考に config.js を作成してください。');
  }
  const cfg = window.GAS_CONFIG;
  // apiUrl を publicUrl / adminUrl のフォールバックとして使用
  if (cfg.apiUrl && !cfg.publicUrl) cfg.publicUrl = cfg.apiUrl;
  if (cfg.apiUrl && !cfg.adminUrl)  cfg.adminUrl  = cfg.apiUrl;
  return cfg;
}
