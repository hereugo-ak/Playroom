// Playroom Atelier — premium content pools.
// Copy, structure and “editorial” layers for the depth features: age stages,
// play-stage guidance, materials & safety, spare parts, reviews, Q&A, press
// wall and the (clearly-labelled) advisory board. Pure data + tiny helpers —
// no DOM, no imports, so both data.js and app.js can use it.

export const ADVISORY_NOTE =
  'Developmental notes are reviewed with our early-years advisory — an illustrative panel for this concept store.';

export const ADVISORS = [
  {
    name: 'Dr. Meera Iyer', role: 'Early-years development specialist', initials: 'MI', tone: '#a56a76',
    line: 'What looks like play is the brain building its first theories about how the world works.',
  },
  {
    name: 'Anand Rao', role: 'Montessori guide & play consultant', initials: 'AR', tone: '#6f8a6a',
    line: 'A good toy waits. It lets the child set the pace, then quietly raises the ceiling.',
  },
  {
    name: 'Dr. Kavita Menon', role: 'Paediatric occupational therapist', initials: 'KM', tone: '#7d6a9a',
    line: 'Small hands build big skills — grip, aim, patience — one satisfying click at a time.',
  },
];

// ---------------------------------------------------------------- stages --
export const AGE_STAGES = [
  {
    id: 'first-discoveries', label: '0–2 years', name: 'First discoveries',
    kicker: 'STAGE ONE · THE SENSORY YEARS',
    headline: 'The world, one <em>texture</em> at a time.',
    intro: 'Everything is new: weight, sound, softness, taste. This is the age of reaching, holding and dropping — and the beginning of cause and effect.',
    img: 28, tone: '#ead4cb',
    skills: [
      { title: 'Sensory play', body: 'Textures, contrast and gentle sound build the first pathways.' },
      { title: 'Cause & effect', body: 'Push, rattle, drop — the first experiments with “what happens if…”.' },
      { title: 'Early words', body: 'Naming, singing and back-and-forth babble grow language.' },
    ],
    journal: 'choosing-a-toy',
  },
  {
    id: 'big-imaginations', label: '3–5 years', name: 'Big imaginations',
    kicker: 'STAGE TWO · THE STORY YEARS',
    headline: 'Whole worlds, <em>made up</em> on the spot.',
    intro: 'A box becomes a bus, a block becomes a birthday cake. Pretend play arrives at full volume, and small hands are suddenly ready for detail.',
    img: 18, tone: '#e7d7c5',
    skills: [
      { title: 'Pretend play', body: 'Role, story and negotiation — the original social network.' },
      { title: 'Fine motor', body: 'Drawing, threading, placing — control is arriving in the fingers.' },
      { title: 'Emotional literacy', body: 'Acting out big feelings through small characters.' },
    ],
    journal: 'screen-free-afternoons',
  },
  {
    id: 'build-and-question', label: '6–8 years', name: 'Build & question',
    kicker: 'STAGE THREE · THE MAKER YEARS',
    headline: 'Test the theory. <em>Then test it again.</em>',
    intro: 'Rules are interesting now — especially bending them. Marble runs get engineered, games get taken seriously, and “why?” becomes a full-time job.',
    img: 1, tone: '#dbe6d5',
    skills: [
      { title: 'Planning', body: 'Designing before building — and rebuilding without drama.' },
      { title: 'Logic & rules', body: 'Strategy, turn-taking and losing gracefully (eventually).' },
      { title: 'Persistence', body: 'The tower falls; the builder returns. That loop is the lesson.' },
    ],
    journal: 'choosing-a-toy',
  },
  {
    id: 'independent-minds', label: '9–12 years', name: 'Independent minds',
    kicker: 'STAGE FOUR · THE WORKSHOP YEARS',
    headline: 'Mastery, on <em>their own terms.</em>',
    intro: 'Children this age want real stakes: a kit that genuinely works, a game with depth, a project that survives to the shelf. Play becomes craft.',
    img: 26, tone: '#d5e2e8',
    skills: [
      { title: 'Deep focus', body: 'Long builds, finished games, real concentration.' },
      { title: 'Systems thinking', body: 'Circuits, codes, mechanics — how parts make a whole.' },
      { title: 'Ownership', body: 'Projects that are theirs, start to finish.' },
    ],
    journal: 'gifting-by-age',
  },
];

