// Vercel serverless function: member-only monthly play guide.
// Returns a lightweight HTML guide; the browser downloads it via fetch so the
// Supabase token is never placed in a URL.
import { bearer, getAdmin, json } from '../_lib/server.js';

const clean = (value, max = 40) => String(value ?? '').trim().slice(0, max);

function guideHtml(month) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Playrooom Circle · ${month} Play Guide</title>
<style>
body{margin:0;background:#F0E5D7;color:#3D2E23;font-family:Arial,Helvetica,sans-serif;line-height:1.7}
.wrap{max-width:720px;margin:0 auto;padding:42px 26px 70px}
.mast{text-align:center;border-bottom:1px solid #DCCAB4;padding-bottom:28px;margin-bottom:34px}
.brand{font:700 12px Arial,sans-serif;letter-spacing:.16em;color:#B56F7B}
h1{font:400 46px/1.05 Georgia,serif;letter-spacing:-.03em;margin:16px 0 8px}
h1 em{color:#B56F7B;font-style:italic}
p{font-size:14px;color:#6F5A4B}
h2{font:400 27px Georgia,serif;margin:34px 0 10px}
.card{background:#FFF9EF;border:1px solid #E6D6C4;border-radius:10px;padding:22px;margin:16px 0}
ul{padding-left:20px;font-size:14px;color:#6F5A4B}
li{margin:8px 0}
.foot{text-align:center;margin-top:44px;color:#806B5A;font:10px Arial,sans-serif;letter-spacing:.1em}
</style></head>
<body><main class="wrap">
<header class="mast"><div class="brand">LITTLE HANDS. BIG WORLDS.</div><h1>${month} play <em>guide.</em></h1><p>A short, thoughtful set of ideas for slower, better play.</p></header>
<section class="card"><h2>01 · Start with what they already love</h2><p>Put three familiar toys in one place and let the child decide what happens next. The best play often begins with less instruction.</p></section>
<section class="card"><h2>02 · Make room for repetition</h2><p>Building the same tower, retelling the same story or sorting the same buttons is not boredom. It is practice, memory and confidence.</p></section>
<section class="card"><h2>03 · Ask smaller questions</h2><p>“What would this become if it turned over?” opens more play than “What are you making?” A quiet prompt is often enough.</p></section>
<section class="card"><h2>04 · Keep one thing unfinished</h2><p>Leave a block structure, marble run or pretend scene partly built. Returning to it later gives the next play session a gentle entry point.</p></section>
<p class="foot">PLAYROOOM CIRCLE · MADE FOR LITTLE BIG IMAGINATIONS.</p>
</main></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const token = bearer(req);
    if (!token) return json(res, 401, { error: 'Please sign in to access the guide.' });

    const admin = getAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth?.user) return json(res, 401, { error: 'Your session has expired.' });

    const now = new Date().toISOString();
    const { data: active, error: activeError } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .gt('current_period_end', now)
      .limit(1);
    if (activeError) throw activeError;
    if (!active?.length) return json(res, 403, { error: 'An active Circle membership is required.' });

    const month = clean(req.query?.month, 24) || new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="playrooom-circle-play-guide.html"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(guideHtml(month));
  } catch (error) {
    console.error('[membership guide API]', error?.message || error);
    return json(res, 400, { error: String(error?.message || error).slice(0, 300) });
  }
}
