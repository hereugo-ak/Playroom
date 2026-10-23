// Playroom Atelier — data layer.
// Product seed data is extracted verbatim from the supplied reference HTML so the
// catalogue stays 1:1 (names, prices, ages, descriptions, includes, benefits).
import { seedData } from './data-seeds.js';
import { photoPools, categoryPools, categories } from './data-pools.js';
import {
  SKILLS_BY_CATEGORY, PLAY_STAGES_BY_CATEGORY, MATERIALS_BY_KIND,
  SPARE_PARTS_BY_KIND, DEFAULT_SPARE_PARTS, parseMinAge, stageForAge,
} from './premium-data.js';

const IMG = (n) => `assets/img/photo-${String(n).padStart(2, '0')}.jpg`;
export const heroPhoto = 'assets/img/hero.jpg';
export const photos = Array.from({ length: 48 }, (_, i) => IMG(i)); // localPhotos[0..47] equivalent

export { categories };

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Deterministic per-key photo use, mirrors the reference's photoUse allocation.
const photoUse = {};
function productImages(seed) {
  const key = seed[6];
  const pool = photoPools[key] || categoryPools[seed[1]] || [0, 1, 2];
  const n = photoUse[key] || 0;
  photoUse[key] = n + 1;
  const base = pool[n % pool.length];
  return [base, pool[(n + 1) % pool.length], pool[(n + 2) % pool.length]].map(IMG);
}

