// The single Supabase browser client for the whole application.
//
// ES modules are evaluated once, so this module is the one and only place the
// client is created. Every feature imports { supabase } from here.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, AUTH_CONFIGURED, AUTH_CONFIG_MESSAGE } from './config.js';

if (!AUTH_CONFIGURED) {
  // The storefront keeps working without auth; only the account area is limited.
  console.warn(`[Playroom] ${AUTH_CONFIG_MESSAGE}`);
}

export const supabase = AUTH_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        // A long-lived session in localStorage, refreshed in the background.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow lets confirmation and recovery links work even when the
        // email is opened on another device, which PKCE cannot do without a
        // server-side verifier. The tokens stay in the URL fragment and are
        // consumed and removed before the hash router renders a page.
        flowType: 'implicit',
        storageKey: 'playroom-auth',
      },
      global: {
        headers: { 'x-client-info': 'playroom-storefront/1.1.0' },
      },
    })
  : null;

export const isSupabaseConfigured = AUTH_CONFIGURED;
