// Admin analytics dashboard — secure, data-dense, editorial.
import { $, $$, safe, toast } from './dom.js';
import { formatMoney } from './store.js';
import { authState, getAccessToken, signOut } from './auth/auth-store.js';
import { go, route } from './router.js';
import { trackEvent } from './analytics.js';

const RANGES = [7, 30, 90, 365];
let state = null;
let loading = false;

function adminGate() {
  return `<div class="route-enter admin-gate">
    <div class="wrap page-head admin-head">
      <div class="mono muted">ADMIN ACCESS</div>
      <h1 class="page-title">Restricted.</h1>
      <p class="page-intro">This area is available to Playrooom administrators only.</p>
    </div>
    <section class="section wrap"><div class="admin-gate-card"><p>Sign in with an administrator account to view analytics.</p><a class="btn" href="#/account/login?admin=1">Admin sign in <span class="arrow" aria-hidden="true">↗</span></a></div></section>
  </div>`;
}

const money = (n) => formatMoney(Number(n || 0));
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

function lineChart(series, color = '#e59aa2') {
  const points = (series || []).map((d) => Number(d.value || 0));
  if (!points.length) return '<div class="admin-empty">No data in this range.</div>';
  const max = Math.max(...points, 1);
  const w = 620;
  const h = 180;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 22)).toFixed(1)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  const first = series[0]?.day || '';
  const last = series[series.length - 1]?.day || '';
  return `<div class="admin-chart">
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Daily trend">
      <defs><linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#adminFill)"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="admin-chart-axis"><span>${safe(first)}</span><span>${safe(last)}</span></div>
  </div>`;
}

function barList(rows, valueKey = 'count', formatter = num) {
  if (!rows?.length) return '<div class="admin-empty">No data.</div>';
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 1);
  return `<div class="admin-bars">${rows.slice(0, 8).map((r) => `
    <div class="admin-bar-row"><span>${safe(r.name)}</span><i><b style="width:${Math.max(3, (Number(r[valueKey] || 0) / max) * 100)}%"></b></i><strong>${formatter(r[valueKey])}</strong></div>`).join('')}</div>`;
}

function kpiCard(label, value, note = '') {
  return `<article class="admin-kpi"><span>${safe(label)}</span><strong>${safe(value)}</strong>${note ? `<small>${safe(note)}</small>` : ''}</article>`;
}

function renderSkeleton() {
  return `<div class="admin-loading"><span class="admin-spinner" aria-hidden="true"></span> Loading analytics…</div>`;
}

export function renderAdminDashboard(r) {
  if (!authState.session || !authState.user || authState.role !== 'admin') return adminGate();

  const days = RANGES.includes(Number(r?.params?.get('days'))) ? Number(r.params.get('days')) : 30;
  return `<div class="route-enter admin-page">
    <div class="wrap page-head admin-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Admin analytics</span></div>
      <div class="mono muted">PLAYROOOM CONTROL ROOM</div>
      <h1 class="page-title">The whole <em>playrooom.</em></h1>
      <p class="page-intro">Order-level, customer-level and event-level analytics — drawn from the live storefront.</p>
    </div>
    <section class="section wrap admin-section">
      <div class="admin-toolbar">
        <div class="admin-ranges" role="group" aria-label="Date range">
          ${RANGES.map((d) => `<button type="button" data-admin-range="${d}" class="${d === days ? 'active' : ''}">${d === 365 ? '1 year' : `${d}d`}</button>`).join('')}
        </div>
        <div class="admin-toolbar-actions">
          <button type="button" data-admin-refresh>Refresh</button>
          <button type="button" data-admin-export="events">Export events</button>
          <button type="button" data-admin-export="orders">Export orders</button>
          <button type="button" data-admin-logout>Sign out</button>
        </div>
      </div>
      <div id="adminData">${renderSkeleton()}</div>
    </section>
  </div>`;
}

