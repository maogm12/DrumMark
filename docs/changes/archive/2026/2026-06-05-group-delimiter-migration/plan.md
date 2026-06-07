# Group Delimiter Migration

## Status

approved - pending human stamp before implementation

## Problem

DrumMark currently uses square brackets for rhythmic groups:

```txt
[2: x x]
[x d b]
```

That syntax blocks square brackets from being reused for visible section shorthand such as `[A]` or `[Verse]`. If the project wants bracket-shaped rehearsal labels, the current group delimiter owns the most natural surface form.

## Goal

Move rhythmic-group syntax from `[]` to `()` so square brackets can be reserved for future structural label syntax.

After this change:
- rhythmic groups use `(...)`,
- square brackets are no longer valid rhythmic-group delimiters,
- specs, examples, CLI output, and WASM-facing behavior agree on the new syntax,
- follow-up rehearsal-mark work can evaluate `[label]` without grammar conflict.

## Non-goals

- Do not implement rehearsal marks in this change.
- Do not introduce angle-bracket group syntax.
- Do not redesign group semantics, duration math, or modifier behavior.
- Do not support both `[]` and `()` as equal long-term syntaxes in v1.
- Do not add an automatic source rewriter in the parser or CLI in v1.
- Do not add migration-oriented parser diagnostics for legacy bracket groups.

## Current Plan

Adopt a hard pre-1.0 delimiter migration:

- rhythmic groups change from `[]` to `()`,
- parser rejects legacy `[]` group syntax as invalid authored measure content without a migration hint,
- normalized IR and render-facing semantics stay unchanged because this is a surface-syntax migration, not a group-behavior redesign,
- square brackets become reserved for future measure-expression DSL work and must not silently parse as rhythmic groups or other measure-body constructs.

Examples:

```txt
(2: x x)
(x d b)
(@SD { d d } x):accent
```

Legacy authored input such as `[x d b]` becomes invalid after the migration and should fail as ordinary invalid measure syntax. The parser does not need to teach the `()` replacement in its error text because bracket syntax is being retired immediately ahead of rehearsal-mark work.

## Spec Delta

Update the canonical sections of `DRUMMARK_SPEC.md` so rhythmic groups use parentheses instead of square brackets.

Planned canonical updates:

- Replace the rhythmic-group syntax examples:

```txt
(span: item1 item2 ...)
(item1 item2 ...)
```

- State that `(` and `)` delimit rhythmic groups in authored measure content.
- Reserve `[` and `]` for future non-group structural syntax inside measure expressions and reject them as rhythmic-group delimiters.
- Preserve existing group rules:
  - `span` is measured in active Note Units.
  - Group-local durations are scaled into the declared span.
  - Trailing group modifiers still apply to all note events produced by the group.
  - Zero-duration directives remain legal inside groups.
- Add migration guidance to the spec text or compatibility note:
  - Integrate the new canonical syntax into `6.4 Groups`.
  - Add a removed-syntax rule under `12. Compatibility And Deprecated Syntax` for legacy `[]` groups.
  - Pre-1.0 DrumMark used `[]` for rhythmic groups.
  - Current canonical syntax is `()`.
  - Legacy `[]` inputs are parse errors.

The spec should not require a migration-oriented parser diagnostic for legacy brackets; it only needs to make the syntax invalid.