// ------------------------------------------------------------------
// Makers — the studios behind each piece. Every product is assigned
// one deterministically, and the full maker profile (about, ratings
// breakdown, more from the maker) opens from the product page.
// ------------------------------------------------------------------
export const SELLERS = [
  {
    id: 'meridian', name: 'Meridian Playworks', initials: 'MP', tone: '#7d6a9a',
    tagline: 'Precision builds for curious hands', location: 'Bengaluru', since: 2019,
    rating: 4.9, ratings: 1284, sold: '18,400', response: '99%', dispatch: 'Same day', onTime: 98,
    about: 'Meridian Playworks began in a Bengaluru garage with one laser cutter and a stubborn belief that construction toys deserve real engineering. Every set is prototyped with a rowdy focus group of neighbourhood kids before it earns a box.',
    specialties: ['Magnetic builds', 'STEM', 'Tested by kids'],
    badges: ['Verified maker', 'Top maker 2025', 'On-time dispatcher'],
    distribution: [92, 6, 1, 0.6, 0.4],
    reviews: [
      { name: 'Aditi S.', initials: 'AS', tone: '#b56f7b', when: '2 weeks ago', text: 'Magnets strong enough for real towers, and the finish has held up after six months of daily play.' },
      { name: 'Rahul M.', initials: 'RM', tone: '#6f8a6a', when: '1 month ago', text: 'Arrived in two days, beautifully packed, and the tiles click together with a very satisfying snap.' },
    ],
  },
  {
    id: 'grove', name: 'Little Grove Atelier', initials: 'GA', tone: '#6f8a6a',
    tagline: 'Wooden classics, made slowly', location: 'Kochi', since: 2016,
    rating: 4.8, ratings: 2110, sold: '31,900', response: '98%', dispatch: '1–2 days', onTime: 97,
    about: 'A family workshop in Kochi where every block is cut, sanded and finished by hand. The wood comes from certified groves, the corners are softened twice, and the studio still smells faintly of beeswax. These are the toys that get handed down, not thrown out.',
    specialties: ['Wooden toys', 'Open-ended play', 'Heirloom quality'],
    badges: ['Verified maker', 'Family-run', 'Plastic-free packing'],
    distribution: [88, 9, 2, 0.7, 0.3],
    reviews: [
      { name: 'Meera J.', initials: 'MJ', tone: '#c98a5b', when: '3 weeks ago', text: 'You can feel the hand-finishing. The blocks are already being saved for the next baby in the family.' },
      { name: 'Tom W.', initials: 'TW', tone: '#7d6a9a', when: '2 months ago', text: 'Third order from this maker. Quietly perfect every time — heirloom toys at fair prices.' },
    ],
  },
  {
    id: 'wonderworks', name: 'Wonderworks', initials: 'WW', tone: '#c98a5b',
    tagline: 'Small-batch mechanics for big ideas', location: 'Jaipur', since: 2018,
    rating: 4.8, ratings: 967, sold: '12,600', response: '100%', dispatch: 'Same day', onTime: 99,
    about: 'Wonderworks is a five-person studio in Jaipur that prototypes marble runs the way other people write drafts — over and over until gravity itself seems impressed. If a route is possible, their test kids will find it.',
    specialties: ['Marble runs', 'Mechanics', 'Physics of play'],
    badges: ['Verified maker', 'On-time dispatcher', 'Plastic-free packing'],
    distribution: [89, 8, 2, 0.6, 0.4],
    reviews: [
      { name: 'Nikhil B.', initials: 'NB', tone: '#6f8a6a', when: '1 week ago', text: 'The spiral pieces fit together better than any set we have owned. Two rainy weekends and still going.' },
      { name: 'Farah K.', initials: 'FK', tone: '#b56f7b', when: '1 month ago', text: 'Customer service answered on a Sunday when a piece went missing, and posted a replacement the same day.' },
    ],
  },
  {
    id: 'quiet', name: 'The Quiet Company', initials: 'QC', tone: '#8a6a3f',
    tagline: 'Good puzzles, no shouting', location: 'Pune', since: 2020,
    rating: 4.7, ratings: 806, sold: '9,300', response: '97%', dispatch: '1–2 days', onTime: 96,
    about: 'The Quiet Company makes puzzles and tabletop games for slow afternoons — printed on thick recycled board, cut in Pune, and tested at the founders kitchen table until the whole family stops arguing and starts playing.',
    specialties: ['Puzzles', 'Family games', 'Recycled board'],
    badges: ['Verified maker', 'Recycled materials'],
    distribution: [84, 11, 3.5, 1, 0.5],
    reviews: [
      { name: 'Shreya D.', initials: 'SD', tone: '#a56a76', when: '2 weeks ago', text: 'The pieces are satisfyingly thick and the picture is genuinely beautiful — it is framed on the wall now.' },
      { name: 'Arvind P.', initials: 'AP', tone: '#7d6a9a', when: '1 month ago', text: 'Bought it for the grandparents, and it quietly became the family routine every Sunday evening.' },
    ],
  },
  {
    id: 'sunhouse', name: 'Sunhouse Toys', initials: 'ST', tone: '#b56f7b',
    tagline: 'For gardens, kitchens and muddy hands', location: 'Goa', since: 2017,
    rating: 4.9, ratings: 1542, sold: '22,700', response: '99%', dispatch: 'Same day', onTime: 98,
    about: 'Sunhouse Toys makes art and outdoor gear for children who play like the weather is a challenge. Everything is tested in the Goan sun for a full season — if it fades, cracks or gets boring, it never makes it to the shop.',
    specialties: ['Outdoor play', 'Art & craft', 'Season-tested'],
    badges: ['Verified maker', 'Top maker 2025', 'Season-tested'],
    distribution: [93, 5.5, 1, 0.3, 0.2],
    reviews: [
      { name: 'Ishaan R.', initials: 'IR', tone: '#6f8a6a', when: '5 days ago', text: 'Left the easel outside all monsoon — no warp, no fade. That is a small miracle in Goa.' },
      { name: 'Neha G.', initials: 'NG', tone: '#c98a5b', when: '3 weeks ago', text: 'The pressed-flower kit kept a nine-year-old happily busy for an entire holiday without a screen.' },
    ],
  },
  {
    id: 'nimbus', name: 'Nimbus & Co.', initials: 'NC', tone: '#9a8fa8',
    tagline: 'First friends, softly made', location: 'Mumbai', since: 2021,
    rating: 4.8, ratings: 1198, sold: '15,100', response: '98%', dispatch: '1–2 days', onTime: 97,
    about: 'Nimbus & Co. makes the very first toys a child truly owns — plush, soft and machine-washable, stitched in Mumbai with safety stitching everywhere and no loose parts anywhere. Designed with a paediatric occupational therapist.',
    specialties: ['Plush & soft', 'First toys', 'Washable'],
    badges: ['Verified maker', 'Safety-tested', 'OT-designed'],
    distribution: [87, 10, 2, 0.6, 0.4],
    reviews: [
      { name: 'Pooja V.', initials: 'PV', tone: '#b56f7b', when: '1 week ago', text: 'Third wash and it still looks brand new. The safety stitching on the eyes convinced my mother, finally.' },
      { name: 'Daniel A.', initials: 'DA', tone: '#6f8a6a', when: '1 month ago', text: 'The texture is perfect for tiny hands — our daughter has not let go of it since the box opened.' },
    ],
  },
];

// Each maker stays true to their craft: categories map to the studio
// that would plausibly make them, and Building & STEM rotates between
// the build studios (so the three sponsored partners stay aligned).
const CATEGORY_SELLER = {
  'Games & Puzzles': SELLERS[3],
  'Soft & Plush': SELLERS[5],
  'Vehicles & Adventures': SELLERS[2],
  'Art & Imagination': SELLERS[4],
  'Baby & Early Years': SELLERS[5],
  'Pretend & Role Play': SELLERS[1],
  'Outdoor & Active': SELLERS[4],
  'Science & Discovery': SELLERS[0],
  'Music & Movement': SELLERS[4],
};
const BUILD_SELLERS = [SELLERS[0], SELLERS[1], SELLERS[2]];
let buildSeen = 0;

