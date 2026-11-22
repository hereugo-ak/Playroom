// Vercel serverless function: activate Playrooom Circle after the existing demo
// payment flow is approved. No real payment provider is used.
import { renderSubscriptionConfirmation } from '../../emails/subscription-confirmation.js';
import { bearer, getAdmin, getTransport, json, readJson, requireEnv } from '../_lib/server.js';

const PLAN_META = {
  circle_monthly: { name: 'Monthly Circle', price: 499, interval: 'month' },
  circle_yearly: { name: 'Yearly Circle', price: 4499, interval: 'year' },
};

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

function siteUrl() {
  return (process.env.SITE_URL || 'https://playrooom.vercel.app/').replace(/\/+$/, '') + '/';
}

function periodEnd(interval, from = new Date()) {
  const end = new Date(from);
  if (interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}

function laterIso(a, b) {
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}

async function sendConfirmation(admin, { subscription, payment, plan, user }) {
  const type = 'subscription_confirmation';
  const outboxKey = `subscription:${payment.idempotency_key}:${type}`;
  let { data: outbox, error } = await admin
    .from('email_outbox')
    .insert({
      order_id: payment.provider_reference,
      user_id: user.id,
      recipient: user.email,
      email_type: type,
      status: 'pending',
      idempotency_key: outboxKey,
      payload: { subscription_id: subscription.id, payment_id: payment.id, plan_code: plan.code },
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (!/duplicate|unique/i.test(error.message || '')) throw error;
    const existing = await admin.from('email_outbox').select('*').eq('idempotency_key', outboxKey).maybeSingle();
    if (existing.error) throw existing.error;
    outbox = existing.data;
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
    const benefits = Array.isArray(plan.benefits) ? plan.benefits : [];
    const { subject, html, text } = renderSubscriptionConfirmation({
      planName: plan.name,
      amount: payment.amount,
      currentPeriodEnd: subscription.current_period_end,
      paymentReference: payment.provider_reference,
      method: `${payment.method} · demo`,
      firstName: String(user.user_metadata?.full_name || '').trim().split(/\s+/)[0] || '',
      benefits,
    }, {
      siteUrl: siteUrl(),
      membershipUrl: `${siteUrl()}#/account/membership`,
      shopUrl: siteUrl(),
    });

    const info = await getTransport().sendMail({
      from: requireEnv('SMTP_FROM'),
      to: user.email,
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
    if (!token) return json(res, 401, { error: 'Please sign in before joining Circle.' });

    const admin = getAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user) return json(res, 401, { error: 'Your session has expired. Please sign in again.' });

    const body = await readJson(req);
    const code = clean(body.planCode, 40);
    const plan = PLAN_META[code];
    if (!plan) return json(res, 400, { error: 'Choose a valid Playrooom Circle plan.' });

    const key = clean(body.idempotencyKey, 100);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) return json(res, 400, { error: 'Invalid membership request.' });

    const { data: existingPayment, error: existingError } = await admin
      .from('subscription_payments')
      .select('*, subscriptions (*)')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingPayment) {
      return json(res, 200, {
        subscription: existingPayment.subscriptions,
        payment: existingPayment,
        email: { status: 'already_requested' },
      });
    }

    const { data: planRow, error: planError } = await admin
      .from('subscription_plans')
      .select('code, name, price, interval, benefits')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle();
    if (planError) throw planError;
    if (!planRow) return json(res, 400, { error: 'This plan is not available.' });

    const now = new Date();
    const start = now.toISOString();
    const end = periodEnd(planRow.interval, now);
    const method = clean(body.paymentMethod, 120) || 'Card · demo gateway';
    const providerReference = `demo_circle_${Date.now().toString(36)}_${key.slice(-6)}`;

    const { data: activeRows, error: activeError } = await admin
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .gt('current_period_end', start)
      .order('current_period_end', { ascending: false })
      .limit(1);
    if (activeError) throw activeError;

    let subscription;
    if (activeRows?.length) {
      const current = activeRows[0];
      const { data, error } = await admin
        .from('subscriptions')
        .update({
          plan_code: code,
          provider: 'demo',
          provider_reference: providerReference,
          current_period_end: laterIso(current.current_period_end, end),
        })
        .eq('id', current.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      subscription = data;
    } else {
      const { data, error } = await admin
        .from('subscriptions')
        .insert({
          user_id: auth.user.id,
          plan_code: code,
          status: 'active',
          provider: 'demo',
          provider_reference: providerReference,
          current_period_start: start,
          current_period_end: end,
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      subscription = data;
    }

    const { data: payment, error: paymentError } = await admin
      .from('subscription_payments')
      .insert({
        user_id: auth.user.id,
        subscription_id: subscription.id,
        plan_code: code,
        amount: Number(planRow.price),
        method,
        status: 'demo_approved',
        provider_reference: providerReference,
        idempotency_key: key,
        created_at: start,
      })
      .select('*')
      .maybeSingle();
    if (paymentError) throw paymentError;

    let email = { status: 'not_attempted' };
    try {
      email = await sendConfirmation(admin, { subscription, payment, plan: planRow, user: auth.user });
    } catch (emailError) {
      email = { status: 'failed', error: String(emailError?.message || emailError) };
    }

    return json(res, 200, { subscription, payment, email });
  } catch (error) {
    console.error('[subscriptions API]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}
