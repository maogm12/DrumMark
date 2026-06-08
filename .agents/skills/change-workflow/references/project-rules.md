# Project Rules

This file contains project-specific rules that extend the generic change workflow.

These rules are especially important for DSL, parser, layout, renderer, CLI, and spec/contract changes.

---

## Branch and Main Discipline

Do not commit directly on `main` unless the user explicitly requests it.

Do not start a new change by editing on `main`. For any new change that will create `plan.md`, `history.md`, or implementation commits, first move to a dedicated non-`main` branch.

`main` is the repository baseline and integration target. It is not the working location for in-flight planning or implementation.

Planning-only branches are allowed when the branch is only producing change-tracking artifacts. Once a change enters implementation, prefer one implemented change per branch.

If work begins accidentally on `main`, stop before committing and move the work to a non-`main` branch.

---

## Tiny Change Exclusion Criteria

A change is NOT a Tiny Change (and must use at least Planned Change workflow) if it meets **any** of the following:

- modifies parser, lexer, or AST
- modifies IR structure or normalize logic
- modifies the layout engine
- modifies public API or CLI interface
- modifies the WASM boundary
- spans more than 3 files
- requires new test coverage
- may change existing test output

When any exclusion criterion is met, escalate to Planned Change.

---

## Project Learnings

If investigation produces reusable technical knowledge, debugging lessons, architectural constraints, or command-line findings, append them to `LEARNINGS.md`.

Do not write routine implementation notes to `LEARNINGS.md`.

Use `LEARNINGS.md` for lessons that should help future agents avoid repeated investigation.

Examples of good LEARNINGS entries:

- a parser edge case that was hard to diagnose
- a layout invariant discovered during debugging
- a command needed to reproduce a class of failures
- a platform or WASM boundary constraint
- a golden/snapshot update rule
- a project-specific build or test caveat

---

## Change Closeout Semantics

`docs/changes/active/` is reserved for changes that are still being planned, implemented, or reviewed.

An implementation review result of `STATUS: APPROVED` means the change is ready for closeout, not that the workflow is already complete.

Required closeout order:

1. finish all implementation-review fixes
2. move `docs/changes/active/<change-id>/` to `docs/changes/archive/<year>/<change-id>/` on the change branch
3. squash/merge that archived final state into `main`

Do not leave an approved change in `docs/changes/active/` while starting unrelated follow-up work.

Do not merge a change into `main` first and archive it later unless the user explicitly requests an exception.

Once a change is archived on-branch, only closeout edits are allowed before merge. If further implementation is required, move the folder back to `active` or open a new review round and record why.

### Stacked Change Branches

Avoid stacking multiple implementation changes on one branch when a separate branch would work.

If a change depends on an earlier unmerged change, record the dependency under `## Linked Items` or an equivalent note in `plan.md`, including:

- the upstream change id
- why the dependency exists
- why the approved upstream change cannot yet be archived and merged independently

Do not let stacked branches hide approved-but-unclosed changes.

---

## Active Specs and Contracts

List only active specs or contracts in `## Affected Specs / Contracts`.

Examples of active specs/contracts may include:

- `DRUMMARK_SPEC.md`
- `RENDER_LAYOUT_CONTRACT.md`
- other active project contracts

Do not modify archived specs unless the user explicitly asks.

If an older spec file has been archived, do not list it as an active target.

IR-related behavior should be documented in the active spec or contract that currently owns the behavior. Do not assume an archived IR spec is active.

---

## Spec Merge Protocol

For Planned Changes with `Spec Impact: Yes`, affected spec or contract files must be updated before merge.

This project now has two maintenance modes for active specs/contracts:

- **Canonical-integrated**: accepted behavior is merged into the main body of the active spec.
- **Append-only**: accepted behavior is appended as dated addenda.

Unless a spec has been explicitly converted to canonical-integrated maintenance, treat it as append-only unless the user explicitly approves a rewrite.

Current canonical-integrated active specs:

- `DRUMMARK_SPEC.md`

Current append-only active specs/contracts include, but are not limited to:

- `RENDER_LAYOUT_CONTRACT.md`
- other active project specs/contracts not explicitly listed as canonical-integrated

