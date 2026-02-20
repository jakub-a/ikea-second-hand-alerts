# Project Agent Instructions

## Required workflow files
For all implementation/debug tasks, follow:
- docs/ai-debug-framework.md
- docs/release-checklist.md

For medium/high-risk tasks:
- initialize and maintain tasks/todo.md

For repeated/high-impact misses:
- append concise lessons to tasks/lessons.md (pattern -> guardrail -> verification check)

## Session start behavior
At the beginning of each non-trivial task, explicitly state:
- which workflow files apply
- why they apply
- before starting any new implementation/debug task, remind the user to create/switch to a feature branch (e.g., `codex/<task-name>`) unless they explicitly choose to work on `main`
- when a branch is needed, provide the exact command to create/switch (`git checkout -b codex/<task-name>` or `git checkout <existing-branch>`)

## Completion requirements
Before marking done, include:
- evidence run (tests/checks)
- behavior validation summary
- risk + rollback note
- which workflow files were used
