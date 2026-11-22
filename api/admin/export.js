// Admin-only CSV export for low-level analytics rows.
import {
  authenticate, cleanText, getAdmin, isAdmin, json,
} from '../_lib/server.js';

const DAY = 86400000;

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const user = await authenticate(req);
    if (!user) return json(res, 401, { error: 'Please sign in.' });
    const admin = getAdmin();
    if (!(await isAdmin(admin, user.id))) return json(res, 403, { error: 'Admin access required.' });

    const type = cleanText(req.query?.type, 20) === 'orders' ? 'orders' : 'events';
    const days = Number(req.query?.days || 30);
    const rangeDays = [7, 30, 90, 365].includes(days) ? days : 30;
    const since = new Date(Date.now() - rangeDays * DAY).toISOString();
    const event = cleanText(req.query?.event, 60);

    let rows = [];
    if (type === 'events') {
      let query = admin
        .from('analytics_events')
        .select('id,event_name,page_path,product_id,order_id,value,device_type,browser,user_id,anon_id,properties,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000);
      if (event) query = query.eq('event_name', event);
      const result = await query;
      if (result.error) throw result.error;
      rows = result.data || [];

      const header = ['id', 'event_name', 'page_path', 'product_id', 'order_id', 'value', 'device_type', 'browser', 'user_id', 'anon_id', 'properties', 'created_at'];
      const csv = [header.join(','), ...rows.map((r) => header.map((key) => csvCell(key === 'properties' ? JSON.stringify(r[key]) : r[key])).join(','))].join('\n');
      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="playrooom-events-${rangeDays}d.csv"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(csv);
    }

    const result = await admin
      .from('orders')
      .select('order_id,user_id,total,status,payment_status,tracking_number,created_at,data')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    rows = result.data || [];
    const header = ['order_id', 'user_id', 'total', 'status', 'payment_status', 'tracking_number', 'payment_method', 'city', 'items', 'created_at'];
    const csv = [header.join(','), ...rows.map((r) => {
      const data = r.data || {};
      const values = [
        r.order_id, r.user_id, r.total, r.status, r.payment_status, r.tracking_number,
        data.paymentMethod, data.customer?.city,
        (data.items || []).map((item) => `${item.name} x${item.qty}`).join(' | '), r.created_at,
      ];
      return values.map(csvCell).join(',');
    })].join('\n');
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="playrooom-orders-${rangeDays}d.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(csv);
  } catch (error) {
    console.error('[admin export]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}
