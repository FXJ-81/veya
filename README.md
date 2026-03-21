# Veya — Two standalone projects

Two **separate** apps (no monorepo, no shared packages):

- **veya-web** — Next.js 14 web app with API routes, Prisma, NextAuth, deployable to Vercel.
- **veya-mobile** — Expo (React Native) app that talks to veya-web’s API.

Same account works on both: web uses NextAuth (cookies); mobile uses `/api/auth/token` (JWT) and sends `Authorization: Bearer <token>`.

---

## veya-web

**From the repo root** you can run `npm install` then `npm run dev` (uses npm workspaces).  
Or **cd into the app folder** as below.

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

---

## Dev server: browser won’t load / spins forever

1. **Use this URL:** `http://127.0.0.1:3000` (not `https://`). On some PCs `localhost` fails; `127.0.0.1` works.
2. **Wait for the first compile:** After “Ready”, the **first** visit triggers compilation. Watch the terminal for `○ Compiling` / `✓ Compiled` — it can take 10–30+ seconds. Leave the tab open until then.
3. **Project in OneDrive:** If the repo lives under OneDrive (`…\OneDrive\…`), sync can make Next.js very slow or flaky. Prefer cloning to a folder **outside** OneDrive (e.g. `C:\dev\Finance-app`) or pause sync for this folder and exclude `node_modules` and `.next`.
4. **`npm run dev` now uses `-H 0.0.0.0`** so you can also try the **Network** URL Next prints (e.g. `http://192.168.x.x:3000`) from the same machine.
