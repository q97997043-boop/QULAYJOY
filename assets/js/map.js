// QULAYJOY xarita moduli — tashqi kutubxonasiz yengil "slippy map" (OpenStreetMap plitkalari).
// Plitkalar yuklanmasa (masalan, cheklangan muhitda) O'zbekistonning sxematik xaritasi chiziladi.
// Keyinchalik Google Maps qo'shish: listingsMap() va locationPicker() interfeysini saqlab,
// ichini google.maps bilan almashtirish kifoya — sahifalar kodi o'zgarmaydi.
import { i18n } from './i18n.js';
import { UZ_CENTER, CITY_COORDS } from './market.js';

const TILE = 256;
const TILE_URL = (z, x, y) => `https://${'abc'[(x + y) % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png`;

// Taxminiy chegara (faqat zaxira sxematik xarita uchun)
const UZ_OUTLINE = [[45.59,55.98],[45.58,56.6],[45.45,57.6],[45.3,58.5],[45.0,58.65],[44.75,59.6],[44.45,60.6],[44.15,61.15],[43.65,62.0],[43.5,63.2],[43.15,64.0],[42.95,64.9],[42.6,65.7],[42.1,66.3],[41.6,66.6],[41.2,67.0],[40.85,67.7],[40.95,68.4],[41.3,68.9],[41.45,69.35],[41.75,69.75],[42.05,70.15],[42.25,70.75],[41.95,71.05],[41.5,70.95],[41.35,71.4],[41.45,71.75],[41.2,72.25],[40.95,72.85],[40.6,73.15],[40.38,72.8],[40.22,72.2],[40.08,71.55],[40.1,70.95],[40.35,70.45],[40.85,70.4],[40.8,69.8],[40.45,69.4],[40.1,69.2],[39.95,68.6],[39.6,68.05],[39.5,67.45],[39.1,67.35],[38.6,68.1],[38.2,68.4],[37.85,68.05],[37.25,67.8],[37.2,67.2],[37.35,66.55],[37.95,66.55],[38.4,65.95],[38.85,65.1],[39.25,64.2],[39.55,63.6],[40.1,62.7],[40.7,62.0],[41.1,61.4],[41.15,60.8],[41.2,60.15],[41.55,60.15],[41.85,60.45],[42.15,60.05],[42.45,59.35],[42.2,58.7],[41.95,58.2],[41.8,57.5],[41.5,57.0],[41.28,56.0]];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function project(lat, lng, z) {
  const s = TILE * 2 ** z, sin = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}
function unproject(x, y, z) {
  const s = TILE * 2 ** z, n = Math.PI - (2 * Math.PI * y) / s;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: (x / s) * 360 - 180 };
}

