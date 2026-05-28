# Project Rules

This file contains project-specific rules that extend the generic change workflow.

These rules are especially important for DSL, parser, layout, renderer, CLI, and spec/contract changes.

---

## Tiny Change Exclusion Criteria

A change is NOT a Tiny Change (and must use at least Normal Change workflow) if it meets **any** of the following:

- modifies parser, lexer, or AST
- modifies IR structure or normalize logic
- modifies the layout engine
- modifies public API or CLI interface
- modifies the WASM boundary
- spans more than 3 files
- requires new test coverage
- may change existing test output

When any exclusion criterion is met, escalate to Normal Change.

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

For Spec / Contract Changes, affected spec or contract files must be updated before merge.

Spec and contract files are append-only unless the user explicitly approves a rewrite.

Append-only files include, but are not limited to:

- `DRUMMARK_SPEC.md`
- `RENDER_LAYOUT_CONTRACT.md`
- other active project specs/contracts

Do not insert new normative text into the middle of an existing spec section.

Do not rewrite existing spec text unless `plan.md` explicitly says this is a rewrite and the user has approved it.

### Spec Delta Source of Truth

`plan.md` must contain `## Spec Delta`.

`## Spec Delta` is the draft source for the final spec or contract addendum.

Before merge, the agent must convert `## Spec Delta` into a clean addendum and append it to the affected spec or contract file.

The final appended addendum must not include:

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

### Addendum Heading Format

When appending to a spec or contract, use a clear dated heading:

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

Before implementation review can approve a Spec / Contract Change, the reviewer must check:

- `plan.md` contains `## Spec Delta`
- affected specs/contracts are listed
- final addendum was appended to the affected spec/contract
- no review notes or rejected alternatives were copied into the spec
- existing spec text was not rewritten unless explicitly approved
- `history.md` contains `## Consolidated Changes`
- the implementation matches the final spec addendum

Spec / Contract Changes must not merge until this check passes.

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
