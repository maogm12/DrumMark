# Fully Deprecate `divisions`

## Status

in progress - implementation underway

## Problem

`divisions` is no longer the intended rhythmic model in DrumMark, but it still exists across the implementation as:
- a parsed DSL header,
- an AST/header field,
- a normalized IR field,
- a render-score field,
- a TypeScript/WASM/CLI contract field,
- a large body of fixtures and tests.

That leaves the project in an unstable middle state: the canonical spec now says `note 1/N` and Note Units are primary, but the implementation still accepts and propagates `divisions` as a first-class compatibility input. This keeps creating design confusion, raises review risk, and makes new feature work harder to reason about.

## Goal

Remove `divisions` from the accepted DrumMark DSL and from the active public DrumMark data model, while preserving MusicXML `<divisions>` as an export-internal concept.

After this change:
- DrumMark source uses `note 1/N` only.
- Parser/AST no longer expose `divisions` as a header field.
- Normalized IR and render-facing contracts no longer require or expose `divisions`.
- TypeScript/WASM/CLI public shapes no longer advertise `divisions` as DrumMark header state.
- Fixtures, tests, examples, and docs use `note 1/N`.

## Non-goals

- No change to MusicXML export's internal `<divisions>` computation.
- No change to accepted rhythmic semantics beyond removing the `divisions` input path and derived public field.
- No pickup / rehearsal-mark / modifier-completion feature work.
- No redesign of grouping, tuplet, or event-fraction math.
- No compatibility shim that silently rewrites `divisions` forever; this change is about removing active support, not extending it.

## Current Plan

Treat this as a Spec / Contract Change plus a cross-layer implementation change.

The work splits into four layers:
- language/spec: remove `divisions` from accepted DSL syntax and move it to removed/deprecated historical context,
- parser/core: delete header parsing and AST/storage for `divisions`, making `note 1/N` the only rhythmic-unit source,
- public contracts: remove `divisions` from normalized/render/TS/WASM/CLI header shapes unless it is strictly internal and not user-visible,
- migration/tests: rewrite fixtures and tests to `note 1/N`, and add explicit diagnostics for legacy `divisions` input.

MusicXML remains allowed to emit `<divisions>` because that is MusicXML's own duration encoding mechanism, not DrumMark DSL syntax.

## Spec Delta

Normative changes to active specs/contracts:

- `docs/DRUMMARK_SPEC.md`
  - remove `divisions <number>` from accepted header syntax,
  - state that `note 1/N` is the only accepted rhythmic-unit header,
  - move `divisions` to removed legacy syntax with a dedicated migration diagnostic,
  - remove normalized-header language that presents `divisions` as an active public field.

- `docs/RENDER_LAYOUT_CONTRACT.md`
  - remove any requirement that render-facing header contracts expose DrumMark `divisions`,
  - keep only the data actually needed by layout, preferably `note_value` and exact durations.

Expected implementation policy:
- legacy `divisions` input becomes a parse error with a migration-oriented diagnostic,
- internal helper variables may still use “divisions” as a local name for MusicXML duration math if that is the external format's term, but not as DrumMark DSL contract vocabulary.

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

Potential additional contract surfaces to verify:
- `src/dsl/types.ts`
- `crates/drummark-layout/src/contract.rs`
- `crates/drummark-core/drummark_core.d.ts`
- `src/drummark.ts`
- `src/scoreWorker.ts`

## Tasks

### Task 1: Inventory `divisions` Surfaces

Status: Done

Scope:
- parser/core
- layout/render contract
- TypeScript/WASM/CLI contract surfaces
- editor/runtime DSL surfaces
- docs/examples/tests/corpus

Action:
- Build a durable inventory of all remaining DrumMark-meaningful `divisions` references.
- Separate them into:
  - remove from DSL/public contract,
  - keep only as MusicXML/export-internal terminology,
  - rewrite test/example input.
- Explicitly inventory user-visible surfaces that still advertise `divisions`, including editor highlighting/completions and parse-error fallback score shapes.

Input / Output Contract:
- Inventory must be durable in `history.md` or a tracked artifact in this change folder.

Dependencies:
- None.

Acceptance:
- Every remaining DrumMark-facing `divisions` use has an explicit disposition.
- User-visible editor/runtime surfaces have explicit remove-or-migrate dispositions, not implicit catch-all coverage.

Verification:
- `rg -n "\\bdivisions\\b" crates src docs`

### Task 2: Remove DSL/Header Support

Status: Done

Scope:
- `crates/drummark-core/src/lexer.rs`
- `crates/drummark-core/src/parser.rs`
- `crates/drummark-core/src/ast.rs`
- parser-facing JS/WASM AST surfaces
- legacy-input diagnostic contract

Action:
- Remove `divisions` header parsing from the active grammar.
- Remove `HeaderSection.divisions`.
- Replace legacy acceptance with a targeted parse diagnostic telling users to use `note 1/N`.
- Pin the legacy diagnostic wording closely enough that parser/WASM/UI tests can assert it.

Input / Output Contract:
- AST header exposes `note` only for rhythmic-unit declaration.

Dependencies:
- Human stamp before implementation.

Acceptance:
- Source files using `divisions` fail with a clear migration diagnostic.
- Equivalent `note 1/N` files parse successfully.
- Existing legacy-fixture tests that currently parse `divisions` successfully are converted either to migration-diagnostic assertions or to `note 1/N` fixtures.

Verification:
- `cargo test -p drummark-core parser -- --nocapture`
- `npm run drummark -- <fixture> --format ast`
- `npm test -- --run src/wasm/parser_ast_contract.test.ts`

