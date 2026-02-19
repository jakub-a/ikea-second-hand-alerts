# Release Checklist

## Before deploy

1. Run worker tests:
   - `cd apps/worker && npm run test:all`
2. Run web unit tests:
   - `cd apps/web && npm run test:unit`
3. Run web smoke tests:
   - `cd apps/web && npm run test:smoke`
4. Run reproducible search snapshot for changed search behavior:
   - `node scripts/repro-search.mjs --query "billy shelf" --stores "294,203"`
5. Verify one production sanity check manually:
   - single city search
   - multi city search
   - alert deep-link opens Alerts tab

## Deploy

1. Worker:
   - `cd apps/worker && npm run deploy`
2. Web:
   - `cd apps/web && npm run build`
   - `cd apps/web && npx wrangler pages deploy dist --project-name ikea-second-hand-alerts-web`

## After deploy

1. Confirm Worker URL responds:
   - `GET /api/meta`
2. Confirm Pages URL serves latest assets.
3. Record deploy notes in PR:
   - hypothesis
   - evidence
   - fix summary
   - residual risks