class MiniMap {
  constructor(el, { center = UZ_CENTER, zoom = 6, minZoom = 4, maxZoom = 18 } = {}) {
    this.el = el; this.minZoom = minZoom; this.maxZoom = maxZoom;
    this.c = { lat: center[0], lng: center[1] }; this.z = zoom;
    this.markers = []; this.polys = []; this.tiles = new Map();
    this.tileOk = 0; this.tileErr = 0; this.offline = false; this.listeners = { click: [], move: [], render: [] };
    el.classList.add('mm');
    el.innerHTML = `<div class="mm-tiles"></div><svg class="mm-svg" aria-hidden="true"></svg><div class="mm-markers"></div>
      <div class="mm-zoom"><button type="button" data-z="1" aria-label="zoom in">+</button><button type="button" data-z="-1" aria-label="zoom out">−</button></div>
      <div class="mm-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>`;
    this.$t = el.querySelector('.mm-tiles'); this.$s = el.querySelector('.mm-svg'); this.$m = el.querySelector('.mm-markers');
    el.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); this.zoomAround(this.z + +b.dataset.z, null, true); }));
    this._bind();
    this.ro = new ResizeObserver(() => this.render()); this.ro.observe(el);
    this.render();
    setTimeout(() => { if (!this.tileOk && el.isConnected) this.goOffline(); }, 3500);
  }
  get w() { return this.el.clientWidth; }
  get h() { return this.el.clientHeight; }
  on(ev, f) { this.listeners[ev].push(f); }
  emit(ev, a) { this.listeners[ev].forEach(f => f(a)); }
  toScreen(lat, lng) { const c = project(this.c.lat, this.c.lng, this.z), p = project(lat, lng, this.z); return { x: p.x - c.x + this.w / 2, y: p.y - c.y + this.h / 2 }; }
  toLatLng(x, y) { const c = project(this.c.lat, this.c.lng, this.z); return unproject(c.x + x - this.w / 2, c.y + y - this.h / 2, this.z); }
  setView(center, zoom) { this.c = { lat: center[0] ?? center.lat, lng: center[1] ?? center.lng }; this.z = clamp(zoom ?? this.z, this.minZoom, this.maxZoom); this.render(); this.emit('move'); }
  zoomAround(z, pt, animate) {
    z = clamp(z, this.minZoom, this.maxZoom);
    if (!pt) { if (animate) return this.flyTo([this.c.lat, this.c.lng], z, 250); return this.setView([this.c.lat, this.c.lng], z); }
    const ll = this.toLatLng(pt.x, pt.y);
    const p = project(ll.lat, ll.lng, z);
    const c = unproject(p.x - (pt.x - this.w / 2), p.y - (pt.y - this.h / 2), z);
    this.setView([c.lat, c.lng], z);
  }
  flyTo(center, zoom, ms = 550) {
    const from = { ...this.c, z: this.z }, to = { lat: center[0], lng: center[1], z: clamp(zoom ?? this.z, this.minZoom, this.maxZoom) };
    cancelAnimationFrame(this._raf); const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.c = { lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + (to.lng - from.lng) * e }; this.z = from.z + (to.z - from.z) * e;
      this.render(); if (k < 1) this._raf = requestAnimationFrame(step); else this.emit('move');
    };
    this._raf = requestAnimationFrame(step);
  }
  fitBounds(pts, pad = 48, maxZoom = 13) {
    if (!pts.length) return;
    if (pts.length === 1) return this.setView(pts[0], maxZoom);
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    const nw = project(Math.max(...lats), Math.min(...lngs), 0), se = project(Math.min(...lats), Math.max(...lngs), 0);
    const zx = Math.log2((this.w - pad * 2) / Math.max(1e-9, se.x - nw.x)), zy = Math.log2((this.h - pad * 2) / Math.max(1e-9, se.y - nw.y));
    const z = clamp(Math.min(zx, zy, maxZoom), this.minZoom, maxZoom);
    const mid = unproject((nw.x + se.x) / 2, (nw.y + se.y) / 2, 0);
    this.setView([mid.lat, mid.lng], z);
  }
  addMarker(lat, lng, html, { cls = '', onClick, z = 0 } = {}) {
    const el = document.createElement('div'); el.className = 'mm-marker ' + cls; el.innerHTML = html; el.style.zIndex = z;
    if (onClick) { el.classList.add('clickable'); el.addEventListener('click', e => { e.stopPropagation(); if (!this._moved) onClick(); }); }
    const m = { lat, lng, el }; this.markers.push(m); this.$m.appendChild(el); this._placeMarker(m); return m;
  }
  removeMarker(m) { m.el.remove(); this.markers = this.markers.filter(x => x !== m); }
  addPolygon(pts, cls) { this.polys.push({ pts, cls }); this.render(); }
  _placeMarker(m) { const p = this.toScreen(m.lat, m.lng); m.el.style.transform = `translate(${p.x}px, ${p.y}px)`; }
  goOffline() {
    if (this.offline) return; this.offline = true; this.el.classList.add('offline');
    this.$t.innerHTML = ''; this.tiles.clear();
    this.addPolygon(UZ_OUTLINE, 'uz-land');
    Object.entries(CITY_COORDS).forEach(([c, ll]) => this.addMarker(ll[0], ll[1], `<i></i><span>${i18n.td('city', c)}</span>`, { cls: 'city-lbl', z: -1 }));
    const n = document.createElement('div'); n.className = 'mm-note'; n.textContent = i18n.t('map.schematic'); this.el.appendChild(n);
  }
  render() {
    const w = this.w, h = this.h; if (!w || !h) return;
    if (!this.offline) {
      const tz = clamp(Math.round(this.z), 0, 19), sc = 2 ** (this.z - tz), size = TILE * sc;
      const c = project(this.c.lat, this.c.lng, tz), n = 2 ** tz;
      const x0 = Math.floor((c.x - w / 2 / sc) / TILE), x1 = Math.floor((c.x + w / 2 / sc) / TILE);
      const y0 = Math.max(0, Math.floor((c.y - h / 2 / sc) / TILE)), y1 = Math.min(n - 1, Math.floor((c.y + h / 2 / sc) / TILE));
      const keep = new Set();
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const wx = ((x % n) + n) % n, key = `${tz}/${wx}/${y}/${x}`; keep.add(key);
        let img = this.tiles.get(key);
        if (!img) {
          img = new Image(); img.alt = ''; img.draggable = false; img.decoding = 'async';
          img.onload = () => { this.tileOk++; img.classList.add('ok'); };
          img.onerror = () => { if (++this.tileErr >= 3 && !this.tileOk) this.goOffline(); };
          img.src = TILE_URL(tz, wx, y); this.tiles.set(key, img); this.$t.appendChild(img);
        }
        img.style.width = img.style.height = size + 0.5 + 'px';
        img.style.transform = `translate(${(x * TILE - c.x) * sc + w / 2}px, ${(y * TILE - c.y) * sc + h / 2}px)`;
      }
      for (const [k, img] of this.tiles) if (!keep.has(k)) { img.remove(); this.tiles.delete(k); }
    }
    this.$s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.$s.innerHTML = this.polys.map(p => `<path class="${p.cls}" d="${p.pts.map((q, i) => { const s = this.toScreen(q[0], q[1]); return (i ? 'L' : 'M') + s.x.toFixed(1) + ' ' + s.y.toFixed(1); }).join('')}Z"/>`).join('');
    this.markers.forEach(m => this._placeMarker(m));
    this.el.querySelector('[data-z="1"]').disabled = this.z >= this.maxZoom - 0.01;
    this.el.querySelector('[data-z="-1"]').disabled = this.z <= this.minZoom + 0.01;
    this.emit('render');
  }
  _bind() {
    const el = this.el, pts = new Map();
    let start = null, pinch = null;
    const rect = () => el.getBoundingClientRect();
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.mm-zoom, .mm-attr')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._moved = false;
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, c: project(this.c.lat, this.c.lng, this.z) };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.z }; }
    });
    window.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()], r = rect();
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this._moved = true;
        this.zoomAround(pinch.z + Math.log2(d / pinch.d), { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top });
        return;
      }
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!this._moved && Math.hypot(dx, dy) < 5) return;
      if (!this._moved) { this._moved = true; el.classList.add('dragging'); try { el.setPointerCapture(e.pointerId); } catch {} }
      const c = unproject(start.c.x - dx, start.c.y - dy, this.z);
      this.c = c; this.render();
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = [...pts.values()]; start = { x: p.x, y: p.y, c: project(this.c.lat, this.c.lng, this.z) }; return; }
      el.classList.remove('dragging');
      if (start && this._moved) this.emit('move');
      else if (start && e.type === 'pointerup' && !e.target.closest('.mm-marker.clickable')) { const r = rect(); this.emit('click', this.toLatLng(e.clientX - r.left, e.clientY - r.top)); }
      start = null; setTimeout(() => (this._moved = false), 0);
    };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    let wheelOn = false;
    el.addEventListener('click', () => (wheelOn = true));
    el.addEventListener('mouseleave', () => (wheelOn = false));
    el.addEventListener('wheel', e => {
      if (!wheelOn && !e.ctrlKey) return;
      e.preventDefault(); const r = rect();
      this.zoomAround(this.z - Math.sign(e.deltaY) * 0.5, { x: e.clientX - r.left, y: e.clientY - r.top });
      clearTimeout(this._wt); this._wt = setTimeout(() => this.emit('move'), 200);
    }, { passive: false });
    el.addEventListener('dblclick', e => { if (e.target.closest('.mm-zoom,.mm-marker')) return; const r = rect(); this.zoomAround(this.z + 1, { x: e.clientX - r.left, y: e.clientY - r.top }); this.emit('move'); });
  }
}

