// QULAYJOY — asosiy ilova (vanilla JS, build talab qilinmaydi)
import { i18n, AMENITIES } from './i18n.js';
import { icon } from './icons.js';
import { CATEGORIES, CITIES, CITY_COORDS, UZ_CENTER, LONG_STAY, listingPoint, validateListing, filterListings, normPhone, PHONE_RE } from './market.js';
import { initStore, favs, prefs, compressImage } from './data.js';
import * as dataMod from './data.js';
import { listingsMap, locationPicker, distKm } from './map.js';

const { t, td } = i18n;
const S = () => dataMod.store; // joriy adapter
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `${i18n.price(n)} ${t('currency')}`;
const catIcon = id => CATEGORIES.find(c => c.id === id)?.icon || 'home';

const state = {
  user: null,
  listings: null,
  filters: prefs.get('filters', {}),
  view: prefs.get('view', 'list'),
  mapSel: null,
  mapView: null,
  afterLogin: '',
};
const saveFilters = () => prefs.set('filters', state.filters);

/* ------------------------------ UI yordamchilar ------------------------------ */
function toast(msg, type = 'ok') {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.setAttribute('role', 'status');
  el.innerHTML = `${icon(type === 'err' ? 'x' : 'check', 16)}<span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}
function confirmDialog(text, yes = t('common.yes')) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'modal-back';
    d.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p class="modal-text">${esc(text)}</p><div class="modal-actions"><button class="btn ghost" data-no>${t('common.cancel')}</button><button class="btn danger" data-yes>${esc(yes)}</button></div></div>`;
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    const close = v => { d.classList.remove('show'); setTimeout(() => d.remove(), 200); res(v); };
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-no]')) close(false); if (e.target.closest('[data-yes]')) close(true); });
    $('[data-yes]', d).focus();
  });
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
  }
}
const go = h => { if (location.hash === '#' + h || (!h && !location.hash)) render(); else location.hash = h; };
const setTitle = s => (document.title = s ? `${s} — QULAYJOY` : `QULAYJOY — ${t('tagline')}`);

async function loadListings(force) {
  if (!state.listings || force) state.listings = await S().listListings().catch(() => []);
  return state.listings;
}

/* ------------------------------ Kartochka ------------------------------ */
function photoBlock(l, cls = 'card-photo') {
  const m = l.media?.find(x => x.media_type !== 'video' && x.url);
  if (m) return `<img class="${cls}" src="${esc(m.url)}" alt="${esc(l.title)}" loading="lazy" decoding="async">`;
  return `<div class="${cls} ph ph-${esc(l.category)}">${icon(catIcon(l.category), 44)}</div>`;
}
function card(l, { preview = false } = {}) {
  const fav = favs.has(l.id);
  const tag = preview ? 'div' : 'a';
  return `<${tag} class="card" ${preview ? '' : `href="#listing-${esc(l.id)}"`} data-id="${esc(l.id)}">
    <div class="card-media">${photoBlock(l)}
      ${l.sample ? `<span class="badge sample">${t('sample')}</span>` : ''}
      ${preview ? '' : `<button class="fav-btn${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="${t('detail.save')}" aria-pressed="${fav}">${icon('heart', 18)}</button>`}
      ${l.media?.length > 1 ? `<span class="badge count">${icon('image', 12)} ${l.media.length}</span>` : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${icon(catIcon(l.category), 14)} ${esc(td('cat', l.category))}</span>
      <h3 class="card-title">${esc(l.title || '—')}</h3>
      <p class="card-loc">${icon('pin', 14)} ${esc(td('city', l.city))}${l.district ? ', ' + esc(l.district) : ''}</p>
      <div class="card-meta"><span>${icon('door', 14)} ${t('card.rooms', { n: l.rooms || 1 })}</span><span>${icon('users', 14)} ${t('card.places', { n: l.available_places || 1 })}</span></div>
      <p class="card-price"><b>${money(l.price || 0)}</b> <span>/ ${t('period.' + l.payment_period)}</span></p>
    </div>
  </${tag}>`;
}
function skeletons(n = 6) { return `<div class="grid-cards">${Array.from({ length: n }, () => `<div class="card skel"><div class="card-media"><div class="card-photo"></div></div><div class="card-body"><i></i><i></i><i class="s"></i></div></div>`).join('')}</div>`; }

/* ------------------------------ Shell ------------------------------ */
function renderShell() {
  const u = state.user;
  const theme = document.documentElement.dataset.theme;
  $('#header').innerHTML = `
    <div class="wrap header-in">
      <a href="#" class="logo" aria-label="QULAYJOY">${logoSvg()}<span>QULAYJOY<em>.</em></span></a>
      <nav class="top-nav" aria-label="main">
        <a href="#" data-nav="home">${t('nav.home')}</a>
        <a href="#favorites" data-nav="favorites">${t('nav.fav')}</a>
        ${u ? `<a href="#messages" data-nav="messages">${t('nav.msgs')}<span class="nbadge" data-unread hidden></span></a><a href="#profile" data-nav="profile">${t('nav.my')}</a>` : ''}
      </nav>
      <div class="header-actions">
        <label class="lang-select" title="${t('common.lang')}">${icon('globe', 16)}
          <select id="langSel" aria-label="${t('common.lang')}">${i18n.langs.map(l => `<option value="${l}" ${l === i18n.lang ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select>
        </label>
        <button class="icon-btn" id="themeBtn" aria-label="${t('common.theme')}">${icon(theme === 'dark' ? 'sun' : 'moon', 18)}</button>
        ${u ? `<a class="icon-btn hide-sm" href="#profile" aria-label="${t('nav.profile')}">${icon('user', 18)}</a>` : `<a class="btn ghost hide-sm" href="#auth">${t('nav.login')}</a>`}
        <a class="btn primary hide-sm" href="#new">${icon('plus', 16)} ${t('nav.post')}</a>
      </div>
    </div>`;
  $('#bottomNav').innerHTML = `
    <a href="#" data-nav="home">${icon('search', 20)}<span>${t('nav.search')}</span></a>
    <a href="#favorites" data-nav="favorites">${icon('heart', 20)}<span>${t('nav.fav')}</span></a>
    <a href="#new" data-nav="new" class="bn-post"><b>${icon('plus', 22)}</b><span>${t('nav.post')}</span></a>
    <a href="${u ? '#messages' : '#auth'}" data-nav="messages" class="bn-msg">${icon('chat', 20)}<span>${t('nav.msgs')}</span><i class="nbadge" data-unread hidden></i></a>
    <a href="${u ? '#profile' : '#auth'}" data-nav="profile">${icon('user', 20)}<span>${u ? t('nav.profile') : t('nav.login')}</span></a>`;
  $('#footer').innerHTML = `
    <div class="wrap footer-in">
      <div><a href="#" class="logo">${logoSvg()}<span>QULAYJOY<em>.</em></span></a><p>${t('footer.about')}</p></div>
      <div class="footer-links"><b>${t('cats.heading')}</b>${CATEGORIES.slice(0, 5).map(c => `<a href="#" data-cat="${c.id}">${esc(td('cat', c.id))}</a>`).join('')}</div>
      <div class="footer-links"><b>${t('cities.heading')}</b>${['Toshkent', 'Samarqand', 'Buxoro', 'Xiva', 'Farg‘ona'].map(c => `<a href="#" data-city="${esc(c)}">${esc(td('city', c))}</a>`).join('')}</div>
    </div>
    <div class="wrap footer-bottom"><span>© ${new Date().getFullYear()} QULAYJOY. ${t('footer.rights')}</span>${S().mode === 'demo' ? `<span class="demo-pill">${t('mode.demo')}</span>` : ''}</div>`;
  $('#langSel').onchange = e => { i18n.setLang(e.target.value); renderShell(); render(); };
  $('#themeBtn').onclick = () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; prefs.set('theme', n); renderShell(); markNav(); };
  $$('[data-cat]', $('#footer')).forEach(a => a.onclick = e => { e.preventDefault(); state.filters = { category: a.dataset.cat }; saveFilters(); go(''); scrollToResults(); });
  $$('[data-city]', $('#footer')).forEach(a => a.onclick = e => { e.preventDefault(); state.filters = { city: a.dataset.city }; saveFilters(); go(''); scrollToResults(); });
  markNav();
  refreshUnread();
}
function markNav() {
  const r = route().name;
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === r || (r === 'auth' && a.dataset.nav === 'profile') || (r === 'chat' && a.dataset.nav === 'messages')));
}
const logoSvg = () => `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--primary)"/><path d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1h-4.5v-5.5h-5V25H9a1 1 0 0 1-1-1Z" fill="#fff"/><circle cx="24.5" cy="8.5" r="3" fill="var(--highlight)"/></svg>`;
const scrollToResults = () => setTimeout(() => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

/* ------------------------------ Router ------------------------------ */
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!h || h.includes('access_token') || h.includes('error=')) return { name: 'home' };
  if (h.startsWith('listing-')) return { name: 'listing', id: h.slice(8) };
  if (h.startsWith('edit-')) return { name: 'new', id: h.slice(5) };
  if (h.startsWith('chat-')) return { name: 'chat', id: h.slice(5) };
  if (['new', 'auth', 'profile', 'favorites', 'reset', 'messages'].includes(h)) return { name: h };
  if (h === 'results') return { name: 'home', results: true };
  return { name: 'home' };
}
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const r = route();
  const view = $('#view');
  markNav();
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  const views = { home, listing, new: listingForm, auth, profile, favorites, reset, messages, chat };
  stopChatPoll();
  try {
    if (['new', 'profile', 'messages', 'chat'].includes(r.name) && !state.user) { state.afterLogin = location.hash.slice(1); return go('auth'); }
    await views[r.name](view, r, () => seq === renderSeq);
  } catch (e) {
    console.error(e);
    if (seq === renderSeq) view.innerHTML = `<div class="wrap empty"><h2>${t('err.generic')}</h2><a class="btn primary" href="#">${t('nav.home')}</a></div>`;
  }
  if (r.name !== 'home' || !r.results) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ------------------------------ Bosh sahifa ------------------------------ */
