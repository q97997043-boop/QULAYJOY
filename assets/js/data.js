// Ma'lumotlar qatlami: Supabase (agar sozlangan va ulanish bo'lsa) yoki brauzerdagi demo (IndexedDB)
import { CATEGORIES } from './market.js';

const CFG = window.QJ_CONFIG || {};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const nowIso = () => new Date().toISOString();
const daysAgo = d => new Date(Date.now() - d * 864e5).toISOString();

/* ---------- Kichik IndexedDB kalit-qiymat ombori (xotira zaxirasi bilan) ---------- */
const mem = new Map();
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const r = indexedDB.open('qulayjoy', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const kv = {
  async get(k, def) {
    const db = await idb(); if (!db) return mem.has(k) ? mem.get(k) : def;
    return new Promise(res => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? def); q.onerror = () => res(def); } catch { res(def); } });
  },
  async set(k, v) {
    const db = await idb(); if (!db) { mem.set(k, v); return; }
    return new Promise((res, rej) => { try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } });
  },
};
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

async function sha256(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 0; for (const c of s) h = (h * 33 + c.charCodeAt(0)) | 0; return 'h' + h; }
}

/* ---------- Namuna e'lonlar (aniq "Namuna" belgisi bilan ko'rsatiladi) ---------- */
const IMG = n => `assets/img/${n}.jpg`;
export const SAMPLES = [
  { id: 's-1', category: 'apartment_daily', city: 'Toshkent', district: 'Yunusobod', title: 'Yunusobodda zamonaviy 2 xonali kvartira', description: 'Yangi ta’mirlangan, to‘liq jihozlangan kvartira. Metroga 5 daqiqa piyoda, yaqinida supermarket va kafe bor. Toza choyshab va sochiqlar beriladi.', price: 450000, payment_period: 'daily', available_places: 4, total_places: 4, rooms: 2, floor: 5, amenities: ['wifi', 'ac', 'kitchen', 'washer', 'tv', 'metro'], latitude: 41.3647, longitude: 69.2873, photos: [IMG('tashkent')], created_at: daysAgo(0.2), house_rules: 'Chekish mumkin emas. Kechki 23:00 dan keyin shovqin qilmaslik.' },
  { id: 's-2', category: 'hotel', city: 'Samarqand', district: 'Registon atrofi', title: 'Registon yonidagi oilaviy mehmonxona', description: 'Registon maydoniga 7 daqiqa piyoda. Har kuni milliy nonushta, hovlida choyxona. Ikki va uch kishilik xonalar mavjud.', price: 600000, payment_period: 'daily', available_places: 6, total_places: 12, rooms: 6, amenities: ['wifi', 'ac', 'breakfast', 'parking'], latitude: 39.6548, longitude: 66.9757, photos: [IMG('samarkand')], created_at: daysAgo(1) },
  { id: 's-3', category: 'hostel_bed', city: 'Buxoro', district: 'Lyabi-Hovuz', title: 'Eski shahar markazida hostel — joy', description: 'Lyabi-Hovuz yonida qulay hostel. 6 o‘rinli xonada joy, umumiy oshxona, bepul Wi-Fi va sayohatchilar uchun maslahatlar.', price: 120000, payment_period: 'daily', available_places: 3, total_places: 6, rooms: 1, amenities: ['wifi', 'kitchen', 'breakfast'], photos: [IMG('bukhara')], created_at: daysAgo(2) },
  { id: 's-4', category: 'apartment_monthly', city: 'Toshkent', district: 'Chilonzor', title: 'Chilonzorda oylik ijaraga 3 xonali kvartira', description: 'Oilaga mos keng kvartira, 3-qavat. Maktab, bog‘cha va bozor yaqin. Mebel va maishiy texnika bor. Uzoq muddatga beriladi.', price: 6500000, payment_period: 'monthly', available_places: 5, total_places: 5, rooms: 3, floor: 3, amenities: ['furniture', 'kitchen', 'washer', 'heating', 'fridge', 'metro'], photos: [], created_at: daysAgo(3) },
  { id: 's-5', category: 'roommate', city: 'Toshkent', district: 'Olmazor', title: 'Talaba qizlar uchun sherik qidirilmoqda', description: 'Universitetga yaqin kvartirada bitta bo‘sh o‘rin. Kommunal to‘lovlar teng bo‘linadi. Tinch va ozoda sherik kerak.', price: 1500000, payment_period: 'monthly', available_places: 1, total_places: 3, rooms: 2, amenities: ['wifi', 'kitchen', 'washer'], photos: [], created_at: daysAgo(4) },
  { id: 's-6', category: 'house', city: 'Xiva', district: 'Ichan qal’a yaqini', title: 'Xivada hovlili uy ijaraga', description: 'Ichan qal’aga 10 daqiqa. 4 xonali hovli uy, katta ayvon, mashina qo‘yish joyi. Oylik yoki mavsumiy ijaraga.', price: 5000000, payment_period: 'monthly', available_places: 6, total_places: 6, rooms: 4, amenities: ['parking', 'kitchen', 'furniture', 'heating'], photos: [IMG('khiva')], created_at: daysAgo(5) },
  { id: 's-7', category: 'room', city: 'Samarqand', district: 'Universitet xiyoboni', title: 'Alohida bo‘sh xona, mebel bilan', description: 'Uy egasi bilan birga yashash, alohida kirish. Xonada karavot, shkaf, ish stoli. Avtobus bekati yonida.', price: 1200000, payment_period: 'monthly', available_places: 1, total_places: 1, rooms: 1, amenities: ['furniture', 'wifi', 'heating'], photos: [], created_at: daysAgo(6) },
  { id: 's-8', category: 'apartment_weekly', city: 'Farg‘ona', district: 'Markaz', title: 'Haftalik ijaraga 1 xonali shinam kvartira', description: 'Shahar markazida, bog‘ yonida. Xizmat safari yoki dam olish uchun qulay. Hamma narsa bor, darhol kirish mumkin.', price: 1800000, payment_period: 'weekly', available_places: 2, total_places: 2, rooms: 1, floor: 2, amenities: ['wifi', 'ac', 'kitchen', 'tv'], photos: [], created_at: daysAgo(7) },
].map(s => ({ owner_id: 'sample', status: 'active', address: '', house_rules: s.house_rules || '', available_from: null, available_to: null, room_number: '', floor: s.floor ?? null, latitude: s.latitude ?? null, longitude: s.longitude ?? null, sample: true, ...s, media: s.photos.map((u, i) => ({ id: `${s.id}-m${i}`, url: u, media_type: 'image' })) }));

