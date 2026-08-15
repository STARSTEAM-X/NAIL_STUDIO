# Project Instructions

Before implementing any task, inspect the existing repository.

## General Rules

- Do not modify unrelated code.
- Preserve existing architecture unless explicitly instructed otherwise.
- Follow existing naming and coding conventions.
- Avoid unnecessary dependencies.
- Validate all external input.
- Never expose secrets or credentials.

## Algorithm Requirements

Prefer algorithms with complexity:

- O(1)
- O(log n)
- O(n)

Algorithms worse than O(n) require technical justification.

## Before completing a task

Always run relevant:

- lint
- typecheck
- tests

Inspect all changed files before reporting completion.

## Implementation Tasks

When Claude delegates an implementation task:

1. Read the specification under docs/tasks/
2. Inspect existing implementation
3. Implement the specification
4. Run validation
5. Run tests
6. Report:
   - files changed
   - tests executed
   - remaining risks