async function home(view, r, alive) {
  setTitle('');
  const f = state.filters;
  const long = LONG_STAY.includes(f.category);
  view.innerHTML = `
  <section class="hero">
    <img src="assets/img/tashkent.jpg" alt="Toshkent" fetchpriority="high">
    <div class="hero-shade"></div>
    <div class="wrap hero-in">
      <span class="hero-label">${icon('pin', 14)} ${t('hero.label')}</span>
      <h1>QULAYJOY<em>.</em></h1>
      <p class="hero-tag">${t('tagline')}</p>
      <p class="hero-sub">${t('hero.sub')}</p>
      <div class="hero-stats"><span><b>${CITIES.length}</b> ${t('hero.stat1')}</span><span><b>${CATEGORIES.length}</b> ${t('hero.stat2')}</span><span><b>0 ${t('currency')}</b> ${t('hero.stat3')}</span></div>
    </div>
  </section>
  <div class="wrap">
    <form class="search-panel" id="searchForm" autocomplete="off">
      <div class="sp-head"><b>${icon('search', 16)} ${t('search.title')}</b></div>
      <div class="sp-fields">
        <label class="field"><span>${icon('pin', 14)} ${t('search.where')}</span>
          <select name="city"><option value="">${t('search.allCities')}</option>${CITIES.map(c => `<option value="${esc(c)}" ${f.city === c ? 'selected' : ''}>${esc(td('city', c))}</option>`).join('')}</select></label>
        <label class="field grow"><span>${icon('search', 14)} ${t('search.q')}</span><input name="q" value="${esc(f.q || '')}" placeholder="${t('search.qph')}"></label>
        <label class="field"><span>${icon('calendar', 14)} ${long ? t('search.from') : t('search.arrive')}</span><input type="date" name="date" value="${esc(f.date || '')}"></label>
        ${long ? `<label class="field"><span>${icon('door', 14)} ${t('search.rooms')}</span><input type="number" min="1" max="20" name="rooms" value="${esc(f.rooms || '')}" placeholder="1+"></label>`
               : `<label class="field"><span>${icon('calendar', 14)} ${t('search.depart')}</span><input type="date" name="end" value="${esc(f.end || '')}"></label>`}
        <label class="field sm"><span>${icon('users', 14)} ${long ? t('search.people') : t('search.guests')}</span><input type="number" min="1" max="50" name="guests" value="${esc(f.guests || '')}" placeholder="1"></label>
        <button class="btn primary big">${icon('search', 18)} ${t('search.btn')}</button>
      </div>
    </form>

    <section class="section">
      <div class="sec-head"><h2>${t('cats.heading')}</h2></div>
      <div class="cat-row" role="tablist">
        <button class="cat${!f.category ? ' active' : ''}" data-c="">${icon('sparkle', 20)}<span>${t('cats.all')}</span></button>
        ${CATEGORIES.map(c => `<button class="cat${f.category === c.id ? ' active' : ''}" data-c="${c.id}">${icon(c.icon, 20)}<span>${esc(td('cat', c.id))}</span></button>`).join('')}
      </div>
    </section>

    <section class="section" id="results">
      <div class="results-head">
        <div><h2 id="resTitle"></h2><p class="muted" id="resCount"></p></div>
        <div class="results-tools">
          <div class="seg" role="group"><button data-view="list" class="${state.view === 'list' ? 'on' : ''}">${icon('list', 16)} ${t('view.list')}</button><button data-view="map" class="${state.view === 'map' ? 'on' : ''}">${icon('map', 16)} ${t('view.map')}</button></div>
          <select id="sortSel" class="select-sm" aria-label="sort">${['newest', 'priceAsc', 'priceDesc'].map(s => `<option value="${s}" ${(f.sort || 'newest') === s ? 'selected' : ''}>${t('sort.' + s)}</option>`).join('')}</select>
          <button class="btn outline" id="filterBtn">${icon('sliders', 16)} ${t('filters.btn')}<span class="dot" id="filterDot" hidden></span></button>
        </div>
      </div>
      <div id="activeChips" class="chips"></div>
      <div id="resBody">${skeletons()}</div>
    </section>

    <section class="section">
      <div class="sec-head"><div><h2>${t('cities.heading')}</h2><p class="muted">${t('cities.sub')}</p></div></div>
      <div class="city-grid">${[['Toshkent', 'tashkent'], ['Samarqand', 'samarkand'], ['Buxoro', 'bukhara'], ['Xiva', 'khiva']].map(([c, img]) => `<button class="city-tile" data-city="${esc(c)}"><img src="assets/img/${img}.jpg" alt="${esc(td('city', c))}" loading="lazy"><span>${esc(td('city', c))}<small id="cc-${img}"></small></span></button>`).join('')}</div>
    </section>

    <section class="section how">
      <h2>${t('how.heading')}</h2>
      <div class="how-grid">${[['search', 1], ['phone', 2], ['key', 3]].map(([ic, n]) => `<div class="how-step"><span class="how-num">${n}</span>${icon(ic, 26)}<h3>${t(`how.${n}t`)}</h3><p>${t(`how.${n}d`)}</p></div>`).join('')}</div>
    </section>

    <section class="cta">
      <div><h2>${t('cta.t')}</h2><p>${t('cta.d')}</p></div>
      <a class="btn light big" href="#new">${icon('plus', 18)} ${t('nav.post')}</a>
    </section>

    <section class="trust">${[['shield', 1], ['badge', 2], ['users', 3]].map(([ic, n]) => `<div>${icon(ic, 26)}<div><h3>${t(`trust.${n}t`)}</h3><p>${t(`trust.${n}d`)}</p></div></div>`).join('')}</section>
  </div>`;

  // Hodisalar
  $('#searchForm').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.assign(state.filters, { city: fd.get('city') || '', q: fd.get('q') || '', date: fd.get('date') || '', end: fd.get('end') || '', guests: +fd.get('guests') || 0, rooms: +fd.get('rooms') || state.filters.rooms || 0 });
    saveFilters(); drawResults(); scrollToResults();
  };
  $$('.cat').forEach(b => b.onclick = () => {
    const was = LONG_STAY.includes(state.filters.category);
    state.filters.category = b.dataset.c; saveFilters();
    $$('.cat').forEach(x => x.classList.toggle('active', x === b));
    if (was !== LONG_STAY.includes(b.dataset.c)) { home(view, { results: true }, alive); setTimeout(scrollToResults, 50); } else drawResults();
  });
  $$('.city-tile').forEach(b => b.onclick = () => { state.filters.city = b.dataset.city; saveFilters(); $('#searchForm [name=city]').value = b.dataset.city; drawResults(); scrollToResults(); });
  $$('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; prefs.set('view', state.view); $$('[data-view]').forEach(x => x.classList.toggle('on', x === b)); drawResults(); });
  $('#sortSel').onchange = e => { state.filters.sort = e.target.value; saveFilters(); drawResults(); };
  $('#filterBtn').onclick = openFilters;

  const list = await loadListings();
  if (!alive()) return;
  // shahar bo'yicha sonlar
  [['Toshkent', 'tashkent'], ['Samarqand', 'samarkand'], ['Buxoro', 'bukhara'], ['Xiva', 'khiva']].forEach(([c, k]) => { const n = list.filter(l => l.city === c).length; const el = $('#cc-' + k); if (el) el.textContent = t('results.count', { n }); });
  drawResults(true);
  if (r.results || (state.view === 'map' && state.mapSel)) scrollToResults();
}

