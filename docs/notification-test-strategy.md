# Notification Test Strategy

This document defines how to validate alert matching and push delivery end-to-end.

## Goals

- Catch keyword matching regressions (including Unicode/diacritics).
- Explain why alerts did or did not trigger.
- Keep confidence high through deterministic tests plus one daily live canary.

## Test layers

## 1) Worker unit tests

Focus:
- normalization (`normalizeForMatch`)
- keyword matching (`matchKeyword`)
- precision controls (negative cases)

Required cases:
- `tradfri` matches `TRÅDFRI`
- `tonstad` matches `TONSTAD`
- punctuation/spacing normalization
- unrelated terms do not match

## 2) Worker integration tests

Endpoint:
- `POST /api/run-alerts?dryRun=1&debug=1`

Focus:
- per-alert debug counters
- seen-id suppression
- malformed payload resilience
- multi-alert behavior

Required counters:
- `offersScanned`
- `offersMatched`
- `offersFresh`
- `offersSuppressedBySeen`
- `sampleMissReasons`

## 3) Web smoke E2E (Playwright)

Focus:
- deep-link behavior (`tab=alerts`)
- unread badge increment idempotency
- per-alert unread isolation
- clear-on-open behavior

## 4) Daily live canary

Workflow:
- `.github/workflows/notification-canary.yml`
- runs `scripts/canary-check.mjs`

Mode:
- non-blocking but visible operational signal
- uses worker dry-run debug endpoint

## Incident triage runbook: "Alert did not trigger"

1. Reproduce alert/store/keyword combination.
2. Run:
   - `POST /api/run-alerts?dryRun=1&debug=1`
3. Inspect per-alert counters:
   - low `offersMatched`: likely keyword/matching issue
   - high `offersSuppressedBySeen`: dedupe/seen behavior
   - `missing_offer_id` samples: upstream payload id gaps
4. Verify alert is active and synced to subscription record.
5. Validate queue and push path using test endpoints:
   - `/api/test-alert`
   - `/api/next-notification`

## Release gate for notification changes

Before deploy:
- `cd apps/worker && npm run test:notifications`
- `cd apps/web && npm run test:smoke:notifications`
- latest canary status reviewed
