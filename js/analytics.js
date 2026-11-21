// Low-level analytics beacon. Fire-and-forget; never blocks the interface.
import { getAccessToken } from './auth/auth-store.js';

let sessionId = '';
let anonId = '';

export function initAnalytics() {
  try {
    sessionId = sessionStorage.getItem('pl-analytics-session') || '';
    if (!sessionId) {
      sessionId = (globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
      sessionStorage.setItem('pl-analytics-session', sessionId);
    }
    anonId = localStorage.getItem('pl-analytics-anon') || '';
    if (!anonId) {
      anonId = (globalThis.crypto?.randomUUID?.() || `a-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
      localStorage.setItem('pl-analytics-anon', anonId);
    }
  } catch {
    sessionId = sessionId || `s-${Date.now()}`;
    anonId = anonId || `a-${Date.now()}`;
  }
}

function eventId() {
  return (globalThis.crypto?.randomUUID?.() || `e-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
}

export async function trackEvent(eventName, properties = {}) {
  try {
    if (!sessionId) initAnalytics();
    let token = '';
    try { token = await getAccessToken(); } catch { /* guest event */ }

    const payload = {
      eventId: eventId(),
      sessionId,
      anonId,
      eventName,
      pagePath: properties.pagePath || (window.location.hash ? window.location.hash.slice(1) : '/'),
      referrer: document.referrer || '',
      productId: properties.productId || '',
      orderId: properties.orderId || '',
      planCode: properties.planCode || '',
      value: properties.value,
      properties: { ...properties, pagePath: undefined, productId: undefined, orderId: undefined, planCode: undefined, value: undefined },
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      country: 'India',
    };

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the storefront.
  }
}

export function trackClick(name) {
  return (event) => trackEvent(name, { label: event?.currentTarget?.textContent || '' });
}