function drawResults(keepMap = false) {
  const body = $('#resBody'); if (!body) return;
  if (!keepMap) { state.mapSel = null; state.mapView = null; }
  const f = state.filters;
  const res = filterListings(state.listings || [], f);
  $('#resTitle').textContent = f.city ? t('results.inCity', { city: td('city', f.city) }) : t('results.default');
  $('#resCount').textContent = t('results.count', { n: res.length }) + (f.category ? ' · ' + td('cat', f.category) : '');
  // faol filtr chiplari
  const chips = [];
  if (f.city) chips.push(['city', td('city', f.city)]);
  if (f.category) chips.push(['category', td('cat', f.category)]);
  if (f.q) chips.push(['q', `“${f.q}”`]);
  if (f.min) chips.push(['min', `≥ ${i18n.price(f.min)}`]);
  if (f.max) chips.push(['max', `≤ ${i18n.price(f.max)}`]);
  if (f.district) chips.push(['district', f.district]);
  if (f.guests) chips.push(['guests', `${icon('users', 12)} ${f.guests}`]);
  if (f.rooms) chips.push(['rooms', `${icon('door', 12)} ${f.rooms}+`]);
  if (f.date) chips.push(['date', i18n.date(f.date)]);
  if (f.end) chips.push(['end', '→ ' + i18n.date(f.end)]);
  (f.amenities || []).forEach(a => chips.push(['amenity:' + a, td('amenity', a)]));
  $('#activeChips').innerHTML = chips.map(([k, v]) => `<button class="chip" data-k="${esc(k)}">${k === 'guests' || k === 'rooms' ? v : esc(v)} ${icon('x', 12)}</button>`).join('') + (chips.length > 1 ? `<button class="chip clear" data-k="*">${t('filters.clear')}</button>` : '');
  $('#filterDot').hidden = !(f.min || f.max || f.district || f.amenities?.length || f.rooms);
  $$('#activeChips .chip').forEach(c => c.onclick = () => {
    const k = c.dataset.k;
    if (k === '*') state.filters = { sort: f.sort };
    else if (k.startsWith('amenity:')) state.filters.amenities = (f.amenities || []).filter(a => a !== k.slice(8));
    else delete state.filters[k];
    saveFilters();
    if (k === 'category' || k === '*') { home($('#view'), { results: true }, () => true); return; }
    if (k === 'city') $('#searchForm [name=city]').value = '';
    if (k === 'q') $('#searchForm [name=q]').value = '';
    drawResults();
  });

  if (state.view === 'map') { drawMapView(body, res); return; }
  if (!res.length) {
    body.innerHTML = `<div class="empty">${icon('search', 40)}<h3>${t('empty.none')}</h3><p class="muted">${t('empty.noneHint')}</p><div class="row-gap"><button class="btn outline" id="clearAll">${icon('x', 16)} ${t('filters.clear')}</button><a class="btn primary" href="#new">${icon('plus', 16)} ${t('empty.post')}</a></div></div>`;
    $('#clearAll').onclick = () => { state.filters = {}; saveFilters(); home($('#view'), { results: true }, () => true); };
    return;
  }
  body.innerHTML = `<div class="grid-cards">${res.map(l => card(l)).join('')}</div>`;
}
function shortPrice(p) { p = Number(p) || 0; if (p >= 1e6) return (p / 1e6).toFixed(p % 1e6 ? 1 : 0).replace('.0', '') + 'M'; if (p >= 1e3) return Math.round(p / 1e3) + 'K'; return String(p); }
function mapPanelHtml(l, idx, total, d) {
  const img = l.media?.find(m => m.url)?.url;
  const href = `#listing-${esc(l.id)}`;
  const fav = favs.has(l.id);
  return `<button class="mp-x" data-mp="close" aria-label="close">${icon('x', 16)}</button>
    <a class="mp-media" href="${href}">${img ? `<img src="${esc(img)}" alt="${esc(l.title)}">` : `<div class="ph ph-${esc(l.category)}">${icon(catIcon(l.category), 40)}</div>`}
      ${l.sample ? `<span class="badge sample">${t('sample')}</span>` : ''}${l.media?.length > 1 ? `<span class="badge count">${icon('image', 12)} ${l.media.length}</span>` : ''}</a>
    <button class="fav-btn${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="${t('detail.save')}" aria-pressed="${fav}">${icon('heart', 18)}</button>
    <div class="mp-body">
      <span class="card-cat">${icon(catIcon(l.category), 14)} ${esc(td('cat', l.category))}</span>
      <a href="${href}"><h3 class="card-title">${esc(l.title)}</h3></a>
      <p class="card-loc">${icon('pin', 14)} ${esc(td('city', l.city))}${l.district ? ', ' + esc(l.district) : ''}</p>
      <div class="card-meta"><span>${icon('door', 14)} ${t('card.rooms', { n: l.rooms || 1 })}</span><span>${icon('users', 14)} ${t('card.places', { n: l.available_places || 1 })}</span>${d > 0.05 ? `<span>${icon('map', 14)} ${t('map.away', { d: d < 10 ? d.toFixed(1) : Math.round(d) })}</span>` : ''}</div>
      <p class="card-price"><b>${money(l.price)}</b> <span>/ ${t('period.' + l.payment_period)}</span></p>
      <div class="mp-actions">
        ${total > 1 ? `<button class="icon-btn" data-mp="prev" ${idx <= 0 ? 'disabled' : ''} aria-label="${t('map.prev')}" title="${t('map.prev')}">${icon('chevronLeft', 18)}</button>` : ''}
        <a class="btn primary sm grow" href="${href}">${t('map.details')} ${icon('arrowRight', 15)}</a>
        ${total > 1 ? `<button class="icon-btn" data-mp="next" ${idx >= total - 1 ? 'disabled' : ''} aria-label="${t('map.next')}" title="${t('map.next')}">${icon('chevronRight', 18)}</button>` : ''}
      </div>
      ${total > 1 ? `<p class="mp-count">${t('map.count', { i: idx + 1, n: total })}</p>` : ''}
    </div>`;
}

