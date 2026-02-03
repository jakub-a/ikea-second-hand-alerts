# IKEA Second-Hand Alerts

Mobile-first PWA that checks IKEA "Buy from IKEA" second-hand listings and sends keyword alerts.

## Structure
- `apps/web`: React + Vite PWA
- `apps/worker`: Cloudflare Worker API + hourly cron

## Local dev (requires network)
```bash
cd apps/web
npm install
npm run dev
```

```bash
cd apps/worker
npm install
npm run dev
```

## Deployment
- Web: Cloudflare Pages
- Worker: Cloudflare Workers + KV + Cron

See `apps/worker/README.md` for Worker setup.
