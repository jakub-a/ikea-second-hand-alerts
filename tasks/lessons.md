# Lessons Log

Add entries only for repeated issue classes or high-impact misses.

## Entry Template
- Date:
- Pattern:
- Impact:
- Guardrail:
- Verification check:

## Entries

### Entry
- Date: 2026-02-20
- Pattern: Locale-sensitive keyword matching missed alert triggers (`Trådfri` vs `tradfri`).
- Impact: Users can miss notifications for expected products despite active alerts.
- Guardrail: Normalize both offer text and keywords (NFKD + remove diacritics + whitespace collapse + lowercase) before matching.
- Verification check: Worker unit tests for diacritic/case/punctuation scenarios + integration dry-run debug counters for matched/fresh/suppressed paths.
