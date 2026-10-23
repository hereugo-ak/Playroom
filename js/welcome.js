// Playroom Atelier — one-time welcome offer popup.
// Ported 1:1 from the approved prototype (#playloom-welcome-media-behavior, popup part only).
export function initWelcome() {
  const overlay = document.getElementById('plWelcomeOverlay');
  const card = document.getElementById('plWelcomeCard');
  const closeButton = document.getElementById('plWelcomeClose');
  const form = document.getElementById('plWelcomeForm');
  const input = document.getElementById('plWelcomeEmail');
  const content = document.getElementById('plWelcomeContent');
  if (!overlay || !card || !closeButton || !form || !input || !content) return;
  let previousFocus = null, opened = false;
  const readList = () => { try { const x = JSON.parse(localStorage.getItem('pl-newsletter') || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
  const canOffer = () => { try { const until = +(localStorage.getItem('pl-welcome-snooze-until') || 0); return Date.now() > until && !localStorage.getItem('pl-welcome-subscribed') && readList().length === 0; } catch { return true; } };
  const isHome = () => { const h = location.hash; return !h || h === '#/' || h === '#'; };
  function setBackgroundInert(state) { [...document.body.children].forEach((el) => { if (el !== overlay) el.inert = state; }); }
  function open() { if (opened || !canOffer() || !isHome()) return; opened = true; previousFocus = document.activeElement; overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false'); document.body.classList.add('lock'); setBackgroundInert(true); setTimeout(() => input.focus({ preventScroll: true }), 100); }
  function close(reason = 'dismiss') { if (!overlay.classList.contains('is-open')) return; overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lock'); setBackgroundInert(false); opened = false; if (reason === 'dismiss') { try { localStorage.setItem('pl-welcome-snooze-until', String(Date.now() + 21 * 24 * 60 * 60 * 1000)); } catch {} } if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true }); }
  closeButton.addEventListener('click', () => close('dismiss'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close('dismiss'); });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close('dismiss'); return; }
    if (e.key === 'Tab') { const focusables = [...card.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter((el) => !el.disabled && el.getClientRects().length > 0); const first = focusables[0], last = focusables[focusables.length - 1]; if (first && last && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (first && last && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { input.focus(); return; }
    const emails = [...new Set([...readList(), email])];
    try { localStorage.setItem('pl-newsletter', JSON.stringify(emails)); localStorage.setItem('pl-welcome-subscribed', '1'); localStorage.removeItem('pl-welcome-snooze-until'); } catch {}
    card.classList.add('is-success');
    content.innerHTML = `<div class="pl-welcome-wordmark"><span class="pl-welcome-mark">p.</span> playroom</div><div class="mono pl-welcome-kicker">A LITTLE SOMETHING, UNLOCKED</div><h2 class="pl-welcome-success-title">Your next little<br><em>discovery awaits.</em></h2><p>Use this code at checkout for 10% off your first demo order.</p><div class="pl-welcome-code" id="plWelcomeCode">PLAY10</div><button class="pl-welcome-copy-code" type="button" id="plWelcomeCopyCode">Copy your code</button><button class="pl-welcome-shop-btn" type="button" id="plWelcomeShop">EXPLORE THE COLLECTION ↗</button><p class="pl-welcome-fineprint">This is a concept store. The sign-up is saved only in this browser.</p>`;
    card.querySelector('.pl-welcome-success-title')?.setAttribute('tabindex', '-1');
    card.querySelector('.pl-welcome-success-title')?.focus({ preventScroll: true });
    const copy = document.getElementById('plWelcomeCopyCode');
    copy?.addEventListener('click', async () => { try { await navigator.clipboard.writeText('PLAY10'); copy.textContent = 'Copied · PLAY10'; } catch { const range = document.createRange(); range.selectNodeContents(document.getElementById('plWelcomeCode')); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); copy.textContent = 'Select and copy PLAY10'; } });
    document.getElementById('plWelcomeShop')?.addEventListener('click', () => { close('success'); location.hash = '#/catalog'; });
  });
  // Show only after the visitor has started browsing, then suppress for three weeks after dismissal.
  let scrollQueued = false;
  window.addEventListener('scroll', () => { if (scrollQueued) return; scrollQueued = true; requestAnimationFrame(() => { scrollQueued = false; if (window.scrollY > 420) open(); }); }, { passive: true });
  // A short delay also permits visitors who browse with a mouse but do not scroll much; never open immediately.
  window.setTimeout(() => { if (window.scrollY > 160) open(); }, 18000);
  window.addEventListener('hashchange', () => { if (!isHome() && overlay.classList.contains('is-open')) close('dismiss'); });
}
