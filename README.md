# micromanus-frontend

Vite + React SPA for micromanus (BYOK chat, credits, Stripe Checkout redirect).

## Local setup

```bash
bun install
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# Leave VITE_API_URL unset — Vite proxies API routes to http://localhost:4000

bun run dev
# http://localhost:5173
```

Run the backend on port **4000** (`micromanus-backend`).

### Supabase Auth redirect URLs (required for local OAuth)

OAuth `redirectTo` is always `${window.location.origin}/new`. If that URL is **not** on the project allow list, Supabase falls back to **Site URL** (production), which looks like “login sent me to Vercel.”

In [URL Configuration](https://supabase.com/dashboard/project/egprtjyxbyruhlhzvrgz/auth/url-configuration) keep Site URL as production, and add **Redirect URLs**:

```
http://localhost:5173/**
http://localhost:4173/**
https://micromanus-frontend.vercel.app/**
```

- `5173` — `bun run dev`
- `4173` — `bun run preview`
- Vercel — production (and optionally `https://*-.vercel.app/**` for preview deploys)

## Scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Vite dev server + API proxy |
| `bun run typecheck` | TypeScript |
| `bun run lint` | ESLint |
| `bun run build` | Production build → `dist/` |
| `bun run preview` | Preview the production build |

## Deploy to Vercel

Deploy this repo as its **own** Vercel project (separate from the backend).

1. [Import](https://vercel.com/new) the `micromanus-frontend` Git repo (framework: Vite; output `dist`).
2. `vercel.json` rewrites all routes to `/index.html` so React Router and Stripe return URLs (`/credits?checkout=…`) work.
3. Set **Production** env vars (build-time — Vite inlines `VITE_*`):

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Same project as the backend |
| `VITE_SUPABASE_ANON_KEY` | Anon / publishable key only — never the service role |
| `VITE_API_URL` | Backend origin, e.g. `https://<backend>.vercel.app` (no trailing slash) |
| `VITE_SITE_URL` | Optional. Canonical public origin for SEO (no trailing slash). Defaults to the current origin in the app; static `og:*` / sitemap use `https://micromanus-frontend.vercel.app` until you customize those files. |

4. Deploy the **backend** first (or re-deploy the frontend after you know the API URL).
5. On the backend, set `CORS_ORIGINS` to this frontend’s origin and point `CHECKOUT_*_URL` at this host.
6. Supabase Dashboard → **Authentication** → URL configuration: set **Site URL** to `https://<frontend>.vercel.app`, and keep local Redirect URLs (`http://localhost:5173/**`, `http://localhost:4173/**`) plus `https://<frontend>.vercel.app/**` (see Local setup above).

### Stripe Test checkout on production

The frontend only redirects to the Checkout `url` from `POST /credits/checkout`. Keep Stripe in **Test mode** on the backend (`sk_test_…` + Test webhook). Pay with dummy card `4242 4242 4242 4242`.

Never put `STRIPE_SECRET_KEY`, webhook secrets, `ENCRYPTION_KEY`, or the Supabase service role in frontend env.
