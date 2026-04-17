/* Fund Partners Meeting render engine */

const state = {
  version: 'journey',
  images: [],
  versions: {},
  linkedin: null,
  currentSlideIdx: 0,
};

async function loadData() {
  const [imgsRes, versRes, liRes] = await Promise.all([
    fetch('data/images.json'),
    fetch('data/versions.json'),
    fetch('data/linkedin.json'),
  ]);
  state.images = await imgsRes.json();
  state.versions = await versRes.json();
  state.linkedin = await liRes.json();
}

/* Resolve an imageRef (slug or section tag) to image objects */
function resolveRef(ref) {
  const imgs = state.images;
  // full filename match
  const direct = imgs.find(i => i.file === `images/${ref}.jpg` || i.file.endsWith(`/${ref}.jpg`));
  if (direct) return [direct];
  // object: { section, sub }
  if (typeof ref === 'object') {
    return imgs.filter(i =>
      (!ref.section || i.section === ref.section) &&
      (!ref.sub || i.sub === ref.sub)
    );
  }
  // section tag
  const bySection = imgs.filter(i => i.section === ref);
  if (bySection.length) return bySection;
  return [];
}

function imageFileFromRef(ref) {
  const arr = resolveRef(ref);
  return arr.length ? arr[0].file : null;
}

/* Expand a version's sections into a flat list of slides.
   A section with a `beats` array becomes N slides, all sharing the same
   heroImage — the text layer changes as the user scrolls through beats. */
function expandSlides(version) {
  const out = [];
  version.sections.forEach(sec => {
    if (Array.isArray(sec.beats) && sec.beats.length) {
      sec.beats.forEach((beat, bIdx) => {
        out.push({
          type: beat.type || sec.type || 'chapter',
          eyebrow: beat.eyebrow !== undefined ? beat.eyebrow : sec.eyebrow,
          title: beat.title !== undefined ? beat.title : sec.title,
          subtitle: beat.subtitle !== undefined ? beat.subtitle : sec.subtitle,
          stats: beat.stats || null,
          quote: beat.quote || null,
          quoteBy: beat.quoteBy || null,
          diagram: beat.diagram || sec.diagram || '',
          gallery: beat.gallery || null,
          heroImage: beat.heroImage || sec.heroImage,
          year: beat.year || sec.year || null,
          imageRefs: bIdx === 0 ? (sec.imageRefs || []) : [],
          beat: { index: bIdx, total: sec.beats.length, sectionId: sec.id },
        });
      });
    } else {
      out.push({
        type: sec.type,
        eyebrow: sec.eyebrow,
        title: sec.title,
        subtitle: sec.subtitle,
        stats: sec.stats || null,
        quote: sec.quote || null,
        quoteBy: sec.quoteBy || null,
        diagram: sec.diagram || '',
        gallery: sec.gallery || null,
        heroImage: sec.heroImage,
        year: sec.year || null,
        imageRefs: sec.imageRefs || [],
        beat: null,
      });
    }
  });
  return out;
}

/* Build the ordered dock tile list from a flat slide list.
   Hero images are excluded from the dock (each photo lives in exactly
   one place). Each tile knows which slide index it first belongs to
   so we can light tiles up progressively as the viewer scrolls. */
function buildTileOrder(flatSlides) {
  // Collect every hero image so we can exclude them from the dock
  const heroFiles = new Set();
  flatSlides.forEach(slide => {
    if (slide.heroImage) {
      const f = imageFileFromRef(slide.heroImage);
      if (f) heroFiles.add(f);
    }
  });

  const out = [];
  const seen = new Set();
  flatSlides.forEach((slide, sIdx) => {
    (slide.imageRefs || []).forEach(ref => {
      resolveRef(ref).forEach(img => {
        if (heroFiles.has(img.file)) return; // heroes are not dock tiles
        if (!seen.has(img.file)) {
          seen.add(img.file);
          out.push({ img, sectionIdx: sIdx });
        }
      });
    });
  });
  // For the final collage: include ALL images from this tab (heroes + refs)
  // so the collage is comprehensive
  flatSlides.forEach(slide => {
    if (slide.heroImage) {
      const f = imageFileFromRef(slide.heroImage);
      if (f && !seen.has(f)) {
        seen.add(f);
        out.push({ img: { file: f }, sectionIdx: flatSlides.length - 1 });
      }
    }
  });
  return out;
}

function renderDock(tileOrder) {
  const dock = document.getElementById('dock');
  dock.innerHTML = '';
  tileOrder.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.style.backgroundImage = `url("${t.img.file}")`;
    el.dataset.sectionIdx = t.sectionIdx;
    el.dataset.tileIdx = i;
    dock.appendChild(el);
  });
}