### Task 3: Remove Public Contract Field Propagation

Status: Done

Scope:
- `crates/drummark-core/src/normalize.rs`
- `crates/drummark-core/src/render_score.rs`
- `crates/drummark-layout/src/contract.rs`
- `src/dsl/types.ts`
- `src/drummark.ts`
- `src/scoreWorker.ts`
- WASM/CLI/JS bridge files
- generated WASM declaration artifacts

Action:
- Remove `divisions` from normalized header and render header public shapes.
- Update layout to rely on `note_value`, time signature, grouping, and exact fractions rather than a DrumMark `divisions` contract field.
- Update TS/WASM/CLI bridges and type declarations accordingly.
- Remove `divisions` from editor header keyword surfaces and fallback parse-error score shapes.
- Rebuild generated WASM packages and verify generated declarations no longer expose DrumMark `divisions`.

Input / Output Contract:
- Public DrumMark header contracts no longer expose `divisions`.
- MusicXML internals may still compute/export MusicXML `<divisions>`.

Dependencies:
- Task 2.

Acceptance:
- Public normalized/render header shapes compile and test without `divisions`.
- No active TypeScript or Rust public contract surface presents DrumMark `divisions` as required state.
- User-visible editor/runtime surfaces no longer advertise `divisions` as an accepted header keyword.
- Generated WASM declaration artifacts no longer expose DrumMark `divisions`.

Verification:
- `cargo test -p drummark-core -- --nocapture`
- `cargo test -p drummark-layout -- --nocapture`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/wasm/parser_ast_contract.test.ts`
- `npm run wasm:build`
- `rg -n "\\bdivisions\\b" src/wasm/*/drummark_core.d.ts crates/drummark-core/drummark_core.d.ts`

### Task 4: Migrate Fixtures, Corpus, And Docs

Status: Done

Scope:
- docs examples
- musicxml corpus inputs
- parser/layout/spec tests
- renderer parity/corpus tests
- active specs/contracts

Action:
- Rewrite DrumMark source fixtures from `divisions` to `note 1/N`.
- Update active spec and layout contract text to remove DrumMark-facing `divisions` language.
- Keep MusicXML goldens using `<divisions>` unchanged except where source migration changes exact exported durations or ordering.
- Enumerate and migrate current `divisions` fixtures in parser/WASM parity/musicxml corpus tests.

Input / Output Contract:
- Active docs describe `divisions` only as removed legacy syntax or MusicXML terminology.

Dependencies:
- Tasks 2 and 3.

Acceptance:
- Source fixtures no longer use the DrumMark `divisions` header.
- Active specs/contracts are aligned with implementation reality.
- Layout/renderer parity remains stable across migrated fixtures.

Verification:
- `rg -n "^divisions " docs src crates`
- `npm run build`
- `npm test -- --run src/renderer/corpusGate.test.ts src/renderer/svgSceneAdapter.test.ts src/dsl/musicxml_corpus.test.ts`

### Task 5: Review And Close-Out

Status: Done

Scope:
- full change

Action:
- Run implementation review.
- Record consolidated spec/contract changes.
- Archive only after review approval.

Input / Output Contract:
- No unresolved DrumMark-facing `divisions` references remain outside clearly historical or MusicXML-specific contexts.

Dependencies:
- Tasks 1-4.

Acceptance:
- Implementation review reaches `STATUS: APPROVED`.

Verification:
- Focused `rg` over active code/spec surfaces for DrumMark-facing `divisions`.

## Test Plan

- `cargo test -p drummark-core parser -- --nocapture`
- `cargo test -p drummark-core -- --nocapture`
- `cargo test -p drummark-layout -- --nocapture`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/wasm/parser_ast_contract.test.ts src/dsl/musicxml_corpus.test.ts src/renderer/corpusGate.test.ts src/renderer/svgSceneAdapter.test.ts`
- `npm run drummark -- <legacy-divisions-fixture> --format ast`
- `npm run drummark -- <migrated-note-fixture> --format ir`
- `npm run wasm:build`
- `npm run build`
- `rg -n "\\bdivisions\\b" docs/DRUMMARK_SPEC.md docs/RENDER_LAYOUT_CONTRACT.md crates src`
- `rg -n "\\bdivisions\\b" src/scoreWorker.ts src/drummark.ts src/wasm/*/drummark_core.d.ts crates/drummark-core/drummark_core.d.ts`

## Risks / Notes

- This is a broad compatibility break and should be treated as such.
- The biggest hidden risk is confusing DrumMark `divisions` with MusicXML `<divisions>`; the latter stays.
- Layout and normalization still use local variables named `divisions` for slot-count math. Some of those may be fine as implementation detail, but public contract and DSL meaning must be removed.
- Test churn will be high because many fixtures currently use `divisions`.
- If some consumer still depends on the public `divisions` field in normalized/render headers, we may need a short migration note rather than keeping the field alive indefinitely.
- Known migration tests to touch include current `divisions` fixtures in `src/wasm/parser_ast_contract.test.ts`, `src/wasm/parser_layout_parity.test.ts`, `src/dsl/musicxml_corpus.test.ts`, musicxml corpus inputs, and editor/runtime surfaces such as `src/drummark.ts` and `src/scoreWorker.ts`.

## Linked Items

- GitHub Issue: N/A
- Bug: remove legacy DrumMark `divisions` compatibility
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-01 | Initial draft |
| 2 | 2026-06-01 | Addressed plan review: added editor/runtime scope, explicit WASM/declaration verification, stronger layout corpus coverage, and a concrete legacy-fixture migration matrix. |
