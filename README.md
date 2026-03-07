# Veya — Your money. Your rules.

Subscription management with AI-powered financial coaching. Track every subscription, get insights, and chat with the Veya AI coach.

## Features

- **Dashboard** — Monthly spend, yearly projection, active/paused counts, daily AI tip
- **Subscriptions** — Full CRUD, categories, billing cycles, renewal dates, pause/resume
- **Analytics** — Subscription score, spend by category, history, insights, heatmap
- **Veya AI Coach** — GPT-4o–powered chat with full context of your subscriptions; daily tips
- **Family Plan** — Create family, invite members, shared subscriptions, split costs
- **Auth** — Register, login, JWT (access + refresh), forgot/reset password
- **Notifications** — In-app; settings for renewal reminder, weekly summary, etc.
- **Premium** — Stripe checkout; Free (10 subs) vs Premium (unlimited, Plaid, family)

## Tech stack

- **Monorepo** — Turborepo
- **API** — Node 20, Express, TypeScript, Prisma (PostgreSQL), Redis, JWT, Bcrypt, OpenAI, Stripe
- **Mobile** — React Native, Expo SDK 51, Expo Router, NativeWind, Zustand, TanStack Query
- **Web** — Next.js 14, Tailwind, Recharts, same API

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7 (optional for full features)

### 1. Clone and install

```bash
git clone <repo>
cd Finance-app
npm install
```

### 2. Environment

Copy `.env.example` to `.env` in the repo root and in `packages/api` if you run the API from there. Set at least:

- `DATABASE_URL` — e.g. `postgresql://postgres:postgres@localhost:5432/veya`
- `JWT_ACCESS_SECRET` — min 32 characters
- `JWT_REFRESH_SECRET` — min 32 characters
- `OPENAI_API_KEY` — for AI coach (optional; falls back to demo tips)
- `REDIS_URL` — e.g. `redis://localhost:6379` (optional)

### 3. Database

```bash
cd packages/api
npx prisma generate
npx prisma db push
npm run seed
```

### 4. Run API

```bash
cd packages/api
npm run dev
```

API: http://localhost:4000  
Health: http://localhost:4000/health

### 5. Run web app

```bash
cd apps/web
npm install
npm run dev
```

Web: http://localhost:3000

### 6. Run mobile app (Expo)

```bash
cd apps/mobile
npm install
npx expo install
npx expo start
```

Set `EXPO_PUBLIC_API_URL=http://YOUR_IP:4000` (e.g. your machine’s LAN IP) for device/emulator.

## Environment variables

| Variable | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL (optional) |
| `JWT_ACCESS_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_ACCESS_EXPIRES_IN` | e.g. 15m |
| `JWT_REFRESH_EXPIRES_IN` | e.g. 30d |
| `BCRYPT_SALT_ROUNDS` | e.g. 12 |
| `OPENAI_API_KEY` | OpenAI API key for Veya AI coach |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PREMIUM_PRICE_MONTHLY` | Stripe Price ID monthly |
| `STRIPE_PREMIUM_PRICE_YEARLY` | Stripe Price ID yearly |
| `NEXT_PUBLIC_API_URL` | API base URL for web app |
| `EXPO_PUBLIC_API_URL` | API base URL for mobile app |

## API overview

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, forgot/reset password
- **Subscriptions** — `GET/POST /api/subscriptions`, `GET/PUT/DELETE /api/subscriptions/:id`, `PATCH .../pause`, `.../resume`, `GET .../alternative`
- **Analytics** — `GET /api/analytics/summary`, `history`, `categories`, `score`, `insights`, `heatmap`
- **AI** — `POST /api/ai/chat`, `GET /api/ai/conversations`, `DELETE /api/ai/conversations`, `GET /api/ai/daily-tip`
- **Family** — `POST /api/family/create`, `GET /api/family/:id`, `POST /api/family/invite`, `POST /api/family/join/:invite_code`, `DELETE /api/family/leave`, members, shared-subscriptions
- **Notifications** — `GET /api/notifications`, `PATCH .../:id/read`, `PATCH .../read-all`, `GET/PUT .../settings`
- **User** — `GET/PUT /api/user/profile`, `PUT /api/user/password`, `DELETE /api/user/account`, `GET/PUT /api/user/settings`
- **Billing** — `POST /api/billing/create-checkout-session`, `POST /api/billing/webhook`, `GET /api/billing/subscription`, `POST /api/billing/cancel`

Protected routes use header: `Authorization: Bearer <accessToken>`.

## Deployment

### Vercel (web)

1. Link repo to Vercel.
2. Set root to repo root; build command: `cd apps/web && npm install && npm run build`; output directory: `apps/web/.next` (or use Vercel’s Next.js detection with root `apps/web`).
3. Set `NEXT_PUBLIC_API_URL` to your API URL.

### Railway (API + DB)

1. Create a new project; add PostgreSQL and (optional) Redis.
2. Add a service from `packages/api` (or Dockerfile in that folder).
3. Set env vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.
4. Run migrations: `npx prisma migrate deploy` (or `db push` for dev).

### Docker (API + PostgreSQL + Redis)

From `packages/api`:

```bash
docker compose up -d
```

Then run migrations and seed as above.

## Screenshots

- **Landing** — Hero, features grid, pricing (Free vs Premium), FAQ, footer
- **Dashboard** — Greeting, monthly spend card, stats row, AI tip card
- **Subscriptions** — List with search, cards with logo, price, status, renewal
- **Analytics** — Score gauge, monthly spend, bar chart, categories, insights
- **Veya AI Coach** — Chat UI, quick prompts, send message

---

© Veya. Your money. Your rules.
