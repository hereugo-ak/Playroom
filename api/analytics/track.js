// Low-level analytics event collector. No personal data or payment data.
import {
  authenticate, cleanText, getAdmin, json, readJson,
} from '../_lib/server.js';

const EVENTS = new Set([
  'page_view',
  'product_view',
  'search',
  'category_click',
  'filter_change',
  'sort_change',
  'add_to_cart',
  'remove_from_cart',
  'qty_change',
  'wishlist_add',
  'wishlist_remove',
  'quick_view',
  'compare_add',
  'checkout_start',
  'order_completed',
  'signup_start',
  'signup_complete',
  'login_start',
  'login_success',
  'login_failed',
  'logout',
  'otp_verify',
  'password_reset_request',
  'membership_view',
  'membership_activate',
  'guide_download',
  'support_request',
  'chat_open',
  'audio_call_open',
  'admin_view',
  'admin_export',
  'admin_refresh',
]);

const BLOCKED_KEYS = /pass|token|secret|card|cvc|email|phone|address|otp/i;

function safeProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    if (BLOCKED_KEYS.test(key)) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key.slice(0, 40)] = value;
    }
  });
  return out;
}

function deviceFrom(agent) {
  const ua = String(agent || '').toLowerCase();
  if (/ipad|tablet|android.*tablet/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function browserFrom(agent) {
  const ua = String(agent || '').toLowerCase();
  if (/edg\//.test(ua)) return 'Edge';
  if (/chrome\//.test(ua)) return 'Chrome';
  if (/safari\//.test(ua)) return 'Safari';
  if (/firefox\//.test(ua)) return 'Firefox';
  return 'Other';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const body = await readJson(req, 32 * 1024);
    const eventName = cleanText(body.eventName, 60);
    if (!EVENTS.has(eventName)) return json(res, 200, { ok: false, reason: 'unknown_event' });

    const user = await authenticate(req);
    const agent = req.headers['user-agent'];
    const admin = getAdmin();

    const payload = {
      event_id: cleanText(body.eventId, 100) || null,
      session_id: cleanText(body.sessionId, 100) || null,
      user_id: user?.id || null,
      anon_id: user ? null : (cleanText(body.anonId, 100) || null),
      event_name: eventName,
      page_path: cleanText(body.pagePath, 200) || null,
      referrer: cleanText(body.referrer, 200) || null,
      product_id: cleanText(body.productId, 40) || null,
      order_id: cleanText(body.orderId, 40) || null,
      plan_code: cleanText(body.planCode, 40) || null,
      value: Number.isFinite(Number(body.value)) ? Number(body.value) : null,
      currency: cleanText(body.currency, 8) || 'INR',
      properties: safeProperties(body.properties),
      device_type: deviceFrom(agent),
      browser: browserFrom(agent),
      viewport: cleanText(body.viewport, 40) || null,
      country: cleanText(body.country, 40) || 'India',
    };

    const { error } = await admin
      .from('analytics_events')
      .upsert(payload, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) throw error;

    return json(res, 200, { ok: true });
  } catch (error) {
    console.warn('[analytics track]', error?.message || error);
    return json(res, 200, { ok: false });
  }
}