export function parseMinAge(age) {
  const s = String(age || '').toLowerCase();
  if (/18\s*\+?\s*months/.test(s)) return 1.5;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 3;
}

export function stageForAge(age) {
  const a = parseMinAge(age);
  if (a < 3) return AGE_STAGES[0];
  if (a < 6) return AGE_STAGES[1];
  if (a < 9) return AGE_STAGES[2];
  return AGE_STAGES[3];
}

export function stageById(id) {
  return AGE_STAGES.find((s) => s.id === id) || null;
}

export const stageCatalogHref = (s) => `#/catalog?stage=${s.id}`;

// ---------------------------------------------------------------- skills --
export const SKILLS_BY_CATEGORY = {
  'Building & STEM': ['Spatial reasoning', 'Planning & persistence', 'Cause & effect'],
  'Games & Puzzles': ['Logic & strategy', 'Turn-taking', 'Emotional regulation'],
  'Soft & Plush': ['Comfort & security', 'Nurturing play', 'Early language'],
  'Vehicles & Adventures': ['Storytelling', 'Gross motor', 'Sequencing'],
  'Art & Imagination': ['Fine motor', 'Self-expression', 'Focus'],
  'Baby & Early Years': ['Sensory play', 'Cause & effect', 'First words'],
  'Pretend & Role Play': ['Empathy', 'Negotiation', 'Story-building'],
  'Outdoor & Active': ['Balance & coordination', 'Risk assessment', 'Fresh-air stamina'],
  'Science & Discovery': ['Curiosity', 'Observation', 'Test & repeat'],
  'Music & Movement': ['Rhythm & timing', 'Listening', 'Confidence'],
};

// --------------------------------------------------------- play guidance --
// {name} is replaced with the product name at render time.
export const PLAY_STAGES_BY_CATEGORY = {
  'Building & STEM': {
    first: { t: 'First play · figure it out', b: 'Leave {name} on the floor with no instructions. Watch which piece gets picked first — that is the real starting point.' },
    next: { t: 'A little harder · constraints', b: 'Ask for a build that can survive a table tap, or one that uses exactly nine pieces. Constraints are where the ideas get interesting.' },
    together: { t: 'Play together · collaborative build', b: 'Each builder adds one piece and narrates why. The story and the structure usually grow at the same speed.' },
  },
  'Games & Puzzles': {
    first: { t: 'First play · corner to centre', b: 'Start from the corners and the picture builds itself. For young puzzlers, sort a few friendly pieces out first.' },
    next: { t: 'A little harder · silent round', b: 'One full round without speaking — pointing and eyebrows only. It sounds easy. It is not.' },
    together: { t: 'Play together · team time', b: 'Two players, one side of the table each. Swap seats when the time runs out and compare strategies.' },
  },
  'Soft & Plush': {
    first: { t: 'First play · introductions', b: 'Let the child name {name} and decide where it sleeps. Ownership comes before play.' },
    next: { t: 'A little harder · little responsibilities', b: 'Give the friend a daily job — guarding the bed, riding in the bag, keeping secrets at dinner.' },
    together: { t: 'Play together · comfort rituals', b: 'Bring the friend into bedtime stories and long car rides. Familiarity is the whole point.' },
  },
  'Vehicles & Adventures': {
    first: { t: 'First play · the open road', b: 'Clear a runway across the living room and let {name} find its route. Sofas are mountains.' },
    next: { t: 'A little harder · route rules', b: 'Add a delivery mission, a speed limit or a hairpin tunnel. Simple rules double the play.' },
    together: { t: 'Play together · the pit crew', b: 'One driver, one mechanic, one commentator. Roles rotate when someone calls “driver change!”.' },
  },
  'Art & Imagination': {
    first: { t: 'First play · no wrong marks', b: 'Open {name}, make one mark, then hand it over. The first mark is the hardest; after that the page belongs to them.' },
    next: { t: 'A little harder · one-colour challenge', b: 'Make a whole picture in a single colour. Limits are quietly excellent for imagination.' },
    together: { t: 'Play together · shared picture', b: 'Everyone draws on the same page, taking turns adding one thing. Sign it at the end, like proper artists.' },
  },
  'Baby & Early Years': {
    first: { t: 'First play · face to face', b: 'Hold {name} between you and show it slowly. Distance of 20–30 cm is where babies see best.' },
    next: { t: 'A little harder · reach & hold', b: 'Move it just out of reach and wait. The first deliberate grab is a milestone worth cheering.' },
    together: { t: 'Play together · call and answer', b: 'Make a sound, pause, let them answer. That early back-and-forth is how conversation starts.' },
  },
  'Pretend & Role Play': {
    first: { t: 'First play · who are we today?', b: 'Ask who {name} is and what they do. The first answer sets the whole world up.' },
    next: { t: 'A little harder · a problem appears', b: 'Introduce a small crisis — the shop has no bread, the doctor has lost the keys. Watch the negotiation begin.' },
    together: { t: 'Play together · guest star', b: 'You play a customer, patient or passenger. Let the child run the scene — and the rules.' },
  },
  'Outdoor & Active': {
    first: { t: 'First play · garden rules', b: 'Set one boundary (“the ball stays this side of the fence”) and {name} handles the rest.' },
    next: { t: 'A little harder · targets & times', b: 'Add a target, a stopwatch or a course. Measurable play keeps going long after “just playing” stops.' },
    together: { t: 'Play together · family tournament', b: 'Everyone plays, everyone keeps score badly. The unreliable scorekeeping is part of the fun.' },
  },
  'Science & Discovery': {
    first: { t: 'First play · wonder out loud', b: 'Ask what they think will happen with {name} — write the guess down. Guessing is science.' },
    next: { t: 'A little harder · change one thing', b: 'Repeat the experiment but change exactly one variable. Then argue about the result. That is the whole job.' },
    together: { t: 'Play together · demonstration day', b: 'The child runs the experiment; you are the audience. Applause is mandatory.' },
  },
  'Music & Movement': {
    first: { t: 'First play · copy my sound', b: 'Tap a simple pattern on {name} and let them echo it back. Then swap — and try to keep up.' },
    next: { t: 'A little harder · rhythm games', b: 'Clap a rhythm from across the room and have them play it back. Three rounds, best of five.' },
    together: { t: 'Play together · living-room band', b: 'Everyone grabs an instrument, a wooden spoon counts, and the last song of the night is the loud one.' },
  },
};