/* ---------- Rasmni siqish ---------- */
export async function compressImage(file, max = 1280, q = 0.78) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
    return { blob, dataUrl: c.toDataURL('image/jpeg', q) };
  } finally { URL.revokeObjectURL(url); }
}

/* ======================= DEMO (lokal) adapter ======================= */
const local = {
  mode: 'demo',
  _listeners: [],
  async _users() { return kv.get('users', []); },
  async _listings() { return kv.get('listings', []); },
  async init() {},
  async currentUser() {
    const id = ls.get('qj_session', null); if (!id) return null;
    const u = (await this._users()).find(x => x.id === id); if (!u) return null;
    return { id: u.id, email: u.email, created_at: u.created_at };
  },
  onAuth(cb) { this._listeners.push(cb); },
  _emit() { this._listeners.forEach(f => f()); },
  async signUp({ email, password, first_name, last_name, phone }) {
    const users = await this._users();
    if (users.some(u => u.email === email.toLowerCase())) throw new Error('err.exists');
    const u = { id: uid(), email: email.toLowerCase(), pass: await sha256(password + ':qj'), first_name, last_name, phone, created_at: nowIso() };
    users.push(u); await kv.set('users', users); ls.set('qj_session', u.id); this._emit();
    return { confirm: false };
  },
  async signIn({ email, password }) {
    const u = (await this._users()).find(x => x.email === email.toLowerCase());
    if (!u || u.pass !== (await sha256(password + ':qj'))) throw new Error('err.login');
    ls.set('qj_session', u.id); this._emit();
  },
  async signOut() { ls.del('qj_session'); this._emit(); },
  async resetPassword() { return { demo: true }; },
  async updatePassword(password) { const me = await this.currentUser(); if (!me) throw new Error('err.generic'); const users = await this._users(); const u = users.find(x => x.id === me.id); u.pass = await sha256(password + ':qj'); await kv.set('users', users); },
  async getProfile() { const me = await this.currentUser(); if (!me) return null; const u = (await this._users()).find(x => x.id === me.id); return { first_name: u.first_name || '', last_name: u.last_name || '', phone: u.phone || '', email: u.email, created_at: u.created_at }; },
  async updateProfile(p) { const me = await this.currentUser(); const users = await this._users(); const u = users.find(x => x.id === me.id); Object.assign(u, { first_name: p.first_name, last_name: p.last_name, phone: p.phone }); await kv.set('users', users); },
  async listListings() { const mine = (await this._listings()).filter(l => l.status === 'active'); return [...mine, ...SAMPLES]; },
  async getListing(id) {
    const s = SAMPLES.find(x => x.id === id); if (s) return s;
    const l = (await this._listings()).find(x => x.id === id); if (!l) return null;
    if (l.status !== 'active') { const me = await this.currentUser(); if (!me || me.id !== l.owner_id) return null; }
    return l;
  },
  async myListings() { const me = await this.currentUser(); if (!me) return []; return (await this._listings()).filter(l => l.owner_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async saveListing(id, data, photos) {
    const me = await this.currentUser(); if (!me) throw new Error('auth.required');
    const all = await this._listings();
    const media = photos.map((p, i) => ({ id: p.id || uid(), url: p.dataUrl || p.url, media_type: 'image', position: i }));
    let l;
    if (id) { l = all.find(x => x.id === id && x.owner_id === me.id); if (!l) throw new Error('err.generic'); Object.assign(l, data, { media }); }
    else { l = { id: uid(), owner_id: me.id, created_at: nowIso(), ...data, media }; all.push(l); }
    try { await kv.set('listings', all); } catch { throw new Error('err.storage'); }
    return l.id;
  },
  async setStatus(id, status) { const me = await this.currentUser(); const all = await this._listings(); const l = all.find(x => x.id === id && x.owner_id === me?.id); if (l) { l.status = status; await kv.set('listings', all); } },
  async deleteListing(id) { const me = await this.currentUser(); const all = (await this._listings()).filter(x => !(x.id === id && x.owner_id === me?.id)); await kv.set('listings', all); },

  /* ---- Chat (demo) ---- */
  async _name(id) { if (id === 'sample') return 'QULAYJOY'; const u = (await this._users()).find(x => x.id === id); return u ? (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email.split('@')[0]) : '—'; },
  async startChat(l) {
    const me = await this.currentUser(); if (!me) throw new Error('auth.required');
    if (l.owner_id === me.id) throw new Error('chat.own');
    const chats = await kv.get('chats', []);
    let c = chats.find(x => x.listing_id === l.id && x.buyer_id === me.id);
    if (!c) {
      c = { id: uid(), listing_id: l.id, owner_id: l.owner_id, buyer_id: me.id, created_at: nowIso(), last_message_at: nowIso(), last_message: '',
        listing: { id: l.id, title: l.title, price: l.price, payment_period: l.payment_period, category: l.category, city: l.city, photo: l.media?.find(m => m.url)?.url || null } };
      chats.push(c); await kv.set('chats', chats);
    }
    return c.id;
  },
  async _decorate(c, meId, msgs) {
    const other = c.owner_id === meId ? c.buyer_id : c.owner_id;
    return { ...c, role: c.owner_id === meId ? 'owner' : 'buyer', other_name: await this._name(other), unread: msgs.filter(m => m.chat_id === c.id && m.sender_id !== meId && !m.read_at).length };
  },
  async listChats() {
    const me = await this.currentUser(); if (!me) return [];
    const msgs = await kv.get('msgs', []);
    const mine = (await kv.get('chats', [])).filter(c => c.buyer_id === me.id || c.owner_id === me.id).filter(c => c.last_message || c.buyer_id === me.id);
    const out = []; for (const c of mine) out.push(await this._decorate(c, me.id, msgs));
    return out.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  },
  async getChat(id) {
    const me = await this.currentUser(); if (!me) return null;
    const c = (await kv.get('chats', [])).find(x => x.id === id && (x.buyer_id === me.id || x.owner_id === me.id)); if (!c) return null;
    const msgs = await kv.get('msgs', []);
    return { chat: await this._decorate(c, me.id, msgs), messages: msgs.filter(m => m.chat_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)), me: me.id };
  },
  async sendMessage(id, body) {
    const me = await this.currentUser(); if (!me) throw new Error('auth.required');
    const chats = await kv.get('chats', []); const c = chats.find(x => x.id === id); if (!c) throw new Error('err.generic');
    const msgs = await kv.get('msgs', []);
    const m = { id: uid(), chat_id: id, sender_id: me.id, body: body.slice(0, 2000), created_at: nowIso(), read_at: null };
    msgs.push(m); c.last_message = m.body; c.last_message_at = m.created_at;
    await kv.set('msgs', msgs); await kv.set('chats', chats);
    if (c.owner_id === 'sample' && !msgs.some(x => x.chat_id === id && x.sender_id === 'sample')) {
      setTimeout(async () => {
        const ms = await kv.get('msgs', []), cs = await kv.get('chats', []), cc = cs.find(x => x.id === id);
        const r = { id: uid(), chat_id: id, sender_id: 'sample', body: this.sampleReply || '…', created_at: nowIso(), read_at: null };
        ms.push(r); cc.last_message = r.body; cc.last_message_at = r.created_at; await kv.set('msgs', ms); await kv.set('chats', cs);
      }, 1500);
    }
    return m;
  },
  async markRead(id) {
    const me = await this.currentUser(); if (!me) return;
    const msgs = await kv.get('msgs', []); let ch = false;
    msgs.forEach(m => { if (m.chat_id === id && m.sender_id !== me.id && !m.read_at) { m.read_at = nowIso(); ch = true; } });
    if (ch) await kv.set('msgs', msgs);
  },
  async unreadCount() {
    const me = await this.currentUser(); if (!me) return 0;
    const ids = new Set((await kv.get('chats', [])).filter(c => c.buyer_id === me.id || c.owner_id === me.id).map(c => c.id));
    return (await kv.get('msgs', [])).filter(m => ids.has(m.chat_id) && m.sender_id !== me.id && !m.read_at).length;
  },
};

/* ======================= SUPABASE adapter ======================= */
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }
const BUCKET = CFG.supabaseBucket || 'listing-media';
const COLS = ['title', 'description', 'category', 'city', 'district', 'address', 'latitude', 'longitude', 'price', 'payment_period', 'available_places', 'total_places', 'rooms', 'floor', 'room_number', 'available_from', 'available_to', 'amenities', 'house_rules', 'status'];