function renderSlideContent(sec) {
  const eyebrow = sec.eyebrow ? `<div class="eyebrow">${sec.eyebrow}</div>` : '';
  const stats = (sec.stats || []).map(s =>
    `<div class="stat"><div class="val">${s.value}</div><div class="lbl">${s.label}</div></div>`
  ).join('');
  const quote = sec.quote
    ? `<div class="quote">${sec.quote}${sec.quoteBy ? `<cite>— ${sec.quoteBy}</cite>` : ''}</div>`
    : '';
  const diagram = sec.diagram || '';

  let beatDots = '';
  let beatHint = '';
  if (sec.beat && sec.beat.total > 1) {
    const dots = Array.from({ length: sec.beat.total }, (_, i) => {
      let cls = 'beat-dot';
      if (i < sec.beat.index) cls += ' passed';
      if (i === sec.beat.index) cls += ' active';
      return `<div class="${cls}"></div>`;
    }).join('');
    beatDots = `<div class="beat-dots">${dots}</div>`;
    if (sec.beat.index === 0) {
      beatHint = `<div class="beat-hint show">Scroll for more</div>`;
    }
  }

  if (sec.type === 'cover') {
    const titleText = sec.coverTitle || 'Mastercard Foundation\nAfrica Growth Fund';
    return `
      <div class="cover-grey-block"></div>
      <div class="slide-content">
        <div class="cover-title-area">
          ${eyebrow}
          <h1>${titleText}</h1>
          ${sec.subtitle ? `<p>${sec.subtitle}</p>` : ''}
        </div>
      </div>
      <div class="cover-partners">
        <span class="partners-label">In partnership with:</span>
        <div class="partner-names">
          <span class="partner-name">MEDA</span>
          <span class="partner-name">Criterion Institute</span>
          <span class="partner-name">Genesis</span>
          <span class="partner-name">ACG</span>
          <span class="partner-name">ESP</span>
        </div>
      </div>`;
  }

  if (sec.type === 'pause') {
    return `
      <div class="slide-content">
        <h2>${sec.title}</h2>
        ${sec.subtitle ? `<p class="lede">${sec.subtitle}</p>` : ''}
      </div>`;
  }

  // Gallery: compact horizontal strip of images
  let gallery = '';
  if (sec.gallery && sec.gallery.length) {
    const imgs = sec.gallery.map(ref => {
      const f = imageFileFromRef(ref);
      return f ? `<img src="${f}" alt="" loading="lazy">` : '';
    }).join('');
    gallery = `<div class="gallery">${imgs}</div>`;
  }

  return `
    ${beatDots}
    <div class="slide-content">
      ${eyebrow}
      <h2>${sec.title}</h2>
      ${sec.subtitle ? `<p class="lede">${sec.subtitle}</p>` : ''}
      ${diagram}
      ${stats ? `<div class="stat-row">${stats}</div>` : ''}
      ${gallery}
      ${quote}
    </div>
    ${beatHint}`;
}

function renderSlides(flatSlides) {
  const slides = document.getElementById('slides');
  slides.innerHTML = '';
  flatSlides.forEach((sec, sIdx) => {
    const slide = document.createElement('section');
    slide.className = 'slide';
    slide.dataset.type = sec.type || 'chapter';
    slide.dataset.idx = sIdx;
    slide.dataset.total = flatSlides.length;
    if (sec.year) slide.dataset.year = sec.year;
    const heroUrl = sec.heroImage ? imageFileFromRef(sec.heroImage) : null;
    if (heroUrl) slide.dataset.hero = heroUrl;
    slide.innerHTML = renderSlideContent(sec);
    slides.appendChild(slide);
  });
}

/* Timeline year bar: shows year progression for versions that define years. */
function renderTimelineBar(version) {
  const bar = document.getElementById('timeline-bar');
  if (!bar) return;
  // Collect unique years from sections (including beats)
  const years = [];
  const seen = new Set();
  version.sections.forEach(sec => {
    const y = sec.year || (sec.beats && sec.beats[0] && sec.beats[0].year);
    if (y && !seen.has(y)) { seen.add(y); years.push(y); }
  });
  if (years.length < 2) { bar.classList.remove('visible'); bar.innerHTML = ''; return; }
  bar.innerHTML = years.map((y, i) =>
    (i > 0 ? '<div class="tl-dot"></div>' : '') +
    `<div class="tl-year" data-year="${y}">${y}</div>`
  ).join('');
  bar.classList.add('visible');
}

function updateTimelineBar(year) {
  const bar = document.getElementById('timeline-bar');
  if (!bar) return;
  let reachedActive = false;
  bar.querySelectorAll('.tl-year').forEach(el => {
    const y = el.dataset.year;
    if (y === year) {
      el.classList.add('active');
      el.classList.remove('past');
      reachedActive = true;
    } else if (!reachedActive) {
      el.classList.add('past');
      el.classList.remove('active');
    } else {
      el.classList.remove('active', 'past');
    }
  });
}

