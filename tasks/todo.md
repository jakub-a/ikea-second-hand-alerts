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