No `RENDER_LAYOUT_CONTRACT.md` change is planned because IR and layout semantics remain unchanged.

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`

## Tasks

### Task 1: Grammar and Parser Migration

Status: Done

Scope:
- `crates/drummark-core/src/lexer.rs`
- `crates/drummark-core/src/parser.rs`
- `crates/drummark-core/src/ast.rs`

Action:
- Replace rhythmic-group delimiter tokens/parse flow from `[` / `]` to `(` / `)`.
- Preserve the existing optional `span:` prefix and trailing group modifiers.
- Ensure legacy square-bracket groups fail as invalid measure syntax without special migration messaging.
- Update delimiter-sensitive parser helpers, especially dynamic-directive boundary checks, so migrated close-paren cases such as `(@p)` and `(@f x x)` remain legal group content.
- Update stale parser diagnostics that still hardcode bracket wording so canonical `(` / `)` groups do not error using legacy delimiter terminology.
- Preserve lossy-parse recovery behavior for unclosed canonical `(` groups, not just the removed `[` form.
- Keep header-value raw text behavior unchanged, including literal `(`, `)`, `[` and `]` inside titles, subtitles, and composer fields.
- Audit interactions with any other parser paths that currently rely on `FreeText` fallback or raw line slicing.

Input / Output Contract:
- Group AST shape stays `MeasureExpr::Group(GroupExpr)`.
- Successful parse semantics are unchanged except for the authored delimiter characters in measure-expression grammar.

Dependencies:
- Human stamp for spec change before implementation.

Acceptance:
- `(x d b)` parses as a rhythmic group.
- `(2: x x)` parses as a span-declared group.
- `(@p)` and `(@f x x)` parse without `invalid dynamic directive boundary` errors.
- `[x d b]` fails as invalid measure syntax, without parser guidance about migrating to `()`.
- Unclosed `(` groups report canonical delimiter wording and retain lossy recovery to the following measure boundary.
- Existing raw-text header values such as `title Song No. 5 (Remix) [2024]` remain unaffected.

Verification:
- `cargo test -p drummark-core parser -- --nocapture`
- `npm run drummark -- <fixture> --format ast`

### Task 2: Normalization, CLI, and Diagnostic Parity

Status: Done

Scope:
- `crates/drummark-core/src/normalize.rs`
- CLI / parser-facing fixtures that exercise grouped content

Action:
- Confirm normalization behavior is identical for parenthesized groups.
- Update fixtures and examples that currently author square-bracket groups.
- Verify parser and normalizer diagnostics still identify invalid empty or durationless groups correctly after the delimiter swap.
- Update developer-facing code comments or examples that currently explain group semantics with bracketed syntax when they are meant to describe active authored grammar.

Input / Output Contract:
- IR shape and timing semantics do not change.

Dependencies:
- Task 1.

Acceptance:
- Existing grouped-note IR outputs stay semantically identical after source migration.
- Nested zero-duration directives inside groups still normalize correctly.
- No normalization logic depends on literal bracket tokens after parsing.

Verification:
- `cargo test -p drummark-core normalize -- --nocapture`
- `npm run drummark -- <fixture> --format ir`

### Task 3: Spec, Examples, and Migration Surface

Status: Done

Scope:
- `docs/DRUMMARK_SPEC.md`
- active docs, examples, and developer-facing grammar commentary
- user-visible diagnostics / help text

Action:
- Canonically rewrite the active spec sections from `[]` to `()`.
- Integrate the canonical syntax into `DRUMMARK_SPEC.md` section `6.4 Groups`, and record the removed legacy `[]` syntax under section `12. Compatibility And Deprecated Syntax`.
- Update examples, docs, and any golden inputs that still teach square-bracket groups.
- Add one explicit migration note showing old and new group syntax.
- Limit authored-syntax migration claims to rhythmic groups in measure content; do not outlaw brackets in raw-text metadata.

Input / Output Contract:
- Active documentation teaches only the new parenthesized group syntax.
- Metadata examples remain free to contain literal bracket characters as text.

Dependencies:
- Tasks 1-2.

Acceptance:
- No active doc or example still presents `[]` as valid rhythmic-group syntax.
- The spec clearly distinguishes old bracket syntax from the new canonical syntax.
- The spec does not claim that raw-text metadata fields reject literal brackets.
- Developer-facing commentary that documents active grammar no longer uses bracket-group examples unless explicitly labeled historical.

Verification:
- `rg -n "\\[[^]]*\\]" docs examples crates src`
- targeted manual review of each remaining match to confirm it is prose, metadata text, or legacy-migration commentary rather than active rhythmic-group syntax
- spot-check updated examples with `npm run drummark -- <fixture> --format ast`

### Task 4: WASM, Frontend Parity, and Rehearsal Reservation

Status: Done

Scope:
- `src/wasm/`
- browser/parser parity tests
- any frontend examples or editor defaults that use groups

Action:
- Rebuild WASM packages after parser updates.
- Update parity tests and browser-facing fixtures.
- Confirm square brackets are no longer consumed as rhythmic groups anywhere in measure-content parsing across the TS/WASM boundary.

Input / Output Contract:
- Browser and CLI parse behavior matches on the new syntax.

Dependencies:
- Tasks 1-3.

Acceptance:
- WASM parser accepts `()` groups and rejects legacy `[]` groups consistently with native parser behavior.
- No frontend default content or fixture still depends on square-bracket group parsing.
- Header metadata containing literal brackets still round-trips unchanged through the parser boundary.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts`

## Test Plan

- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core normalize -- --nocapture`
- Parser fixtures:
  - simple group `(x d b)`
  - span group `(2: x x)`
  - trailing modifier `(x x):accent`
  - zero-duration directive in group `(@p x x)`
  - zero-duration directive at migrated close-paren boundary `(@p)` and `(@f)`
  - legacy bracket group `[x d b]` invalid-syntax error without migration hint
  - unclosed `(` group error
  - lossy parse recovery after unclosed `(` group still preserves following measure parsing
  - header raw text `title Song No. 5 (Remix) [2024]`
- CLI checks:
  - `npm run drummark -- <fixture> --format ast`
  - `npm run drummark -- <fixture> --format ir`
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts`

## Risks / Notes

- This is a migration-sensitive DSL change even before 1.0 because existing fixtures, examples, and local user charts may use `[]`.
- `()` currently appears inside free text such as titles; parser changes must stay measure-expression-scoped so header/body text behavior does not regress.
- `<>` is intentionally excluded because angle-bracket semantics already appear in grouping documentation and would make the language visually noisier.
- The main value of this change is grammar reservation for future bracket-based structure syntax; if that future syntax is dropped, the migration cost may not be justified.

## Linked Items

- GitHub Issue: N/A
- Bug: rehearsal-mark syntax follow-up enabler
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-05 | Initial draft for migrating rhythmic groups from `[]` to `()` and reserving square brackets for future label syntax. |
