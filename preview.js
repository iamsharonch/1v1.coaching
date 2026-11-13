const menu = document.querySelector('.preview-menu');
const links = document.querySelector('.preview-nav-links');
const narrowNav = matchMedia('(max-width: 960px)');

function setMenu(open) {
  links.classList.toggle('is-open', open);
  menu.setAttribute('aria-expanded', String(open));
}

document.documentElement.classList.add('js-nav');
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
narrowNav.addEventListener('change', () => setMenu(false));
document.querySelector('#top nav').addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target || !target.hasAttribute('tabindex')) return;
    setMenu(false);
    target.focus({ preventScroll: true });
  });
});

const mobileBooking = document.querySelector('.mobile-booking');
const mobileBookingWidth = matchMedia('(max-width: 760px)');
let mobileBookingTimer = 0;

function scheduleMobileBooking() {
  if (!mobileBookingWidth.matches || !window.scrollY || mobileBookingTimer) return;
  mobileBookingTimer = window.setTimeout(() => {
    mobileBookingTimer = 0;
    if (!mobileBookingWidth.matches) return;
    mobileBooking.hidden = false;
    window.removeEventListener('scroll', scheduleMobileBooking);
  }, 5000);
}

window.addEventListener('scroll', scheduleMobileBooking, { passive: true });
mobileBookingWidth.addEventListener('change', () => {
  if (mobileBookingWidth.matches) return;
  clearTimeout(mobileBookingTimer);
  mobileBookingTimer = 0;
});
mobileBooking.querySelector('button').addEventListener('click', () => {
  mobileBooking.hidden = true;
});

const strip = document.querySelector('.story-strip');
const row = strip.querySelector('.story-row');
const cards = [...row.children];
const toolbar = document.querySelector('.story-toolbar');
const actions = toolbar.querySelector('.story-actions');
const dialog = document.querySelector('.story-dialog');
const closeButton = dialog.querySelector('.story-close');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const mouseHover = matchMedia('(hover: hover) and (pointer: fine)');
let onScreen = false;
let hover = false;
let touching = false;
let resumeAfter = 0;
let lastTime = 0;
let frame = 0;
let offset = 0;
let opener = null;

function makeCopies() {
  return cards.map((card, index) => {
    const copy = card.cloneNode(true);
    copy.classList.add('story-copy');
    copy.dataset.story = index;
    copy.tabIndex = -1;
    copy.setAttribute('aria-hidden', 'true');
    return copy;
  });
}

const leading = makeCopies();
const trailing = makeCopies();
row.prepend(...leading);
row.append(...trailing);

function cycleWidth() {
  return trailing[0].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
}

function normalize(position) {
  const cycle = cycleWidth();
  if (reduce.matches || cycle <= 0) return position;
  const start = cards[0].offsetLeft;
  return start + ((position - start) % cycle + cycle) % cycle;
}

function move(time) {
  const elapsed = lastTime ? Math.min(time - lastTime, 40) : 0;
  lastTime = time;
  const focused = document.activeElement;
  const keyboardFocus = (strip.contains(focused) || actions.contains(focused)) && focused.matches(':focus-visible');
  if (time >= resumeAfter && !touching && !hover && !keyboardFocus && !dialog.open) {
    offset = normalize(offset + elapsed * .028);
    strip.scrollTo({ left: offset, behavior: 'instant' });
  } else {
    offset = strip.scrollLeft;
  }
  frame = requestAnimationFrame(move);
}

