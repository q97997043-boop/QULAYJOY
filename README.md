# Screenshot To Scene

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/53113974-9e82-4665-a9f5-27ef8ce5f17e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Tillar va xarita (MVP)

- **Tillar:** O‘zbekcha (standart), Русский, English. Tanlov sarlavhadagi til menyusida, `localStorage`da saqlanadi. Matnlar `src/lib/i18n.tsx`da — yangi til qo‘shish uchun `Lang`ga qo‘shing va lug‘at yozing (TypeScript yetishmayotgan kalitlarni ko‘rsatadi).
- **Xarita:** Leaflet + OpenStreetMap (API kalit kerak emas). Bosh sahifada «Ro‘yxat / Xarita» almashtirgich, e’lon sahifasida joylashuv, e’lon berishda xaritadan nuqta belgilash. Koordinata kiritilmagan e’lonlar shahar markazi atrofida «taxminiy» ko‘rsatiladi.
- Yangi paket: `leaflet`, `@types/leaflet` → `npm install` (yoki `bun install`) kerak.
