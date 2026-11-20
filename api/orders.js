// Vercel serverless function: trusted order creation + confirmation email.
// The browser supplies product ids and quantities only; prices, names and
// images come from the repository catalogue on the server. Email is sent only
// after the Supabase order has been committed.
import { byId } from '../js/data.js';
import { renderOrderConfirmation } from '../emails/order-confirmation.js';
import { bearer, getAdmin, getTransport, json, readJson, requireEnv } from './_lib/server.js';

const FREE_DELIVERY_THRESHOLD = 1499;
const DELIVERY_FEE = 99;
const EXPRESS_FEE = 149;
const PICKDAY_FEE = 99;
const GIFT_WRAP_PRICE = 149;
const PERSONALISE_FEE = 249;
const PROMO_PLAY10 = 0.10;

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

function siteUrl() {
  return (process.env.SITE_URL || 'https://playrooom.vercel.app/').replace(/\/+$/, '') + '/';
}

function absoluteImage(path, site) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).toString();
    return new URL(raw.replace(/^\/+/, ''), site).toString();
  } catch {
    return '';
  }
}

function deliveryFor(id, subtotal) {
  if (id === 'express') return { id, label: 'Express', fee: EXPRESS_FEE, dateLabel: 'Next business day (demo)' };
  if (id === 'pickday') return { id, label: 'Pick a day', fee: PICKDAY_FEE, dateLabel: 'Chosen weekday (demo)' };
  const fee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  return { id: 'standard', label: 'Standard', fee, dateLabel: '2–4 business days (demo)' };
}

function buildOrder(body, user) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || rawItems.length > 30) throw new Error('Your bag needs between 1 and 30 items.');

  const lines = [];
  for (const raw of rawItems) {
    const product = byId(clean(raw.productId, 40));
    const qty = Math.max(1, Math.min(20, Number(raw.qty || 1)));
    if (!product) throw new Error(`One of your items is no longer available.`);
    const personalisation = clean(raw.personalisation, 10);
    const unitPrice = Number(product.price || 0) + (personalisation && product.persKind ? PERSONALISE_FEE : 0);
    lines.push({
      productId: product.id,
      name: product.name,
      image: absoluteImage(product.image, siteUrl()),
      unitPrice,
      qty,
      lineTotal: unitPrice * qty,
      personalisation: personalisation || null,
      persKind: product.persKind || null,
      special: null,
    });
  }

  let subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const gift = body.gift && typeof body.gift === 'object' ? {
    wrap: Boolean(body.gift.wrap),
    message: clean(body.gift.message, 140),
    from: clean(body.gift.from, 40),
    hidePrices: body.gift.hidePrices !== false,
  } : null;

  if (gift?.wrap) {
    lines.push({
      productId: 'gift-wrap', name: 'Gift wrapping', image: '',
      unitPrice: GIFT_WRAP_PRICE, qty: 1, lineTotal: GIFT_WRAP_PRICE,
      personalisation: null, persKind: null, special: 'gift-wrap',
    });
    subtotal += GIFT_WRAP_PRICE;
  }

  const promoCode = clean(body.promoCode, 24).toUpperCase();
  const discount = promoCode === 'PLAY10' ? Math.round(subtotal * PROMO_PLAY10) : 0;
  const delivery = deliveryFor(clean(body.deliveryId, 20), subtotal);
  const total = Math.max(0, subtotal - discount + delivery.fee);

  const c = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const metaName = String(user.user_metadata?.full_name || '').trim();
  const firstName = clean(c.firstName, 60) || (metaName.split(/\s+/)[0] || 'Friend');
  const lastName = clean(c.lastName, 60) || metaName.split(/\s+/).slice(1).join(' ');
  const customer = {
    firstName,
    lastName,
    email: String(user.email || '').trim(),
    phone: clean(c.phone, 32),
    addressLine1: clean(c.addressLine1, 200),
    addressLine2: clean(c.addressLine2, 200),
    city: clean(c.city, 120),
    state: clean(c.state, 120),
    pincode: clean(c.pincode, 24),
    deliveryNote: clean(c.deliveryNote, 200),
  };

  const method = clean(body.paymentMethod, 120) || 'Card · demo gateway';
  const isCod = /cash|cod|pay on delivery/i.test(method);
  const paymentStatus = isCod ? 'cod' : 'demo_not_charged';

  const id = `PL-${100000 + Math.floor(Math.random() * 899999)}`;
  const now = new Date();
  return {
    id,
    createdAt: now.toISOString(),
    createdAtLabel: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    customer,
    email: customer.email,
    items: lines,
    currency: 'INR',
    subtotal,
    discount,
    discountLabel: promoCode === 'PLAY10' ? '10% off' : '',
    deliveryFee: delivery.fee,
    total,
    paymentMethod: method,
    paymentStatus,
    status: 'order_placed',
    statusLabel: isCod ? 'Order confirmed' : 'Order received',
    gift,
    delivery,
    trackingNumber: digits(12),
    carrier: 'FedEx',
    carrierService: 'FedEx Priority Overnight™ (demo)',
    package: {
      service: 'PRIORITY OVERNIGHT',
      weight: '1 kg',
      dims: '24 × 18 × 12 cm',
      pieces: 1,
      reference: `PL-${digits(6)}`,
      billedWeight: '1 kg',
      packaging: 'PLAYROOM SECURE BOX',
    },
    promoCode: promoCode || null,
    pointsEarned: Math.floor(total / 50),
    isDemo: true,
    source: 'server_checkout',
  };
}

