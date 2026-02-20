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
   - Deploy script automatically sets `WORKER_VERSION_ID` to a timestamp+git-sha value.

## Endpoints
- `GET /api/items?languageCode=pl&size=32&storeIds=294&page=0`
- `GET /api/items?languageCode=pl&size=32&storeIds=294&query=billy&allPages=1&debug=1`
- `POST /api/subscribe`
- `POST /api/unsubscribe`
- `POST /api/run-alerts?force=1`
- `POST /api/run-alerts?dryRun=1&debug=1`

`/api/items` debug mode (`debug=1` query or header `x-debug-search: 1`) includes:
- `debug.requestFingerprint`
- `debug.rawCount`
- `debug.normalizedCount`
- normalized query/store metadata for troubleshooting

`/api/run-alerts` debug dry-run mode (`dryRun=1&debug=1`) includes:
- top-level run summary (`subscriptionsProcessed`, `alertsEvaluated`, `notificationsQueued`, `notificationsSent`)
- per-subscription/per-alert counters:
  - `offersScanned`
  - `offersMatched`
  - `offersFresh`
  - `offersSuppressedBySeen`
  - `sampleMissReasons`

## Notes
- The push implementation uses `@cloudflare/web-push` (install via npm).
- The cron runs hourly (UTC) and checks subscriptions.
