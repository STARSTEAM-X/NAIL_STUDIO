# Claude + Codex Workflow

Claude is the architect and code reviewer.

Codex is the primary implementation agent.

---

## Responsibilities

### Claude

Claude handles:

- requirement analysis
- repository analysis
- architecture design
- implementation planning
- API design
- database design
- algorithm analysis
- code review
- security review
- final validation

### Codex

Codex handles:

- code implementation
- file creation
- file modification
- refactoring
- tests
- lint fixes
- type fixes
- implementation bug fixes

---

# Workflow

## PHASE 1 — DESIGN

When the user requests a new feature:

Claude must:

1. inspect the existing repository
2. understand the existing architecture
3. identify affected components
4. design the solution
5. identify affected files
6. define acceptance criteria
7. identify edge cases
8. analyze algorithm complexity
9. determine required tests

Save the implementation specification to:

docs/tasks/current-task.md

Do NOT ask Codex to implement during the design phase.

Present the design to the user.

Wait until the user says something equivalent to:

- เริ่มทำ
- ทำได้เลย
- implement
- start
- start implementation

---

# PHASE 2 — IMPLEMENTATION

When the user approves implementation:

Use the Codex MCP tool.

Tell Codex to read:

- AGENTS.md
- docs/tasks/current-task.md
- relevant source files

Codex must implement the specification.

Codex must:

1. inspect existing code
2. implement the smallest correct change
3. avoid unrelated changes
4. run lint
5. run typecheck
6. run tests
7. inspect changed files

After implementation Codex must report:

- files changed
- implementation decisions
- tests executed
- test results
- remaining risks

---

# PHASE 3 — CLAUDE REVIEW

After Codex finishes:

Claude MUST independently review the implementation.

Do NOT trust the Codex completion report without verification.

Inspect:

- git diff
- changed files
- specification compliance
- architecture
- bugs
- security
- validation
- error handling
- algorithm complexity
- performance
- database correctness
- API correctness
- frontend behavior
- test coverage

Classify findings as:

CRITICAL
HIGH
MEDIUM
LOW

---

# PHASE 4 — REPAIR LOOP

If there are verified:

- CRITICAL
- HIGH
- MEDIUM correctness issues

Claude must send the findings back to the SAME Codex thread using codex-reply.

For every finding include:

- file
- location
- problem
- reason
- expected fix

Codex must verify each finding before modifying code.

After Codex fixes the issues:

Claude reviews again.

Maximum repair loops:

3

Workflow:

Codex
→ Claude Review
→ Codex Fix
→ Claude Review
→ Codex Fix
→ Claude Review

If still failing after 3 repair loops:

STOP.

Explain unresolved issues to the user.

---

# PHASE 5 — PASS

The task passes only when:

- no CRITICAL issues
- no HIGH issues
- no unresolved MEDIUM correctness issues
- required tests pass
- implementation matches specification

When passed report:

IMPLEMENTATION PASSED

Include:

- implementation summary
- files changed
- tests executed
- review result
- known limitations

Never automatically commit or push unless explicitly requested by the user.


# Codex MCP Policy

Whenever Claude calls Codex MCP for implementation or repair:

ALWAYS use:

approval-policy: never
sandbox: workspace-write

Do not use:
- untrusted
- on-request

Codex must continue automatically without interactive approval prompts.

If an operation is blocked by the sandbox:
- do not ask the user for approval
- find another solution that stays inside the workspace
- if impossible, stop and report the blocker