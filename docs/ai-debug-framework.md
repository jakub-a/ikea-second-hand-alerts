# AI-Assisted Development Framework

## Workflow Orchestration (Codex-Optimized)

### 1) Planning Discipline (Risk-Based)
- Use explicit planning when ANY of these are true:
  - Architectural decision or cross-cutting change
  - 3+ files with non-trivial coupling
  - Unknown behavior, flaky failures, or unclear requirements
  - High-risk domains (auth, payments, data integrity, deploy infra)
- For small, low-risk fixes: execute directly with concise reasoning and verification.
- If new evidence invalidates assumptions, stop and re-plan before continuing.

### 2) Subagent Strategy (Selective, Not Default)
- Default to one orchestrator agent owning end-to-end quality.
- Use subagents only when parallel work has clear boundaries:
  - external research/spike
  - fixture/data generation
  - isolated test stabilization
- One bounded objective per subagent; merge results through orchestrator review.

### 3) Continuous Improvement Loop
- Capture lessons when:
  - the same class of issue repeats, or
  - the miss was high-impact.
- Store concise prevention rules in `tasks/lessons.md` (pattern -> guardrail -> check).
- Review only relevant lessons at session start.

### 4) Verification Before “Done”
- Never mark complete without evidence proportional to risk.
- Minimum evidence:
  - relevant tests/checks run
  - behavior validated (before/after where useful)
  - logs/errors reviewed for touched paths
- For regressions/bugs: include failing case -> fix -> passing proof chain.

### 5) Elegance With Constraints
- Ask: “Is this the simplest robust design that can scale?”
- Prefer maintainable abstractions over clever one-offs.
- Avoid over-engineering for obvious/simple fixes.
- Refactor only when it improves clarity, testability, or risk profile.

### 6) Autonomous Debugging
- For bug reports:
  - reproduce deterministically
  - isolate root cause
  - fix minimally
  - add regression coverage
- Minimize user context switching; ask only high-impact clarifications.

## Task Management
1. Plan first for medium/high-risk work (`tasks/todo.md` optional, recommended).
2. Track progress with concise, checkable steps.
3. Keep summaries focused on decisions, changes, and evidence.
4. Add review notes (what changed, why, risks, rollback plan).
5. Update `tasks/lessons.md` only for repeated/high-impact patterns.

## Core Principles
- Simplicity first: smallest change that fully solves the problem.
- Root-cause standard: no known temporary fixes unless explicitly scoped.
- Minimal blast radius: touch only what is necessary, but make correctness explicit.
- Evidence over confidence: claims must be backed by checks.
- Scalable quality: code should be modular, observable, and easy to debug.

## Validation Scenarios
1. Small bugfix, single file:
   - Should skip heavyweight planning.
   - Must still provide tests/verification evidence.
2. Multi-file search logic change:
   - Must trigger plan, risk notes, and regression tests.
3. Flaky E2E failure:
   - Subagent optional for stabilization; orchestrator keeps final decision authority.
4. Repeated mistake class:
   - Must produce one concise lesson entry and a prevention check.

## Notification incident standards

- Normalize locale-sensitive text for keyword matching (Unicode normalization + diacritic stripping) before comparisons.
- For "missing alert" incidents, run a debug-first dry-run trace before mutating production state:
  - `POST /api/run-alerts?dryRun=1&debug=1`
- Include "why not triggered" counters in incident notes:
  - scanned, matched, fresh, suppressed-by-seen, missing-id, sample miss reasons.

## Assumptions and Defaults
1. Default operating mode is Codex-native pragmatic execution with risk-based planning.
2. Team priority is delivery speed with high confidence, not maximal process ceremony.
3. Existing quality stack (unit + integration + smoke E2E + CI soft gate) remains the baseline.
4. `tasks/todo.md` and `tasks/lessons.md` are workflow aids, not hard gates.