For append-only specs/contracts:

- Do not insert new normative text into the middle of an existing spec section.
- Do not rewrite existing spec text unless `plan.md` explicitly says this is a rewrite and the user has approved it.

For canonical-integrated specs:

- Update the relevant canonical sections so the active spec reads as today's truth.
- Do not append chronological addenda by default.
- Keep rationale, rejected alternatives, and review history in change folders and archives, not in the active spec body.
- If a planned feature is not yet accepted or implemented, keep it out of normative sections.

### Spec Delta Source of Truth

`plan.md` must contain `## Spec Delta`.

`## Spec Delta` is the draft source for the final accepted spec or contract text.

Before merge:

- for append-only specs/contracts, convert `## Spec Delta` into a clean addendum and append it to the affected file.
- for canonical-integrated specs, convert `## Spec Delta` into clean normative section updates in the active spec body.

The final accepted text must not include:

- review notes
- rejected alternatives
- implementation chatter
- unresolved questions
- temporary planning notes

### Consolidated Changes

Before updating the affected spec or contract, add a human-readable summary to `history.md`:

```md
## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- `DRUMMARK_SPEC.md`
- `RENDER_LAYOUT_CONTRACT.md`

Summary:
- ...
- ...

Final addendum location:
- Appended to `<spec-file>` under `<heading>`
```

This replaces the old proposal-file `### Consolidated Changes` step.

The purpose is to preserve a clear record of what was merged into the spec without polluting `plan.md`.

For canonical-integrated specs, replace "Final addendum location" with:

```md
Final integration location:
- Integrated into `<spec-file>` sections:
  - `...`
```

### Addendum Heading Format

When appending to an append-only spec or contract, use a clear dated heading:

```md
## Addendum: <Title>

Date: YYYY-MM-DD
Source change: `docs/changes/active/<change-id>/plan.md`
Status: Accepted

<final normative spec text>
```

If the target file already uses a different addendum heading convention, follow the existing convention.

### ADR vs Spec

ADR answers why a long-term decision was made.

Spec addendum answers what behavior, syntax, contract, or compatibility rule is now required.

If both are needed:

- write the rationale in ADR
- write the normative behavior in the spec addendum
- link the ADR from `plan.md`
- do not replace spec text with an ADR

### Required Final Check

Before implementation review can approve a Planned Change with `Spec Impact: Yes`, the reviewer must check:

- `plan.md` contains `## Spec Delta`
- affected specs/contracts are listed
- final accepted text was merged into the affected spec/contract using the correct maintenance mode
- no review notes or rejected alternatives were copied into the spec
- existing spec text was not rewritten unless explicitly approved for rewrite or canonical integration
- `history.md` contains `## Consolidated Changes`
- the implementation matches the final accepted spec text

Planned Changes with `Spec Impact: Yes` must not merge until this check passes.

---

## Project Verification Gates

For parser, DSL, IR, or CLI behavior changes, the Test Plan should include relevant `drummark` CLI checks, such as:

```bash
npm run drummark -- <file> --format ast
npm run drummark -- <file> --format ir
npm run drummark -- <file> --format svg
npm run drummark -- <file> --format xml
```

Use the formats that are relevant to the change.

For `drummark-core`, layout, or WASM-boundary changes, include:

```bash
npm run wasm:build
```

For layout or renderer changes, include golden/snapshot verification and document whether snapshots were updated intentionally.

For bug fixes, include the original reproduction command or fixture whenever possible.

For automated tests that are not practical, record manual verification steps in `plan.md`.

---

## Golden and Snapshot Updates

If a layout, renderer, SVG, XML, or golden output changes:

1. Confirm the output change is intentional.
2. Explain why the new output is correct.
3. Update the relevant golden/snapshot files.
4. Mention the update in the implementation review summary.
5. Link the change to a bug, plan task, or Spec Delta when applicable.

Do not update golden/snapshot files just to make tests pass without explaining the semantic change.

---

## Bootstrap Directories

If the project does not already contain the following directories, create them before using this workflow:

```text
docs/changes/active/
docs/changes/archive/
docs/adr/
docs/spikes/
```

Add `.gitkeep` files if empty directories need to be tracked.