function paint(data) {
  const host = $('#adminData');
  if (!host) return;
  state = data;

  const k = data.kpis || {};
  const b = data.breakdowns || {};
  host.innerHTML = `
    <div class="admin-kpis">
      ${kpiCard('Revenue', money(k.revenue), `${data.rangeDays} day range`)}
      ${kpiCard('Orders', num(k.orders), `AOV ${money(k.avgOrderValue)}`)}
      ${kpiCard('Customers', num(k.customers), `${num(k.newCustomers)} new · ${num(k.repeatCustomers)} repeat`)}
      ${kpiCard('Conversion', pct(k.conversionRate), 'checkout → order')}
      ${kpiCard('Circle members', num(k.circleMembers), `${money(k.circleMrr)} MRR`)}
      ${kpiCard('Revenue events', num(k.productViews), `${num(k.addToCarts)} add to bag`)}
    </div>

    <div class="admin-grid admin-grid--charts">
      <article class="admin-panel"><header><span class="mono">REVENUE BY DAY</span><h2>${money(k.revenue)}</h2></header>${lineChart(data.series?.revenue)}</article>
      <article class="admin-panel"><header><span class="mono">ORDERS BY DAY</span><h2>${num(k.orders)}</h2></header>${lineChart(data.series?.orders, '#3d6482')}</article>
      <article class="admin-panel"><header><span class="mono">EVENT VOLUME</span><h2>${num((b.eventTypes || []).reduce((a, x) => a + x.count, 0))}</h2></header>${lineChart(data.series?.events, '#73a0ca')}</article>
      <article class="admin-panel"><header><span class="mono">CIRCLE REVENUE</span><h2>${money(k.circleRevenue)}</h2></header>${lineChart(data.series?.circle, '#e59aa2')}</article>
    </div>

    <div class="admin-grid admin-grid--three">
      <article class="admin-panel"><header><span class="mono">CHECKOUT FUNNEL</span><h2>Where they drop</h2></header><div class="admin-funnel">${(data.funnel || []).map((f, i) => `<div><span>${safe(f.name.replaceAll('_', ' '))}</span><b>${num(f.count)}</b><i style="width:${Math.max(8, (f.count / Math.max(1, data.funnel[0].count)) * 100)}%"></i></div>`).join('')}</div></article>
      <article class="admin-panel"><header><span class="mono">PAYMENT METHODS</span><h2>How they pay</h2></header>${barList(b.paymentMethods)}</article>
      <article class="admin-panel"><header><span class="mono">PAYMENT STATUS</span><h2>Real state</h2></header>${barList(b.paymentStatuses)}</article>
      <article class="admin-panel"><header><span class="mono">TOP PAGES</span><h2>Where they go</h2></header>${barList(b.topPages)}</article>
      <article class="admin-panel"><header><span class="mono">EVENT TYPES</span><h2>What they do</h2></header>${barList(b.eventTypes)}</article>
      <article class="admin-panel"><header><span class="mono">DEVICES</span><h2>How they browse</h2></header>${barList(b.devices)}</article>
      <article class="admin-panel"><header><span class="mono">CITIES</span><h2>Where orders land</h2></header>${barList(b.cities)}</article>
      <article class="admin-panel"><header><span class="mono">CATEGORY REVENUE</span><h2>What sells</h2></header>${barList(b.categories, 'value', money)}</article>
      <article class="admin-panel"><header><span class="mono">EMAIL DELIVERY</span><h2>Outbox health</h2></header>${barList(data.emailStatus)}</article>
    </div>

    <div class="admin-grid admin-grid--tables">
      <article class="admin-panel"><header><span class="mono">TOP PRODUCTS</span><h2>Best performers</h2></header><div class="admin-table-wrap"><table><thead><tr><th>Product</th><th>Units</th><th>Views</th><th>Revenue</th></tr></thead><tbody>${(data.topProducts || []).map((p) => `<tr><td>${safe(p.name)}</td><td>${num(p.units)}</td><td>${num(p.views || 0)}</td><td>${money(p.revenue)}</td></tr>`).join('') || '<tr><td colspan="4">No product data yet.</td></tr>'}</tbody></table></div></article>
      <article class="admin-panel"><header><span class="mono">TOP CUSTOMERS</span><h2>Highest value</h2></header><div class="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>${(data.topCustomers || []).map((c) => `<tr><td>${safe(c.id.slice(0, 12))}</td><td>${num(c.orders)}</td><td>${money(c.revenue)}</td></tr>`).join('') || '<tr><td colspan="3">No customer data yet.</td></tr>'}</tbody></table></div></article>
    </div>

    <article class="admin-panel admin-ledger"><header><span class="mono">EVENT LEDGER</span><h2>Low-level activity</h2></header><div class="admin-table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Page</th><th>Product</th><th>Value</th><th>Device</th><th>Visitor</th></tr></thead><tbody>${(data.recentEvents || []).map((e) => `<tr><td>${safe(new Date(e.createdAt).toLocaleString('en-IN'))}</td><td>${safe(e.name)}</td><td>${safe(e.path || '—')}</td><td>${safe(e.productId || '—')}</td><td>${e.value ? money(e.value) : '—'}</td><td>${safe(e.device || '—')}</td><td>${safe(e.user)}</td></tr>`).join('') || '<tr><td colspan="7">No events recorded yet.</td></tr>'}</tbody></table></div></article>

    <article class="admin-panel"><header><span class="mono">RECENT ORDERS</span><h2>Latest activity</h2></header><div class="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>${(data.orders || []).map((o) => `<tr><td>${safe(o.id)}</td><td>${safe(o.user)}</td><td>${safe(o.method || '—')}</td><td>${safe(o.status)}</td><td>${money(o.total)}</td><td>${safe(new Date(o.createdAt).toLocaleString('en-IN'))}</td></tr>`).join('') || '<tr><td colspan="6">No orders in this range.</td></tr>'}</tbody></table></div></article>

    <p class="admin-note">Generated ${safe(new Date(data.generatedAt).toLocaleString('en-IN'))}. All figures are live Supabase data. Analytics events omit payment and contact details.</p>`;
}

