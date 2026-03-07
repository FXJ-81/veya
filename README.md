# Veya — Two standalone projects

Two **separate** apps (no monorepo, no shared packages):

- **veya-web** — Next.js 14 web app with API routes, Prisma, NextAuth, deployable to Vercel.
- **veya-mobile** — Expo (React Native) app that talks to veya-web’s API.

Same account works on both: web uses NextAuth (cookies); mobile uses `/api/auth/token` (JWT) and sends `Authorization: Bearer <token>`.

---

## veya-web

```bash
cd veya-web
cp .env.example .env.local   # fill DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, etc.
npm install
npx prisma generate
npx prisma db push          # create DB tables (PostgreSQL, e.g. Supabase)
npm run dev                 # http://localhost:3000
```

Deploy to Vercel: connect the repo, set root to `veya-web`, add env vars. No extra config needed.

---

## veya-mobile

```bash
cd veya-mobile
npm install
# Set EXPO_PUBLIC_API_URL in .env to your veya-web URL (e.g. https://your-app.vercel.app)
npx expo start
```

Use the same email/password as on web. Mobile signs in via `POST /api/auth/token` and then calls the same API routes with the returned JWT.