function refreshPlayback() {
  const active = !reduce.matches && onScreen && !document.hidden;
  if (active && !frame) {
    offset = strip.scrollLeft;
    frame = requestAnimationFrame(move);
  } else if (!active && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
}

function adjustMotion() {
  strip.scrollLeft = reduce.matches ? 0 : cards[0].offsetLeft;
  offset = strip.scrollLeft;
  refreshPlayback();
}

function shift(direction) {
  resumeAfter = performance.now() + 1200;
  const stride = cards[1].offsetLeft - cards[0].offsetLeft;
  const here = normalize(strip.scrollLeft);
  const first = reduce.matches ? 0 : cards[0].offsetLeft;
  const index = (here - first) / stride;
  const next = direction > 0 ? Math.floor(index + .08) + 1 : Math.ceil(index - .08) - 1;
  let left = first + next * stride;
  if (reduce.matches) {
    const end = strip.scrollWidth - strip.clientWidth;
    if (direction > 0 && here >= end - 2) left = 0;
    if (direction < 0 && here <= 2) left = end;
  } else {
    strip.scrollLeft = here;
  }
  strip.scrollTo({ left, behavior: reduce.matches ? 'instant' : 'smooth' });
}

document.documentElement.classList.add('js-stories');
toolbar.hidden = false;
adjustMotion();
new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  refreshPlayback();
}).observe(strip);
reduce.addEventListener('change', adjustMotion);
document.addEventListener('visibilitychange', refreshPlayback);
strip.addEventListener('pointerenter', event => {
  if (mouseHover.matches && event.pointerType === 'mouse') hover = true;
});
strip.addEventListener('pointerleave', () => { hover = false; });
strip.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse') touching = true;
});
function endTouch() {
  if (!touching) return;
  touching = false;
  resumeAfter = performance.now() + 1800;
}
document.addEventListener('pointerup', endTouch);
document.addEventListener('pointercancel', endTouch);
strip.addEventListener('wheel', () => { resumeAfter = performance.now() + 1800; }, { passive: true });
toolbar.querySelector('.story-prev').addEventListener('click', () => shift(-1));
toolbar.querySelector('.story-next').addEventListener('click', () => shift(1));

row.addEventListener('click', event => {
  const target = event.target.closest('.story-preview');
  if (!target) return;
  opener = target.classList.contains('story-copy') ? cards[Number(target.dataset.story)] : target;
  if (opener !== target) {
    strip.scrollLeft += opener.offsetLeft - target.offsetLeft;
  }
  const selectedIndex = cards.indexOf(opener);
  for (const [index, card] of cards.entries()) {
    for (const item of [card, leading[index], trailing[index]]) {
      item.classList.toggle('is-selected', index === selectedIndex);
    }
  }
  dialog.querySelector('h3').textContent = opener.querySelector('.story-title').textContent;
  dialog.querySelector('.story-dialog-quote').textContent = opener.querySelector('.story-excerpt').textContent;
  dialog.querySelector('.story-dialog-byline').textContent = opener.querySelector('.story-byline').textContent;
  dialog.showModal();
  closeButton.focus();
});
closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  opener?.focus({ preventScroll: true });
  resumeAfter = performance.now() + 1800;
});

const motionObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('has-entered');
    motionObserver.unobserve(entry.target);
  }
}, { threshold: .4 });
document.querySelectorAll('.founder-stats')
  .forEach(element => motionObserver.observe(element));

const programEmblem = document.querySelector('.longterm-emblem');
const programObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) {
    programEmblem.classList.remove('has-entered');
  } else if (entry.intersectionRatio >= .25) {
    programEmblem.classList.add('has-entered');
  }
}, { threshold: [0, .25] });
programObserver.observe(programEmblem);

const awarenessRings = document.querySelector('.awareness-rings');
const awarenessObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) {
    awarenessRings.classList.remove('has-entered');
  } else if (entry.intersectionRatio >= .25) {
    awarenessRings.classList.add('has-entered');
  }
}, { threshold: [0, .25], rootMargin: '0px 0px -8% 0px' });
awarenessObserver.observe(awarenessRings);

const infoCards = document.querySelectorAll('.longterm-benefit, .founder-stats > div, .method-mini-card');
const tapTimers = new WeakMap();
for (const card of infoCards) {
  card.addEventListener('click', () => {
    card.classList.add('is-tapped');
    clearTimeout(tapTimers.get(card));
    tapTimers.set(card, setTimeout(() => card.classList.remove('is-tapped'), 550));
  });
}
