# Fully Deprecate `divisions` History

## 2026-06-01

### Draft Created

Plan file: `docs/changes/active/2026-06-01-fully-deprecate-divisions/plan.md`

Status: pending plan review and human stamp before implementation.

Context:
- User requested a follow-on change after canonical spec rewrite to fully remove DrumMark `divisions` as an accepted DSL and public contract concept.
- MusicXML `<divisions>` remains out of scope for removal because it is an export format concept, not a DrumMark header.

### Plan Review Round 1

Reviewer: subagent `019e85a8-73af-7ea2-845f-afa1462ea912`

Status: CHANGES_REQUESTED

Findings:
- Medium: Plan did not explicitly scope user-visible editor/runtime surfaces such as `src/drummark.ts` and `src/scoreWorker.ts`.
- Medium: Generated WASM/package declaration fallout was under-specified and lacked explicit `npm run wasm:build` plus declaration checks.
- Medium: Layout regression coverage was too soft given current `header.divisions` usage in layout planning.
- Low: Legacy diagnostic contract and current `divisions` fixture migration matrix were not explicit enough.

Resolution:
- Added explicit editor/runtime scope and acceptance for `src/drummark.ts` and `src/scoreWorker.ts`.
- Added explicit `npm run wasm:build` and generated declaration verification for WASM/package surfaces.
- Added renderer/layout corpus and SVG parity coverage.
- Added a concrete migration matrix covering current `divisions` parser/WASM/musicxml fixtures and pinned the legacy diagnostic contract more tightly.

### Plan Review Round 2

Reviewer: subagent `019e85a8-73af-7ea2-845f-afa1462ea912`

Status: APPROVED

Summary:
- Editor/runtime scope is now explicit.
- WASM/package declaration fallout is now explicitly rebuilt and verified.
- Layout regression coverage now includes renderer corpus/SVG parity.
- Legacy diagnostic and fixture migration coverage are now explicit enough for implementation review.

### Approved Plan

Approved file: `docs/changes/active/2026-06-01-fully-deprecate-divisions/plan.md`
Approved summary:
- Remove DrumMark `divisions` from DSL syntax and public contracts.
- Preserve MusicXML `<divisions>` as an export-internal concept.
- Migrate editor/runtime surfaces, generated WASM declarations, and fixtures to `note 1/N`.

Open conditions:
- Human stamp required before implementation.

## Human Stamp

Date: 2026-06-01
Approved by: user
Approved plan: `docs/changes/active/2026-06-01-fully-deprecate-divisions/plan.md`
Approved plan commit: `224fd53`
Scope: Remove DrumMark `divisions` from the accepted DSL and active public contracts while keeping MusicXML `<divisions>` intact.

Approval text:

> Go for it

Conditions:
- Keep MusicXML `<divisions>` untouched as an export-format concept.
- Remove user-visible DrumMark `divisions` support consistently across parser, contracts, editor surfaces, and fixtures.

Status: APPROVED_FOR_IMPLEMENTATION

## Spec Inventory / Disposition

Source:
- active code and docs surfaces matched by `rg -n "\\bdivisions\\b" crates src docs`

Disposition summary:
- `crates/drummark-core/src/lexer.rs`, `parser.rs`, `ast.rs`, `to_js.rs`, `main.rs`, `lib.rs`, `crates/drummark-cli/src/json.rs`, `crates/drummark-core/drummark_core.d.ts` -> remove DrumMark header parsing/storage/serialization and replace with migration diagnostics where needed.
- `crates/drummark-core/src/normalize.rs`, `render_score.rs`, `crates/drummark-layout/src/contract.rs`, `src/dsl/types.ts` -> remove DrumMark-facing `divisions` public contract fields.
- `crates/drummark-layout/src/planning.rs` and related layout callers -> replace `header.divisions` slot-fraction derivation with `note_value`-based math.
- `src/drummark.ts`, `src/scoreWorker.ts` -> remove user-visible `divisions` keyword handling and fallback score shape usage.
- `src/wasm/*/drummark_core.d.ts`, `scripts/build_wasm.mjs` verification path -> rebuild and verify generated declarations no longer expose DrumMark `divisions`.
- parser/WASM/musicxml/layout fixtures and docs inputs that still use `divisions` -> migrate to `note 1/N` or convert to migration-diagnostic assertions.
- MusicXML exporter internals and MusicXML output `<divisions>` tags -> keep as export-format terminology, not DrumMark DSL terminology.

## Consolidated Changes

- Removed DrumMark `divisions` from parser AST storage, parser-facing JS/WASM AST serialization, and parser diagnostics now point users to `note 1/N`.
- Removed DrumMark `divisions` from normalized/render public header contracts, TS types, editor header keyword surfaces, fallback worker score state, and generated WASM/public declaration surfaces.
- Updated layout slot math to derive from `note_value` rather than a DrumMark `divisions` header field.
- Migrated active fixtures, corpus inputs, and spec text from DrumMark `divisions` to `note 1/N`, while keeping MusicXML `<divisions>` as an export-internal format concept.
- Closed the remaining runtime hole so legacy `divisions` now stops active normalize/export/layout entrypoints instead of silently producing score output.
- Rebuilt parser/layout WASM packages and refreshed affected MusicXML goldens.

### Implementation Review

Reviewer: subagent `019e866c-082c-7190-91b9-17fe25c40b4c`

Status: APPROVED

Summary:
- Legacy DrumMark `divisions` no longer leaks through active DSL or public contract surfaces.
- Native CLI non-AST outputs reject legacy `divisions` correctly.
- TS/WASM runtime now rejects legacy `divisions` across `ir`, `xml`, and `svg` paths.
- MusicXML `<divisions>` remains internal/export-only as intended.

Residual gap:
- The subagent noted that explicit checked-in TS runtime coverage is stronger for `ir`/`xml` than for the exact `buildCliOutput(..., "svg")` path; current verification included direct `npx tsx` runtime exercise plus node layout guard coverage.
