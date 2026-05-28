# History

<!--
Use exactly ONE of the two paths below. Do not use both for the same change.

Path A (full plan review):  Round 1..N → STATUS: APPROVED → ### Approved Plan
Path B (plan review skipped): ### Plan Review Skipped (no rounds)
-->

## Path A — Full Plan Review

### Round 1 - Plan Review

Reviewer: <sub-agent-name>

### Comments

1. ...
2. ...

### Agent Response

- ...
- ...

### Resolution

- R1: closed, updated plan.md
- R2: open, pending clarification

STATUS: CHANGES_REQUESTED

---

### Round 2 - Plan Review

Reviewer: <sub-agent-name>

### Comments

...

### Agent Response

...

STATUS: APPROVED

### Approved Plan

Approved file: `docs/changes/active/<change-id>/plan.md`
Approved commit: <commit-hash-if-available>
Approved summary:
- ...

Open conditions:
- None

---

## Path B — Plan Review Skipped

### Plan Review Skipped

Skip reason: <why plan review was skipped>
Plan file: `docs/changes/active/<change-id>/plan.md`

---

## Human Stamp

Date: YYYY-MM-DD
Approved by: <user or role>
Approved plan: `docs/changes/active/<change-id>/plan.md`
Approved plan commit: <commit-hash-if-available>
Scope: <what is approved>

Approval text:

> <verbatim user approval message; if none, write "Verbally approved in conversation">

Conditions:
- None

Status: APPROVED_FOR_IMPLEMENTATION

---

## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- ...

Summary:
- ...

Final addendum location:
- Appended to `<spec-file>` under `<heading>`

---

## Implementation Review

### Round N - Implementation Review

Reviewer: <sub-agent-name>

### Comments

...

### Checks

- Tasks complete:
- Tests pass:
- Spec/contract updated if required:
- GitHub Issues updated if applicable:
- ADRs respected:
- Scope creep:

### Agent Response

...

STATUS: APPROVED
