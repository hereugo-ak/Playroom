// Playroom Atelier — support chat + a demo audio call surface.
// The call is intentionally an audio-call UI: a recorded support note plays
// through it for now, with live captions and a reactive waveform. A real agent
// can be connected to this same surface in a later build.
//
// The desk is context-aware: when a customer is signed in, its quick prompts
// and answers read the same Supabase-backed order mirror as the account pages.
import { safe } from './dom.js';
import { state, formatMoney } from './store.js';
import { authState, onAuthChange } from './auth/auth-store.js';
import { fedexStatus } from './gateway.js';

export function initSupport() {
  const $ = (s) => document.querySelector(s);
  const chatPanel = $('#plChatPanel'), openChat = $('#plOpenChat'), closeChat = $('#plCloseChat'), chatForm = $('#plChatForm'), chatInput = $('#plChatInput'), messages = $('#plChatMessages'), chatCount = $('#plChatCount'), chatContext = $('#plChatContext');
  const callOverlay = $('#plCallOverlay'), openCall = $('#plOpenCall'), closeCall = $('#plCloseCall'), endCall = $('#plEndCall'), quick = $('#plChatQuick');
  if (!chatPanel || !callOverlay) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let chatBusy = false;
  let noteCount = messages?.children.length || 1;

  // ---------- account context ----------
  const signedIn = () => Boolean(authState.session && authState.user);
  const accountOrders = () => (signedIn() && Array.isArray(state.orders) ? state.orders : []);
  const lastOrder = () => accountOrders()[0] || null;

  function orderFrom(text) {
    const orders = accountOrders();
    if (!orders.length) return null;
    const id = String(text).match(/PL-?\d{6}/i)?.[0]?.replace('-', '').toUpperCase();
    if (id) return orders.find((o) => String(o.id || '').replace('-', '').toUpperCase() === id) || null;
    const tracking = String(text).match(/\b\d{12}\b/)?.[0];
    if (tracking) return orders.find((o) => String(o.trackingNumber || '') === tracking) || null;
    return /last|my order|recent|track|return|receipt|invoice/i.test(String(text)) ? lastOrder() : null;
  }

  const promptHTML = (_index, prompt, title, sub) => `
    <button type="button" class="pr-suggestion" data-support-prompt="${safe(prompt)}">
      <b>${safe(title)}</b>
      ${sub ? `<small>${safe(sub)}</small>` : ''}
    </button>`;

  function renderQuickPrompts() {
    if (!quick) return;
    const order = lastOrder();
    if (signedIn() && order) {
      quick.innerHTML = [
        promptHTML(1, 'Tell me about my last order', 'My last order', `${order.id} · ${formatMoney(order.total || 0)}`),
        promptHTML(2, `Track ${order.id}`, 'Track order', order.trackingNumber || 'Demo tracking'),
        promptHTML(3, 'Start a return for my last order', 'Start a return', 'Saved to your account'),
      ].join('');
      if (chatContext) chatContext.textContent = `ACCOUNT · ${order.id}`;
    } else if (signedIn()) {
      quick.innerHTML = [
        promptHTML(1, 'I need help choosing a gift.', 'Find a gift', 'By age, play & budget'),
        promptHTML(2, 'When will my order arrive?', 'Delivery question', 'Demo estimates'),
        promptHTML(3, 'What is your return policy?', 'Returns policy', '30-day story'),
      ].join('');
      if (chatContext) chatContext.textContent = 'YOUR ACCOUNT';
    } else {
      quick.innerHTML = [
        promptHTML(1, 'Can you help me track my order?', 'Track an order', 'PL- number or tracking'),
        promptHTML(2, 'I need help choosing a gift.', 'Find a gift', 'A thoughtful shortlist'),
        promptHTML(3, 'What is your return policy?', 'Returns', 'The 30-day story'),
      ].join('');
      if (chatContext) chatContext.textContent = 'GUEST';
    }
  }

  renderQuickPrompts();
  onAuthChange(renderQuickPrompts);
  window.addEventListener('playroom:orders-updated', renderQuickPrompts);

  // ---------- floating character launcher ----------
  const fab = $('#plSupportFab'), fabToggle = $('#plFabToggle'), fabMenu = $('#plFabMenu'), fabHint = $('#plFabHint');
  let fabOpen = false;
  function setFab(open) {
    if (!fab || !fabToggle) return;
    fabOpen = open;
    fab.classList.toggle('is-open', open);
    fabToggle.setAttribute('aria-expanded', String(open));
    if (fabMenu) fabMenu.setAttribute('aria-hidden', String(!open));
  }

  function setChat(open) {
    if (open) setFab(false);
    chatPanel.classList.toggle('is-open', open);
    chatPanel.setAttribute('aria-hidden', String(!open));
    openChat.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('pl-chat-active', open);
    if (open) { setTimeout(() => chatInput.focus(), reduced ? 0 : 180); }
    else (fabToggle || openChat).focus();
  }
  function addMessage(text, kind = 'bot', label) {
    const row = document.createElement('div');
    row.className = 'pl-chat-message' + (kind === 'user' ? ' is-user' : '');
    const small = document.createElement('small');
    small.textContent = label || (kind === 'user' ? 'You · Just now' : 'Playroom Care · Just now');
    const p = document.createElement('p');
    p.textContent = text;
    row.append(small, p); messages.append(row); messages.scrollTop = messages.scrollHeight;
    noteCount += 1;
    if (chatCount) chatCount.textContent = `${String(noteCount).padStart(2, '0')} ${noteCount === 1 ? 'message' : 'messages'}`;
    return row;
  }
  function replyFor(message) {
    const m = String(message || '').toLowerCase();
    const order = orderFrom(message);

    // Account-aware answers first: a signed-in customer gets real details from
    // their own saved orders, never another customer's data.
    if (signedIn() && /start a return|return.*order|refund.*order|exchange.*order/.test(m)) {
      if (!order) return 'You’re signed in, but there’s no saved order to return yet. Complete a demo checkout first — the receipt, tracking and a returns option will appear under My orders.';
      return `I can see ${order.id} on your account. Open #/account/orders and use “Return or exchange” on that card. The simulated pickup steps are saved with your account; no one collects the parcel and no money moves.`;
    }
    if (order && /last order|my order|order status|track|where.*order|delivery status|receipt|invoice|summary|tell me about/.test(m)) {
      const st = fedexStatus(order);
      const tracking = order.trackingNumber ? `Tracking number ${order.trackingNumber}.` : 'A tracking number has not been generated yet.';
      return `I found ${order.id} in your account. Placed ${order.createdAtLabel || 'recently'} · ${formatMoney(order.total || 0)} demo total · currently “${st.big}”. ${st.sub}. ${tracking} Open the order card or “Track an order” for the full timeline. Nothing is charged or shipped in this prototype.`;
    }
    if (signedIn() && !order && /track|my order|order status|delivery status|last order/.test(m)) {
      return 'I checked your account and there are no saved orders yet. Once you complete a demo checkout, the receipt, tracking number and returns desk will all live under My orders.';
    }
    if (/track|tracking|order status|where.*order|delivery status/.test(m)) return 'Of course. This storefront is running in demo mode, so I can’t see a live courier. After checkout, open “Track an order” in the site footer and enter the PL- number shown on your confirmation. The status and timeline are simulated in this browser.';
    if (/deliver|shipping|ship|pincode|pin code|when.*arriv/.test(m)) return 'Delivery is complimentary on demo orders of ₹1,499 or more; otherwise the demo estimates ₹99. Product-page PIN checks show an illustrative 3–6 business day estimate. No real parcel is dispatched in this prototype.';
    if (/return|refund|exchange|damaged/.test(m)) return 'We can help you understand the demo returns flow. The prototype describes a 7-day easy-returns concept, but it does not process real returns or refunds. For a live store, this would be confirmed against the order and fulfilment system.';
    if (/gift|present|birthday|recommend|recommendation|choose|choosing|age|toy for/.test(m)) return 'Let’s find something thoughtful. The Gift Finder can narrow the collection by age, interest and budget. For open-ended play, try Building & STEM; for a quieter activity, look at Games & Puzzles; for little comfort gifts, explore Soft & Plush.';
    if (/payment|upi|card|checkout|pay/.test(m)) return 'Checkout is a frontend demo. You can select a payment preference and complete an example order, but no money is collected and no payment credentials are requested or sent.';
    if (/hello|hi\b|hey|good morning|good evening/.test(m)) return 'Hello! Glad you stopped by. I’m here to help you explore toys, think through a gift, or explain how the demo order and tracking screens work.';
    if (/human|person|agent|call|video|talk|speak/.test(m)) return 'The audio call in the corner is a demo call surface right now — a recorded support note plays with live captions, and a real agent can join this same space later. No microphone or camera is used yet.';
    return 'Thanks for telling me. I’m the Playroom Care assistant, so I can help with toys and gifting, delivery estimates, returns, checkout and order tracking. This message has been received locally; nothing is sent to a server. What would you like help with next?';
  }
  function sendMessage(value) {
    const message = String(value || '').trim();
    if (!message || chatBusy) return;
    addMessage(message, 'user');
    chatInput.value = '';
    chatBusy = true;
    const typing = document.createElement('div');
    typing.className = 'pl-chat-message';
    typing.id = 'plChatTyping';
    typing.innerHTML = '<small>Playroom Care is typing</small><div class="pl-chat-typing" aria-label="Playroom Care is typing"><i></i><i></i><i></i></div>';
    messages.append(typing); messages.scrollTop = messages.scrollHeight;
    setTimeout(() => { typing.remove(); addMessage(replyFor(message), 'bot'); chatBusy = false; chatInput.focus(); }, reduced ? 0 : 560);
  }

  openChat.addEventListener('click', () => setChat(!chatPanel.classList.contains('is-open')));
  closeChat.addEventListener('click', () => setChat(false));
  chatForm.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(chatInput.value); });
  quick?.addEventListener('click', (e) => { const b = e.target.closest('[data-support-prompt]'); if (b) sendMessage(b.dataset.supportPrompt); });

  // Character toggle: tap the face to fan out the actions; tap away to tuck them back.
  if (fabToggle) {
    fabToggle.addEventListener('click', () => setFab(!fabOpen));
    document.addEventListener('click', (e) => { if (fabOpen && fab && !fab.contains(e.target)) setFab(false); });
    try {
      if (fabHint && !sessionStorage.getItem('pl-fab-hinted')) {
        sessionStorage.setItem('pl-fab-hinted', '1');
        setTimeout(() => {
          fabHint.classList.add('is-on');
          setTimeout(() => fabHint.classList.remove('is-on'), 6000);
        }, 2400);
      }
    } catch (err) { /* storage unavailable — skip the hint */ }
  }

  // ---------- demo audio call ----------
  // Word timings derived from the real sentence boundaries of the recorded
  // clip (0.100–3.225s and 3.175–7.037s), weighted per word. Every cue in
  // this list sits inside the true span of its sentence.
  const GREETING = [
    { w: 'Hello,', t: 0.100, d: 0.649 }, { w: 'and', t: 0.749, d: 0.304 },
    { w: 'welcome', t: 1.054, d: 0.710 }, { w: 'to', t: 1.764, d: 0.203 },
    { w: 'the', t: 1.967, d: 0.304 }, { w: 'Playroom.', t: 2.271, d: 0.954 },
    { w: 'Thanks', t: 3.175, d: 0.565 }, { w: 'for', t: 3.740, d: 0.283 },
    { w: 'choosing', t: 4.023, d: 0.754 }, { w: 'us —', t: 4.776, d: 0.339 },
    { w: 'how', t: 5.115, d: 0.283 }, { w: 'may', t: 5.398, d: 0.283 },
    { w: 'I', t: 5.681, d: 0.094 }, { w: 'help', t: 5.775, d: 0.377 },
    { w: 'you', t: 6.152, d: 0.283 }, { w: 'today?', t: 6.434, d: 0.603 },
  ];
  const SENTENCES = [[0, 6], [6, 16]]; // caption line groups
  const BARS = 26;

  const audio = $('#plGreetingAudio');
  const waveEl = $('#plCallWave');
  const captionEl = $('#plCallCaption');
  const captionLines = $('#plCaptionLines');
  const stateText = $('#plCallStateText');
  const stateChip = $('#plCallState');
  const afterNote = $('#plCallAfter');
  const timerEl = $('#plCallTimer');

  let callOpen = false;
  let callPhase = 'idle'; // idle → connecting → live
  let connectTimer = 0, clockTimer = 0;
  let callStartedAt = 0;
  let rafId = 0;
  let audioCtx = null, analyser = null, gainNode = null, waveData = null;
  let speakersOn = true, captionsOn = true;
  let fallbackAt = null; // virtual clock when the browser refuses playback
  let endedShown = false;
  let lastWord = -1, activeLine = -1, lineEls = [], wordEls = [];

  if (waveEl) {
    waveEl.innerHTML = new Array(BARS).fill('<i></i>').join('');
  }
  const barEls = waveEl ? [...waveEl.children] : [];

  if (captionLines) {
    captionLines.innerHTML = SENTENCES.map(([from, to], gi) => (
      `<p class="pl-caption-line${gi === 0 ? ' is-active' : ''}" data-line="${gi}">` +
      GREETING.slice(from, to).map((c) => `<span>${c.w}</span>`).join(' ') +
      '</p>'
    )).join('');
    lineEls = [...captionLines.children];
    wordEls = [...captionLines.querySelectorAll('span')];
  }

  function ensureGraph() {
    if (!audio) return;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        audioCtx = new AC();
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        gainNode = audioCtx.createGain();
        gainNode.gain.value = speakersOn ? 1 : 0;
        source.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioCtx.destination);
      } catch (err) {
        audioCtx = null; analyser = null; gainNode = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  // A soft two-note "line open" chime, synthesised (no asset needed).
  function playChime(kind) {
    const ctx = audioCtx;
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const notes = kind === 'end' ? [[440, 0], [587.33, 0.10]] : [[587.33, 0], [880, 0.10]];
    for (const [freq, dt] of notes) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.09, t0 + dt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.62);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.7);
    }
  }

  function formatTime(seconds) { return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  function updateTimer() { timerEl.textContent = formatTime(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000))); }

  function resetCaptions() {
    lastWord = -1; activeLine = -1;
    wordEls.forEach((el) => el.classList.remove('is-said', 'is-now'));
    lineEls.forEach((el, gi) => el.classList.toggle('is-active', gi === 0));
    captionEl.classList.remove('is-speaking');
    if (afterNote) afterNote.hidden = true;
    endedShown = false;
  }

  function captionClock() {
    if (audio && audio.ended) return audio.duration || 99;
    if (audio && !audio.paused) return audio.currentTime;
    if (fallbackAt !== null) return (performance.now() - fallbackAt) / 1000;
    return 0;
  }

  function paintCaptions(ct) {
    let idx = -1;
    for (let i = 0; i < GREETING.length; i += 1) {
      if (ct >= GREETING[i].t) idx = i; else break;
    }
    const end = GREETING[GREETING.length - 1];
    const finished = (audio && audio.ended) || ct >= end.t + end.d - 0.03;
    if (idx !== lastWord || finished !== endedShown) {
      lastWord = idx;
      const done = finished ? GREETING.length : idx;
      wordEls.forEach((el, i) => {
        el.classList.toggle('is-said', i < done || (finished && i <= idx));
        el.classList.toggle('is-now', !finished && i === idx);
      });
      const line = idx >= SENTENCES[1][0] ? 1 : 0;
      if (line !== activeLine) {
        activeLine = line;
        lineEls.forEach((el, gi) => el.classList.toggle('is-active', gi === line));
      }
      captionEl.classList.toggle('is-speaking', idx >= 0 && !finished);
      captionEl.classList.toggle('is-finished', finished);
      if (finished && !endedShown) {
        endedShown = true;
        if (afterNote) afterNote.hidden = false;
        stateText.textContent = 'Note played';
        stateChip.classList.add('is-done');
      }
    }
  }

  function waveFrame() {
    if (!callOpen) return;
    const now = performance.now() / 1000;
    const ct = captionClock();
    paintCaptions(ct);
    // The waveform reads the clip's real output when the browser exposes it;
    // on devices with no audio output (or a blocked context) it falls back to
    // a speech-shaped breath that follows the same word cues as the captions.
    let sliceRms = null;
    if (analyser) {
      if (!waveData || waveData.length !== analyser.fftSize) waveData = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(waveData);
      let sum = 0;
      for (let j = 0; j < waveData.length; j += 1) { const d = (waveData[j] - 128) / 128; sum += d * d; }
      const overall = Math.sqrt(sum / waveData.length);
      if (overall > 0.02) {
        sliceRms = [];
        for (let i = 0; i < barEls.length; i += 1) {
          const from = Math.floor((i * waveData.length) / barEls.length);
          const to = Math.floor(((i + 1) * waveData.length) / barEls.length);
          let s2 = 0;
          for (let j = from; j < to; j += 1) { const d = (waveData[j] - 128) / 128; s2 += d * d; }
          sliceRms.push(Math.sqrt(s2 / Math.max(1, to - from)));
        }
      }
    }
    const live = audio && !audio.paused && !audio.ended;
    const word = lastWord >= 0 ? GREETING[lastWord] : null;
    const speaking = !!word && ct < word.t + word.d + 0.04;
    for (let i = 0; i < barEls.length; i += 1) {
      let v;
      if (sliceRms) {
        v = 0.08 + Math.min(1, sliceRms[i] * 3.4);
      } else if (live && speaking) {
        v = 0.24 + 0.52 * Math.abs(Math.sin(now * 6.4 + i * 0.83)) * (0.55 + 0.45 * Math.abs(Math.sin(now * 1.7 + i * 0.21)));
      } else if (live) {
        v = 0.11 + 0.05 * Math.sin(now * 2.1 + i * 0.6);
      } else if (callPhase === 'connecting') {
        v = 0.14 + 0.10 * Math.sin(now * 4.2 + i * 0.7);
      } else {
        v = 0.15 + 0.09 * Math.sin(now * 1.8 + i * 0.55) + 0.05 * Math.sin(now * 3.4 + i * 1.6);
      }
      barEls[i].style.transform = `scaleY(${Math.max(0.06, Math.min(1, v)).toFixed(3)})`;
    }
    rafId = requestAnimationFrame(waveFrame);
  }

  async function playGreeting() {
    if (!audio) return;
    resetCaptions();
    stateChip.classList.remove('is-done');
    stateText.textContent = 'In call';
    ensureGraph();
    try {
      audio.currentTime = 0;
      fallbackAt = null;
      await audio.play();
    } catch (err) {
      // Playback blocked (or no output device): run the captions on a
      // virtual clock so the call still plays out visually, label unchanged.
      fallbackAt = performance.now();
    }
  }

  function openCallFlow() {
    if (callOpen) return;
    callOpen = true;
    callPhase = 'connecting';
    if (chatPanel.classList.contains('is-open')) setChat(false);
    setFab(false);
    callOverlay.classList.add('is-open');
    callOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pl-call-active');
    timerEl.textContent = '00:00';
    stateText.textContent = 'Connecting…';
    stateChip.classList.remove('is-done');
    stateChip.classList.add('is-live');
    resetCaptions();
    ensureGraph();
    playChime('open');
    connectTimer = setTimeout(() => {
      callPhase = 'live';
      callStartedAt = Date.now();
      updateTimer();
      clockTimer = setInterval(updateTimer, 1000);
      playGreeting();
    }, reduced ? 250 : 1150);
    closeCall.focus();
    rafId = requestAnimationFrame(waveFrame);
  }

  function closeCallFlow(restoreFocus = true) {
    if (!callOpen) return;
    callOpen = false;
    callPhase = 'idle';
    clearTimeout(connectTimer);
    clearInterval(clockTimer);
    cancelAnimationFrame(rafId);
    rafId = 0;
    try { audio.pause(); audio.currentTime = 0; } catch (err) { /* nothing to stop */ }
    fallbackAt = null;
    if (audioCtx) playChime('end');
    callOverlay.classList.remove('is-open');
    callOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pl-call-active');
    stateChip.classList.remove('is-live');
    resetCaptions();
    if (restoreFocus) (fabToggle || openCall).focus();
  }

  // The room opens on the call window's own transition — no ringing halos or
  // orbiting rings around the care icons.
  function openCallFromLauncher() {
    if (callOpen) return;
    openCallFlow();
  }

  openCall.addEventListener('click', openCallFromLauncher);
  closeCall.addEventListener('click', () => closeCallFlow());
  endCall.addEventListener('click', () => closeCallFlow());
  callOverlay.addEventListener('click', (e) => { if (e.target === callOverlay) closeCallFlow(); });
  $('#plChatCall')?.addEventListener('click', () => { setChat(false); openCallFromLauncher(); });
  $('#plOpenChatFromCall')?.addEventListener('click', () => { closeCallFlow(false); setChat(true); });

  $('#plToggleCaptions').addEventListener('click', (e) => {
    const b = e.currentTarget;
    captionsOn = !captionsOn;
    b.setAttribute('aria-pressed', String(captionsOn));
    b.classList.toggle('is-off', !captionsOn);
    captionEl.classList.toggle('is-off', !captionsOn);
  });
  $('#plReplayGreeting').addEventListener('click', () => {
    if (callPhase !== 'live') return;
    playGreeting();
  });

  audio?.addEventListener('ended', () => {
    if (callOpen) paintCaptions(audio.duration || GREETING[GREETING.length - 1].t + 1);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (fabOpen) setFab(false);
    if (chatPanel.classList.contains('is-open')) setChat(false);
    if (callOpen) closeCallFlow();
  });
}
