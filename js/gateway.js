// Playroom Atelier — demo payment gateway ("Stripe-like") + logistics ("FedEx-like").
// These are UI/model mocks only: no network calls, no charges. Card data is
// generated randomly and validated by pattern, exactly like a test-mode gateway.

// ------------------------------------------------------------ payments ----
export const PAYMENT_METHODS = [
  { id: 'card', label: 'Card', sub: 'Visa · Mastercard · RuPay · Amex', icon: '▮▮', testHint: 'Demo card auto-fills' },
  { id: 'upi', label: 'UPI', sub: 'Any UPI app (GPay, PhonePe, Paytm)', icon: '⚡', testHint: 'Demo VPA auto-fills' },
  { id: 'netbanking', label: 'Net banking', sub: '58 banks supported', icon: '🏦', testHint: 'Demo bank auto-fills' },
  { id: 'crypto', label: 'Crypto', sub: 'BTC · ETH · USDT (test)', icon: '◈', testHint: 'Demo wallet auto-fills' },
];

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const digits = (n) => Array.from({ length: n }, () => rand(10)).join('');

export function generatePayer() {
  const first = pick(['Ayesha','Rohan','Meera','Kabir','Ananya','Ishan','Aditi','Vikram','Zoya','Dev']);
  const last = pick(['Sharma','Iyer','Khan','Patel','Mehta','Reddy','Bose','Kulkarni','Rana','Nair']);
  const cities = [
    ['Pune','411001','Maharashtra'],['Bengaluru','560001','Karnataka'],['Mumbai','400001','Maharashtra'],
    ['Delhi','110001','Delhi'],['Hyderabad','500001','Telangana'],['Chennai','600001','Tamil Nadu'],
    ['Kolkata','700001','West Bengal'],['Jaipur','302001','Rajasthan'],['Kochi','682001','Kerala'],
  ];
  const [city, pin, stateName] = pick(cities);
  return {
    firstName: first, lastName: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `${pick(['7','8','9'])}${digits(9)}`,
    address: `${rand(120) + 1} ${pick(['Rose','Marigold','Cedar','Maple','Lotus'])} ${pick(['Villa','Enclave','Residency'])}, ${pick(['Lane 3','Road 7','Street 12'])}`,
    city, pincode: pin, stateName,
    note: pick(['Leave at the door.', 'Ring the bell twice.', 'Call before delivery.', '']),
  };
}

export function generatePayment(method) {
  if (method === 'card') {
    // Luhn-valid-looking test numbers per network
    const nets = [
      { net: 'visa', bin: '4242' }, { net: 'mastercard', bin: '5555' },
      { net: 'rupay', bin: '6076' }, { net: 'amex', bin: '3782' },
    ];
    const n = pick(nets);
    return {
      // Amex is 15 digits and groups 4-6-5 in the field; the rest are 16.
      cardNumber: n.net === 'amex'
        ? `${n.bin} ${digits(6)} ${digits(5)}`
        : `${n.bin} ${digits(4)} ${digits(4)} ${digits(4)}`,
      expiry: `${String(rand(12) + 1).padStart(2, '0')}/${rand(3) + 27}`,  // 27–29 so validator always accepts
      cvc: digits(3),
      nameOnCard: 'AUTO · TEST MODE',
    };
  }
  if (method === 'upi') return { upiId: `${pick(['player','buyer','shopper','friend'])}${digits(4)}@${pick(['okaxis','ybl','paytm','okhdfcbank'])}` };
  if (method === 'netbanking') {
    const banks = ['HDFC Bank','ICICI Bank','State Bank of India','Axis Bank','Kotak Mahindra','Punjab National Bank'];
    return { bank: pick(banks) };
  }
  // crypto
  return {
    wallet: `${pick(['bc1q','0x','T'])}${digits(6)}${pick(['aF','b9','cD'])}${digits(8)}…`,
    coin: pick(['BTC', 'ETH', 'USDT']),
  };
}

export function validatePayment(method, d) {
  const e = {};
  if (method === 'card') {
    const card = (d.cardNumber || '').trim();
    const standard = /^(?:[0-9]{4} ){3}[0-9]{4}$/.test(card);
    const amex = /^[0-9]{4} [0-9]{6} [0-9]{5}$/.test(card);
    if (!standard && !amex) e.cardNumber = 'Use a 16-digit test card (or 15-digit Amex).';
    // the field displays "MM / YY" (Stripe-style) — validate the digits only
    if (!/^(0[1-9]|1[0-2])\/2[7-9]$/.test((d.expiry || '').replace(/\s+/g, '').trim())) e.expiry = 'Use MM / YY with a future year.';
    if (!/^[0-9]{3}$/.test((d.cvc || '').trim())) e.cvc = '3 digits.';
  }
  if (method === 'upi' && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test((d.upiId || '').trim())) e.upiId = 'Format: name@bank (auto-fill available).';
  if (method === 'netbanking' && !d.bank) e.bank = 'Choose a bank.';
  if (method === 'crypto' && (d.wallet || '').trim().length < 8) e.wallet = 'Wallet address looks too short.';
  return e;
}

// A gateway transaction id (PI-like)
export const gatewayTxnId = () => `pi_demo_${digits(10).replace(/^0+/, '3') || '3'}`;

