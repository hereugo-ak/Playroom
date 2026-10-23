// Playroom Atelier — demo tracking timeline (handoff §8.6).
// Model: the FULL planned timeline is generated deterministically at lookup time
// from the order snapshot, with the first event marked complete and later events
// labelled "Simulated next step". No randomness, no courier claims, no GPS.

// Hours after placement for each subsequent demo event.
const OFFSETS_H = { processing: 4, packed: 22, shipped: 40, out_for_delivery: 62, delivered: 88 };

function eventAt(order, index) {
  const placed = new Date(order.createdAt);
  const t = new Date(placed.getTime() + OFFSETS_H.delivered * 0); // placeholder, replaced below
  return t;
}

const STAGES = [
  {
    status: 'order_placed',
    title: 'Order received',
    desc: (o) => `We’ve recorded your demo checkout for ${o.customer.firstName} ${o.customer.lastName}. No payment has been taken.`,
  },
  {
    status: 'processing',
    title: 'Preparing your parcel (simulated)',
    desc: () => 'Simulated status only — nothing is being packed. A real store would confirm this through its fulfilment system.',
  },
  {
    status: 'packed',
    title: 'Packed and ready (simulated)',
    desc: (o) => `Imagined handover hub near ${o.customer.city}. Simulated for this demo.`,
  },
  {
    status: 'shipped',
    title: 'On its way (simulated)',
    desc: (o) => `Moving toward ${o.customer.city} ${o.customer.pincode} — in this prototype only. No live courier is connected.`,
  },
  {
    status: 'out_for_delivery',
    title: 'Out for delivery (simulated)',
    desc: (o) => `Estimated arrival at ${o.customer.addressLine1}, ${o.customer.city}. (Simulated estimate, not a carrier promise.)`,
  },
  {
    status: 'delivered',
    title: 'Delivered (simulated)',
    desc: (o) => `Demo journey complete for ${o.customer.firstName}. Nothing has physically shipped.`,
  },
];

export function timelineFor(order) {
  const placed = new Date(order.createdAt);
  const fmt = (d) => d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return STAGES.map((stage, i) => {
    if (i === 0) {
      return {
        status: stage.status, title: stage.title, description: stage.desc(order),
        timestampLabel: fmt(placed), locationLabel: 'Playroom demo store', complete: true,
      };
    }
    const at = new Date(placed.getTime() + OFFSETS_H[stage.status] * 3600 * 1000);
    return {
      status: stage.status, title: stage.title, description: stage.desc(order),
      timestampLabel: `Expected ${fmt(at)}`, locationLabel: 'Simulated route',
      complete: false,
    };
  });
}

export { STAGES as TRACKING_STAGES };