// ------------------------------------------------ materials & safety -----
// Keyed by the seed photo-pool key (data.js keeps it as `photoKey`).
export const MATERIALS_BY_KIND = {
  blocks: { made: 'Plant-based polymer and sealed magnetic parts; beechwood in wooden sets', finish: 'Water-based, saliva-safe paint (design intent)', care: 'Wipe with a damp cloth; air-dry flat' },
  wood: { made: 'FSC-style certified beechwood and rubberwood', finish: 'Beeswax and plant-oil finish, hand-rubbed', care: 'Damp wipe; re-oil lightly once a year' },
  robot: { made: 'Recycled ABS-style housing, low-voltage components', finish: 'Matte, chip-resistant coating', care: 'Wipe clean; keep away from water' },
  science: { made: 'Recycled board, child-safe plastics, mini solar cell', finish: 'Non-toxic inks and coatings', care: 'Store dry; wipe parts with a soft cloth' },
  puzzle: { made: 'Thick recycled greyboard, soy-based inks', finish: 'Linen-texture, smudge-resistant print', care: 'Keep flat and dry; rebuild often' },
  board: { made: 'Recycled greyboard, soy-based inks', finish: 'Matte laminate, rounded corners', care: 'Wipe with a dry cloth' },
  plush: { made: 'Organic-cotton outer, recycled polyfill, safety-stitched features', finish: 'Azo-free dyes', care: 'Machine wash 30°, air-dry (a spin cycle is fine)' },
  cars: { made: 'Beechwood bodies, plant-based wheels, metal-free axles', finish: 'Water-based paint, rounded edges', care: 'Damp wipe; check wheels monthly' },
  train: { made: 'Solid beechwood, sealed magnets in couplings', finish: 'Water-based, saliva-safe paint', care: 'Wipe clean; keep magnets away from cards' },
  craft: { made: 'Recycled paper stock, cotton threads, FSC-style wooden tools', finish: 'Azo-free pigments', care: 'Store dry; smocks advised' },
  baby: { made: 'Food-grade silicone, organic cotton, beechwood', finish: 'Untreated or food-safe oiled surfaces', care: 'Sterilise silicone parts; hand-wash wood' },
  music: { made: 'Certified tonewoods and recycled metals', finish: 'Natural oils; no lacquer on chime bars', care: 'Tune-friendly: keep dry, play loudly' },
  doll: { made: 'Cotton and wool fabrics, recycled stuffing, wire-free construction', finish: 'Azo-free dyes, embroidered features', care: 'Surface wash or gentle hand-wash' },
  outdoor: { made: 'UV-stable recycled plastics, hardwood handles', finish: 'Weather-tested, fade-resistant coatings', care: 'Rinse after beach days' },
  garden: { made: 'Bamboo, cotton canvas, recycled metal tools', finish: 'Plant-oil treatment', care: 'Wipe tools after soil contact' },
  book: { made: 'FSC-style board pages, soy-based inks', finish: 'Rounded corners, chewy-safe board', care: 'Wipe with a dry cloth' },
};

