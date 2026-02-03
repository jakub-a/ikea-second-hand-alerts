# Worker Setup

1. Create a KV namespace named `SUBSCRIPTIONS` and update `wrangler.toml` with its id.
2. Generate VAPID keys:
   - `npx web-push generate-vapid-keys`
3. Set secrets:
   - `wrangler secret put VAPID_PUBLIC_KEY`
   - `wrangler secret put VAPID_PRIVATE_KEY`
4. (Optional) Update store list:
   - Edit `STORES_JSON` in `wrangler.toml` with the full list of stores.
4. Deploy:
   - `npm install`
   - `npm run deploy`

## Endpoints
- `GET /api/items?languageCode=pl&size=32&storeIds=294&page=0`
- `POST /api/subscribe`
- `POST /api/unsubscribe`

## Notes
- The push implementation uses `@cloudflare/web-push` (install via npm).
- The cron runs hourly (UTC) and checks subscriptions.