const remote = {
  mode: 'live',
  sb: null,
  async init() {
    const mod = await withTimeout(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'), 8000);
    this.sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    const r = await withTimeout(this.sb.from('listings').select('id').limit(1), 8000);
    if (r.error) throw r.error;
  },
  async currentUser() { const { data } = await this.sb.auth.getSession(); return data.session?.user ?? null; },
  onAuth(cb) { this.sb.auth.onAuthStateChange((ev) => cb(ev)); },
  async signUp({ email, password, first_name, last_name, phone }) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { first_name, last_name, phone }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new Error(/registered|exists/i.test(error.message) ? 'err.exists' : error.message);
    return { confirm: !data.session };
  },
  async signIn({ email, password }) { const { error } = await this.sb.auth.signInWithPassword({ email, password }); if (error) throw new Error(/invalid/i.test(error.message) ? 'err.login' : error.message); },
  async signOut() { await this.sb.auth.signOut(); },
  async resetPassword(email) { const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw new Error(error.message); return {}; },
  async updatePassword(password) { const { error } = await this.sb.auth.updateUser({ password }); if (error) throw new Error(error.message); },
  async getProfile() {
    const me = await this.currentUser(); if (!me) return null;
    const { data } = await this.sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
    let avatar_url = '';
    if (data?.avatar_path) { const { data: signed } = await this.sb.storage.from(BUCKET).createSignedUrl(data.avatar_path, 3600); avatar_url = signed?.signedUrl || ''; }
    return { ...data, first_name: data?.first_name || '', last_name: data?.last_name || '', phone: data?.phone || '', email: me.email, avatar_url, created_at: data?.created_at || me.created_at };
  },
  async updateProfile(p) {
    const me = await this.currentUser();
    const { error } = await this.sb.from('profiles').update({ first_name:p.first_name, last_name:p.last_name, phone:p.phone, display_name:p.display_name||'', bio:p.bio||'', telegram:p.telegram||'', show_phone:!!p.show_phone }).eq('id', me.id);
    if (error) throw new Error(error.message);
  },
  async uploadAvatar(file) {
    const me=await this.currentUser(); if(!me) throw new Error('auth.required');
    const path=`${me.id}/avatars/avatar-${Date.now()}.jpg`;
    const up=await this.sb.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
    if(up.error) throw new Error(up.error.message);
    const {error}=await this.sb.from('profiles').update({avatar_path:path}).eq('id',me.id);
    if(error) throw new Error(error.message);
    const {data}=await this.sb.storage.from(BUCKET).createSignedUrl(path,3600); return data?.signedUrl||'';
  },
  async recordListingView(id) {
    let viewer=localStorage.getItem('qj_viewer_key');
    if(!viewer){viewer=uid().replace(/-/g,'')+uid().replace(/-/g,'');localStorage.setItem('qj_viewer_key',viewer);}
    const {error}=await this.sb.rpc('record_listing_view',{p_listing:id,p_viewer:viewer.slice(0,64)});
    if(error) console.warn('View counter:',error.message);
  },
  async createBooking(payload) {
    const me=await this.currentUser(); if(!me) throw new Error('auth.required');
    const {data,error}=await this.sb.rpc('request_booking',{
      p_listing:payload.listing_id,p_name:payload.guest_name,p_phone:payload.guest_phone,
      p_in:payload.check_in,p_out:payload.check_out,p_places:payload.places
    });
    if(error) throw new Error(error.message); return data;
  },
  async completeListing(id) {
    const me=await this.currentUser(); if(!me) throw new Error('auth.required');
    const {error}=await this.sb.rpc('owner_complete_listing',{p_listing:id});
    if(error) throw new Error(error.message);
  },
  async _hydrate(rows) {
    const imgs = rows.flatMap(r => (r.listing_images || []));
    const paths = imgs.map(i => i.storage_path);
    let urls = {};
    if (paths.length) {
      const { data } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
      (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; });
    }
    return rows.map(r => ({ ...r, price: Number(r.price), media: (r.listing_images || []).sort((a, b) => a.position - b.position).map(i => ({ ...i, url: urls[i.storage_path] || null })).filter(m => m.url) }));
  },
  async listListings() {
    const { data, error } = await this.sb.from('listings').select('*, listing_images(*)').eq('status', 'active').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const rows = await this._hydrate(data || []);
    return rows;
  },
  async getListing(id) {
    const s = SAMPLES.find(x => x.id === id); if (s) return s;
    const { data } = await this.sb.from('listings').select('*, listing_images(*)').eq('id', id).maybeSingle();
    return data ? (await this._hydrate([data]))[0] : null;
  },
  async myListings() {
    const me = await this.currentUser(); if (!me) return [];
    const { data } = await this.sb.from('listings').select('*, listing_images(*)').eq('owner_id', me.id).order('created_at', { ascending: false });
    return this._hydrate(data || []);
  },
  async saveListing(id, data, photos) {
    const me = await this.currentUser(); if (!me) throw new Error('auth.required');
    const row = {}; COLS.forEach(k => (row[k] = data[k]));
    if (row.floor == null) row.floor = null;
    if (!row.room_number) row.room_number = null;
    const write = async r => id ? this.sb.from('listings').update(r).eq('id', id).eq('owner_id', me.id).select('id').single() : this.sb.from('listings').insert({ ...r, owner_id: me.id }).select('id').single();
    const res = await write(row);
    if (res.error) throw new Error(res.error.message);
    const lid = res.data.id;
    // Rasmlar: eskisidan o'chirilganlarini olib tashlash, yangilarini yuklash
    const { data: old } = await this.sb.from('listing_images').select('*').eq('listing_id', lid);
    const keep = new Set(photos.filter(p => p.storage_path).map(p => p.storage_path));
    const gone = (old || []).filter(o => !keep.has(o.storage_path));
    if (gone.length) { await this.sb.from('listing_images').delete().in('id', gone.map(g => g.id)); await this.sb.storage.from(BUCKET).remove(gone.map(g => g.storage_path)); }
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.storage_path) { await this.sb.from('listing_images').update({ position: i }).eq('listing_id', lid).eq('storage_path', p.storage_path); continue; }
      const path = `${me.id}/${lid}/${uid()}.jpg`;
      const up = await this.sb.storage.from(BUCKET).upload(path, p.blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw new Error(up.error.message);
      await this.sb.from('listing_images').insert({ listing_id: lid, storage_path: path, media_type: 'image', position: i });
    }
    return lid;
  },
  async setStatus(id, status) { const me = await this.currentUser(); const { error } = await this.sb.from('listings').update({ status }).eq('id', id).eq('owner_id', me.id); if (error) throw new Error(error.message); },
  async deleteListing(id) {
    const me = await this.currentUser();
    const { data: imgs } = await this.sb.from('listing_images').select('storage_path').eq('listing_id', id);
    const { error } = await this.sb.from('listings').delete().eq('id', id).eq('owner_id', me.id);
    if (error) throw new Error(error.message);
    if (imgs?.length) await this.sb.storage.from(BUCKET).remove(imgs.map(i => i.storage_path));
  },

  /* ---- Chat (Supabase: supabase/chat.sql) ---- */
  _chatErr(e) { if (e && /conversations|messages|does not exist|schema cache/i.test(e.message || '')) return new Error('chat.notReady'); return new Error(e?.message || 'err.generic'); },
  async _shapeChats(rows, meId) {
    const paths = rows.map(r => (r.listings?.listing_images || []).sort((a, b) => a.position - b.position)[0]?.storage_path).filter(Boolean);
    const urls = {};
    if (paths.length) { const { data } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 3600); (data || []).forEach(d => d.signedUrl && (urls[d.path] = d.signedUrl)); }
    return rows.map(r => {
      const l = r.listings || {}; const ph = (l.listing_images || []).sort((a, b) => a.position - b.position)[0]?.storage_path;
      return { id: r.id, listing_id: r.listing_id, owner_id: r.owner_id, buyer_id: r.buyer_id, last_message: r.last_message || '', last_message_at: r.last_message_at, created_at: r.created_at,
        role: r.owner_id === meId ? 'owner' : 'buyer', other_name: (r.owner_id === meId ? r.buyer_name : r.owner_name) || '—', unread: 0,
        listing: { id: l.id, title: l.title || '—', price: Number(l.price || 0), payment_period: l.payment_period, category: l.category, city: l.city, photo: ph ? urls[ph] || null : null } };
    });
  },
  async startChat(l) {
    const me = await this.currentUser(); if (!me) throw new Error('auth.required');
    if (l.sample) throw new Error('chat.sample');
    if (l.owner_id === me.id) throw new Error('chat.own');
    const ex = await this.sb.from('conversations').select('id').eq('listing_id', l.id).eq('buyer_id', me.id).maybeSingle();
    if (ex.error) throw this._chatErr(ex.error);
    if (ex.data) return ex.data.id;
    const { data, error } = await this.sb.from('conversations').insert({ listing_id: l.id, buyer_id: me.id, owner_id: l.owner_id }).select('id').single();
    if (error) throw this._chatErr(error);
    return data.id;
  },
  async listChats() {
    const me = await this.currentUser(); if (!me) return [];
    const { data, error } = await this.sb.from('conversations').select('*, listings(id,title,price,payment_period,category,city,listing_images(storage_path,position))').or(`buyer_id.eq.${me.id},owner_id.eq.${me.id}`).order('last_message_at', { ascending: false });
    if (error) throw this._chatErr(error);
    const rows = (data || []).filter(r => r.last_message || r.buyer_id === me.id);
    const chats = await this._shapeChats(rows, me.id);
    const un = await this.sb.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', me.id);
    (un.data || []).forEach(m => { const c = chats.find(x => x.id === m.conversation_id); if (c) c.unread++; });
    return chats;
  },
  async getChat(id) {
    const me = await this.currentUser(); if (!me) return null;
    const { data, error } = await this.sb.from('conversations').select('*, listings(id,title,price,payment_period,category,city,listing_images(storage_path,position))').eq('id', id).maybeSingle();
    if (error) throw this._chatErr(error);
    if (!data) return null;
    const [chat] = await this._shapeChats([data], me.id);
    const ms = await this.sb.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }).limit(500);
    return { chat, messages: (ms.data || []).map(m => ({ ...m, chat_id: m.conversation_id })), me: me.id };
  },
  async sendMessage(id, body) {
    const { data, error } = await this.sb.from('messages').insert({ conversation_id: id, body: body.slice(0, 2000) }).select('*').single();
    if (error) throw this._chatErr(error);
    return data;
  },
  async markRead(id) {
    const me = await this.currentUser(); if (!me) return;
    await this.sb.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', id).neq('sender_id', me.id).is('read_at', null);
  },
  async unreadCount() {
    const me = await this.currentUser(); if (!me) return 0;
    const { count } = await this.sb.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', me.id);
    return count || 0;
  },
};

/* ---------- Tanlash ---------- */
export let store = local;
export async function initStore() {
  const forceDemo = /[?&]demo=1/.test(location.search);
  if (!forceDemo && CFG.supabaseUrl && CFG.supabaseKey) {
    try { await remote.init(); store = remote; return store; } catch (e) { console.warn('[QULAYJOY] Supabase ulanmadi, demo rejim:', e?.message || e); }
  }
  store = local; await local.init(); return store;
}

/* ---------- Saqlanganlar (har doim lokal) ---------- */
export const favs = {
  all() { return ls.get('qj_favs', []); },
  has(id) { return this.all().includes(id); },
  toggle(id) { const a = this.all(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.unshift(id); ls.set('qj_favs', a); return i < 0; },
};
export const prefs = { get: (k, d) => ls.get('qj_' + k, d), set: (k, v) => ls.set('qj_' + k, v) };
export { CATEGORIES };