/* Two-layer crossfade for the fixed hero background.
   Only swaps when the target image actually differs from the current one,
   so scrolling between beats of the same photo does NOT flicker. */
const heroBg = {
  activeId: 'bg-a',
  currentUrl: null,
  set(url) {
    if (!url || url === this.currentUrl) return;
    const activeEl = document.getElementById(this.activeId);
    const inactiveId = this.activeId === 'bg-a' ? 'bg-b' : 'bg-a';
    const inactiveEl = document.getElementById(inactiveId);
    inactiveEl.style.backgroundImage = `url("${url}")`;
    // next frame: fade in inactive, fade out active
    requestAnimationFrame(() => {
      inactiveEl.classList.add('visible');
      activeEl.classList.remove('visible');
    });
    this.activeId = inactiveId;
    this.currentUrl = url;
  },
  reset() {
    document.getElementById('bg-a').style.backgroundImage = '';
    document.getElementById('bg-b').style.backgroundImage = '';
    document.getElementById('bg-a').classList.add('visible');
    document.getElementById('bg-b').classList.remove('visible');
    this.activeId = 'bg-a';
    this.currentUrl = null;
  },
};

/* IntersectionObserver lights dock tiles, updates dock state, and
   swaps the hero background as slides come into view. */
function setupObserver(version) {
  const slides = document.querySelectorAll('.slide');
  const tiles = document.querySelectorAll('.tile');
  const dock = document.getElementById('dock');
  const counter = document.getElementById('slide-counter');
  const progress = document.getElementById('progress-bar');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const slide = entry.target;
      if (!entry.isIntersecting) {
        slide.classList.remove('visible');
        return;
      }
      slide.classList.add('visible');

      const idx = parseInt(slide.dataset.idx, 10);
      const total = parseInt(slide.dataset.total, 10);
      const type = slide.dataset.type;
      state.currentSlideIdx = idx;

      // Swap hero background (only fires when URL actually changes)
      if (slide.dataset.hero) heroBg.set(slide.dataset.hero);

      // Light tiles for sections 0..idx, unlight those beyond idx.
      // Unlight on reverse scroll so the dock "rewinds" as the user
      // scrolls back up — important for re-running the story.
      tiles.forEach(t => {
        const sIdx = parseInt(t.dataset.sectionIdx, 10);
        if (sIdx >= 0 && sIdx <= idx) {
          t.classList.add('lit');
        } else {
          t.classList.remove('lit');
        }
      });

      // Dock visibility rules
      if (type === 'cover') {
        dock.classList.add('hidden');
        dock.classList.remove('fullscreen');
      } else if (type === 'final') {
        dock.classList.remove('hidden');
        dock.classList.add('fullscreen');
      } else {
        dock.classList.remove('hidden');
        dock.classList.remove('fullscreen');
      }

      // Cover shows the tab's own mark. Inner slides show the pinned version.
      const coverMark = document.getElementById('cover-mark');
      const pinnedMark = document.getElementById('pinned-mark');
      const acgCoverMark = document.getElementById('acg-cover-mark');
      const acgPinnedMark = document.getElementById('acg-pinned-mark');
      const ticker = document.getElementById('ticker');
      const tabs = document.getElementById('tabs');
      const tlBar = document.getElementById('timeline-bar');
      if (type === 'cover') {
        if (coverMark) coverMark.classList.remove('gone');
        if (pinnedMark) pinnedMark.classList.remove('visible');
        if (acgCoverMark) acgCoverMark.classList.remove('gone');
        if (acgPinnedMark) acgPinnedMark.classList.remove('visible');
        if (ticker) ticker.classList.remove('visible');
        if (tabs) tabs.classList.add('cover-hidden');
        if (tlBar) tlBar.classList.remove('visible');
      } else {
        if (coverMark) coverMark.classList.add('gone');
        if (pinnedMark) pinnedMark.classList.add('visible');
        if (acgCoverMark) acgCoverMark.classList.add('gone');
        if (acgPinnedMark) acgPinnedMark.classList.add('visible');
        if (ticker) ticker.classList.add('visible');
        if (tabs) tabs.classList.remove('cover-hidden');
        if (tlBar) tlBar.classList.add('visible');
      }

      // Progress bar + timeline year
      const pct = ((idx + 1) / total) * 100;
      progress.style.width = pct + '%';
      counter.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${version.name}`;
      if (slide.dataset.year) updateTimelineBar(slide.dataset.year);
    });
  }, { threshold: 0.55 });

  slides.forEach(s => obs.observe(s));
}

function render(versionKey) {
  const version = state.versions[versionKey];
  if (!version) return;
  state.version = versionKey;

  // Apply theme: ACG tab gets editorial dark theme, Journey tab keeps Fund green
  document.body.classList.toggle('theme-acg', versionKey === 'acg');

  const flatSlides = expandSlides(version);
  const tileOrder = buildTileOrder(flatSlides);
  renderDock(tileOrder);
  renderSlides(flatSlides);
  renderTimelineBar(version);
  heroBg.reset();
  setupObserver(version);

  // reset scroll
  document.getElementById('scroller').scrollTo({ top: 0, behavior: 'instant' });
}

function setupTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  Object.entries(state.versions).forEach(([key, v]) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (key === state.version ? ' active' : '');
    btn.textContent = v.name;
    btn.dataset.key = key;
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(key);
    };
    tabs.appendChild(btn);
  });
}

/* Scroll-linked LinkedIn ticker.
   Reads the real Q1 daily audience series from state.linkedin and maps
   scroll progress (0..1) to day index. Subtle reminder of the audience
   that grows alongside the story. */
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

function setupLinkedInTicker() {
  const numEl = document.getElementById('ticker-num');
  const deltaEl = document.getElementById('ticker-delta');
  const lblEl = document.getElementById('ticker-lbl');
  const li = state.linkedin;
  if (!numEl || !li || !li.points.length) return;

  const scroller = document.getElementById('scroller');
  const points = li.points;
  const lastIdx = points.length - 1;

  // Smoothed tween: we interpolate toward target using rAF so that
  // scroll jumps become gentle rises. Pauses when tab is hidden.
  let targetIdx = 0;
  let current = points[0].count;
  let rafId = null;

  function setTarget() {
    const total = scroller.scrollHeight - scroller.clientHeight;
    const pct = total > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / total)) : 0;
    targetIdx = Math.round(pct * lastIdx);
  }

  function render() {
    const target = points[targetIdx];
    const diff = target.count - current;
    if (Math.abs(diff) < 0.5) {
      current = target.count;
    } else {
      current += diff * 0.12;
    }
    numEl.textContent = Math.round(current).toLocaleString();
    const delta = target.delta;
    deltaEl.textContent = (delta >= 0 ? '+' : '') + delta.toLocaleString();
    lblEl.textContent = `The Fund · LinkedIn · ${formatDateShort(target.date)} 2026`;
    rafId = requestAnimationFrame(render);
  }

  function startTicker() { if (!rafId) rafId = requestAnimationFrame(render); }
  function stopTicker() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTicker(); else startTicker();
  });

  scroller.addEventListener('scroll', setTarget, { passive: true });
  setTarget();
  // initialize display
  numEl.textContent = points[0].count.toLocaleString();
  deltaEl.textContent = '+0';
  lblEl.textContent = `The Fund · LinkedIn · ${formatDateShort(points[0].date)} 2026`;
  startTicker();
}

/* Toast notification for tab switch */
function showToast(msg) {
  let toast = document.getElementById('switch-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'switch-toast';
    toast.style.cssText = `
      position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
      background:rgba(10,20,16,0.88); color:#fff; font-family:'Poppins',Arial,sans-serif;
      font-size:0.82rem; font-weight:600; padding:10px 24px; border-radius:999px;
      z-index:999; opacity:0; transition:opacity 0.3s ease; pointer-events:none;
      border:1px solid rgba(255,255,255,0.15);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
}

