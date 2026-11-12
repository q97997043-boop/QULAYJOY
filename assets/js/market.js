// Toifalar, shaharlar, validatsiya — brauzer uchun xavfsiz modul
export const CATEGORIES = [
  { id: 'hotel', period: 'daily', icon: 'hotel' },
  { id: 'hostel', period: 'daily', icon: 'bed' },
  { id: 'apartment_daily', period: 'daily', icon: 'building' },
  { id: 'apartment_weekly', period: 'weekly', icon: 'calendar' },
  { id: 'apartment_monthly', period: 'monthly', icon: 'building' },
  { id: 'long_term', period: 'monthly', icon: 'key' },
  { id: 'roommate', period: 'monthly', icon: 'users' },
  { id: 'room', period: 'monthly', icon: 'door' },
  { id: 'hostel_bed', period: 'daily', icon: 'bed' },
  { id: 'house', period: 'monthly', icon: 'home' },
];
export const LONG_STAY = ['roommate', 'room', 'long_term', 'apartment_monthly', 'house'];

export const CITY_COORDS = {
  Toshkent: [41.2995, 69.2401], Samarqand: [39.6542, 66.9597], Buxoro: [39.7747, 64.4286], Xiva: [41.3783, 60.3639],
  Andijon: [40.7821, 72.3442], 'Farg‘ona': [40.3864, 71.7864], Namangan: [40.9983, 71.6726], Nukus: [42.4531, 59.6103],
  Qarshi: [38.8606, 65.7891], Termiz: [37.2242, 67.2783], Jizzax: [40.1158, 67.8422], Guliston: [40.4897, 68.7842],
  Navoiy: [40.1039, 65.3739], Urganch: [41.5506, 60.6317],
};
export const CITIES = Object.keys(CITY_COORDS);
export const UZ_CENTER = [41.3, 64.5];

function hash(id) {
  // FNV-1a + aralashtirish: o'xshash id'lar ham bir-biridan uzoq nuqtalar beradi
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
}

/** Aniq koordinata bo'lsa — o'sha; aks holda shahar markazi atrofida barqaror siljish. */
export function listingPoint(l) {
  const lat = l.latitude == null ? NaN : Number(l.latitude), lng = l.longitude == null ? NaN : Number(l.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, approx: false };
  const c = CITY_COORDS[l.city]; if (!c) return null;
  const h = hash(String(l.id));
  return { lat: c[0] + (((h % 1000) - 500) / 500) * 0.03, lng: c[1] + ((((h >>> 10) % 1000) - 500) / 500) * 0.04, approx: true };
}

export const PHONE_RE = /^\+998\d{9}$/;
export const normPhone = v => { const d = String(v || '').replace(/[^\d+]/g, ''); if (/^\d{9}$/.test(d)) return '+998' + d; if (/^998\d{9}$/.test(d)) return '+' + d; return d; };

/** Qaytaradi: { ok, data, errors: {field: i18nKey} } */
export function validateListing(raw) {
  const e = {};
  const s = k => String(raw[k] ?? '').trim();
  const n = k => (raw[k] === '' || raw[k] == null ? NaN : Number(raw[k]));
  const data = {
    title: s('title'), description: s('description'), category: s('category'), city: s('city'),
    district: s('district').slice(0, 100), address: s('address').slice(0, 250),
    price: Math.round(n('price')), payment_period: s('payment_period') || 'monthly',
    available_places: Math.round(n('available_places')) || 1, total_places: Math.round(n('total_places')) || 1,
    rooms: Math.round(n('rooms')) || 1, floor: Number.isFinite(n('floor')) ? Math.round(n('floor')) : null,
    room_number: s('room_number').slice(0, 30),
    available_from: s('available_from') || null, available_to: s('available_to') || null,
    amenities: Array.isArray(raw.amenities) ? raw.amenities.slice(0, 30) : [],
    latitude: raw.latitude ?? null, longitude: raw.longitude ?? null,
    house_rules: s('house_rules').slice(0, 1500), status: ['active', 'paused', 'draft'].includes(s('status')) ? s('status') : 'active',
  };
  if (data.title.length < 5 || data.title.length > 160) e.title = 'err.title';
  if (data.description.length < 20 || data.description.length > 5000) e.description = 'err.description';
  if (!CATEGORIES.some(c => c.id === data.category)) e.category = 'err.generic';
  if (data.city.length < 2) e.city = 'err.generic';
  if (!Number.isFinite(data.price) || data.price < 0 || data.price > 1e11) e.price = 'err.price';
  if (data.available_places > data.total_places || data.available_places < 1) e.available_places = 'err.places';
  if (data.available_from && data.available_to && data.available_to < data.available_from) e.available_to = 'err.dates';
  return { ok: !Object.keys(e).length, data, errors: e };
}

export function filterListings(list, f) {
  const q = (f.q || '').toLocaleLowerCase().trim();
  const dist = (f.district || '').toLocaleLowerCase().trim();
  let r = list.filter(l =>
    (!f.category || l.category === f.category) &&
    (!f.city || l.city === f.city) &&
    (!dist || (l.district || '').toLocaleLowerCase().includes(dist)) &&
    (!f.guests || l.available_places >= f.guests) &&
    (!f.rooms || l.rooms >= f.rooms) &&
    (!f.min || l.price >= f.min) &&
    (!f.max || l.price <= f.max) &&
    (!f.date || !l.available_from || l.available_from <= f.date) &&
    (!f.end || !l.available_to || l.available_to >= f.end) &&
    (!f.amenities?.length || f.amenities.every(a => (l.amenities || []).includes(a))) &&
    (!q || `${l.title} ${l.description} ${l.district} ${l.address} ${l.city}`.toLocaleLowerCase().includes(q)));
  if (f.sort === 'priceAsc') r = [...r].sort((a, b) => a.price - b.price);
  else if (f.sort === 'priceDesc') r = [...r].sort((a, b) => b.price - a.price);
  else r = [...r].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return r;
}