export const SAFETY_NOTE_SMALL_PARTS =
  'Contains small parts — not suitable for children under 3 years. Every set ships with the age guidance printed on the box.';

export const DESIGN_STANDARDS = [
  { mark: 'CE', label: 'EU toy safety', note: 'Designed to the essential requirements of the EU Toy Safety Directive.' },
  { mark: 'EN 71', label: 'Materials migration', note: 'Paints and materials chosen to meet EN 71-3 migration limits.' },
  { mark: 'ASTM F963', label: 'US toy standard', note: 'Mechanical and physical tests modelled on ASTM F963.' },
  { mark: 'FSC®-style', label: 'Wood sourcing', note: 'Wooden ranges specify certified-grove timber in this concept.' },
  { mark: 'Azo-free', label: 'Textiles & dyes', note: 'No azo colourants in any textile piece we list.' },
  { mark: 'Saliva-safe', label: 'Coatings', note: 'Water-based finishes on everything a mouth might find.' },
];

export const SAFETY_DEMO_NOTE =
  'Playroom is a concept storefront. These standards describe the design intent of the demo catalogue — no real certification body has tested these simulated products.';

// ----------------------------------------------------------- spare parts --
export const SPARE_PARTS_BY_KIND = {
  blocks: ['A spare tile or track piece', 'Replacement marbles', 'Connector pins & clips'],
  wood: ['A replacement block', 'A single wheel or dowel', 'A spare storage sack'],
  robot: ['A replacement battery hatch', 'A spare wheel set', 'Sticker & decal sheet'],
  science: ['A spare propeller or panel', 'Replacement connectors', 'A printed experiment card'],
  puzzle: ['A missing puzzle piece', 'A spare piece bag', 'A replacement poster insert'],
  board: ['Missing counters or dice', 'A replacement rulebook', 'A spare score pad'],
  plush: ['A stitch-repair kit', 'A replacement ribbon or charm', 'A new baby-safe embroidered patch'],
  cars: ['A replacement wheel', 'A spare driver figure', 'A touch-up beeswax stick'],
  train: ['A replacement coupling magnet', 'A spare carriage', 'A bridge or rail piece'],
  craft: ['Replacement thread colours', 'A spare wooden tool', 'A new sheet pack'],
  baby: ['A spare silicone ring', 'A replacement teether', 'A pram-clip strap'],
  music: ['A replacement mallet or beater', 'A spare chime bar', 'A drum strap'],
  doll: ['A spare outfit', 'Replacement embroidered features', 'A new carry ribbon'],
  outdoor: ['A replacement handle grip', 'A spare ball or shuttle', 'A catch-net repair patch'],
  garden: ['A spare tool head', 'Replacement twine spools', 'A new plant label pack'],
  book: ['A replacement board page', 'A spare dust jacket', 'A new reading log card'],
};
export const DEFAULT_SPARE_PARTS = ['A replacement piece', 'A spare part or accessory', 'A printed instruction card'];

// -------------------------------------------------------------- reviews ---
export const REVIEWERS = [
  { name: 'Aditi S.', initials: 'AS', tone: '#b56f7b' },
  { name: 'Rahul M.', initials: 'RM', tone: '#6f8a6a' },
  { name: 'Meera J.', initials: 'MJ', tone: '#c98a5b' },
  { name: 'Tom W.', initials: 'TW', tone: '#7d6a9a' },
  { name: 'Nikhil B.', initials: 'NB', tone: '#6f8a6a' },
  { name: 'Farah K.', initials: 'FK', tone: '#b56f7b' },
  { name: 'Shreya D.', initials: 'SD', tone: '#a56a76' },
  { name: 'Arvind P.', initials: 'AP', tone: '#7d6a9a' },
  { name: 'Ishaan R.', initials: 'IR', tone: '#6f8a6a' },
  { name: 'Neha G.', initials: 'NG', tone: '#c98a5b' },
  { name: 'Pooja V.', initials: 'PV', tone: '#b56f7b' },
  { name: 'Daniel A.', initials: 'DA', tone: '#6f8a6a' },
];