/* keyboard nav: arrows for slides, 1/2 for tab switch */
function setupKeys() {
  const scroller = document.getElementById('scroller');
  const versionKeys = Object.keys(state.versions);

  window.addEventListener('keydown', (e) => {
    const slides = document.querySelectorAll('.slide');
    const total = slides.length;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      const next = Math.min(total - 1, state.currentSlideIdx + 1);
      slides[next].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      const prev = Math.max(0, state.currentSlideIdx - 1);
      slides[prev].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'Home') {
      slides[0].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'End') {
      slides[total - 1].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === '1' && versionKeys[0]) {
      render(versionKeys[0]);
      showToast(state.versions[versionKeys[0]].name);
    } else if (e.key === '2' && versionKeys[1]) {
      render(versionKeys[1]);
      showToast(state.versions[versionKeys[1]].name);
    }
  });
}

async function main() {
  try {
    await loadData();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#fff;background:#0a0e1a;min-height:100vh">
      <h1>Data load failed</h1>
      <p style="color:#8a94a8;margin-top:12px">This file must be served over HTTP, not opened directly.</p>
      <pre style="background:#0f1524;padding:16px;border-radius:8px;margin-top:16px;color:#FBB500;font-family:monospace;font-size:0.9rem">cd client_tools/acg/partners_meeting_2026_04
python -m http.server 8000
# open http://localhost:8000</pre>
      <p style="color:#555;margin-top:24px;font-size:0.85rem">Error: ${err.message}</p>
    </div>`;
    return;
  }
  setupTabs();
  render(state.version);
  setupKeys();
  setupLinkedInTicker();
}

main();
