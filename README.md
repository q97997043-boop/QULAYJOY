# QULAYJOY — turar joy topish platformasi (MVP)

O‘zbekiston bo‘ylab mehmonxona, hostel, kunlik/oylik kvartira, xona va sherik topish. E’lon berish bepul.

## Imkoniyatlar
- Qidiruv: shahar, kalit so‘z, sana, mehmonlar, xonalar; 10 ta toifa
- Filtrlar: narx oralig‘i, tuman, xonalar soni, qulayliklar; saralash
- Ro‘yxat / Xarita ko‘rinishi (Leaflet + OpenStreetMap, kalit kerak emas)
- E’lon sahifasi: galereya (swipe, to‘liq ekran), qulayliklar, xarita (atrofdagi e’lonlar bilan), ulashish, o‘xshash e’lonlar
- **Chat**: mijoz e’lon egasiga faqat sayt ichida yozadi (Xabarlar bo‘limi, o‘qilmagan xabarlar soni, tezkor javoblar)
- **Telefon raqam — pullik xizmat** (to‘lov oynasi tayyor, Payme/Click ulanishi keyingi bosqich)
- **Xarita**: tashqi kutubxonasiz o‘z dvigateli (OpenStreetMap), belgilarni guruhlash, belgini bosganda rasm/narx/ma’lumot kartochkasi, yaqindagilar bo‘ylab oldinga/orqaga, “Yaqinimdagilar”
- Ro‘yxatdan o‘tish / kirish / parolni tiklash
- E’lon berish: 6 bo‘limli forma, 8 tagacha rasm (avtomatik siqiladi), xaritadan joy belgilash, jonli oldindan ko‘rish
- Profil: e’lonlarni tahrirlash, to‘xtatish/faollashtirish, o‘chirish, statistika
- Saqlanganlar (♡), 3 til (O‘zbek / Русский / English), tungi rejim
- Telefon uchun pastki menyu, PWA (telefonga ilova sifatida o‘rnatish)

## Texnologiya
Build kerak emas: oddiy HTML + CSS + JavaScript modullar. Vercel’ga to‘g‘ridan-to‘g‘ri joylanadi.

- **Supabase ulangan bo‘lsa** (`config.js`) — haqiqiy baza, auth va rasmlar saqlash.
- **Ulanmasa** yoki manzilga `?demo=1` qo‘shilsa — demo rejim (ma’lumotlar brauzerda, IndexedDB).

## Vercel’ga joylash
1. https://vercel.com/new → GitHub’dagi `qulayjoy` reposini tanlang
2. Framework: **Other**, Build command: bo‘sh, Output directory: `.` (bo‘sh qoldiring)
3. **Deploy** — tayyor.

## Supabase (ixtiyoriy)
`supabase/schema.sql` — asosiy jadvallar. Chat uchun `supabase/chat.sql` ni SQL Editor’da bir marta ishga tushiring.
Telefon raqam faqat egasining yopiq profilida saqlanadi va e’londa ko‘rinmaydi.

Xarita: `assets/js/map.js` — keyinchalik Google Maps API ulash uchun shu fayl ichini almashtirish kifoya.
Supabase → Authentication → URL Configuration’da sayt manzilingizni (masalan `https://qulayjoy.vercel.app`) qo‘shing.

## Lokal ishga tushirish
```sh
npx serve .
```
