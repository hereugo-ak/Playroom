// Playroom Atelier — the living room hero and the cinematic scroll handoff.
//
// The hero video is rendered from the exact art-directed playroom photograph:
// the same girl, teddy, train, blocks, stacking rings, dollhouse and teepee,
// with no generative repaint and nothing removed. Lenis supplies the wheel
// inertia; GSAP + ScrollTrigger own the copy fade and the cream content card
// that slides over the pinned room.

const HEADER_OFFSET = 57;
const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;
let lenisTicker = null;
let lockObserver = null;
let heroState = null;

function teardownHero() {
  if (!heroState) return;
  heroState.playback?.kill();
  heroState.mm?.revert();
  heroState = null;
}

/** One-time smooth-scroll plumbing. Safe to call on every boot. */
export function initScrollExperience() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const Lenis = window.Lenis;
  if (!gsap || !ScrollTrigger || !Lenis || prefersReduced()) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (lenis) return;

  lenis = new Lenis({
    duration: 1.12,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.92,
    touchMultiplier: 1.05,
    syncTouch: false,
    autoRaf: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  lenisTicker = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(lenisTicker);
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;

  // The call room, drawers, modals and welcome card lock the page. Pause the
  // virtual scroller too, so wheel inertia cannot move the page behind them.
  const syncLock = () => {
    if (!lenis) return;
    if (document.body.classList.contains('lock') || document.body.classList.contains('pl-call-active')) lenis.stop();
    else lenis.start();
  };
  lockObserver = new MutationObserver(syncLock);
  lockObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncLock();
}

/** Rebuild the home hero after a route render. */
export function refreshHeroScene() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hero = document.querySelector('.home-premium [data-hero-scene]');
  teardownHero();

  const reduced = prefersReduced();
  const video = hero?.querySelector('[data-hero-video]');
  const playBtn = hero?.querySelector('[data-hero-video-play]');
  const showPlay = () => { if (playBtn) playBtn.hidden = false; };
  const hidePlay = () => { if (playBtn) playBtn.hidden = true; };
  const playVideo = () => {
    if (!video) return;
    if (reduced && !hero.classList.contains('hero-force-motion')) {
      showPlay();
      return;
    }
    try {
      const attempt = video.play();
      attempt?.then(hidePlay).catch(showPlay);
    } catch (err) {
      showPlay();
    }
  };

  if (video) {
    video.muted = true;
    video.playsInline = true;
    if (reduced) {
      video.pause();
      showPlay();
    } else {
      playVideo();
    }
    video.addEventListener('playing', hidePlay);
    video.addEventListener('canplay', playVideo, { once: true });
    video.addEventListener('error', showPlay);

    // If the browser blocked muted autoplay, the first gesture anywhere on the
    // page is enough to start it. The small play control is the visible fallback.
    const unlock = () => { if (video.paused) playVideo(); };
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((evt) => {
      document.addEventListener(evt, unlock, { once: true, passive: true });
    });
    playBtn?.addEventListener('click', () => {
      hero.classList.add('hero-force-motion');
      playVideo();
    });
  }

  if (!gsap || !ScrollTrigger || !hero || reduced) return;

  const image = hero.querySelector('[data-hero-image]');
  const parallax = hero.querySelector('[data-hero-parallax]');
  const editorial = hero.querySelector('.hero-editorial');
  const editorialInner = hero.querySelector('.hero-editorial-inner');
  const topLine = hero.querySelector('.hero-cinema-top');
  const caption = hero.querySelector('.hero-scene-caption');
  const shade = hero.querySelector('.hero-cinema-shade');
  const strip = hero.parentElement?.querySelector('.hero-index-strip');
  const copyEl = editorialInner || editorial;

  // Pause the film once the room is fully covered; resume on the way back.
  const playback = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    invalidateOnRefresh: true,
    onLeave: () => video?.pause(),
    onEnterBack: playVideo,
  });

  const mm = gsap.matchMedia();

  // Desktop: pin the room under the compact header and let the cream page
  // peel up over it. The pin lasts exactly until the content card reaches the
  // header, so unpinning can never leave a bare strip on screen.
  mm.add('(min-width: 761px)', () => {
    const travel = () => Math.max(1, hero.offsetHeight + (strip?.offsetHeight || 0));
    const pin = ScrollTrigger.create({
      trigger: hero,
      start: `top ${HEADER_OFFSET}px`,
      end: () => `+=${travel()}`,
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: `top ${HEADER_OFFSET}px`,
        end: () => `+=${travel()}`,
        scrub: 1.05,
        invalidateOnRefresh: true,
      },
    });
    // A small parallax inside the 104% media bed. The 2% overscan is enough
    // for the movement and leaves almost the whole photograph visible.
    tl.to(parallax, { yPercent: 1.6, ease: 'none' }, 0)
      .to(shade, { opacity: 0.55, ease: 'none' }, 0);

    // The copy leaves before the cream card can reach it. It moves and fades
    // in the first third of the handoff; the room itself keeps holding.
    const copyTl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: `top ${HEADER_OFFSET}px`,
        end: () => `+=${Math.max(1, hero.offsetHeight * 0.3)}`,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
    copyTl.to(copyEl, { y: -84, opacity: 0, ease: 'none' }, 0)
      .to(caption, { opacity: 0, ease: 'none' }, 0);

    return () => {
      pin.kill();
      tl.scrollTrigger?.kill();
      tl.kill();
      copyTl.scrollTrigger?.kill();
      copyTl.kill();
    };
  });

  // Phones keep native touch momentum; the room still parallaxes and the copy
  // gives way as the content arrives. No pin, so the URL bar can breathe.
  mm.add('(max-width: 760px)', () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.9,
        invalidateOnRefresh: true,
      },
    });
    tl.to(parallax, { yPercent: 2, ease: 'none' }, 0);

    const copyTl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => `+=${Math.max(1, hero.offsetHeight * 0.55)}`,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
    copyTl.to(copyEl, { y: -42, opacity: 0.16, ease: 'none' }, 0);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
      copyTl.scrollTrigger?.kill();
      copyTl.kill();
    };
  });

  heroState = { mm, playback };

  // Wait for the intrinsic image before measuring the pin. The hero height is
  // fixed, but this also makes the first scroll after a cold load exact.
  if (image && !image.complete) {
    image.decode?.().catch(() => {}).finally(() => ScrollTrigger.refresh());
  } else {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}

export function resetScrollExperience() {
  if (!lenis) return;
  lenis.scrollTo(0, { immediate: true, force: true });
}
