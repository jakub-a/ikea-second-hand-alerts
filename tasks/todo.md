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

## Current Task
- Goal: Implement Listing-page pre-search empty state from Figma node `23:1467`.
- Scope in: empty-state-only UI for `!lastSearch` (copy, plush artwork, squiggles, spacing), desktop + mobile responsiveness.
- Scope out: zero-results state, alert logic, worker/API behavior.
- Plan:
  - [x] Fetch Figma node context + screenshot and extract exact sizing/positions.
  - [x] Add local artwork/squiggle assets under `apps/web/public/empty-state`.
  - [x] Implement `!lastSearch` empty-state markup + CSS in listings view.
  - [x] Validate in Chrome MCP and run `cd apps/web && npm run build`.

## Current Task
- Goal: Update empty-state node `23:1467` to latest Figma revision with centered content and refreshed assets.
- Scope in: center empty-state content on both axes, add search icon row, refresh changed artwork/squiggle assets.
- Scope out: search results states, alerts flow, worker/API logic.
- Plan:
  - [x] Pull latest Figma context/screenshot for node `23:1467`.
  - [x] Replace local empty-state assets with the updated Figma exports.
  - [x] Update JSX/CSS to match centered composition and new artwork details.
  - [x] Validate in Chrome MCP and run `cd apps/web && npm run build`.

## Current Task
- Goal: Add JS equivalent of CRAP4J to keep complexity low and testing quality high.
- Scope in: lint complexity gates, coverage thresholds, mutation testing setup, CI integration (soft gate).
- Scope out: runtime behavior changes in web/worker app logic.
- Plan:
  - [x] Add ESLint complexity/depth/function-size rules for web + worker.
  - [x] Add Vitest coverage thresholds and scripts in both apps.
  - [x] Add Stryker mutation configs and scripts (opt-in + nightly CI).
  - [x] Extend CI workflows with lint/coverage/mutation checks in soft-gate mode.

## Current Task
- Goal: Refactor `apps/web/src/App.jsx` and `apps/worker/src/index.js` into smaller, safer modules.
- Scope in: extract pure utilities, storage/api helpers, and isolated workflow functions without changing behavior.
- Scope out: UX redesign, API contract changes, or worker runtime behavior changes.
- Plan:
  - [x] Extract web helper logic from `App.jsx` into focused modules and keep component behavior identical.
  - [x] Extract worker parsing/notification/run-alert helper logic from `index.js` into focused modules.
  - [x] Rewire imports and keep existing endpoint behavior unchanged.
  - [x] Run lint/tests/coverage for both apps and fix regressions.
