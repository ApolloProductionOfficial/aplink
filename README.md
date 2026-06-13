# APLink — Apollo Production

**APLink** — приватные видеозвонки без ограничений по IP. Проект Apollo Production.

- Прод: https://aplink.live
- Бэкенд: Supabase (`otpqvjrdhaitghygkdnc`) — Apollo-owned
- Видео: LiveKit / JaaS (8x8)
- Десктоп: Electron-сборка (`ELECTRON_BUILD=1`)

## Стек

Vite · React · TypeScript · Tailwind · shadcn/ui · LiveKit · Supabase

## Локальная разработка

```sh
npm install
npm run dev      # http://localhost:8080
```

## Сборка

```sh
npm run build                    # web (Vercel), base "/"
ELECTRON_BUILD=1 npm run build   # Electron, base "./"
```

## Деплой

Web — Vercel (проект `aplink`, домен aplink.live). SPA-rewrites в `vercel.json`.

---
© Apollo Production. Все права защищены.