const pinHtml = (label, cls = '') => `<div class="qj-pin ${cls}">${label}</div>`;

/**
 * E'lonlar xaritasi.
 * items: [{id, lat, lng, approx, label, main, small, title}]
 * opts: { onSelect(id), view:{center:{lat,lng},zoom}, onMove(view), maxZoom }
 */
export async function listingsMap(el, items, opts = {}) {
  if (!el?.isConnected) return null;
  const map = new MiniMap(el, { center: UZ_CENTER, zoom: 6 });
  const markers = new Map();
  let current = null;
  items.forEach(it => {
    const cls = [it.approx && 'approx', it.main && 'main', it.small && 'small'].filter(Boolean).join(' ');
    const m = map.addMarker(it.lat, it.lng, pinHtml(it.label, cls), { onClick: opts.onSelect ? () => opts.onSelect(it.id) : null, z: it.main ? 5 : 1 });
    m.el.title = it.title || ''; m._cls = cls; m._label = it.label;
    markers.set(it.id, m);
  });
  const api = {
    map,
    select(id, pan = true) {
      if (current && markers.get(current)) { const o = markers.get(current); o.el.innerHTML = pinHtml(o._label, o._cls); o.el.style.zIndex = o._cls.includes('main') ? 5 : 1; }
      current = id;
      const m = markers.get(id); if (!m) return;
      m.el.innerHTML = pinHtml(m._label, m._cls + ' on'); m.el.style.zIndex = 50;
      if (pan) {
        const z = Math.max(map.z, 12);
        const p = project(m.lat, m.lng, z), mobile = el.clientWidth < 640;
        // kartochka belgini to'sib qo'ymasligi uchun markazni biroz siljitamiz
        const t = mobile ? unproject(p.x, p.y + el.clientHeight * 0.2, z) : unproject(p.x - Math.min(170, el.clientWidth * 0.18), p.y, z);
        map.flyTo([t.lat, t.lng], z);
      }
    },
    fit() { map.fitBounds(items.map(i => [i.lat, i.lng]), 48, opts.maxZoom || 13); },
  };
  // Yaqin belgilarni guruhlash (klaster): ustma-ust tushganlari bitta doiraga birlashadi
  let clusters = [], lastZ = null;
  const recluster = () => {
    if (lastZ !== null && Math.abs(lastZ - map.z) < 0.15) return;
    lastZ = map.z;
    clusters.forEach(c => map.removeMarker(c)); clusters = [];
    const groups = [];
    items.forEach(it => {
      const m = markers.get(it.id); m.el.hidden = false;
      if (it.id === current || it.main) return;
      const pt = map.toScreen(it.lat, it.lng);
      const g = groups.find(g => Math.abs(g.x - pt.x) < 62 && Math.abs(g.y - pt.y) < 32);
      if (g) { g.items.push(it); g.x = (g.x * (g.items.length - 1) + pt.x) / g.items.length; g.y = (g.y * (g.items.length - 1) + pt.y) / g.items.length; }
      else groups.push({ x: pt.x, y: pt.y, items: [it] });
    });
    groups.filter(g => g.items.length > 1).forEach(g => {
      g.items.forEach(it => (markers.get(it.id).el.hidden = true));
      const lat = g.items.reduce((a, i) => a + i.lat, 0) / g.items.length, lng = g.items.reduce((a, i) => a + i.lng, 0) / g.items.length;
      const c = map.addMarker(lat, lng, `<div class="qj-cluster"><b>${g.items.length}</b><small>${i18n.t('map.clusterOf')}</small></div>`, {
        z: 3,
        onClick: () => {
          const pts = g.items.map(i => [i.lat, i.lng]);
          const spread = Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1]));
          if (map.z >= 16 || spread < 0.0005) opts.onSelect?.(g.items[0].id);
          else { const before = map.z; map.fitBounds(pts, 70, 17); if (map.z <= before + 0.2) map.setView([lat, lng], before + 2); map.emit('move'); }
        },
      });
      c.el.title = g.items.map(i => i.title).filter(Boolean).slice(0, 5).join('\n');
      clusters.push(c);
    });
  };
  map.on('render', recluster);
  const _select = api.select;
  api.select = (id, pan) => { _select(id, pan); lastZ = null; recluster(); };
  const vc = opts.view?.center;
  if (vc) map.setView(Array.isArray(vc) ? vc : [vc.lat, vc.lng], opts.view.zoom); else api.fit();
  if (opts.onMove) map.on('move', () => opts.onMove({ center: { ...map.c }, zoom: map.z }));
  if (opts.onMapClick) map.on('click', () => opts.onMapClick());
  return api;
}

/** Xaritadan nuqta tanlash. onChange({lat,lng}|null) */
export async function locationPicker(el, { center, point, onChange }) {
  if (!el?.isConnected) return null;
  const map = new MiniMap(el, { center: point ? [point.lat, point.lng] : center, zoom: point ? 15 : 12 });
  let marker = null;
  const set = p => {
    if (marker) { map.removeMarker(marker); marker = null; }
    if (!p) { onChange?.(null); return; }
    marker = map.addMarker(p.lat, p.lng, pinHtml('📍', 'on'), { z: 10 });
    onChange?.({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
  };
  if (point) set(point);
  map.on('click', ll => set(ll));
  return {
    set, recenter(c) { map.setView(c, 12); },
    locate() { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p => { const pt = { lat: p.coords.latitude, lng: p.coords.longitude }; set(pt); map.setView([pt.lat, pt.lng], 16); }, () => {}, { enableHighAccuracy: true, timeout: 8000 }); },
  };
}

/** Ikki nuqta orasidagi masofa (km) */
export function distKm(a, b) {
  const R = 6371, r = x => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