export const products = seedData.map((s, i) => {
  const images = productImages(s);
  const seller = s[1] === 'Building & STEM'
    ? BUILD_SELLERS[buildSeen++ % 3]
    : (CATEGORY_SELLER[s[1]] || SELLERS[i % SELLERS.length]);
  return {
    id: 'pl' + (i + 1),
    slug: slugify(s[0]),
    name: s[0],
    category: s[1],
    price: s[2],
    old: i % 4 === 0 ? s[3] : s[2],
    rating: s[4],
    age: s[5],
    photoKey: s[6],
    desc: s[7],
    detail: s[8],
    benefit: s[9],
    reviews: Math.floor(18 + (i * 37) % 180),
    // Real-feeling inventory: a fifth of the shelf is genuinely low, the rest
    // sits comfortably above the urgency line.
    stock: (i * 7) % 31 < 5 ? 2 + (i % 3) : 14 + (i * 7) % 47,
    featured: [0, 2, 8, 16, 24, 30, 37, 48, 54].includes(i) || (i >= 60 && i % 9 === 0),
    fresh: [4, 10, 20, 31, 43, 50].includes(i) || (i >= 60 && i % 7 === 0),
    image: images[0],
    images,
    seller,
    // ---- derived premium depth (see premium-data.js) ----
    minAge: parseMinAge(s[5]),
    stageId: stageForAge(s[5]).id,
    skills: SKILLS_BY_CATEGORY[s[1]] || [],
    playStages: PLAY_STAGES_BY_CATEGORY[s[1]] || PLAY_STAGES_BY_CATEGORY['Building & STEM'],
    materials: /wood|block|architect|beech/i.test(s[0]) ? MATERIALS_BY_KIND.wood : (MATERIALS_BY_KIND[s[6]] || MATERIALS_BY_KIND.blocks),
    spareParts: SPARE_PARTS_BY_KIND[s[6]] || DEFAULT_SPARE_PARTS,
    video: [0, 2, 6, 26, 31, 55, 63].includes(i),
    persKind: /plush|soft|cuddly|bear|bunny/i.test(`${s[0]} ${s[1]} ${s[6]}`)
      ? 'embroidery'
      : (/(^| )wood|wooden|architect|beech/i.test(s[0]) || s[6] === 'wood' ? 'engraving' : null),
  };
});

export const categoryPhoto = {
  'Building & STEM': photos[0],  'Games & Puzzles': photos[8],
  'Soft & Plush': photos[12],    'Vehicles & Adventures': photos[16],
  'Art & Imagination': photos[20], 'Baby & Early Years': photos[28],
  'Pretend & Role Play': photos[18], 'Outdoor & Active': photos[24],
  'Science & Discovery': photos[26], 'Music & Movement': photos[22],
};

export const byId = (id) => products.find((p) => p.id === id);
export const bySlug = (slug) => products.find((p) => p.slug === slug);
export const stageProducts = (stageId) => products.filter((p) => p.stageId === stageId);

// Frequently bought together: the piece itself plus two carefully-paired
// shelf-mates (one from another aisle, one from the same one). Deterministic.
export function fbtFor(p, count = 2) {
  const idx = Math.max(0, products.indexOf(p));
  const others = products.filter((x) => x.id !== p.id && x.category !== p.category);
  const same = products.filter((x) => x.id !== p.id && x.category === p.category);
  const picks = [
    others[(idx * 7 + 3) % Math.max(1, others.length)],
    same[(idx * 5 + 1) % Math.max(1, same.length)],
    others[(idx * 11 + 5) % Math.max(1, others.length)],
  ].filter(Boolean);
  const unique = picks.filter((v, i, a) => a.indexOf(v) === i && v.id !== p.id);
  return [p, ...unique.slice(0, count)];
}

// Shop copy derived from the reference (photo map keys kept for authoring helpers).
export const photo = {
  blocks: photos[0], toy: photos[31], cars: photos[17], puzzle: photos[8],
  plush: photos[12], craft: photos[20], board: photos[10], baby: photos[28],
  wood: photos[1], outdoor: photos[24], robot: photos[3], doll: photos[18],
  train: photos[16], science: photos[26], book: photos[11], music: photos[22],
  play: heroPhoto, garden: photos[24], gift: photos[31],
};
const img = (id, _w = 900) => (typeof id === 'string' ? id : photos[id] || heroPhoto);
export { img };
