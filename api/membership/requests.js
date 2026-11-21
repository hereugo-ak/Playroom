// Vercel serverless function: member-only Build with us, repair and priority
// support requests. Every request is attached to an active Circle membership.
import { bearer, getAdmin, json, readJson } from '../_lib/server.js';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

const LABELS = {
  build: 'Build with us',
  repair: 'Lifetime repair desk',
  support: 'Priority care desk',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const token = bearer(req);
    if (!token) return json(res, 401, { error: 'Please sign in to use Circle benefits.' });

    const admin = getAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user) return json(res, 401, { error: 'Your session has expired. Please sign in again.' });

    const now = new Date().toISOString();
    const { data: active, error: activeError } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .gt('current_period_end', now)
      .limit(1);
    if (activeError) throw activeError;
    if (!active?.length) return json(res, 403, { error: 'An active Circle membership is required.' });

    const body = await readJson(req);
    const kind = clean(body.kind, 20);
    if (!LABELS[kind]) return json(res, 400, { error: 'Choose a valid Circle service.' });

    const title = clean(body.title, 120) || LABELS[kind];
    const details = clean(body.details, 2000);
    if (details.length < 10) return json(res, 400, { error: 'Add a little more detail so we can help.' });

    const orderId = clean(body.orderId, 40) || null;
    if (orderId) {
      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('order_id', orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json(res, 400, { error: 'That order is not linked to your account.' });
    }

    const { data, error } = await admin
      .from('member_requests')
      .insert({
        user_id: auth.user.id,
        kind,
        title,
        details,
        order_id: orderId,
        priority: true,
        status: 'received',
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;

    return json(res, 200, { request: data });
  } catch (error) {
    console.error('[membership requests API]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}
