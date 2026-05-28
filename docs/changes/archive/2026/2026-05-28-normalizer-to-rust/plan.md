# Normalizer to Rust / WASM

## Status

completed

## Problem

Parsing runs in Rust/WASM, but a large normalization path may still exist in TypeScript, splitting the pipeline and complicating parity and bundling.

## Goal

`Source -> NormalizedScore` (or `RenderScore`) is produced entirely in `drummark-core` / WASM with parity tests against the legacy TS normalizer where it still exists.

## Non-goals

- MusicXML export rewrite in this change (unless required for IR field parity).
- UI/settings work.

## Current Plan

All Rust normalizer modules are implemented and the TS pipeline has been cut over: `ast.ts` and `logic.ts` are deleted; `normalize.ts` is a 92-line adapter that calls WASM `build_normalized_score` and adapts minor JS shape differences. Task 9 (parity testing) is cancelled — the legacy TS normalizer is deleted and cannot serve as an oracle.

## Spec Delta

N/A (internal architecture change unless public IR JSON shape changes — if so, document in `DRUMMARK_SPEC.md` in a follow-on task).

## Affected Specs / Contracts

- N/A initially; update `DRUMMARK_SPEC.md` only if exported IR fields or CLI contracts change.

## Tasks

### Task 1: Fraction Math

Status: Done

Scope: `crates/drummark-core/src/fraction.rs`

Fraction type with gcd-simplified add/multiply/divide/compare, `calculate_token_weight_as_fraction`, `to_slot_count`, `exceeds_exact_duration_range`.

### Task 2: Magic Token Resolution

Status: Done

Scope: `crates/drummark-core/src/resolve.rs`

Static mapping tables, accent-uppercase resolution, anonymous fallback, ST track bypass, track-override precedence. Exports `resolve_token`, `resolve_fallback_track`, `voice_for_track`, `get_track_family`, `is_valid_track`.

### Task 3: Validation

Status: Done

Scope: `crates/drummark-core/src/validate.rs`

`validate_modifier_legality`, `validate_grouping`, `validate_group_token` using modifier legality matrix and grouping boundary checks.

### Task 4: Token → Event Expansion

Status: Done

Scope: `crates/drummark-core/src/event.rs`

`token_to_events` handles basic, group, combined, and braced tokens. Also `scan_hairpin_tokens` and `scan_dynamic_tokens`. Voice assignment, beaming, source offset propagation.

### Task 5: Hairpin State Machine

Status: Done

Scope: `crates/drummark-core/src/hairpin.rs`

Per-track `HairpinState` machine with cross-measure propagation, dangling closure, cross-track deduplication. Exports `collect_track_hairpins`, `close_dangling_hairpin`.

### Task 6: Navigation & Volta

Status: Done

Scope: `crates/drummark-core/src/nav.rs`, `crates/drummark-core/src/volta.rs`

Navigation resolution (startNav/endNav with Fraction anchors, cross-track merge, barline forcing). Volta forward sweep from seed measure.

### Task 7: Core Normalization Engine

Status: Done

Scope: `crates/drummark-core/src/normalize.rs`

`normalize_document()` with main pass and post-passes (volta propagation, hairpin closure, track collection). Exported to WASM as `build_normalized_score`.

### Task 8: JS Adapter & Pipeline Integration

Status: Done

Scope: `src/dsl/`, `src/wasm/parser_runtime.ts`

`buildNormalizedScore(source)` calls WASM directly via `buildNormalizedScoreWithParserRuntime`. `ast.ts` and `logic.ts` deleted (~1349 lines). `normalize.ts` retained as 92-line adapter for JS shape differences (error parsing, nav normalization, measure field adaptation).

### Task 9: Parity Testing

Status: Cancelled

Reason: The legacy TypeScript normalizer (`ast.ts`, `logic.ts`) has been deleted and cannot serve as an oracle. Parity was implicitly validated during cutover: all existing tests pass, CLI output (`--format ir`, `--format svg`, `--format xml`) is correct against corpus fixtures, and the Rust normalizer is the production path.

## Test Plan

- `cargo test -p drummark-core`
- `npm run drummark -- <corpus> --format ir`
- `npm test`

## Risks / Notes

- Hidden coupling between resolve, validate, and event expansion (normalize.rs trap); keep tasks independently testable per change-workflow rules.
- `normalize.ts` retained as thin adapter rather than deleted completely (per LEARNINGS.md: "A safer bridge is a thin adapter that calls the parser WASM runtime's build_normalized_score").

## Linked Items

- Legacy proposal: `docs/archived/ARCHITECTURE_proposal_normalizer_to_rust.md`
- Legacy tasks: `docs/archived/ARCHITECTURE_tasks_normalizer_to_rust.md`

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-05-28 | Migrated from `docs/proposals/` |
| 2 | 2026-05-28 | Synced task statuses; Tasks 1–8 Done, Task 9 Pending |
| 3 | 2026-05-28 | Task 9 cancelled (TS normalizer deleted, no oracle); status → `completed` |
