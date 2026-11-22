// Playrooom Circle membership state.
// Membership is read from Supabase with RLS; all writes happen on the server.
import { supabase, isSupabaseConfigured } from './supabase.js';
import { authState, onAuthChange } from './auth-store.js';

export const membershipState = {
  ready: false,
  active: false,
  subscription: null,
  plan: null,
  payments: [],
  requests: [],
  error: '',
};

const listeners = new Set();
let started = false;
let hydratedFor = null;
let loadPromise = null;

function emit() {
  for (const fn of listeners) {
    try { fn(membershipState); } catch (error) { console.error('[Circle] listener failed', error); }
  }
}

export function onMembershipChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function reset() {
  Object.assign(membershipState, {
    ready: true,
    active: false,
    subscription: null,
    plan: null,
    payments: [],
    requests: [],
    error: '',
  });
  emit();
}

export function hasCircleAccess() {
  if (!membershipState.active || !membershipState.subscription?.current_period_end) return false;
  return new Date(membershipState.subscription.current_period_end).getTime() > Date.now();
}

export async function loadMembership(force = false) {
  if (!isSupabaseConfigured || !supabase || !authState.user) {
    if (!authState.user) reset();
    return membershipState;
  }
  if (loadPromise && !force) return loadPromise;

  loadPromise = (async () => {
    const user = authState.user;
    const now = new Date().toISOString();

    try {
      const { data: rows, error } = await supabase
        .from('subscriptions')
        .select(`
          id, plan_code, status, provider, provider_reference,
          current_period_start, current_period_end,
          subscription_plans ( code, name, price, interval, benefits )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('current_period_end', now)
        .order('current_period_end', { ascending: false })
        .limit(1);
      if (error) throw error;

      const subscription = rows?.[0] || null;
      membershipState.subscription = subscription;
      membershipState.plan = subscription?.subscription_plans || null;
      membershipState.active = Boolean(subscription && new Date(subscription.current_period_end).getTime() > Date.now());
    } catch (error) {
      membershipState.active = false;
      membershipState.subscription = null;
      membershipState.plan = null;
      membershipState.error = String(error?.message || error);
      console.warn('[Circle] membership unavailable', membershipState.error);
    }

    try {
      const { data: payments, error: paymentError } = await supabase
        .from('subscription_payments')
        .select('id, plan_code, amount, method, status, provider_reference, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (paymentError) throw paymentError;
      membershipState.payments = payments || [];
    } catch (error) {
      membershipState.payments = [];
      console.warn('[Circle] payment history unavailable', error?.message || error);
    }

    try {
      const { data: requests, error: requestError } = await supabase
        .from('member_requests')
        .select('id, kind, title, details, order_id, priority, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (requestError) throw requestError;
      membershipState.requests = requests || [];
    } catch (error) {
      membershipState.requests = [];
      console.warn('[Circle] requests unavailable', error?.message || error);
    }

    membershipState.ready = true;
    hydratedFor = user.id;
    emit();
    return membershipState;
  })();

  return loadPromise.finally(() => { loadPromise = null; });
}

export function hydrateMembership() {
  return loadMembership(false);
}

export function startMembershipSync() {
  if (started) return;
  started = true;
  onAuthChange((auth) => {
    if (auth.user) {
      if (hydratedFor !== auth.user.id) {
        hydratedFor = auth.user.id;
        loadMembership(true).catch(() => {});
      }
    } else {
      hydratedFor = null;
      loadPromise = null;
      reset();
    }
  });
}
