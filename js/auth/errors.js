// Human-readable authentication errors.
// Raw Supabase messages are useful but inconsistent in tone; the storefront
// speaks in its own voice and never echoes anything sensitive.

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

export function friendlyAuthError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const message = String(error.message || error.error_description || error || '').trim();
  const code = String(error.code || error.status || '').toLowerCase();

  if (NETWORK.test(message)) {
    return "We couldn't reach Playroom's servers. Check your connection and try again.";
  }
  if (/invalid login credentials|invalid_credentials/i.test(message + code)) {
    return "That email and password don't match. Try again, or reset your password.";
  }
  if (/email not confirmed|email_not_confirmed/i.test(message + code)) {
    return 'Please verify your email address first — we can send you a fresh confirmation link.';
  }
  if (/user already registered|user_already_exists|email_exists/i.test(message + code)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/password should be at least|weak_password/i.test(message + code)) {
    return 'Please choose a password with at least 8 characters.';
  }
  if (/should be different from the old password|same_password/i.test(message + code)) {
    return 'Please choose a password you have not used before.';
  }
  if (/for security purposes, you can only request this after (\d+) seconds?/i.test(message)) {
    const seconds = message.match(/after (\d+) seconds?/i)?.[1];
    return `Please wait ${seconds} seconds before trying again.`;
  }
  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message + code)) {
    return 'Too many emails have been requested. Please wait a few minutes and try again.';
  }
  if (/auth session missing|session_not_found|session expired|jwt expired|invalid refresh token/i.test(message + code)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/invalid_grant|otp expired|token has expired|link.*expired|expired.*link/i.test(message + code)) {
    return 'That link has expired or has already been used. Please request a new one.';
  }
  if (/user not found/i.test(message)) {
    return 'We could not find an account for that email.';
  }
  if (/signups not allowed/i.test(message)) {
    return 'New sign-ups are currently disabled for this project.';
  }
  if (/provider is not enabled|unsupported provider|provider_not_enabled/i.test(message + code)) {
    return 'Google sign-in is not switched on for this store yet. Please use email and password.';
  }
  if (/database error saving new user|profiles.*(does not exist|schema)/i.test(message)) {
    return 'Your account was created, but the customer profile could not be set up. Please contact Playroom care.';
  }
  if (/rate limit|too many requests/i.test(message + code)) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Database / PostgREST errors. These are readable to a developer but raw
  // Postgres wording ("new row violates row-level security policy…") should
  // never reach a customer.
  if (/permission denied|row-level security|insufficient privilege/i.test(message + code)) {
    return 'You do not have permission to do that.';
  }
  if (/duplicate key|unique constraint/i.test(message + code)) {
    return 'That is already saved to your account.';
  }
  if (/relation .* does not exist|column .* does not exist|schema cache|PGRST\d+/i.test(message + code)) {
    return 'The account database is not set up yet. Run the Playroom migration described in docs/AUTH_SETUP.md.';
  }
  if (/violates (foreign key|not-null|check constraint)|invalid input syntax|json object requested/i.test(message)) {
    return fallback;
  }

  // Supabase's own wording is safe to show for the remaining validation cases.
  return message || fallback;
}

export function authUrlErrorMessage(query) {
  const error = query.get('error') || '';
  const description = query.get('error_description') || '';
  if (/access_denied/i.test(error + description)) {
    return 'Google sign-in was cancelled. Nothing was changed.';
  }
  if (/server_error|temporarily_unavailable/i.test(error + description)) {
    return 'Google sign-in is temporarily unavailable. Please try again in a moment.';
  }
  return description || 'That sign-in link is no longer valid. Please try again.';
}
