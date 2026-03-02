# Task Plan Template

Use this for medium/high-risk work where explicit planning is helpful.

## Context
- Goal:
- Scope in:
- Scope out:
- Constraints:

## Plan
- [ ] Step 1:
- [ ] Step 2:
- [ ] Step 3:

## Evidence
- Tests/checks run:
- Behavior validation:
- Logs reviewed:

## Review Notes
- What changed:
- Why:
- Risks:
- Rollback plan:

## Latest Completed Example
- Goal: Notification reliability hardening.
- Scope in: worker matching, debug telemetry, integration tests, notification smoke coverage, canary workflow, docs.
- Key completed steps:
  - [x] Unicode/diacritic-safe keyword matching in worker
  - [x] `/api/run-alerts?dryRun=1&debug=1` summary mode
  - [x] Worker notification integration tests
  - [x] Notification-focused Playwright smoke tests
  - [x] Daily non-blocking canary workflow

## Current Task
- Goal: Reliable per-alert "New items" state on app open + harden notification deep-link to Alerts.
- Scope in: startup snapshot diff, alert badge UX, alert-open clear behavior, deterministic newest-first ordering, deep-link guard.
- Scope out: worker API contract changes and push infrastructure re-architecture.
- Plan:
  - [x] Add startup snapshot diff and per-alert `hasNewItems` semantics in web app state.
  - [x] Render right-aligned blue `New items (N)` badge and clear on alert open.
  - [x] Enforce newest-to-oldest sorting using timestamp-first fallback logic.
  - [x] Harden service-worker click handling to ensure Alerts deep-link.
  - [x] Run local validation (`test` + `build`) and document risks/rollback notes.

## Current Task
- Goal: Sync Listing page UI to updated Figma design (file `hvn6aDKqsy043dhE6P0fxz`, frame `4:4`).
- Scope in: listing-only layout/styling updates (hero block, search row, results heading/actions, product-card density/typography), no alert/settings flow changes.
- Scope out: worker/API logic and notification backend behavior.
- Plan:
  - [x] Fetch Figma design context + screenshot and map visual deltas.
  - [x] Update listing page JSX/CSS to match new composition and spacing.
  - [x] Preserve existing app behavior while aligning visuals (search/open links/alerts actions).
  - [x] Run local validation (`test` + `build`) and capture rollback notes.
