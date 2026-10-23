// Playroom Atelier — delivery promise.
// The logic behind the live urgency line and the checkout delivery options:
// a 3pm dispatch cutoff, business-day estimates, and the chosen option kept
// in sessionStorage so cart → checkout → order snapshot agree on one story.
// DOM-free so every page can use it.

export const CUTOFF_HOUR = 15; // 3pm local — "order within…" cutoff
export const DELIVERY_FEE_EXPRESS = 149;
export const DELIVERY_FEE_PICKDAY = 99;

const isWeekday = (d) => d.getDay() !== 0; // Sunday closed
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/* The next moment an order received "now" would make the daily dispatch run. */
export function nextDispatch(now = new Date()) {
  const d = new Date(now);
  const beforeCutoff = d.getHours() < CUTOFF_HOUR;
  if (isWeekday(d) && beforeCutoff) return startOfDay(d);
  const next = startOfDay(d);
  do { next.setDate(next.getDate() + 1); } while (!isWeekday(next));
  return next;
}

export function addBusinessDays(date, n) {
  const d = new Date(date);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isWeekday(d)) left--;
  }
  return d;
}

/* Countdown until the deadline that matters for today's promise. */
export function msToCutoff(now = new Date()) {
  const d = new Date(now);
  const target = new Date(now);
  if (isWeekday(d) && d.getHours() < CUTOFF_HOUR) {
    target.setHours(CUTOFF_HOUR, 0, 0, 0);
  } else {
    const next = startOfDay(d);
    do { next.setDate(next.getDate() + 1); } while (!isWeekday(next));
    next.setHours(CUTOFF_HOUR, 0, 0, 0);
    return next - d;
  }
  return target - d;
}

export function fmtCountdown(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function standardDate(now = new Date()) {
  return addBusinessDays(nextDispatch(now), 2);
}
export function expressDate(now = new Date()) {
  return addBusinessDays(nextDispatch(now), 1);
}

export function fmtDay(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fmtLongDay(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ISO date string (yyyy-mm-dd) in local time — for the pick-a-day select. */
export function isoDay(d) {
  const x = new Date(d);
  return [x.getFullYear(), String(x.getMonth() + 1).padStart(2, '0'), String(x.getDate()).padStart(2, '0')].join('-');
}
export function fromIsoDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/* Selectable dates for "pick a day": from +3 days out to +14, weekdays only. */
export function pickableDays(now = new Date(), count = 6) {
  const out = [];
  const d = startOfDay(now);
  let offset = 3;
  while (out.length < count && offset < 21) {
    const c = new Date(d); c.setDate(c.getDate() + offset);
    if (isWeekday(c) || out.length < 1) out.push(new Date(c));
    offset++;
  }
  return out;
}

/* The promise line: "Order within 4h 20m for delivery by Fri, 24 Oct". */
export function promiseLine(now = new Date()) {
  const ms = msToCutoff(now);
  return { within: fmtCountdown(ms), date: fmtDay(standardDate(now)), ms };
}

/* ---------------------------------------------------------- options ------- */
export const DELIVERY_STORAGE = 'pl-delivery';

export function deliveryOptions(subtotal, now = new Date()) {
  const std = standardDate(now);
  const exp = expressDate(now);
  const standardFee = subtotal >= 1499 || subtotal === 0 ? 0 : 99;
  return [
    {
      id: 'standard', label: 'Standard', desc: 'Arrives in 2–4 business days',
      date: isoDay(std), dateLabel: fmtDay(std), fee: standardFee,
    },
    {
      id: 'express', label: 'Express', desc: 'Next business day, priority packing',
      date: isoDay(exp), dateLabel: fmtDay(exp), fee: DELIVERY_FEE_EXPRESS,
    },
    {
      id: 'pickday', label: 'Pick a day', desc: 'Choose a weekday that suits you',
      date: null, dateLabel: '', fee: DELIVERY_FEE_PICKDAY, pickable: true,
    },
  ];
}

export function chosenDelivery() {
  try {
    const raw = sessionStorage.getItem(DELIVERY_STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setChosenDelivery(opt) {
  try {
    if (opt) sessionStorage.setItem(DELIVERY_STORAGE, JSON.stringify(opt));
    else sessionStorage.removeItem(DELIVERY_STORAGE);
  } catch {}
}

/* The fee this checkout should charge: the chosen option when set, else the
   classic threshold-based fee (kept for backward compatibility). */
export function effectiveDeliveryFee(subtotal) {
  const chosen = chosenDelivery();
  if (chosen) {
    // prefer the live fee for this option id, so a cart change near the
    // free-delivery threshold can never leave a stale charge on the order
    const live = deliveryOptions(subtotal).find((o) => o.id === chosen.id);
    if (live) return live.fee;
    if (Number.isFinite(chosen.fee)) return chosen.fee;
  }
  return subtotal >= 1499 || subtotal === 0 ? 0 : 99;
}