async function insertOrder(admin, userId, order, key) {
  const base = {
    user_id: userId,
    order_id: order.id,
    data: order,
    status: order.status,
    tracking_number: order.trackingNumber,
    total: order.total,
    payment_status: order.paymentStatus,
    idempotency_key: key,
    created_at: order.createdAt,
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await admin.from('orders').insert(base).select('id, order_id, data, created_at').maybeSingle();
    if (!error) return data;
    if (!/duplicate|unique/i.test(error.message || '')) throw error;
    order.id = `PL-${100000 + Math.floor(Math.random() * 899999)}`;
    base.order_id = order.id;
    order.data = order;
  }
  throw new Error('Could not create a unique order id. Please try again.');
}

async function sendConfirmation(admin, order, userId, key) {
  const emailType = 'order_confirmation';
  const outboxKey = `email:${key}:${emailType}`;
  let { data: outbox, error } = await admin
    .from('email_outbox')
    .insert({
      order_id: order.id,
      user_id: userId,
      recipient: order.email,
      email_type: emailType,
      status: 'pending',
      idempotency_key: outboxKey,
      payload: { order },
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      const existing = await admin.from('email_outbox').select('*').eq('idempotency_key', outboxKey).maybeSingle();
      if (existing.error) throw existing.error;
      outbox = existing.data;
    } else {
      throw error;
    }
  }

  if (!outbox || outbox.status === 'sent' || outbox.status === 'processing') {
    return { status: outbox?.status || 'skipped', messageId: outbox?.provider_message_id || null };
  }

  const { data: claimed, error: claimError } = await admin
    .from('email_outbox')
    .update({ status: 'processing', attempt_count: Number(outbox.attempt_count || 0) + 1 })
    .eq('id', outbox.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { status: 'skipped', messageId: null };

  try {
    const { subject, html, text } = renderOrderConfirmation(order, {
      siteUrl: siteUrl(),
      orderUrl: `${siteUrl()}#/account/orders?order=${encodeURIComponent(order.id)}`,
      supportEmail: process.env.SUPPORT_EMAIL || '',
    });
    const info = await getTransport().sendMail({
      from: requireEnv('SMTP_FROM'),
      to: order.email,
      subject,
      html,
      text,
    });
    await admin.from('email_outbox').update({
      status: 'sent',
      provider_message_id: info.messageId || null,
      sent_at: new Date().toISOString(),
      last_error: null,
    }).eq('id', claimed.id);
    return { status: 'sent', messageId: info.messageId || null };
  } catch (mailError) {
    await admin.from('email_outbox').update({
      status: 'failed',
      last_error: String(mailError?.message || mailError).slice(0, 1000),
    }).eq('id', claimed.id);
    return { status: 'failed', error: String(mailError?.message || mailError) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const token = bearer(req);
    if (!token) return json(res, 401, { error: 'Please sign in before placing an order.' });

    const admin = getAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user) return json(res, 401, { error: 'Your session has expired. Please sign in again.' });

    const body = await readJson(req);
    const key = clean(body.idempotencyKey, 100);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) return json(res, 400, { error: 'Invalid checkout request.' });

    const { data: existing, error: existingError } = await admin
      .from('orders')
      .select('data, created_at')
      .eq('user_id', auth.user.id)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.data) return json(res, 200, { order: existing.data, email: { status: 'already_requested' } });

    const order = buildOrder(body, auth.user);
    const row = await insertOrder(admin, auth.user.id, order, key);
    const committed = row?.data || order;

    let email = { status: 'not_attempted' };
    try {
      email = await sendConfirmation(admin, committed, auth.user.id, key);
    } catch (emailError) {
      email = { status: 'failed', error: String(emailError?.message || emailError) };
    }

    return json(res, 200, { order: committed, email });
  } catch (error) {
    console.error('[orders API]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}