export const REVIEW_TEXT_BANK = {
  5: [
    ['A keeper', 'Third month in and it still comes out every single day. The finish has held up beautifully.'],
    ['Better in person', 'The photos undersell the material quality — everything feels considered and nothing wobbles.'],
    ['The gift that worked', 'Bought it for a fifth birthday and the grown-ups asked where it was from before the cake was cut.'],
    ['Worth the wait', 'Shipped in two days, packed like it mattered. The little details are properly done.'],
    ['Instant favourite', 'Was out of the box for nine minutes before it was renamed and given a backstory.'],
    ['Quietly brilliant', 'No lights, no sounds — and it kept two siblings busy for an entire rainy Sunday.'],
    ['Exactly as described', 'What you see is what arrives. Rounded edges, solid weight, no sharp surprises.'],
  ],
  4: [
    ['Lovely, one tiny note', 'Beautifully made, though I wish the storage bag was a little bigger for the whole set.'],
    ['Very good indeed', 'A small learning curve for our three-year-old, but once it clicked, it really clicked.'],
    ['Good weight, good finish', 'Slightly smaller than I expected, but the quality is obvious the moment you pick it up.'],
    ['Almost perfect', 'Would love a spare piece or two in the box. Delivery and packing were flawless.'],
    ['Happy (slightly biased) parent', 'I have started recommending it to everyone at nursery pickup. Consider yourself warned.'],
  ],
  3: [
    ['Nice, needs a grown-up', 'Great with adult help; on its own it was a bit fiddly for our younger one.'],
    ['Good but specific', 'Well made, though it matched a narrower age window than we hoped at home.'],
  ],
};

export const REVIEW_PHOTO_CAPTIONS = [
  'Out of the box, first afternoon',
  'Third rebuild of the day',
  'In its natural habitat (the living room floor)',
  'The birthday morning',
  'Set up on the play table',
  'Grandparent-approved',
];

// Deterministic review set for a product: { name, initials, tone, stars, title, body, when, photo, photoCaption, verified }
export function reviewsForProduct(p, idx, photosArr = []) {
  const n = 3 + (idx % 3); // 3–5 seeded reviews
  const base = (idx * 5) % REVIEWERS.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    const who = REVIEWERS[(base + k * 3) % REVIEWERS.length];
    const starRoll = (idx + k * 7) % 10;
    const stars = starRoll < 7 ? 5 : starRoll < 9 ? 4 : 3;
    const bank = REVIEW_TEXT_BANK[stars];
    const [title, body] = bank[(idx + k * 2) % bank.length];
    const when = ['2 weeks ago', '1 month ago', '3 weeks ago', '5 weeks ago', '2 months ago'][(idx + k) % 5];
    const photo = (k === 1 || (k === 3 && idx % 2 === 0)) && p.images && p.images.length > ((k + 1) % p.images.length)
      ? p.images[((k + 1) % p.images.length)]
      : null;
    out.push({
      name: who.name, initials: who.initials, tone: who.tone,
      stars, title, body, when,
      photo,
      photoCaption: photo ? REVIEW_PHOTO_CAPTIONS[(idx + k) % REVIEW_PHOTO_CAPTIONS.length] : '',
      verified: true,
      helpful: (idx * 3 + k * 11) % 14,
    });
  }
  return out;
}

// Distribution bars derived from the seeded set + the catalogue rating.
export function reviewDistribution(p, seeded) {
  const five = seeded.filter((r) => r.stars === 5).length;
  const four = seeded.filter((r) => r.stars === 4).length;
  const three = seeded.filter((r) => r.stars === 3).length;
  const total = seeded.length || 1;
  const pct = (n) => Math.round((n / total) * 100);
  return { 5: pct(five), 4: pct(four), 3: pct(three), 2: 0, 1: 0 };
}

