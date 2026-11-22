// Premium transactional order confirmation email.
// Email-safe table layout, inline styles, no JavaScript, no external fonts.
// The browser never renders this module; it is used by the Vercel API only.

const LOGO = 'https://kouyxayyapmfqhixjved.supabase.co/storage/v1/object/public/email-assets/playroom-real-logo.png';
const SITE = 'https://playrooom.vercel.app/';

const C = {
  beige: '#f6ece3',
  cocoa: '#3d6482',
  rose: '#e59aa2',
  gold: '#87aed2',
  ivory: '#d3e1ee',
  ink: '#3c2c24',
  muted: '#7b685f',
  footer: '#d0dde9',
  line: '#bbcddd',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(value, base = SITE) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).toString();
    return new URL(raw.replace(/^\/+/, ''), base).toString();
  } catch {
    return '';
  }
}

function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function dateLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

function paymentState(order = {}) {
  const status = String(order.paymentStatus || '').toLowerCase();
  const method = String(order.paymentMethod || '').toLowerCase();
  if (/^(paid|payment_confirmed|succeeded|success|captured)$/.test(status)) {
    return {
      kind: 'paid',
      label: 'PAYMENT CONFIRMED',
      headline: 'Payment confirmed.',
      body: 'Your payment has been received successfully. We’re preparing your order.',
      display: 'Paid',
    };
  }
  if (/(cod|cash|pay_on_delivery|pay on delivery)/.test(`${status} ${method}`)) {
    return {
      kind: 'cod',
      label: 'ORDER CONFIRMED',
      headline: 'Order confirmed.',
      body: 'Your order has been received. We’ll keep you updated as it makes its way to you.',
      display: 'Pay on delivery',
    };
  }
  return {
    kind: 'pending',
    label: 'ORDER RECEIVED',
    headline: 'Order received.',
    body: 'We’ve received your order. Your payment status is shown below — no payment confirmation has been issued yet.',
    display: status ? status.replace(/_/g, ' ') : 'Not charged',
  };
}

function productRows(order, site) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) {
    return `<tr><td style="padding:20px 0;color:${C.muted};font:14px Georgia,serif;">Your order items are listed in your account.</td></tr>`;
  }
  return items.map((item) => {
    const src = safeUrl(item.image, site);
    const variant = item.personalisation
      ? `${item.persKind === 'embroidery' ? 'Embroidered' : 'Engraved'} “${item.personalisation}”`
      : item.special === 'gift-wrap' ? 'Gift wrapping' : '';
    const image = src
      ? `<img src="${escapeHtml(src)}" width="64" height="72" alt="${escapeHtml(item.name || 'Playrooom item')}" style="display:block;width:64px;height:72px;object-fit:cover;border-radius:4px;background:${C.beige};">`
      : `<table role="presentation" cellpadding="0" cellspacing="0" width="64" height="72" style="width:64px;height:72px;background:${C.beige};border-radius:4px;"><tr><td align="center" valign="middle" style="color:${C.cocoa};font:18px Georgia,serif;">✳</td></tr></table>`;
    return `<tr>
      <td width="76" valign="top" style="padding:18px 12px 18px 0;">${image}</td>
      <td valign="top" style="padding:18px 0;border-bottom:1px solid ${C.line};">
        <div style="color:${C.ink};font:600 15px/1.35 Arial,sans-serif;">${escapeHtml(item.name || 'Playrooom item')}</div>
        ${variant ? `<div style="margin-top:5px;color:${C.muted};font:12px/1.5 Arial,sans-serif;">${escapeHtml(variant)}</div>` : ''}
        <div style="margin-top:5px;color:${C.muted};font:12px/1.5 Arial,sans-serif;">Qty ${escapeHtml(item.qty || 1)} · ${escapeHtml(money(item.unitPrice))} each</div>
      </td>
      <td align="right" valign="top" style="padding:18px 0 18px 12px;border-bottom:1px solid ${C.line};color:${C.ink};font:600 14px Arial,sans-serif;white-space:nowrap;">${escapeHtml(money(item.lineTotal ?? (Number(item.unitPrice || 0) * Number(item.qty || 1))))}</td>
    </tr>`;
  }).join('');
}