async function load(days = route().params.get('days') || 30) {
  if (loading) return;
  loading = true;
  const button = $('[data-admin-refresh]');
  if (button) button.textContent = 'Loading…';
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Please sign in again.');
    const response = await fetch(`/api/admin/analytics?days=${encodeURIComponent(days)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load analytics.');
    paint(data);
  } catch (error) {
    const host = $('#adminData');
    if (host) host.innerHTML = `<div class="admin-error">${safe(String(error?.message || error))}</div>`;
  } finally {
    loading = false;
    if (button) button.textContent = 'Refresh';
  }
}

async function download(type) {
  try {
    const token = await getAccessToken();
    const days = route().params.get('days') || 30;
    const response = await fetch(`/api/admin/export?type=${type}&days=${encodeURIComponent(days)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Could not export data.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playrooom-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent('admin_export', { type });
    toast('Export ready.', 'CSV downloaded.');
  } catch (error) {
    toast('Export failed.', String(error?.message || error));
  }
}

export function wireAdminPage() {
  if (!route().path.startsWith('/admin')) return;
  if (!authState.session || authState.user?.role !== 'admin' && authState.role !== 'admin') return;

  $$('[data-admin-range]').forEach((button) => {
    button.addEventListener('click', () => go(`/admin?days=${button.dataset.adminRange}`));
  });
  $('[data-admin-refresh]')?.addEventListener('click', () => {
    trackEvent('admin_refresh');
    load(route().params.get('days') || 30);
  });
  $$('[data-admin-export]').forEach((button) => {
    button.addEventListener('click', () => download(button.dataset.adminExport));
  });
  $('[data-admin-logout]')?.addEventListener('click', async () => {
    await signOut();
    trackEvent('logout', { admin: true });
    go('/account/login?admin=1');
  });

  load(route().params.get('days') || 30);
}
