# PenShift

Multi-model AI SaaS — Humanizer · Blog Generator · Affiliate Generator · AI Detection  
**React 18 · Vite 8 · Tailwind 3 · Node HTTP Production Web Service · Zero framer-motion**

---

## Deploy to Render in 3 Steps

1. Push to GitHub (`https://github.com/mccoywilson01-dot/penshift.git`).
2. In [Render Dashboard](https://dashboard.render.com), create a new **Web Service** connected to your repository.
3. Configure build & start settings:
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - Add environment variables as listed in `.env.example`.

---

## Environment Variables

Configure these in **Render → Environment**:

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret (server-only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |
| `QSTASH_TOKEN` | Upstash QStash Token |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash QStash Current Signing Key |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash Next Signing Key |
| `PENSHIFT_QSTASH_WORKER_URL` | `https://<your-service>.onrender.com/api/internal/worker/generation` |
| `PENSHIFT_RECONCILE_URL` | `https://<your-service>.onrender.com/api/internal/reconcile` |
| `CRON_SECRET` | Secret token for QStash scheduled reconciliation |
| `GEMINI_API_KEY_1` | Google Gemini API Key |
| `GROQ_API_KEY_1` | Groq Cloud API Key |
| `ALLOWED_ORIGINS` | `https://<your-service>.onrender.com,https://penshift.com` |

---

## Local Development

```bash
cp .env.example .env
# Fill in your development credentials in .env
npm install
npm run dev
```

To test the production build and Node HTTP server locally:

```bash
npm run build
npm start
```

Health check:

```bash
curl http://localhost:10000/api/health
```
