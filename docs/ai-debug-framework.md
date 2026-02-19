# AI-Assisted Development Framework

## Default issue workflow

1. Reproduce:
   - capture exact symptom, expected behavior, and strict reproduction steps.
2. Hypothesize:
   - list top 2-4 root-cause hypotheses.
3. Patch:
   - implement minimal code changes that address the highest-confidence hypothesis.
4. Validate:
   - run targeted automated tests and produce before/after evidence.
5. Document:
   - include deploy notes and residual risk in PR.

## Agent strategy

- Default: one orchestrator session for end-to-end flow.
- Use subagents only for explicit deep-dive tasks:
  - API behavior research
  - fixture generation
  - flaky E2E stabilization

## Required bug record fields

- Symptom
- Expected vs actual
- Repro steps
- Logs/snapshots (including `artifacts/search-debug` when search-related)
- Acceptance criteria

## Debugging best practices

- Always create a deterministic failing case before changing code.
- Keep patches small and reversible.
- Add at least one regression test per bug class.
- Save debug artifacts for comparison across environments.