// Stripe Elements-style helpers: live formatting + brand detect.
export function cardBrand(number = '') {
  const d = String(number).replace(/\D/g, '');
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(60|65|81|82|508|607|608)/.test(d)) return 'rupay';
  if (/^35/.test(d)) return 'rupay';
  return 'unknown';
}
export const CARD_BRAND_LABEL = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', rupay: 'RuPay', unknown: 'Card' };
export function formatCardNumber(raw = '') {
  const d = String(raw).replace(/\D/g, '').slice(0, 16);
  const brand = cardBrand(d);
  // Amex 4-6-5 grouping, everything else 4-4-4-4
  if (brand === 'amex') {
    const p = [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean);
    return p.join(' ');
  }
  return (d.match(/.{1,4}/g) || []).join(' ');
}
export function formatExpiry(raw = '') {
  const d = String(raw).replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)} / ${d.slice(2)}`; // Stripe Elements style: "12 / 29"
}

// ------------------------------------------------------------ logistics ----
export const CARRIER = {
  name: 'FedEx',
  product: 'FedEx Priority Overnight™ (demo)',
  trackingUrlBase: 'https://www.fedex.com/fedextrack/?trknbr=',  // opens their real tracker (no data)
};

export function fedexTrackingNumber() {
  // FedEx Express format: 12 digits (real services use 12/15). Demo → random.
  return digits(12);
}

// Service metadata for the package card
export function packageMeta(lines, total) {
  const weightKg = +(lines.reduce((s, l) => s + l.qty * pick([0.3, 0.45, 0.6, 0.8]), 0.2)).toFixed(2);
  return {
    service: 'PRIORITY OVERNIGHT',
    weight: `${weightKg} kg`,
    dims: `${18 + rand(8)} × ${12 + rand(6)} × ${8 + rand(6)} cm`,
    pieces: 1,
    reference: `PL-${digits(6)}`,
    billedWeight: `${weightKg} kg`,
    packaging: 'PLAYROOM SECURE BOX',
  };
}

// FedEx-like event stream. Deterministic timeline from the order's createdAt.
const H = 3600e3;
export function fedexTimeline(order) {
  const t0 = new Date(order.createdAt).getTime();
  const mk = (offset, code, desc, loc, status = 'pending') => ({
    at: new Date(t0 + offset).toISOString(),
    label: new Date(t0 + offset).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    code, desc, location: loc, status,
  });
  const dest = `${order.customer.city} ${order.customer.pincode}`;
  const events = [
    mk(0, 'Shipment information sent to FedEx', 'Order received · label created', 'PLAYROOM ATELIER, IN', 'done'),
    mk(2 * H, 'Picked up', 'Package picked up from sender', 'PLAYROOM ATELIER, IN', 'done'),
    mk(10 * H, 'Arrived at FedEx location', 'Scan at origin facility', 'MUMBAI HUB, IN', 'pending'),
    mk(20 * H, 'Departed FedEx location', 'In transit', 'MUMBAI HUB, IN', 'pending'),
    mk(30 * H, 'Arrived at FedEx hub', 'Line-haul scan', 'DELHI GATEWAY, IN', 'pending'),
    mk(40 * H, 'In transit', 'On FedEx vehicle for delivery', dest, 'pending'),
    mk(46 * H, 'Delivered', 'Delivered · left at reception (demo)', dest, 'pending'),
  ];
  return events;
}
export const fedexLatest = (order) => {
  const ev = fedexTimeline(order);
  return ev.find((e) => e.status === 'pending') || ev[ev.length - 1];
};

// ---------------------------------------------------------------- status ----
// The five milestones the real tracker shows (Label created → We have your
// package → On the way → Out for delivery → Delivered), and which scan event
// belongs to each.
export const STATION_OF = [0, 1, 2, 2, 2, 3, 4];
export const STATIONS = ["Label created", 'We have your package', 'On the way', 'Out for delivery', 'Delivered'];

// Derive the live demo status for an order. Demo rule kept from v1: the label
// and pickup scans are always shown as complete so a freshly-placed order has
// a living timeline; every later scan lights up once its offset has passed.
export function fedexStatus(order) {
  const events = fedexTimeline(order);
  const now = Date.now();
  const done = events.map((e, i) => i < 2 || new Date(e.at).getTime() <= now);
  const doneN = done.filter(Boolean).length;
  const all = doneN === events.length;
  const latestIdx = Math.max(0, doneN - 1);
  const pendingIdx = done.findIndex((d) => !d);
  const currentStation = pendingIdx === -1 ? 4 : STATION_OF[pendingIdx];
  const stationReached = events.reduce((m, e, i) => (done[i] ? Math.max(m, STATION_OF[i]) : m), 0);

  const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const last = events[events.length - 1];
  const big = all ? 'Delivered'
    : doneN >= 6 ? 'Out for delivery'
    : doneN >= 3 ? 'On the way'
    : doneN >= 2 ? 'We have your package'
    : 'Label created';
  const sub = all
    ? `Delivered ${fmtDay(last.at)} at ${fmtTime(last.at)} · left at reception (demo)`
    : `Estimated delivery ${fmtDay(last.at)} by 8:00 pm`;

  const firstOf = [0, 1, 2, 5, 6]; // first scan event of each station
  const lastOf = [0, 1, 4, 5, 6];  // last scan event of each station
  const stations = STATIONS.map((label, s) => {
    const isDone = done[lastOf[s]];
    const at = events[firstOf[s]].at;
    return {
      label, at, date: fmtDay(at), time: fmtTime(at),
      state: isDone ? 'done' : s === currentStation ? 'current' : 'todo',
    };
  });

  return {
    events, done, doneN, all, latestIdx,
    latest: events[latestIdx],
    big, sub,
    pct: Math.round(stationReached / (STATIONS.length - 1) * 100),
    stations, currentStation,
  };
}
