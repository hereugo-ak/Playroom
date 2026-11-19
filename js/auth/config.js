// Central Supabase configuration.
//
// Vite only exposes variables prefixed with VITE_ to the browser. The values
// below are the project URL and the publishable (or legacy anon) key — both are
// safe to ship to a browser because every table is protected by Row Level
// Security. A service_role / secret key must never appear in this file.
const env = import.meta.env || {};

const clean = (value) => String(value || '').trim();

export const SUPABASE_URL = clean(env.VITE_SUPABASE_URL).replace(/\/+$/, '');
export const SUPABASE_KEY = clean(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);

export const AUTH_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const AUTH_CONFIG_MESSAGE = AUTH_CONFIGURED
  ? ''
  : 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) to .env.local, then restart the dev server. See docs/AUTH_SETUP.md.';

/** True when the URL looks like a real http(s) endpoint rather than a placeholder. */
export function configLooksValid() {
  if (!AUTH_CONFIGURED) return false;
  try {
    const url = new URL(SUPABASE_URL);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !SUPABASE_URL.includes('your-project-ref');
  } catch {
    return false;
  }
}

/**
 * The URL Supabase sends the browser back to after email links, password
 * recovery and OAuth. It deliberately has no hash fragment: Supabase appends
 * its own tokens, and the app consumes them before the hash router runs.
 *
 * next      in-app path to open after the session is established
 * options   { recovery: true } for password reset, { verified: true } after email confirmation
 */
export function buildAuthRedirect(next = '/account', options = {}) {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('next', next);
  if (options.recovery) url.searchParams.set('recovery', '1');
  if (options.verified) url.searchParams.set('verified', '1');
  return url.toString();
}
