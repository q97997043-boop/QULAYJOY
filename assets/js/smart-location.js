// QULAYJOY Smart Location — OpenStreetMap / Overpass
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const GROUPS = [
  { id: 'transport', label: 'Transport', icon: '🚌' },
  { id: 'education', label: "Ta’lim", icon: '🎓' },
  { id: 'health', label: 'Tibbiyot', icon: '🏥' },
  { id: 'shopping', label: 'Savdo', icon: '🛒' },
  { id: 'leisure', label: 'Dam olish', icon: '🌳' },
  { id: 'food', label: 'Ovqatlanish', icon: '🍽️' },
  { id: 'finance', label: 'Bank va ATM', icon: '🏧' },
];
const TAGS = {
  transport: ['node["public_transport"="platform"]', 'node["highway"="bus_stop"]', 'node["railway"="station"]', 'node["railway"="subway_entrance"]'],
  education: ['node["amenity"="school"]', 'node["amenity"="university"]', 'node["amenity"="college"]', 'node["amenity"="kindergarten"]'],
  health: ['node["amenity"="hospital"]', 'node["amenity"="clinic"]', 'node["amenity"="pharmacy"]', 'node["amenity"="doctors"]'],
  shopping: ['node["shop"="supermarket"]', 'node["shop"="convenience"]', 'node["shop"="mall"]'],
  leisure: ['node["leisure"="park"]', 'node["leisure"="fitness_centre"]', 'node["leisure"="sports_centre"]'],
  food: ['node["amenity"="restaurant"]', 'node["amenity"="cafe"]', 'node["amenity"="fast_food"]'],
  finance: ['node["amenity"="bank"]', 'node["amenity"="atm"]'],
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const distance = (a, b) => {
  const rad = x => x * Math.PI / 180, d1 = rad(b.lat - a.lat), d2 = rad(b.lon - a.lng);
  const h = Math.sin(d1/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(d2/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const groupFor = tags => Object.keys(TAGS).find(k => TAGS[k].some(q => {
  const m = q.match(/\["([^"]+)"="([^"]+)"\]/); return m && tags?.[m[1]] === m[2];
})) || 'transport';
const cacheKey = (p, r) => 'qj-poi-v1:' + p.lat.toFixed(3) + ':' + p.lng.toFixed(3) + ':' + r;
function readCache(key) {
  try { const x = JSON.parse(sessionStorage.getItem(key)); return x && Date.now() - x.time < 30*60*1000 ? x.items : null; } catch { return null; }
}
function writeCache(key, items) { try { sessionStorage.setItem(key, JSON.stringify({time:Date.now(),items})); } catch {} }
async function loadNearby(point, radius) {
  const key = cacheKey(point, radius), cached = readCache(key);
  if (cached) return cached;
  const selectors = Object.values(TAGS).flat().map(s => s.replace(/^node/, 'nwr'));
  const query = '[out:json][timeout:20];(' + selectors.map(s => s + '(around:' + radius + ',' + point.lat + ',' + point.lng + ');').join('') + ');out center tags;';
  let lastError;
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:'data=' + encodeURIComponent(query), signal:AbortSignal.timeout(24000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      const seen = new Set();
      const items = (json.elements || []).map(el => {
        const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon, tags = el.tags || {};
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const id = el.type + '/' + el.id; if (seen.has(id)) return null; seen.add(id);
        return { id, lat, lon, name: tags.name || tags['name:uz'] || tags['name:ru'] || tags.amenity || tags.shop || tags.leisure || 'Nomi ko‘rsatilmagan', group:groupFor(tags), distance:distance(point,{lat,lon}), type:tags.amenity || tags.shop || tags.leisure || tags.public_transport || tags.highway || '' };
      }).filter(x => x && x.distance <= radius/1000).sort((a,b)=>a.distance-b.distance);
      writeCache(key, items); return items;
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error('Nearby service unavailable');
}
export function mountSmartNearby(root, point, mapApi) {
  if (!root || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
  let radius = 1000, active = new Set(GROUPS.map(g=>g.id)), items = [], markers = [], busy = false;
  root.innerHTML = `
    <section class="smart-nearby">
      <div class="sn-head"><div><h2>Yaqin atrofdagi infratuzilma</h2><p class="muted small">OpenStreetMap ma’lumotlari asosida</p></div><span class="sn-source">OSM</span></div>
      <div class="sn-radii" role="group" aria-label="Qidiruv radiusi">${[500,1000,2000,5000].map(n=>`<button type="button" data-radius="${n}" class="${n===radius?'on':''}">${n>=1000?n/1000+' km':n+' m'}</button>`).join('')}</div>
      <div class="sn-categories">${GROUPS.map(g=>`<button type="button" data-group="${g.id}" class="on"><span>${g.icon}</span>${g.label}</button>`).join('')}</div>
      <p class="sn-status muted small" aria-live="polite">Yaqin obyektlar yuklanmoqda…</p>
      <div class="sn-results"></div>
      <p class="sn-foot muted small">Masofa xarita koordinatalari bo‘yicha to‘g‘ri chiziqda hisoblangan. Yo‘l vaqti ko‘rsatilmaydi.</p>
    </section>`;
  const status = root.querySelector('.sn-status'), results = root.querySelector('.sn-results');
  const clearMarkers = () => { markers.forEach(m=>mapApi?.map?.removeMarker(m)); markers=[]; };
  const draw = () => {
    const visible = items.filter(x=>active.has(x.group));
    status.textContent = visible.length ? visible.length + ' ta obyekt topildi' : 'Bu radius va toifalarda obyekt topilmadi.';
    results.innerHTML = visible.slice(0,36).map(x=>`<article class="sn-item"><span class="sn-icon">${GROUPS.find(g=>g.id===x.group)?.icon||'📍'}</span><span class="sn-name"><b>${esc(x.name)}</b><small>${esc(x.type)}</small></span><strong>${x.distance<1?Math.round(x.distance*1000)+' m':x.distance.toFixed(1)+' km'}</strong></article>`).join('');
    clearMarkers();
    visible.slice(0,80).forEach(x=>{ if(mapApi?.map?.addMarker) markers.push(mapApi.map.addMarker(x.lat,x.lon,`<div class="qj-pin poi-pin">${GROUPS.find(g=>g.id===x.group)?.icon||'📍'}</div>`,{z:2})); });
  };
  const load = async () => {
    if (busy) return; busy=true; status.textContent='Yaqin obyektlar qidirilmoqda…'; results.innerHTML='';
    root.querySelectorAll('[data-radius]').forEach(b=>b.disabled=true);
    try { items=await loadNearby(point,radius); draw(); }
    catch { status.textContent='Hozircha xarita ma’lumotlarini yuklab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.'; results.innerHTML='<button type="button" class="btn outline sn-retry">Qayta urinish</button>'; root.querySelector('.sn-retry')?.addEventListener('click',load); }
    finally { busy=false; root.querySelectorAll('[data-radius]').forEach(b=>b.disabled=false); }
  };
  root.addEventListener('click',e=>{
    const rb=e.target.closest('[data-radius]'), gb=e.target.closest('[data-group]');
    if(rb){ radius=Number(rb.dataset.radius); root.querySelectorAll('[data-radius]').forEach(b=>b.classList.toggle('on',b===rb)); load(); }
    if(gb){ const id=gb.dataset.group; active.has(id)?active.delete(id):active.add(id); gb.classList.toggle('on',active.has(id)); draw(); }
  });
  if (point.approx) { status.textContent='E’lonning aniq koordinatasi kiritilmagan. Yaqin obyektlar taxminiy nuqta asosida ko‘rsatilishi mumkin.'; }
  load();
}