/** Xarita ko'rinishi: belgini bosish -> kartochka (rasm, narx, ma'lumot), yaqindagilar bo'ylab oldinga/orqaga */
async function drawMapView(body, res) {
  const pts = res.flatMap(l => { const p = listingPoint(l); return p ? [{ l, p }] : []; });
  const byId = new Map(pts.map(x => [x.l.id, x]));
  body.innerHTML = `<div class="map-shell">
      <div class="map big" id="resMap"></div>
      <div class="map-panel" id="mapPanel" hidden></div>
      <div class="map-hint" id="mapHint">${icon('pin', 14)} ${t('map.hint')}</div>
      <button class="btn light sm map-near-btn" id="nearMe">${icon('locate', 15)} ${t('map.nearMe')}</button>
    </div>
    <div class="near-head" id="nearHead" hidden><b>${icon('pin', 15)} ${t('map.near')}</b><span class="muted small" id="nearSub"></span></div>
    <div class="near-strip" id="nearStrip"></div>
    ${pts.some(x => x.p.approx) ? `<p class="muted small map-foot">${t('detail.approx')}</p>` : ''}`;
  let order = [];
  let api = null;
  const strip = () => {
    const box = $('#nearStrip'); if (!box) return;
    const near = order.slice(0, 12);
    $('#nearHead').hidden = !near.length;
    box.innerHTML = near.map((o, i) => { const l = byId.get(o.id).l; const img = l.media?.find(m => m.url)?.url;
      return `<button class="near-card${o.id === state.mapSel ? ' on' : ''}" data-near="${esc(o.id)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div class="ph ph-${esc(l.category)}">${icon(catIcon(l.category), 22)}</div>`}<span><b>${money(l.price)}</b><small>${esc(l.title)}</small><em>${i === 0 ? esc(td('city', l.city)) : t('map.away', { d: o.d < 10 ? o.d.toFixed(1) : Math.round(o.d) })}</em></span></button>`; }).join('');
    $$('[data-near]', box).forEach(b => b.onclick = () => show(b.dataset.near, true, true));
    box.querySelector('.on')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };
  const show = (id, pan = true, keepOrder = false) => {
    const cur = byId.get(id); if (!cur) return;
    state.mapSel = id;
    if (!keepOrder || !order.length) order = pts.map(x => ({ id: x.l.id, d: distKm(cur.p, x.p) })).sort((a, b) => a.d - b.d);
    const idx = order.findIndex(o => o.id === id);
    const panel = $('#mapPanel'); if (!panel) return;
    panel.hidden = false; $('#mapHint').hidden = true;
    panel.innerHTML = mapPanelHtml(cur.l, idx, order.length, order[idx].d);
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
    $('#nearSub').textContent = t('map.nearSub', { t: cur.l.title.length > 40 ? cur.l.title.slice(0, 40) + '…' : cur.l.title });
    $$('[data-mp]', panel).forEach(b => b.onclick = () => {
      const a = b.dataset.mp;
      if (a === 'close') { hide(); return; }
      const j = idx + (a === 'next' ? 1 : -1);
      if (order[j]) show(order[j].id, true, true);
    });
    api?.select(id, pan);
    strip();
  };
  const hide = () => { state.mapSel = null; const p = $('#mapPanel'); if (p) p.hidden = true; const h = $('#mapHint'); if (h) h.hidden = false; api?.select(null, false); order = []; strip(); };
  mapKeys = e => { if (!$('#mapPanel') || $('#mapPanel').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') $('[data-mp=next]')?.click(); if (e.key === 'ArrowLeft') $('[data-mp=prev]')?.click(); if (e.key === 'Escape') hide(); };
  $('#nearMe').onclick = () => {
    if (!navigator.geolocation) return toast(t('map.noGeo'), 'err');
    navigator.geolocation.getCurrentPosition(pos => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const best = pts.map(x => ({ id: x.l.id, d: distKm(me, x.p) })).sort((a, b) => a.d - b.d)[0];
      if (best) show(best.id);
    }, () => toast(t('map.noGeo'), 'err'), { timeout: 8000 });
  };
  api = await listingsMap($('#resMap'), pts.map(x => ({ id: x.l.id, ...x.p, label: shortPrice(x.l.price), title: x.l.title })), {
    onSelect: id => show(id),
    view: state.mapView,
    onMove: v => (state.mapView = v),
    onMapClick: () => {},
  });
  if (state.mapSel && byId.has(state.mapSel)) show(state.mapSel, !state.mapView);
}
let mapKeys = null;
document.addEventListener('keydown', e => mapKeys?.(e));

function openFilters() {
  const f = state.filters;
  const d = document.createElement('div');
  d.className = 'sheet-back';
  d.innerHTML = `<form class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-head"><h3>${t('filters.btn')}</h3><button type="button" class="icon-btn" data-close aria-label="close">${icon('x', 18)}</button></div>
    <div class="sheet-body">
      <div class="two"><label class="field"><span>${t('filters.min')}</span><input type="number" name="min" min="0" step="10000" value="${esc(f.min || '')}" placeholder="0"></label>
      <label class="field"><span>${t('filters.max')}</span><input type="number" name="max" min="0" step="10000" value="${esc(f.max || '')}" placeholder="∞"></label></div>
      <div class="price-quick">${[[0, 300000], [300000, 1000000], [1000000, 5000000], [5000000, 0]].map(([a, b]) => `<button type="button" class="chip" data-range="${a},${b}">${a ? shortPrice(a) : '0'} – ${b ? shortPrice(b) : '∞'}</button>`).join('')}</div>
      <div class="two"><label class="field"><span>${t('filters.district')}</span><input name="district" value="${esc(f.district || '')}"></label>
      <label class="field"><span>${t('filters.rooms')}</span><input type="number" name="rooms" min="1" max="20" value="${esc(f.rooms || '')}"></label></div>
      <p class="label">${t('filters.amenities')}</p>
      <div class="am-grid">${AMENITIES.map(a => `<label class="am"><input type="checkbox" name="amenities" value="${a}" ${(f.amenities || []).includes(a) ? 'checked' : ''}><span>${esc(td('amenity', a))}</span></label>`).join('')}</div>
    </div>
    <div class="sheet-foot"><button type="button" class="btn ghost" data-reset>${t('filters.clear')}</button><button class="btn primary">${t('filters.apply')}</button></div>
  </form>`;
  document.body.appendChild(d);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => d.classList.add('show'));
  const close = () => { d.classList.remove('show'); document.body.classList.remove('no-scroll'); setTimeout(() => d.remove(), 250); };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  $$('[data-range]', d).forEach(b => b.onclick = () => { const [a, c] = b.dataset.range.split(','); $('[name=min]', d).value = +a || ''; $('[name=max]', d).value = +c || ''; });
  $('[data-reset]', d).onclick = () => { $$('input', d).forEach(i => (i.type === 'checkbox' ? (i.checked = false) : (i.value = ''))); };
  $('form', d).onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.assign(state.filters, { min: +fd.get('min') || 0, max: +fd.get('max') || 0, district: String(fd.get('district') || '').trim(), rooms: +fd.get('rooms') || 0, amenities: fd.getAll('amenities') });
    saveFilters(); close(); drawResults();
  };
}

/* ------------------------------ E'lon sahifasi ------------------------------ */
async function listing(view, r, alive) {
  view.innerHTML = `<div class="wrap pad">${skeletons(1)}</div>`;
  const l = await S().getListing(r.id);
  if (!alive()) return;
  if (l && !l.sample && S().mode === 'live') await S().recordListingView(l.id).catch(() => {});
  if (!l) { setTitle(t('detail.notFound')); view.innerHTML = `<div class="wrap empty">${icon('search', 40)}<h2>${t('detail.notFound')}</h2><p class="muted">${t('detail.notFoundText')}</p><a class="btn primary" href="#">${icon('arrowLeft', 16)} ${t('detail.back')}</a></div>`; return; }
  setTitle(l.title);
  const mine = state.user && l.owner_id === state.user.id;
  const media = (l.media || []).filter(m => m.url);
  const p = listingPoint(l);
  const fav = favs.has(l.id);
  const all = await loadListings();
  const similar = all.filter(x => x.id !== l.id && (x.city === l.city || x.category === l.category)).slice(0, 4);

  view.innerHTML = `
  <div class="wrap pad detail">
    <div class="detail-top"><button class="link-btn" id="backBtn">${icon('arrowLeft', 16)} ${t('detail.back')}</button>
      <div class="row-gap"><button class="btn outline sm" id="shareBtn">${icon('share', 15)} ${t('detail.share')}</button>
      <button class="btn outline sm fav-toggle${fav ? ' on' : ''}" id="favBtn">${icon('heart', 15)} <span>${fav ? t('detail.saved') : t('detail.save')}</span></button>
      ${mine ? `<a class="btn outline sm" href="#edit-${esc(l.id)}">${icon('edit', 15)} ${t('detail.edit')}</a>` : ''}</div></div>

    <div class="gallery ${media.length > 1 ? 'multi' : ''}">
      ${media.length ? `<div class="g-main" id="gMain">${media.map((m, i) => `<img src="${esc(m.url)}" alt="${esc(l.title)} ${i + 1}" data-i="${i}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>
        ${media.length > 1 ? `<button class="g-nav prev" aria-label="prev">${icon('chevronLeft', 20)}</button><button class="g-nav next" aria-label="next">${icon('chevronRight', 20)}</button><span class="g-count" id="gCount">1 / ${media.length}</span>` : ''}`
      : `<div class="g-main"><div class="ph ph-${esc(l.category)} g-ph">${icon(catIcon(l.category), 72)}</div></div>`}
    </div>
    ${media.length > 1 ? `<div class="thumbs">${media.map((m, i) => `<button data-t="${i}" class="${i ? '' : 'on'}"><img src="${esc(m.url)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}

    <div class="detail-grid">
      <div class="detail-main">
        <span class="card-cat">${icon(catIcon(l.category), 15)} ${esc(td('cat', l.category))} ${l.sample ? `<span class="badge sample inline">${t('sample')}</span>` : ''} ${l.status && l.status !== 'active' ? `<span class="badge st-${esc(l.status)} inline">${t('status.' + l.status)}</span>` : ''}</span>
        <h1 class="detail-title">${esc(l.title)}</h1>
        <p class="detail-loc">${icon('pin', 16)} ${esc(td('city', l.city))}${l.district ? ', ' + esc(l.district) : ''}${l.address ? ' · ' + esc(l.address) : ''}</p>
        <div class="facts">
          <div>${icon('door', 20)}<span>${t('detail.rooms', { n: l.rooms || 1 })}</span></div>
          <div>${icon('users', 20)}<span>${t('detail.free', { n: l.available_places, t: l.total_places })}</span></div>
          ${l.floor != null ? `<div>${icon('building', 20)}<span>${t('detail.floor', { n: l.floor })}</span></div>` : ''}
          ${l.created_at ? `<div>${icon('calendar', 20)}<span>${t('detail.posted', { d: i18n.date(l.created_at) })}</span></div>` : ''}
        </div>
        <h2>${t('detail.about')}</h2><p class="prose">${esc(l.description)}</p>
        ${l.amenities?.length ? `<h2>${t('detail.amenities')}</h2><div class="am-list">${l.amenities.map(a => `<span>${icon('check', 15)} ${esc(td('amenity', a))}</span>`).join('')}</div>` : ''}
        ${l.house_rules ? `<h2>${t('detail.rules')}</h2><p class="prose">${esc(l.house_rules)}</p>` : ''}
        ${l.available_from ? `<h2>${t('detail.available')}</h2><p>${l.available_to ? t('detail.fromTo', { a: i18n.date(l.available_from), b: i18n.date(l.available_to) }) : t('detail.fromOnly', { a: i18n.date(l.available_from) })}</p>` : ''}
        ${p ? `<h2>${t('detail.location')}</h2><div class="map-shell small"><div class="map" id="dMap"></div><div class="map-panel" id="dPanel" hidden></div></div><p class="muted small">${p.approx ? t('detail.approx') + ' ' : ''}${t('detail.nearbyHint')}</p>` : ''}
      </div>
      <aside class="detail-side">
        <div class="price-card">
          <p class="pc-price"><b>${money(l.price)}</b> / ${t('period.' + l.payment_period)}</p>
          <h3>${icon('chat', 18)} ${t('detail.contact')}</h3>
          ${mine ? `<p class="notice">${t('chat.own')}</p><p class="muted small">${icon('eye',14)} ${Number(l.views_count||0)} marta ko‘rilgan</p><a class="btn outline block" href="#messages">${icon('chat', 16)} ${t('nav.msgs')}</a>`
                 : `<button class="btn primary block big" data-book>Joyni bron qilish</button><button class="btn outline block" data-chat>${icon('chat', 18)} ${t('chat.write')}</button>
                    <button class="btn outline block" data-paid>${icon('phone', 16)} ${t('paid.btn')} <span class="paid-tag">${money(CONTACT_PRICE)}</span></button>`}
          <p class="muted small">${t('detail.contactText')}</p>
          <p class="safety">${icon('shield', 14)} ${t('detail.safety')}</p>
        </div>
      </aside>
    </div>
    ${similar.length ? `<section class="section"><h2>${t('detail.similar')}</h2><div class="grid-cards">${similar.map(x => card(x)).join('')}</div></section>` : ''}
  </div>
  <div class="mobile-cta"><div><b>${money(l.price)}</b><small>/ ${t('period.' + l.payment_period)}</small></div>${mine ? `<a class="btn outline" href="#edit-${esc(l.id)}">${icon('edit', 16)} ${t('detail.edit')}</a>` : `<button class="btn primary" data-book>Bron qilish</button><button class="icon-btn" data-paid aria-label="${t('paid.btn')}">${icon('phone', 18)}</button>`}</div>`;
  document.body.classList.add('has-mcta');

  $('#backBtn').onclick = () => (history.length > 1 ? history.back() : go(''));
  $('#shareBtn').onclick = async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: l.title, url }); return; } catch {} }
    if (await copyText(url)) toast(t('detail.copied'));
  };
  $('#favBtn').onclick = e => { const on = favs.toggle(l.id); e.currentTarget.classList.toggle('on', on); $('span', e.currentTarget).textContent = on ? t('detail.saved') : t('detail.save'); toast(on ? t('detail.saved') : '✓'); };
  const openChat = async btn => {
    if (!state.user) { state.afterLogin = 'listing-' + l.id; toast(t('auth.required')); return go('auth'); }
    btn.disabled = true;
    try { const cid = await S().startChat(l); go('chat-' + cid); }
    catch (err) { const m = err.message || ''; toast(m.includes('.') && !m.includes(' ') ? t(m) : m || t('err.generic'), 'err'); btn.disabled = false; }
  };
  $('[data-book]').forEach(b => b.onclick = () => openBooking(l));
  $('[data-chat]').forEach(b => b.onclick = () => openChat(b));
  $$('[data-paid]').forEach(b => b.onclick = () => paidDialog(() => openChat(b)));
  // galereya
  const gm = $('#gMain');
  if (gm && media.length > 1) {
    const goTo = i => { i = (i + media.length) % media.length; gm.scrollTo({ left: gm.clientWidth * i, behavior: 'smooth' }); };
    const cur = () => Math.round(gm.scrollLeft / gm.clientWidth);
    $('.g-nav.prev').onclick = () => goTo(cur() - 1);
    $('.g-nav.next').onclick = () => goTo(cur() + 1);
    $$('.thumbs button').forEach(b => b.onclick = () => goTo(+b.dataset.t));
    gm.addEventListener('scroll', () => { const i = cur(); $('#gCount').textContent = `${i + 1} / ${media.length}`; $$('.thumbs button').forEach(b => b.classList.toggle('on', +b.dataset.t === i)); }, { passive: true });
  }
  if (gm && media.length) gm.addEventListener('click', e => { const img = e.target.closest('img'); if (img) lightbox(media, +img.dataset.i); });
  if (p) {
    const others = all.filter(x => x.id !== l.id).flatMap(x => { const q = listingPoint(x); return q && distKm(p, q) < 40 ? [{ l: x, p: q, d: distKm(p, q) }] : []; }).sort((a, b) => a.d - b.d).slice(0, 15);
    const items = [{ id: l.id, ...p, label: icon('home', 13) + ' ' + shortPrice(l.price), main: true }, ...others.map(o => ({ id: o.l.id, ...o.p, label: shortPrice(o.l.price), small: true }))];
    let dApi = null;
    const dShow = id => {
      const o = others.find(x => x.l.id === id); const panel = $('#dPanel'); if (!panel) return;
      if (!o) { panel.hidden = true; dApi?.select(l.id, false); return; }
      const idx = others.indexOf(o);
      panel.hidden = false; panel.innerHTML = mapPanelHtml(o.l, idx, others.length, o.d);
      panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      $$('[data-mp]', panel).forEach(b => b.onclick = () => { const a = b.dataset.mp; if (a === 'close') { panel.hidden = true; dApi?.select(l.id, false); return; } const n = others[idx + (a === 'next' ? 1 : -1)]; if (n) dShow(n.l.id); });
      dApi?.select(id, true);
    };
    dApi = await listingsMap($('#dMap'), items, { maxZoom: p.approx ? 13 : 15, onSelect: dShow, view: { center: { lat: p.lat, lng: p.lng }, zoom: p.approx ? 13 : 14 } });
    dApi?.select(l.id, false);
  }
}
function lightbox(media, start) {
  let i = start;
  const d = document.createElement('div'); d.className = 'lightbox';
  const draw = () => { d.innerHTML = `<img src="${esc(media[i].url)}" alt=""><button class="lb-x" aria-label="close">${icon('x', 22)}</button>${media.length > 1 ? `<button class="lb-p">${icon('chevronLeft', 26)}</button><button class="lb-n">${icon('chevronRight', 26)}</button><span class="lb-c">${i + 1} / ${media.length}</span>` : ''}`; };
  draw(); document.body.appendChild(d); document.body.classList.add('no-scroll');
  const close = () => { d.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { i = (i + 1) % media.length; draw(); } if (e.key === 'ArrowLeft') { i = (i - 1 + media.length) % media.length; draw(); } };
  document.addEventListener('keydown', key);
  d.addEventListener('click', e => { if (e.target.closest('.lb-n')) { i = (i + 1) % media.length; draw(); } else if (e.target.closest('.lb-p')) { i = (i - 1 + media.length) % media.length; draw(); } else if (e.target.closest('.lb-x') || e.target === d) close(); });
}

