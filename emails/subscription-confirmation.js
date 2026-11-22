// Premium Playrooom Circle confirmation email.
// Uses the same table-based design system as the order confirmation email.
import { escapeHtml } from './order-confirmation.js';

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

function safeUrl(value, base = SITE) {
  const raw = String(value || '').trim();
  if (!raw) return base;
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).toString();
    return new URL(raw.replace(/^\/+/, ''), base).toString();
  } catch {
    return base;
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

function date(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

function benefitRows(benefits = []) {
  const list = Array.isArray(benefits) && benefits.length
    ? benefits
    : [
      'Free next-day delivery',
      'Gift wrapping on us',
      'First look at new toys',
      'Priority care desk',
      'Monthly play guide',
      'Build with us',
      'Endless customisation',
      'Lifetime repair desk',
    ];
  return list.map((benefit, i) => `
    <tr>
      <td width="34" valign="top" style="padding:10px 0;color:${C.rose};font:700 11px Arial,sans-serif;">${String(i + 1).padStart(2, '0')}</td>
      <td valign="top" style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.ink};font:14px/1.5 Arial,sans-serif;">${escapeHtml(benefit)}</td>
    </tr>`).join('');
}

export function renderSubscriptionConfirmation(data = {}, options = {}) {
  const site = safeUrl(options.siteUrl || SITE, SITE);
  const membershipUrl = safeUrl(options.membershipUrl || `${site}#/account/membership`, site);
  const shopUrl = safeUrl(options.shopUrl || site, site);
  const planName = String(data.planName || 'Playrooom Circle');
  const amount = Number(data.amount || 0);
  const periodEnd = data.currentPeriodEnd || data.periodEnd || '';
  const reference = String(data.paymentReference || 'DEMO');
  const method = String(data.method || 'Demo payment');
  const benefits = data.benefits || [];
  const firstName = String(data.firstName || '').trim();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Welcome to Playrooom Circle</title>
<style>
  @media only screen and (max-width:620px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .hero-title { font-size:34px !important; line-height:1.08 !important; }
    .btn { display:block !important; width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.beige};color:${C.ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Welcome to Playrooom Circle. Your demo membership is active.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.beige}" style="background:${C.beige};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;background:${C.ivory};">
      <tr><td align="center" bgcolor="${C.cocoa}" style="background:${C.cocoa};padding:11px 20px;color:#d3e1ee;font:9px Arial,sans-serif;letter-spacing:.12em;">PLAYROOOM CIRCLE · MEMBER CONFIRMATION · MADE FOR LITTLE BIG IMAGINATIONS</td></tr>
      <tr><td align="center" bgcolor="${C.beige}" class="px" style="background:${C.beige};padding:32px 44px 28px;border-bottom:1px solid ${C.line};">
        <img src="${LOGO}" width="190" alt="Playrooom" style="display:block;width:190px;max-width:70%;height:auto;">
        <div style="margin-top:14px;color:${C.rose};font:700 12px Arial,sans-serif;letter-spacing:.14em;">LITTLE HANDS. BIG WORLDS.</div>
      </td></tr>
      <tr><td class="px" style="padding:38px 44px 10px;">
        <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">PLAYROOOM CIRCLE / MEMBERSHIP ACTIVE</div>
        <h1 class="hero-title" style="margin:16px 0 12px;color:${C.ink};font:400 44px/1.05 Georgia,'Times New Roman',serif;letter-spacing:-.03em;">A little more room for <em style="color:${C.rose};font-style:italic;">play.</em></h1>
        <p style="margin:0;color:${C.muted};font:14px/1.75 Arial,sans-serif;">${firstName ? `Hello ${escapeHtml(firstName)},` : 'Hello,'} your Playrooom Circle membership is active. The demo payment was approved and your benefits are ready to use.</p>
      </td></tr>
      <tr><td class="px" style="padding:20px 44px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#d3e1ee;border:1px solid ${C.line};border-radius:6px;">
          <tr><td style="padding:20px 22px;">
            <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.14em;">YOUR MEMBERSHIP</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">PLAN</td><td align="right" style="padding:7px 0;color:${C.ink};font:600 13px Arial,sans-serif;">${escapeHtml(planName)}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">STATUS</td><td align="right" style="padding:7px 0;color:${C.cocoa};font:600 13px Arial,sans-serif;">Active · demo</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">VALID UNTIL</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(date(periodEnd))}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">PAYMENT</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(method)} · ${escapeHtml(money(amount))}</td></tr>
              <tr><td style="padding:7px 0;color:${C.muted};font:10px Arial,sans-serif;letter-spacing:.1em;">REFERENCE</td><td align="right" style="padding:7px 0;color:${C.ink};font:13px Arial,sans-serif;">${escapeHtml(reference)}</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:28px 44px 4px;">
        <div style="color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">WHAT IS LIVE NOW</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:10px;">
          ${benefitRows(benefits)}
        </table>
      </td></tr>
      <tr><td class="px" align="center" style="padding:32px 44px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.cocoa}" style="background:${C.cocoa};border-radius:4px;">
          <a class="btn" href="${escapeHtml(membershipUrl)}" style="display:inline-block;padding:15px 30px;color:${C.ivory};font:700 12px Arial,sans-serif;letter-spacing:.08em;text-decoration:none;">EXPLORE YOUR BENEFITS</a>
        </td></tr></table>
        <div style="margin-top:18px;"><a href="${escapeHtml(shopUrl)}" style="color:${C.muted};font:13px Arial,sans-serif;text-decoration:underline;">Shop with your Circle benefits</a></div>
      </td></tr>
      <tr><td class="px" align="center" style="padding:30px 44px 36px;border-top:1px solid ${C.line};">
        <div style="color:${C.ink};font:400 21px/1.5 Georgia,serif;">Thoughtfully chosen toys for curious minds, big imaginations and everyday little adventures.</div>
        <div style="margin-top:12px;color:${C.rose};font:700 9px Arial,sans-serif;letter-spacing:.16em;">LITTLE HANDS. BIG WORLDS.</div>
        <div style="margin-top:14px;color:#8a9aa8;font:10px/1.6 Arial,sans-serif;">Demo membership — no real payment was collected and no physical service has been scheduled.</div>
      </td></tr>
      <tr><td align="center" bgcolor="${C.footer}" class="px" style="background:${C.footer};padding:26px 30px;">
        <div style="color:${C.cocoa};font:700 10px Arial,sans-serif;letter-spacing:.16em;">MADE FOR LITTLE BIG IMAGINATIONS.</div>
        <div style="margin-top:10px;color:${C.muted};font:12px/1.8 Arial,sans-serif;">playrooom.vercel.app</div>
        <div style="margin-top:12px;color:#8a9aa8;font:10px/1.6 Arial,sans-serif;">Automated membership confirmation. Please do not reply directly to this message.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    'PLAYROOOM CIRCLE — LITTLE HANDS. BIG WORLDS.',
    '',
    'MEMBERSHIP ACTIVE',
    '',
    firstName ? `Hello ${firstName},` : 'Hello,',
    'Your Playrooom Circle membership is active. The demo payment was approved and your benefits are ready to use.',
    '',
    `Plan: ${planName}`,
    'Status: Active · demo',
    `Valid until: ${date(periodEnd)}`,
    `Payment: ${method} · ${money(amount)}`,
    `Reference: ${reference}`,
    '',
    'WHAT IS LIVE NOW',
    ...(Array.isArray(benefits) && benefits.length ? benefits : [
      'Free next-day delivery',
      'Gift wrapping on us',
      'First look at new toys',
      'Priority care desk',
      'Monthly play guide',
      'Build with us',
      'Endless customisation',
      'Lifetime repair desk',
    ]),
    '',
    `Explore your benefits: ${membershipUrl}`,
    `Shop with your Circle benefits: ${shopUrl}`,
    '',
    'Thoughtfully chosen toys for curious minds, big imaginations and everyday little adventures.',
    'Demo membership — no real payment was collected and no physical service has been scheduled.',
    'MADE FOR LITTLE BIG IMAGINATIONS.',
  ].join('\n');

  return {
    subject: 'Welcome to Playrooom Circle — your membership is active',
    html,
    text,
  };
}
