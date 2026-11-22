// Admin-only analytics API. Every figure is derived from Supabase data.
import { byId } from '../../js/data.js';
import {
  authenticate, cleanText, getAdmin, isAdmin, json,
} from '../_lib/server.js';

const DAY = 86400000;

function safeQuery(promise, fallback) {
  return promise.then((result) => {
    if (result.error) throw result.error;
    return result.data ?? fallback;
  }).catch((error) => {
    console.warn('[admin analytics] query failed', error?.message || error);
    return fallback;
  });
}

const sum = (values) => values.reduce((a, b) => a + Number(b || 0), 0);
const round = (value, places = 2) => Number(Number(value || 0).toFixed(places));
const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

function countBy(rows, keyFn) {
  const out = {};
  rows.forEach((row) => {
    const key = keyFn(row) || 'Unknown';
    out[key] = (out[key] || 0) + 1;
  });
  return Object.entries(out)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function seriesByDay(rows, dateFn, valueFn) {
  const out = {};
  rows.forEach((row) => {
    const key = dayKey(dateFn(row));
    if (!out[key]) out[key] = { day: key, value: 0, count: 0 };
    out[key].value += Number(valueFn(row) || 0);
    out[key].count += 1;
  });
  return Object.values(out).sort((a, b) => a.day.localeCompare(b.day));
}

function orderData(row) {
  return row?.data && typeof row.data === 'object' ? row.data : {};
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const user = await authenticate(req);
    if (!user) return json(res, 401, { error: 'Please sign in.' });

    const admin = getAdmin();
    if (!(await isAdmin(admin, user.id))) return json(res, 403, { error: 'Admin access required.' });

    const days = Number(req.query?.days || 30);
    const rangeDays = [7, 30, 90, 365].includes(days) ? days : 30;
    const rangeStart = new Date(Date.now() - rangeDays * DAY).toISOString();
    const eventFilter = cleanText(req.query?.event, 60) || '';

    // Audit the dashboard view itself as a low-level event.
    await admin.from('analytics_events').insert({
      user_id: user.id,
      event_name: 'admin_view',
      page_path: '/admin',
      properties: { days: rangeDays, event_filter: eventFilter },
      device_type: 'desktop',
      browser: 'Playrooom Admin',
    });

    const [
      orders,
      profiles,
      events,
      subscriptions,
      subscriptionPayments,
      outbox,
      memberRequests,
      returns,
      wishlistCount,
      addressCount,
    ] = await Promise.all([
      safeQuery(admin.from('orders').select('order_id,user_id,data,total,status,payment_status,tracking_number,created_at').gte('created_at', rangeStart).order('created_at', { ascending: true }), []),
      safeQuery(admin.from('profiles').select('id,created_at').order('created_at', { ascending: true }), []),
      safeQuery(admin.from('analytics_events').select('id,session_id,user_id,anon_id,event_name,page_path,product_id,order_id,plan_code,value,properties,device_type,browser,viewport,created_at').gte('created_at', rangeStart).order('created_at', { ascending: false }).limit(5000), []),
      safeQuery(admin.from('subscriptions').select('*').order('created_at', { ascending: false }), []),
      safeQuery(admin.from('subscription_payments').select('*').order('created_at', { ascending: false }), []),
      safeQuery(admin.from('email_outbox').select('id,order_id,email_type,status,recipient,attempt_count,provider_message_id,last_error,created_at,sent_at').gte('created_at', rangeStart).order('created_at', { ascending: false }), []),
      safeQuery(admin.from('member_requests').select('id,kind,title,status,priority,created_at').order('created_at', { ascending: false }), []),
      safeQuery(admin.from('returns').select('id,order_id,data,created_at').order('created_at', { ascending: false }), []),
      safeQuery(admin.from('wishlist').select('id', { count: 'exact', head: true }), 0),
      safeQuery(admin.from('addresses').select('id', { count: 'exact', head: true }), 0),
    ]);

    const revenue = sum(orders.map((o) => o.total));
    const orderCount = orders.length;
    const avgOrderValue = orderCount ? revenue / orderCount : 0;
    const orderUsers = new Set(orders.map((o) => o.user_id).filter(Boolean));
    const newCustomers = profiles.filter((p) => new Date(p.created_at).getTime() >= new Date(rangeStart).getTime()).length;
    const customerRows = new Map();
    orders.forEach((o) => {
      if (!o.user_id) return;
      const current = customerRows.get(o.user_id) || { orders: 0, revenue: 0, first: o.created_at };
      current.orders += 1;
      current.revenue += Number(o.total || 0);
      if (new Date(o.created_at) < new Date(current.first)) current.first = o.created_at;
      customerRows.set(o.user_id, current);
    });
    const repeatCustomers = [...customerRows.values()].filter((c) => c.orders > 1).length;
    const topCustomers = [...customerRows.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const eventCounts = {};
    events.forEach((e) => { eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1; });
    const checkoutStarts = eventCounts.checkout_start || 0;
    const orderCompletions = eventCounts.order_completed || orderCount;
    const conversionRate = checkoutStarts ? (orderCompletions / checkoutStarts) * 100 : 0;
    const productViews = eventCounts.product_view || 0;
    const addToCarts = eventCounts.add_to_cart || 0;
    const cartToCheckout = addToCarts ? (checkoutStarts / addToCarts) * 100 : 0;

    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active' && new Date(s.current_period_end) > new Date());
    const circleRevenue = sum(subscriptionPayments.map((p) => p.amount));
    const monthlyEquivalent = sum(activeSubscriptions.map((s) => (
      s.plan_code === 'circle_yearly' ? Number(s.price || 4499) / 12 : Number(s.price || 499)
    )));

    const productStats = new Map();
    orders.forEach((o) => {
      const items = orderData(o).items || [];
      items.forEach((item) => {
        if (!item?.name) return;
        const current = productStats.get(item.name) || { name: item.name, productId: item.productId, units: 0, revenue: 0 };
        current.units += Number(item.qty || 0);
        current.revenue += Number(item.lineTotal || 0);
        productStats.set(item.name, current);
      });
    });
    events.filter((e) => e.event_name === 'product_view').forEach((e) => {
      const product = e.product_id ? byId(e.product_id) : null;
      if (!product) return;
      const current = productStats.get(product.name) || { name: product.name, productId: product.id, units: 0, revenue: 0 };
      current.views = (current.views || 0) + 1;
      productStats.set(product.name, current);
    });
    const topProducts = [...productStats.values()]
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .slice(0, 12);

    const categoryRevenue = {};
    orders.forEach((o) => {
      const items = orderData(o).items || [];
      items.forEach((item) => {
        const product = item.productId ? byId(item.productId) : null;
        const category = product?.category || 'Other';
        categoryRevenue[category] = (categoryRevenue[category] || 0) + Number(item.lineTotal || 0);
      });
    });

    const funnel = ['product_view', 'add_to_cart', 'checkout_start', 'order_completed'].map((name) => ({
      name,
      count: name === 'order_completed' ? orderCompletions : (eventCounts[name] || 0),
    }));

    const filteredEvents = eventFilter
      ? events.filter((e) => e.event_name === eventFilter)
      : events;
    const recentEvents = filteredEvents.slice(0, 120).map((e) => ({
      id: e.id,
      name: e.event_name,
      path: e.page_path,
      productId: e.product_id,
      orderId: e.order_id,
      value: e.value,
      user: e.user_id ? `${String(e.user_id).slice(0, 8)}…` : (e.anon_id || 'Guest'),
      device: e.device_type,
      browser: e.browser,
      createdAt: e.created_at,
      properties: e.properties,
    }));

    const payload = {
      generatedAt: new Date().toISOString(),
      rangeDays,
      kpis: {
        revenue: round(revenue),
        orders: orderCount,
        avgOrderValue: round(avgOrderValue),
        customers: orderUsers.size,
        newCustomers,
        repeatCustomers,
        conversionRate: round(conversionRate, 1),
        addToCarts,
        productViews,
        cartToCheckout: round(cartToCheckout, 1),
        circleMembers: activeSubscriptions.length,
        circleRevenue: round(circleRevenue),
        circleMrr: round(monthlyEquivalent),
        emailsSent: outbox.filter((e) => e.status === 'sent').length,
        emailsFailed: outbox.filter((e) => e.status === 'failed').length,
        supportRequests: memberRequests.length,
        returns: returns.length,
        wishlistItems: Number(wishlistCount || 0),
        addresses: Number(addressCount || 0),
      },
      series: {
        revenue: seriesByDay(orders, (o) => o.created_at, (o) => o.total),
        orders: seriesByDay(orders, (o) => o.created_at, () => 1),
        events: seriesByDay(events, (e) => e.created_at, () => 1),
        circle: seriesByDay(subscriptionPayments, (p) => p.created_at, (p) => p.amount),
      },
      breakdowns: {
        eventTypes: countbyEvents(eventCounts),
        paymentMethods: countBy(orders, (o) => orderData(o).paymentMethod || 'Unknown'),
        paymentStatuses: countBy(orders, (o) => o.payment_status || 'unknown'),
        orderStatuses: countBy(orders, (o) => o.status || 'unknown'),
        delivery: countBy(orders, (o) => orderData(o).delivery?.label || 'Standard'),
        cities: countBy(orders, (o) => orderData(o).customer?.city || 'Unknown'),
        devices: countBy(events, (e) => e.device_type || 'Unknown'),
        browsers: countBy(events, (e) => e.browser || 'Unknown'),
        topPages: countBy(events.filter((e) => e.event_name === 'page_view'), (e) => e.page_path || '/'),
        categories: Object.entries(categoryRevenue)
          .map(([name, value]) => ({ name, value: round(value) }))
          .sort((a, b) => b.value - a.value),
        circlePlans: countBy(activeSubscriptions, (s) => s.plan_code || 'unknown'),
      },
      funnel,
      topProducts,
      topCustomers,
      recentEvents,
      orders: orders.slice(-60).reverse().map((o) => ({
        id: o.order_id,
        user: o.user_id ? `${String(o.user_id).slice(0, 8)}…` : 'Guest',
        total: o.total,
        status: o.payment_status,
        method: orderData(o).paymentMethod,
        createdAt: o.created_at,
      })),
      emailStatus: countBy(outbox, (e) => e.status),
      requestStatus: countBy(memberRequests, (r) => `${r.kind}:${r.status}`),
    };

    return json(res, 200, payload);
  } catch (error) {
    console.error('[admin analytics]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}

function countbyEvents(counts) {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