/* ------------------------------ Kirish / Ro'yxat ------------------------------ */
async function auth(view, r) {
  setTitle(t('auth.login'));
  if (state.user) return go('profile');
  let tab = 'login';
  const draw = () => {
    view.innerHTML = `<div class="wrap pad auth-wrap">
      <div class="auth-art"><img src="assets/img/samarkand.jpg" alt=""><div><h2>${t('auth.welcome')}</h2><p>${t('auth.sub')}</p></div></div>
      <div class="auth-card">
        ${tab !== 'forgot' ? `<div class="seg wide"><button data-tab="login" class="${tab === 'login' ? 'on' : ''}">${t('auth.login')}</button><button data-tab="signup" class="${tab === 'signup' ? 'on' : ''}">${t('auth.signup')}</button></div>` : `<h2>${t('auth.reset')}</h2>`}
        ${state.afterLogin ? `<p class="notice">${t('auth.required')}</p>` : ''}
        <form id="authForm" novalidate>
          ${tab === 'signup' ? `<div class="two"><label class="field"><span>${t('auth.first')}</span><input name="first_name" required maxlength="80" autocomplete="given-name"></label><label class="field"><span>${t('auth.last')}</span><input name="last_name" maxlength="80" autocomplete="family-name"></label></div>
          <label class="field"><span>${t('auth.phone')}</span><input name="phone" type="tel" placeholder="+998 90 123 45 67" autocomplete="tel"><em class="err" data-err="phone"></em></label>` : ''}
          <label class="field"><span>${t('auth.email')}</span><input name="email" type="email" required autocomplete="email"><em class="err" data-err="email"></em></label>
          ${tab !== 'forgot' ? `<label class="field"><span>${t('auth.password')}</span><input name="password" type="password" required minlength="6" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}"><em class="err" data-err="password"></em></label>` : ''}
          <p class="err-box" id="authErr" hidden></p>
          <button class="btn primary block big" id="authSubmit">${tab === 'login' ? t('auth.login') : tab === 'signup' ? t('auth.signup') : t('auth.reset')}</button>
        </form>
        ${tab === 'login' ? `<button class="link-btn center" data-tab="forgot">${t('auth.forgot')}</button>` : tab === 'forgot' ? `<button class="link-btn center" data-tab="login">${icon('arrowLeft', 14)} ${t('auth.login')}</button>` : ''}
        ${S().mode === 'demo' ? `<p class="muted small center">${icon('shield', 13)} ${t('auth.demo')}</p>` : ''}
      </div></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    $('#authForm').onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      $$('.err', e.target).forEach(x => (x.textContent = ''));
      const errBox = $('#authErr'); errBox.hidden = true;
      let bad = false;
      const fe = (k, m) => { const el = $(`[data-err=${k}]`, e.target); if (el) el.textContent = t(m); bad = true; };
      if (!/^\S+@\S+\.\S+$/.test(fd.email || '')) fe('email', 'err.email');
      if (tab !== 'forgot' && (fd.password || '').length < 6) fe('password', 'err.password');
      if (tab === 'signup' && fd.phone && !PHONE_RE.test(normPhone(fd.phone))) fe('phone', 'err.phone');
      if (bad) return;
      const btn = $('#authSubmit'); btn.disabled = true; btn.classList.add('loading');
      try {
        if (tab === 'login') { await S().signIn(fd); }
        else if (tab === 'signup') {
          const res = await S().signUp({ ...fd, phone: fd.phone ? normPhone(fd.phone) : '' });
          if (res.confirm) { view.querySelector('.auth-card').innerHTML = `<div class="done">${icon('check', 40)}<h2>${t('auth.created')}</h2><p>${t('auth.confirm')}</p><p class="muted small">Email manzilingizni tasdiqlang. Tasdiqlash havolasini ochganingizdan so'ng profilingiz avtomatik ochiladi.</p></div>`; return; }
          toast(t('auth.created'));
        } else {
          const res = await S().resetPassword(fd.email);
          errBox.hidden = false; errBox.className = 'ok-box'; errBox.textContent = res.demo ? t('auth.demo') : t('auth.resetSent');
          btn.disabled = false; btn.classList.remove('loading'); return;
        }
        state.user = await S().currentUser();
        renderShell();
        const next = state.afterLogin; state.afterLogin = '';
        go(next || 'profile');
      } catch (err) {
        errBox.hidden = false; errBox.className = 'err-box';
        const m = err.message || ''; errBox.textContent = m.startsWith('err.') ? t(m) : m || t('err.generic');
        btn.disabled = false; btn.classList.remove('loading');
      }
    };
  };
  draw();
}
async function reset(view) {
  setTitle(t('auth.reset'));
  view.innerHTML = `<div class="wrap pad narrow"><div class="auth-card"><h2>${t('auth.reset')}</h2><form id="rf"><label class="field"><span>${t('auth.newPass')}</span><input type="password" name="p" minlength="6" required autocomplete="new-password"></label><p class="err-box" id="rfErr" hidden></p><button class="btn primary block">${t('auth.savePass')}</button></form></div></div>`;
  $('#rf').onsubmit = async e => {
    e.preventDefault(); const p = e.target.p.value;
    if (p.length < 6) { $('#rfErr').hidden = false; $('#rfErr').textContent = t('err.password'); return; }
    try { await S().updatePassword(p); toast(t('auth.passSaved')); go('profile'); } catch (err) { $('#rfErr').hidden = false; $('#rfErr').textContent = err.message || t('err.generic'); }
  };
}