// ------------------------------------------------------------------ Q&A ---
export const QNA_GENERAL = [
  {
    q: 'How long does delivery usually take?',
    a: 'Standard delivery arrives in 2–4 business days across India, and it is complimentary on orders above ₹1,499. Express and “pick a day” options are available at checkout.',
    by: 'Playroom team',
  },
  {
    q: 'What is the return window?',
    a: 'Thirty days, any reason, free pickup. You can start a return from your orders page — the courier comes to you and the refund lands back on the original payment method.',
    by: 'Playroom team',
  },
  {
    q: 'Is it safe for a child who still mouths toys?',
    a: 'Every finish in the range is water-based and saliva-safe by design, and age guidance on the box is enforced strictly. If a set contains small parts, the listing says so before you add it to the bag.',
    by: 'Playroom team',
  },
];

export const QNA_BY_CATEGORY = {
  'Building & STEM': [{ q: 'Do the pieces work with other sets?', a: 'The core formats are deliberately compatible — tiles click to tiles, tracks join tracks — but every range is designed to stand beautifully on its own as well.', by: 'Meridian Playworks' }],
  'Games & Puzzles': [{ q: 'How many players can join a game?', a: 'As a rule: two is a duel, four is a party, and the rulebook includes a solo variant for quiet afternoons.', by: 'The Quiet Company' }],
  'Soft & Plush': [{ q: 'Is the plush machine washable?', a: 'Yes — 30 degrees, inside a pillowcase, then air-dry. Safety-stitched features mean no loose parts, before or after the wash.', by: 'Nimbus & Co.' }],
  'Vehicles & Adventures': [{ q: 'Do the wheels scratch wooden floors?', a: 'No. The wheels are plant-based and rounded, tested on more than one living-room floor by our own children.', by: 'Sunhouse Toys' }],
  'Art & Imagination': [{ q: 'Are the pigments safe if they end up on skin?', a: 'Everything is azo-free and water-washable. Art should occasionally leave evidence, but only on paper.', by: 'Sunhouse Toys' }],
  'Baby & Early Years': [{ q: 'Can it be sterilised?', a: 'The silicone and fabric parts can be sterilised or washed; the wooden parts prefer a damp cloth and a good airing. Full care card included.', by: 'Nimbus & Co.' }],
  'Pretend & Role Play': [{ q: 'Is the paint chipping a problem over time?', a: 'The finish is chip-resistant and touched up with beeswax. Toys that get loved often show it — that is patina, not damage.', by: 'Little Grove Atelier' }],
  'Outdoor & Active': [{ q: 'Can it survive monsoon season?', a: 'The outdoor ranges are season-tested in Goa. Leave them out with confidence; bring them in for the bay windows and the holidays.', by: 'Sunhouse Toys' }],
  'Science & Discovery': [{ q: 'Does it need batteries?', a: 'The solar and mechanical kits run entirely on curiosity, gravity and sunlight — no batteries, no charging cables.', by: 'Meridian Playworks' }],
  'Music & Movement': [{ q: 'How loud is it, honestly?', a: 'A thoughtful question. It is an acoustic toy, tuned to be pleasant at indoor volumes — the two-soft-beater drum is the house favourite.', by: 'Sunhouse Toys' }],
};

// ------------------------------------------------------------ press wall --
export const PRESS_WALL = [
  { outlet: 'PLAYFIELD', quote: 'A toy shop with editorial taste and no shouty aisle in sight.' },
  { outlet: 'The Little Review', quote: 'The rare storefront that feels like a magazine you can buy from.' },
  { outlet: 'SMALL & MIGHTY', quote: 'You can feel the curation — someone actually played with all of this.' },
  { outlet: 'Parent & Play', quote: 'Browseable, honest and genuinely warm. The tracking page is a small joy.' },
  { outlet: 'KINDLING', quote: 'Proves that commerce and gentleness are not opposites.' },
];

export const PRESS_AWARDS = [
  { mark: '★', label: 'Best Concept Store 2025', sub: 'Kind Retail Awards (illustrative)' },
  { mark: '✦', label: 'Editor’s Pick', sub: 'Indie Play Fair' },
  { mark: '❋', label: '4.9 average', sub: '2,100+ demo notes in this browser' },
  { mark: '✳', label: 'Top 100 Small Shops', sub: 'The Little Review' },
];

export const PRESS_NOTE = 'Illustrative press wall — these titles and awards are invented for this concept demo, not real coverage.';

// ------------------------------------------------------------ quick view --
export const QUICKVIEW_NOTE = 'Quick look — add it now, or open the full page for the whole story.';
