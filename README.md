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

## Tests
```bash
cd apps/worker
npm run test:all
```

```bash
cd apps/web
npm run test:unit
npm run test:smoke
```

## Search debug snapshot
```bash
node scripts/repro-search.mjs --query "billy shelf" --stores "294,203"
```

See:
- `docs/release-checklist.md`
- `docs/ai-debug-framework.md`

## Deployment
- Web: Cloudflare Pages
- Worker: Cloudflare Workers + KV + Cron

See `apps/worker/README.md` for Worker setup.