/* ------------------------------ E'lon formasi ------------------------------ */
async function listingForm(view, r, alive) {
  let ex = null;
  if (r.id) { ex = await S().getListing(r.id); if (!alive()) return; if (!ex || ex.owner_id !== state.user.id) { view.innerHTML = `<div class="wrap empty"><h2>${t('detail.notFound')}</h2><a class="btn primary" href="#profile">${t('nav.my')}</a></div>`; return; } }
  setTitle(ex ? t('form.editTitle') : t('form.newTitle'));
  const prof = await S().getProfile().catch(() => null);
  if (!alive()) return;
  const v = ex || { category: 'apartment_daily', city: 'Toshkent', payment_period: 'daily', available_places: 1, total_places: 1, rooms: 1, status: 'active', amenities: [] };
  let category = v.category;
  let point = v.latitude != null && v.longitude != null ? { lat: +v.latitude, lng: +v.longitude } : null;
  let photos = (ex?.media || []).filter(m => m.url).map(m => ({ id: m.id, url: m.url, storage_path: m.storage_path }));
  const sec = (n, title, body) => `<fieldset class="fsec"><legend><span>${n}</span>${title}</legend>${body}</fieldset>`;
  const fld = (name, label, input) => `<label class="field"><span>${label}</span>${input}<em class="err" data-err="${name}"></em></label>`;

  view.innerHTML = `<div class="wrap pad">
    <div class="form-head"><div><h1>${ex ? t('form.editTitle') : t('form.newTitle')}</h1><p class="muted">${t('form.sub')}</p></div><span class="free-pill">${icon('badge', 15)} ${t('form.free')}</span></div>
    <div class="form-layout">
      <form id="lf" novalidate>
        ${sec(1, t('form.s1'), `
          <p class="label">${t('form.category')}</p>
          <div class="cat-pick">${CATEGORIES.map(c => `<button type="button" data-cat="${c.id}" class="${category === c.id ? 'on' : ''}">${icon(c.icon, 18)}<span>${esc(td('cat', c.id))}</span></button>`).join('')}</div>
          ${fld('title', t('form.title'), `<input name="title" maxlength="160" value="${esc(v.title || '')}" placeholder="${t('form.titlePh')}" required>`)}
          ${fld('description', t('form.description'), `<textarea name="description" rows="5" maxlength="5000" placeholder="${t('form.descPh')}" required>${esc(v.description || '')}</textarea><small class="counter" id="descCount"></small>`)}`)}
        ${sec(2, t('form.s2'), `
          <div class="two">${fld('city', t('form.city'), `<select name="city">${CITIES.map(c => `<option value="${esc(c)}" ${v.city === c ? 'selected' : ''}>${esc(td('city', c))}</option>`).join('')}</select>`)}
          ${fld('district', t('form.district'), `<input name="district" maxlength="100" value="${esc(v.district || '')}">`)}</div>
          ${fld('address', t('form.address'), `<input name="address" maxlength="250" value="${esc(v.address || '')}">`)}
          <p class="label">${t('form.pickMap')}</p>
          <div class="map picker" id="pickMap"></div>
          <div class="row-gap small-gap"><button type="button" class="btn outline sm" id="locBtn">${icon('locate', 15)} ${t('form.myLoc')}</button><button type="button" class="btn ghost sm" id="clrPt">${icon('x', 15)} ${t('form.clearPoint')}</button><span class="muted small" id="ptLabel"></span></div>`)}
        ${sec(3, t('form.s3'), `
          <div class="two">${fld('price', t('form.price'), `<input name="price" type="number" min="0" step="1000" inputmode="numeric" value="${esc(v.price ?? '')}" required>`)}
          ${fld('payment_period', t('form.period'), `<select name="payment_period">${['daily', 'weekly', 'monthly'].map(p => `<option value="${p}" ${v.payment_period === p ? 'selected' : ''}>${t('period.' + p)}</option>`).join('')}</select>`)}</div>
          <div class="three">${fld('available_places', t('form.avail'), `<input name="available_places" type="number" min="1" max="1000" value="${esc(v.available_places)}">`)}
          ${fld('total_places', t('form.total'), `<input name="total_places" type="number" min="1" max="1000" value="${esc(v.total_places)}">`)}
          ${fld('rooms', t('form.rooms'), `<input name="rooms" type="number" min="1" max="100" value="${esc(v.rooms)}">`)}</div>
          <div class="three">${fld('floor', t('form.floor'), `<input name="floor" type="number" min="-5" max="100" value="${esc(v.floor ?? '')}">`)}
          ${fld('available_from', t('form.from'), `<input name="available_from" type="date" value="${esc(v.available_from || '')}">`)}
          ${fld('available_to', t('form.to'), `<input name="available_to" type="date" value="${esc(v.available_to || '')}">`)}</div>`)}
        ${sec(4, t('form.s4'), `
          <div class="photos" id="photos"></div>
          <label class="drop" id="drop">${icon('image', 26)}<b>${t('form.addPhotos')}</b><small>${t('form.photosHint')}</small><input type="file" accept="image/*" multiple id="fileIn" hidden></label>`)}
        ${sec(5, t('form.s5'), `
          <p class="label">${t('form.amenities')}</p>
          <div class="am-grid">${AMENITIES.map(a => `<label class="am"><input type="checkbox" name="amenities" value="${a}" ${(v.amenities || []).includes(a) ? 'checked' : ''}><span>${esc(td('amenity', a))}</span></label>`).join('')}</div>
          ${fld('house_rules', t('form.rules'), `<textarea name="house_rules" rows="3" maxlength="1500" placeholder="${t('form.rulesPh')}">${esc(v.house_rules || '')}</textarea>`)}`)}
        ${sec(6, t('form.s6'), `
          <p class="notice">${icon('chat', 15)} ${t('form.chatNote')}</p>
          ${fld('status', t('form.status'), `<select name="status">${['active', 'paused', 'draft'].map(s => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${t('status.' + s)}</option>`).join('')}</select>`)}`)}
        <p class="err-box" id="lfErr" hidden></p>
        <div class="form-submit"><a class="btn ghost" href="${ex ? '#profile' : '#'}">${t('common.cancel')}</a><button class="btn primary big" id="lfBtn">${icon('check', 18)} ${ex ? t('form.saveChanges') : t('form.publish')}</button></div>
      </form>
      <aside class="form-preview"><p class="label">${icon('eye', 14)} ${t('form.preview')}</p><div id="preview"></div></aside>
    </div></div>`;

  const form = $('#lf');
  const collect = () => { const fd = new FormData(form); const o = Object.fromEntries(fd); o.amenities = fd.getAll('amenities'); o.category = category; o.latitude = point?.lat ?? null; o.longitude = point?.lng ?? null; return o; };
  const preview = () => { const d = validateListing(collect()).data; $('#preview').innerHTML = card({ ...d, id: 'preview', media: photos.map(p => ({ url: p.dataUrl || p.url })) }, { preview: true }); $('#descCount').textContent = `${d.description.length} / 5000`; };
  form.addEventListener('input', preview);
  $$('.cat-pick button').forEach(b => b.onclick = () => {
    category = b.dataset.cat; $$('.cat-pick button').forEach(x => x.classList.toggle('on', x === b));
    const per = CATEGORIES.find(c => c.id === category).period; form.payment_period.value = per; preview();
  });
  // xarita
  const ptLabel = () => ($('#ptLabel').textContent = point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : '');
  const picker = await locationPicker($('#pickMap'), { center: CITY_COORDS[v.city] || UZ_CENTER, point, onChange: p => { point = p; ptLabel(); } });
  ptLabel();
  form.city.onchange = () => { if (!point) picker?.recenter?.(CITY_COORDS[form.city.value] || UZ_CENTER); };
  $('#locBtn').onclick = () => picker?.locate?.();
  $('#clrPt').onclick = () => picker?.set?.(null);
  // rasmlar
  const drawPhotos = () => {
    $('#photos').innerHTML = photos.map((p, i) => `<div class="ph-item${i === 0 ? ' cover' : ''}"><img src="${esc(p.dataUrl || p.url)}" alt="">${i === 0 ? `<span class="badge">★</span>` : `<button type="button" class="ph-cover" data-cover="${i}" title="cover">${icon('star', 13)}</button>`}<button type="button" class="ph-del" data-del="${i}" aria-label="delete">${icon('x', 14)}</button></div>`).join('');
    $('#drop').hidden = photos.length >= 8;
    $$('[data-del]').forEach(b => b.onclick = () => { photos.splice(+b.dataset.del, 1); drawPhotos(); preview(); });
    $$('[data-cover]').forEach(b => b.onclick = () => { const [p] = photos.splice(+b.dataset.cover, 1); photos.unshift(p); drawPhotos(); preview(); });
  };
  const addFiles = async files => {
    for (const f of [...files].filter(f => f.type.startsWith('image/')).slice(0, 8 - photos.length)) {
      try { const c = await compressImage(f, S().mode === 'demo' ? 1024 : 1600, S().mode === 'demo' ? 0.72 : 0.82); photos.push({ blob: c.blob, dataUrl: c.dataUrl }); drawPhotos(); preview(); } catch {}
    }
  };
  $('#fileIn').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  drawPhotos(); preview();

  form.onsubmit = async e => {
    e.preventDefault();
    $$('.err', form).forEach(x => (x.textContent = '')); $$('.invalid', form).forEach(x => x.classList.remove('invalid'));
    const res = validateListing(collect());
    const errBox = $('#lfErr'); errBox.hidden = true;
    if (!res.ok) {
      Object.entries(res.errors).forEach(([k, m]) => { const el = $(`[data-err=${k}]`, form); if (el) { el.textContent = t(m); el.previousElementSibling?.classList?.add('invalid'); } });
      errBox.hidden = false; errBox.textContent = t('err.form');
      $('.err:not(:empty)', form)?.closest('.field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const btn = $('#lfBtn'); btn.disabled = true; btn.classList.add('loading'); const old = btn.innerHTML; btn.textContent = t('form.saving');
    try {
      const id = await S().saveListing(ex?.id, res.data, photos);
      state.listings = null;
      toast(ex ? t('ok.saved') : t('ok.published'));
      go('listing-' + id);
    } catch (err) {
      const m = err.message || ''; errBox.hidden = false; errBox.textContent = m.startsWith('err.') || m.startsWith('auth.') ? t(m) : m || t('err.generic');
      btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = old;
    }
  };
}

/* ------------------------------ Profil ------------------------------ */
async function profile(view, r, alive) {
  setTitle(t('profile.title'));
  view.innerHTML=`<div class="wrap pad">${skeletons(3)}</div>`;
  const [p,mine]=await Promise.all([S().getProfile(),S().myListings()]);
  if(!alive()) return;
  const name=p?.display_name||`${p?.first_name||''} ${p?.last_name||''}`.trim()||p?.email||'';
  const initials=(name.match(/\b\p{L}/gu)||['Q']).slice(0,2).join('').toUpperCase();
  const cnt=status=>mine.filter(x=>x.status===status).length;
  const views=mine.reduce((n,x)=>n+Number(x.views_count||0),0);
  const renderRows=arr=>arr.map(l=>`<div class="my-item" data-id="${esc(l.id)}">
    <a href="#listing-${esc(l.id)}" class="my-thumb">${photoBlock(l,'my-img')}</a>
    <div class="my-info"><a href="#listing-${esc(l.id)}"><b>${esc(l.title)}</b></a>
    <p class="muted small">${esc(td('city',l.city))} · ${money(l.price)}</p>
    <span class="badge st-${esc(l.status)} inline">${({booked:'Bron qilingan',completed:'Bajarilgan'})[l.status] || t('status.'+l.status)}</span>
    <small>${icon('eye',13)} ${Number(l.views_count||0)} marta ko‘rilgan</small></div>
    <div class="my-acts">${['active','paused','draft'].includes(l.status)?`<a class="icon-btn" href="#edit-${esc(l.id)}">${icon('edit',16)}</a>`:''}
    ${['active','paused'].includes(l.status)?`<button class="icon-btn" data-toggle="${l.status==='active'?'paused':'active'}">${icon(l.status==='active'?'pause':'play',16)}</button>`:''}
    ${l.status==='booked'?`<button class="icon-btn" data-complete title="Bajarildi">${icon('check',16)}</button>`:''}
    <button class="icon-btn danger" data-del>${icon('trash',16)}</button></div></div>`).join('');
  const active=mine.filter(x=>['active','paused','draft'].includes(x.status)), booked=mine.filter(x=>x.status==='booked'), done=mine.filter(x=>x.status==='completed');
  view.innerHTML=`<div class="wrap pad"><div class="prof-head">
    <div class="avatar profile-avatar">${p?.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Profil rasmi">`:esc(initials)}</div>
    <div class="grow"><h1>${esc(name)}</h1><p class="muted">${esc(p?.email||'')}</p>${p?.bio?`<p class="muted">${esc(p.bio)}</p>`:''}</div>
    <button class="btn ghost" id="logoutBtn">${icon('logout',16)} ${t('nav.logout')}</button></div>
    <div class="stats"><div><b>${mine.length}</b><span>Jami e’lonlar</span></div><div><b>${cnt('active')}</b><span>Faol e’lonlar</span></div><div><b>${views}</b><span>Jami ko‘rishlar</span></div><div><b>${done.length}</b><span>Bajarilgan</span></div></div>
    <div class="prof-grid"><section>
      <div class="sec-head"><h2>Faol va boshqa e’lonlar</h2><a class="btn primary sm" href="#new">${icon('plus',15)} ${t('nav.post')}</a></div>
      <div id="myList">${active.length?renderRows(active):'<p class="muted">Faol e’lon yo‘q.</p>'}</div>
      <div class="sec-head profile-subhead"><h2>Bron qilingan xonalar</h2><span class="badge">${booked.length}</span></div><div id="bookedList">${booked.length?renderRows(booked):'<p class="muted">Bronlar yo‘q.</p>'}</div>
      <div class="sec-head profile-subhead"><h2>Bajarilgan e’lonlar</h2><span class="badge">${done.length}</span></div><div id="completedList">${done.length?renderRows(done):'<p class="muted">Bajarilgan e’lonlar shu yerda ko‘rinadi.</p>'}</div>
    </section><aside class="prof-card"><h2>Profil sozlamalari</h2><form id="pf">
      <label class="field"><span>Profil rasmi</span><input name="avatar" type="file" accept="image/*"></label>
      <label class="field"><span>Ko‘rinadigan ism</span><input name="display_name" maxlength="60" value="${esc(p?.display_name||'')}"></label>
      <label class="field"><span>${t('auth.first')}</span><input name="first_name" maxlength="80" value="${esc(p?.first_name||'')}"></label>
      <label class="field"><span>${t('auth.last')}</span><input name="last_name" maxlength="80" value="${esc(p?.last_name||'')}"></label>
      <label class="field"><span>${t('auth.phone')}</span><input name="phone" type="tel" value="${esc(p?.phone||'')}" placeholder="+998901234567"><em class="err" data-err="phone"></em></label>
      <label class="field"><span>Telegram username</span><input name="telegram" maxlength="40" value="${esc(p?.telegram||'')}"></label>
      <label class="field"><span>O‘zingiz haqingizda</span><textarea name="bio" rows="3" maxlength="500">${esc(p?.bio||'')}</textarea></label>
      <label class="am"><input type="checkbox" name="show_phone" ${p?.show_phone?'checked':''}><span>Telefon raqamimni hammaga ko‘rsatish</span></label>
      <button class="btn primary block">Saqlash</button></form></aside></div></div>`;
  $('#logoutBtn').onclick=async()=>{await S().signOut();state.user=null;renderShell();go('');};
  $('#pf').onsubmit=async ev=>{
    ev.preventDefault();const fd=new FormData(ev.target),ph=fd.get('phone')?normPhone(fd.get('phone')):'';
    if(ph&&!PHONE_RE.test(ph)){$('[data-err=phone]',ev.target).textContent=t('err.phone');return;}
    try{const file=fd.get('avatar');if(file?.size){if(!file.type.startsWith('image/')||file.size>5*1024*1024)throw new Error('Rasm 5 MB dan kichik bo‘lishi kerak');await S().uploadAvatar(file);}
      await S().updateProfile({...Object.fromEntries(fd),phone:ph,show_phone:fd.get('show_phone')==='on'});toast(t('ok.profile'));profile(view,r,alive);
    }catch(err){toast(err.message||t('err.generic'),'err');}
  };
  $$('.my-item').forEach(it=>{const id=it.dataset.id;
    $('[data-toggle]',it)?.addEventListener('click',async b=>{await S().setStatus(id,b.currentTarget.dataset.toggle);state.listings=null;profile(view,r,alive);});
    $('[data-complete]',it)?.addEventListener('click',async()=>{await S().completeListing(id);state.listings=null;profile(view,r,alive);});
    $('[data-del]',it)?.addEventListener('click',async()=>{if(!(await confirmDialog(t('profile.confirmDelete'))))return;await S().deleteListing(id);state.listings=null;profile(view,r,alive);});
  });
}
/* ------------------------------ Pullik raqam ------------------------------ */
const CONTACT_PRICE = (window.QJ_CONFIG || {}).contactPrice || 5000;
function openBooking(l) {
  if(!state.user){state.afterLogin='listing-'+l.id;toast(t('auth.required'));return go('auth');}
  const d=document.createElement('div');d.className='modal-back';
  d.innerHTML=`<div class="modal booking-modal"><h3>Xonani bron qilish</h3><p class="muted small">${esc(l.title)}</p><form id="bookingForm">
    <label class="field"><span>Ism-familiya</span><input name="guest_name" required minlength="2" maxlength="80"></label>
    <label class="field"><span>Telefon raqam</span><input name="guest_phone" type="tel" placeholder="+998901234567" required></label>
    <label class="field"><span>Joylar soni</span><input name="places" type="number" min="1" max="${Math.max(1,Number(l.available_places||1))}" value="1" required></label>
    <div class="two"><label class="field"><span>Kelish sanasi</span><input name="check_in" type="date" required></label><label class="field"><span>Ketish sanasi</span><input name="check_out" type="date" required></label></div>
    <p class="muted small">Bron tasdiqlangach e’lon avtomatik faol ro‘yxatdan olinadi.</p><p class="err-box" id="bookingErr" hidden></p>
    <div class="modal-actions"><button type="button" class="btn ghost" data-no>Bekor qilish</button><button class="btn primary">Bronni yuborish</button></div></form></div>`;
  document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('show'));const close=()=>d.remove();
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-no]'))close();});
  $('#bookingForm',d).onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),phone=normPhone(f.guest_phone);
    const err=$('#bookingErr',d);if(!PHONE_RE.test(phone)){err.hidden=false;err.textContent='Telefon raqamni +998 formatida kiriting.';return;}
    if(f.check_out<=f.check_in){err.hidden=false;err.textContent='Ketish sanasi kelish sanasidan keyin bo‘lishi kerak.';return;}
    const btn=$('button[type=submit]',e.target);btn.disabled=true;
    try{const days=Math.max(1,Math.round((new Date(f.check_out)-new Date(f.check_in))/86400000));
      await S().createBooking({listing_id:l.id,guest_name:f.guest_name.trim(),guest_phone:phone,places:Number(f.places),check_in:f.check_in,check_out:f.check_out,total_price:Number(l.price||0)*days*Number(f.places)});
      close();toast('Bron yuborildi. E’lon faol ro‘yxatdan olindi.');state.listings=null;go('');
    }catch(ex){err.hidden=false;err.textContent=ex.message||'Bron qilishda xatolik.';btn.disabled=false;}
  };
}
function paidDialog(onChat) {
  const d = document.createElement('div');
  d.className = 'modal-back';
  d.innerHTML = `<div class="modal paid" role="dialog" aria-modal="true">
    <div class="paid-ic">${icon('phone', 26)}</div>
    <h3>${t('paid.title')}</h3>
    <p class="paid-price">${money(CONTACT_PRICE)}</p>
    <p class="muted">${t('paid.text')}</p>
    <div class="pay-logos"><span>Payme</span><span>Click</span><span>Uzum</span></div>
    <p class="soon">${icon('sparkle', 14)} ${t('paid.soon')}</p>
    <div class="modal-actions col"><button class="btn primary block" data-chat-go>${icon('chat', 16)} ${t('paid.chat')}</button><button class="btn ghost block" data-no>${t('paid.close')}</button></div></div>`;
  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('show'));
  const close = () => { d.classList.remove('show'); setTimeout(() => d.remove(), 200); };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-no]')) close(); if (e.target.closest('[data-chat-go]')) { close(); onChat(); } });
}

/* ------------------------------ Xabarlar (chat) ------------------------------ */
let chatTimer = null, unreadTimer = null;
function stopChatPoll() { clearInterval(chatTimer); chatTimer = null; }
async function refreshUnread() {
  if (!state.user) return $$('[data-unread]').forEach(b => (b.hidden = true));
  const n = await S().unreadCount().catch(() => 0);
  $$('[data-unread]').forEach(b => { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; });
}
function timeLabel(iso) {
  const d = new Date(iso), now = new Date();
  const hm = d.toLocaleTimeString(i18n.lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return t('chat.yesterday');
  return i18n.date(iso);
}
const chatThumb = l => l.photo ? `<img src="${esc(l.photo)}" alt="" loading="lazy">` : `<div class="ph ph-${esc(l.category)}">${icon(catIcon(l.category), 22)}</div>`;

async function messages(view, r, alive) {
  setTitle(t('chat.title'));
  view.innerHTML = `<div class="wrap pad narrow-lg"><h1 class="page-h">${t('chat.title')}</h1><div id="chatList">${skeletons(2)}</div></div>`;
  let list;
  try { list = await S().listChats(); } catch (err) { if (!alive()) return; $('#chatList').innerHTML = `<div class="empty">${icon('chat', 40)}<p>${esc(t(err.message))}</p></div>`; return; }
  if (!alive()) return;
  $('#chatList').innerHTML = list.length ? `<div class="chat-list">${list.map(c => `
    <a class="chat-row${c.unread ? ' unread' : ''}" href="#chat-${esc(c.id)}">
      <div class="cr-thumb">${chatThumb(c.listing)}</div>
      <div class="cr-main">
        <div class="cr-top"><b>${esc(c.other_name)}</b><span class="role ${c.role}">${c.role === 'owner' ? t('chat.client') : t('chat.owner')}</span><time>${c.last_message_at ? timeLabel(c.last_message_at) : ''}</time></div>
        <p class="cr-listing">${icon(catIcon(c.listing.category), 13)} ${esc(c.listing.title)}</p>
        <p class="cr-last">${esc(c.last_message || t('chat.empty'))}</p>
      </div>
      ${c.unread ? `<span class="nbadge">${c.unread}</span>` : ''}
    </a>`).join('')}</div>`
    : `<div class="empty">${icon('chat', 40)}<h3>${t('chat.none')}</h3><p class="muted">${t('chat.noneHint')}</p><a class="btn primary" href="#">${icon('search', 16)} ${t('nav.search')}</a></div>`;
}

async function chat(view, r, alive) {
  view.innerHTML = `<div class="wrap pad narrow-lg">${skeletons(1)}</div>`;
  let data;
  try { data = await S().getChat(r.id); } catch (err) { data = null; }
  if (!alive()) return;
  if (!data) { view.innerHTML = `<div class="wrap empty">${icon('chat', 40)}<h2>${t('detail.notFound')}</h2><a class="btn primary" href="#messages">${t('nav.msgs')}</a></div>`; return; }
  const { chat: c, me } = data;
  setTitle(c.other_name);
  document.body.classList.add('in-chat');
  view.innerHTML = `<div class="chat-page">
    <div class="chat-head">
      <a class="icon-btn" href="#messages" aria-label="${t('detail.back')}">${icon('arrowLeft', 18)}</a>
      <div class="avatar sm">${esc((c.other_name.match(/\p{L}/u) || ['Q'])[0].toUpperCase())}</div>
      <div class="grow"><b>${esc(c.other_name)}</b><small class="muted">${c.role === 'owner' ? t('chat.client') : t('chat.owner')}</small></div>
    </div>
    <a class="chat-listing" href="#listing-${esc(c.listing.id)}">${chatThumb(c.listing)}<div><b>${esc(c.listing.title)}</b><span>${money(c.listing.price)} / ${t('period.' + c.listing.payment_period)}</span></div>${icon('chevronRight', 18)}</a>
    <div class="chat-body" id="chatBody"></div>
    <div class="chat-quick" id="chatQuick"></div>
    <form class="chat-input" id="chatForm"><textarea id="chatText" rows="1" maxlength="2000" placeholder="${t('chat.ph')}" aria-label="${t('chat.ph')}"></textarea><button class="btn primary send" aria-label="${t('chat.send')}">${icon('send', 18)}</button></form>
  </div>`;
  let msgs = data.messages, sig = '';
  const draw = (force) => {
    const ns = msgs.map(m => m.id + (m.read_at ? 'r' : '')).join();
    if (!force && ns === sig) return; sig = ns;
    const body = $('#chatBody'); if (!body) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    let lastDay = '';
    body.innerHTML = `<p class="chat-safety">${icon('shield', 14)} ${t('chat.safety')}</p>` + (msgs.length ? msgs.map(m => {
      const day = new Date(m.created_at).toDateString();
      const sep = day !== lastDay ? `<div class="day-sep"><span>${day === new Date().toDateString() ? t('chat.today') : i18n.date(m.created_at)}</span></div>` : '';
      lastDay = day;
      const mineMsg = m.sender_id === me;
      return `${sep}<div class="bubble ${mineMsg ? 'me' : 'them'}"><p>${esc(m.body)}</p><time>${new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${mineMsg ? ` ${m.read_at ? '✓✓' : '✓'}` : ''}</time></div>`;
    }).join('') : `<p class="chat-empty">${t('chat.empty')}</p>`);
    if (atBottom || force) body.scrollTop = body.scrollHeight;
    $('#chatQuick').innerHTML = msgs.length || c.role === 'owner' ? '' : ['chat.quick1', 'chat.quick2', 'chat.quick3'].map(k => `<button class="chip" type="button">${t(k)}</button>`).join('');
    $$('#chatQuick .chip').forEach(b => b.onclick = () => { $('#chatText').value = b.textContent; $('#chatForm').requestSubmit(); });
  };
  draw(true);
  S().markRead(r.id).then(refreshUnread);
  const ta = $('#chatText');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover: hover)').matches) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
  $('#chatForm').onsubmit = async e => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) return;
    ta.value = ''; grow();
    const tmp = { id: 'tmp' + Date.now(), sender_id: me, body, created_at: new Date().toISOString(), read_at: null };
    msgs = [...msgs, tmp]; draw(true);
    try { await S().sendMessage(r.id, body); } catch (err) { msgs = msgs.filter(m => m !== tmp); draw(true); ta.value = body; toast(t(err.message) || t('err.generic'), 'err'); return; }
    poll();
  };
  const poll = async () => {
    if (route().name !== 'chat') return stopChatPoll();
    const d = await S().getChat(r.id).catch(() => null);
    if (!d || route().id !== r.id) return;
    msgs = d.messages; draw();
    if (msgs.some(m => m.sender_id !== me && !m.read_at)) S().markRead(r.id).then(refreshUnread);
  };
  stopChatPoll();
  chatTimer = setInterval(poll, 3000);
  if (matchMedia('(hover: hover)').matches) ta.focus();
}

/* ------------------------------ Saqlanganlar ------------------------------ */
async function favorites(view, r, alive) {
  setTitle(t('fav.title'));
  view.innerHTML = `<div class="wrap pad"><h1 class="page-h">${t('fav.title')}</h1><div id="favBody">${skeletons(3)}</div></div>`;
  const all = await loadListings();
  if (!alive()) return;
  const ids = favs.all();
  const items = ids.map(id => all.find(l => l.id === id)).filter(Boolean);
  $('#favBody').innerHTML = items.length ? `<div class="grid-cards">${items.map(l => card(l)).join('')}</div>` : `<div class="empty">${icon('heart', 40)}<h3>${t('fav.none')}</h3><p class="muted">${t('fav.hint')}</p><a class="btn primary" href="#">${icon('search', 16)} ${t('nav.search')}</a></div>`;
}

/* ------------------------------ Global hodisalar ------------------------------ */
document.addEventListener('click', e => {
  const fb = e.target.closest('[data-fav]');
  if (fb) {
    e.preventDefault(); e.stopPropagation();
    const on = favs.toggle(fb.dataset.fav);
    fb.classList.toggle('on', on); fb.setAttribute('aria-pressed', on);
    fb.classList.add('pop'); setTimeout(() => fb.classList.remove('pop'), 300);
    if (!on && route().name === 'favorites') render();
  }
  if (e.target.closest('a[href="#"]') && !location.hash) { e.preventDefault(); render(); }
});
window.addEventListener('hashchange', () => { document.body.classList.remove('has-mcta', 'no-scroll', 'in-chat'); $$('.sheet-back,.lightbox,.modal-back').forEach(x => x.remove()); render(); });

/* ------------------------------ Ishga tushirish ------------------------------ */
(async function boot() {
  const th = prefs.get('theme', null) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = th;
  $('#view').innerHTML = `<div class="boot">${logoSvg()}<span>${t('common.loading')}</span></div>`;
  await initStore();
  state.user = await S().currentUser().catch(() => null);
  S().onAuth(async ev => {
    state.user = await S().currentUser().catch(() => null);
    renderShell();
    if (ev === 'PASSWORD_RECOVERY') go('reset');
    // Email tasdiqlash havolasidan qaytganda foydalanuvchini avtomatik profilga olib o'tish.
    else if (ev === 'SIGNED_IN' && route().name === 'home' && !location.hash) go('profile');
  });
  if (S().mode === 'demo') S().sampleReply = t('chat.sampleReply');
  renderShell();
  render();
  unreadTimer = setInterval(refreshUnread, 15000);
})();