export function renderOrderConfirmation(order = {}, options = {}) {
  const site = safeUrl(options.siteUrl || order.siteUrl || SITE, SITE);
  const customer = order.customer || {};
  const firstName = String(customer.firstName || '').trim();
  const pay = paymentState(order);
  const orderUrl = safeUrl(options.orderUrl || `${site}#/account/orders`, site);
  const greeting = firstName ? `Hello ${escapeHtml(firstName)},` : 'Hello,';

  const discount = Number(order.discount || 0);
  const tax = Number(order.tax || order.gst || 0);
  const address = customer;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Your Playrooom order</title>
<style>
  @media only screen and (max-width:620px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .stack { display:block !important; width:100% !important; text-align:left !important; }
    .hero-title { font-size:34px !important; line-height:1.08 !important; }
    .btn { display:block !important; width:100% !important; }
    .product td { padding-top:14px !important; padding-bottom:14px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.beige};color:${C.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Playrooom order ${escapeHtml(order.id || '')} — ${escapeHtml(pay.display)}.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.beige}" style="background:${C.beige};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;background:${C.ivory};">
      <tr><td align="center" bgcolor="${C.cocoa}" style="background:${C.cocoa};padding:11px 20px;color:#d3e1ee;font:9px Arial,sans-serif;letter-spacing:.12em;">THE PLAYROOOM EDIT · THOUGHTFULLY CHOSEN · MADE FOR LITTLE BIG IMAGINATIONS</td></tr>
      <tr><td align="center" bgcolor="${C.beige}" class="px" style="background:${C.beige};padding:32px 44px 28px;border-bottom:1px solid ${C.line};">
        <img src="${LOGO}" width="190" alt="Playrooom" style="display:block;width:190px;max-width:70%;height:auto;">
        <div style="margin-top:14px;color:${C.rose};font:700 12px Arial,sans-serif;letter-spacing:.14em;">LITTLE HANDS. BIG WORLDS.</div>
      </td></tr>
      <tr><td class="px" style="padding:38px 44px 10px;">
        <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">YOUR PLAYROOOM ORDER / CONFIRMATION</div>
        <h1 class="hero-title" style="margin:16px 0 12px;color:${C.ink};font:400 44px/1.05 Georgia,'Times New Roman',serif;letter-spacing:-.03em;">Something wonderful is <em style="color:${C.rose};font-style:italic;">on its way.</em></h1>
        <p style="margin:0 0 8px;color:${C.ink};font:16px/1.7 Georgia,serif;">${greeting}</p>
        <p style="margin:0;color:${C.muted};font:14px/1.75 Arial,sans-serif;">${escapeHtml(pay.body)} We’ve received your order and are getting everything ready for its next little adventure.</p>
      </td></tr>
      <tr><td class="px" style="padding:20px 44px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#d3e1ee;border:1px solid ${C.line};border-radius:6px;">
          <tr><td style="padding:20px 22px;">
            <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.14em;">${escapeHtml(pay.label)}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">ORDER NUMBER</td><td align="right" style="padding:7px 0;color:${C.ink};font:600 13px Arial,sans-serif;">#${escapeHtml(order.id || '—')}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">ORDER DATE</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(dateLabel(order.createdAt))}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">ORDER STATUS</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(order.statusLabel || 'Order received')}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">PAYMENT METHOD</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(order.paymentMethod || '—')}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">PAYMENT STATUS</td><td align="right" style="padding:7px 0;color:${C.ink};font:600 13px Arial,sans-serif;">${escapeHtml(pay.display)}</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:30px 44px 0;">
        <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">THE LITTLE THINGS YOU CHOSE</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="product" style="margin-top:12px;">
          ${productRows(order, site)}
        </table>
      </td></tr>
      <tr><td class="px" style="padding:20px 44px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-left:auto;max-width:320px;">
          <tr><td style="padding:6px 0;color:${C.muted};font:13px Arial,sans-serif;">Subtotal</td><td align="right" style="padding:6px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(money(order.subtotal))}</td></tr>
          <tr><td style="padding:6px 0;color:${C.muted};font:13px Arial,sans-serif;">Delivery</td><td align="right" style="padding:6px 0;color:${C.ink};font:13px Arial,sans-serif;">${Number(order.deliveryFee || 0) ? escapeHtml(money(order.deliveryFee)) : 'Complimentary'}</td></tr>
          ${discount ? `<tr><td style="padding:6px 0;color:${C.muted};font:13px Arial,sans-serif;">Discount${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ''}</td><td align="right" style="padding:6px 0;color:${C.rose};font:13px Arial,sans-serif;">−${escapeHtml(money(discount))}</td></tr>` : ''}
          ${tax ? `<tr><td style="padding:6px 0;color:${C.muted};font:13px Arial,sans-serif;">Taxes / GST</td><td align="right" style="padding:6px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(money(tax))}</td></tr>` : ''}
          <tr><td colspan="2" style="padding:8px 0 0;border-top:1px solid ${C.line};"></td></tr>
          <tr><td style="padding:10px 0;color:${C.ink};font:700 12px Arial,sans-serif;letter-spacing:.1em;">TOTAL</td><td align="right" style="padding:10px 0;color:${C.cocoa};font:700 22px Georgia,serif;">${escapeHtml(money(order.total))}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:26px 44px 0;">
        <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">WHERE YOUR LITTLE ADVENTURE IS HEADED</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;color:${C.ink};font:14px/1.75 Arial,sans-serif;">
          <tr><td style="padding:2px 0;"><strong>${escapeHtml([address.firstName, address.lastName].filter(Boolean).join(' '))}</strong></td></tr>
          ${address.phone ? `<tr><td style="padding:2px 0;">${escapeHtml(address.phone)}</td></tr>` : ''}
          ${address.addressLine1 ? `<tr><td style="padding:2px 0;">${escapeHtml(address.addressLine1)}</td></tr>` : ''}
          ${address.addressLine2 ? `<tr><td style="padding:2px 0;">${escapeHtml(address.addressLine2)}</td></tr>` : ''}
          <tr><td style="padding:2px 0;">${escapeHtml([address.city, address.state].filter(Boolean).join(', '))}${address.pincode ? ` · ${escapeHtml(address.pincode)}` : ''}</td></tr>
          ${address.country ? `<tr><td style="padding:2px 0;">${escapeHtml(address.country)}</td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td class="px" align="center" style="padding:34px 44px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.cocoa}" style="background:${C.cocoa};border-radius:4px;">
          <a class="btn" href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:15px 30px;color:${C.ivory};font:700 12px Arial,sans-serif;letter-spacing:.08em;text-decoration:none;">VIEW YOUR ORDER</a>
        </td></tr></table>
        <div style="margin-top:18px;"><a href="${escapeHtml(site)}" style="color:${C.muted};font:13px Arial,sans-serif;text-decoration:underline;">Continue exploring Playrooom</a></div>
      </td></tr>
      <tr><td class="px" align="center" style="padding:30px 44px 36px;border-top:1px solid ${C.line};">
        <div style="color:${C.ink};font:400 21px/1.5 Georgia,serif;">Thoughtfully chosen toys for curious minds, big imaginations and everyday little adventures.</div>
        <div style="margin-top:12px;color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">LITTLE HANDS. BIG WORLDS.</div>
      </td></tr>
      <tr><td align="center" bgcolor="${C.footer}" class="px" style="background:${C.footer};padding:26px 30px;">
        <div style="color:${C.cocoa};font:700 10px Arial,sans-serif;letter-spacing:.16em;">MADE FOR LITTLE BIG IMAGINATIONS.</div>
        <div style="margin-top:10px;color:${C.muted};font:12px/1.8 Arial,sans-serif;">
          <a href="${escapeHtml(site)}" style="color:${C.cocoa};text-decoration:underline;">playrooom.vercel.app</a>
          ${options.supportEmail ? ` · <a href="mailto:${escapeHtml(options.supportEmail)}" style="color:${C.cocoa};text-decoration:underline;">${escapeHtml(options.supportEmail)}</a>` : ''}
        </div>
        <div style="margin-top:12px;color:#8a9aa8;font:10px/1.6 Arial,sans-serif;">This is an automated order confirmation. Please do not reply directly to this message.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    'PLAYROOOM — LITTLE HANDS. BIG WORLDS.',
    '',
    pay.label,
    '',
    firstName ? `Hello ${firstName},` : 'Hello,',
    pay.body,
    'We’ve received your order and are getting everything ready for its next little adventure.',
    '',
    `Order number: #${order.id || '—'}`,
    `Order date: ${dateLabel(order.createdAt)}`,
    `Order status: ${order.statusLabel || 'Order received'}`,
    `Payment method: ${order.paymentMethod || '—'}`,
    `Payment status: ${pay.display}`,
    '',
    'THE LITTLE THINGS YOU CHOSE',
    ...(Array.isArray(order.items) ? order.items : []).map((item) => (
      `${item.name || 'Playrooom item'} — Qty ${item.qty || 1}, ${money(item.unitPrice)} each, ${money(item.lineTotal ?? (Number(item.unitPrice || 0) * Number(item.qty || 1)))}`
    )),
    '',
    `Subtotal: ${money(order.subtotal)}`,
    `Delivery: ${Number(order.deliveryFee || 0) ? money(order.deliveryFee) : 'Complimentary'}`,
    discount ? `Discount: -${money(discount)}` : '',
    tax ? `Taxes / GST: ${money(tax)}` : '',
    `TOTAL: ${money(order.total)}`,
    '',
    'WHERE YOUR LITTLE ADVENTURE IS HEADED',
    [address.firstName, address.lastName].filter(Boolean).join(' '),
    address.phone || '',
    address.addressLine1 || '',
    address.addressLine2 || '',
    [address.city, address.state].filter(Boolean).join(', '),
    [address.pincode, address.country].filter(Boolean).join(' · '),
    '',
    `View your order: ${orderUrl}`,
    `Continue exploring Playrooom: ${site}`,
    '',
    'Thoughtfully chosen toys for curious minds, big imaginations and everyday little adventures.',
    'MADE FOR LITTLE BIG IMAGINATIONS.',
  ].filter((line) => line !== '').join('\n');

  const subject = pay.kind === 'paid'
    ? `Your Playrooom order is on its way to becoming something wonderful — #${order.id || ''}`
    : `Your Playrooom order is confirmed — #${order.id || ''}`;

  return { subject, html, text };
}
