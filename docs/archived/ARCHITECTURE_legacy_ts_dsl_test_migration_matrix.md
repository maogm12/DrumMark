# Legacy TypeScript DSL Migration Matrix

This matrix supports `ARCHITECTURE_proposal_remove_legacy_ts_dsl.md`. No legacy TypeScript parser, AST, logic, parity, or benchmark test should be deleted unless it has a row here with a replacement or obsolete-contract rationale.

## Production Surface Inventory

| File | Legacy dependency | Behavior covered | Replacement location | Owning task | Disposition |
|------|-------------------|------------------|----------------------|-------------|-------------|
| `src/dsl/musicxml.ts` | `logic.ts` imports | MusicXML voice grouping, duration helpers, repeat content, instrument mapping | Rust MusicXML exporter in `crates/drummark-core` plus WASM `{ xml, errors }` wrapper | Task 4 | Replace, then reduce TS to glue or delete |
| `src/dsl/normalize.ts` | `buildScoreAst`, `score.ast`, `buildNormalizedScoreFromRegex` | NormalizedScore compatibility adapter | Rust WASM normalizer contract only | Task 9 | Remove `score.ast` and regex alias |
| `src/dsl/index.ts` | re-exports `ast`, `logic`, `musicxml`, `normalize` | Public TypeScript DSL surface | Normalized contract types and WASM-backed functions only | Task 10 | Restrict exports |
| `src/dsl/ast.ts` | `parser.ts`, `skeleton.ts`, `logic.ts`, legacy `ScoreAst` | ScoreAst construction and validation compatibility | Rust parser AST export and Rust normalizer tests | Tasks 2, 6, 11 | Delete |
| `src/dsl/parser.ts` | legacy manual parser types | Old parser skeleton | Rust parser AST export | Tasks 2, 11 | Delete |
| `src/dsl/logic.ts` | legacy semantic helpers | Fraction math, token resolution, voice grouping, MusicXML helpers | Rust core tests and Rust MusicXML exporter | Tasks 4, 5, 11 | Delete |
| `src/wasm/skeleton.ts` | legacy `DocumentSkeleton`, `ParsedMeasure`, `TokenGlyph` adapter | Converts Rust parser JSON into old TS skeleton | Native parser AST WASM wrapper | Tasks 2, 11 | Delete |
| `src/dsl/types.ts` | legacy parser/AST types and `NormalizedScore.ast` | Shared TS contract types | Normalized runtime contracts only | Tasks 9, 10 | Remove legacy exports |

## `logic.ts` Symbol Audit

| Symbol(s) | Current role | Replacement location | Owning task | Disposition |
|-----------|--------------|----------------------|-------------|-------------|
| `Fraction` re-export | Fraction contract helper | Keep only if normalized contract still needs it; otherwise Rust tests | Tasks 5, 10 | Remove from public TS exports if not needed |
| `MAX_EXACT_POWER_OF_TWO_EXPONENT`, `basicTokenExceedsExactDurationRange` | Duration overflow guard | Rust normalizer/event tests | Task 5 | Replace and delete TS export |
| `gcd`, `lcm`, `simplify`, `addFractions`, `subtractFractions`, `multiplyFractions`, `divideFractions`, `multiplyFraction`, `divideFraction`, `fractionFromNumber`, `fractionsEqual`, `compareFractions` | Fraction arithmetic | Rust fraction tests | Task 5 | Replace and delete TS exports |
| `resolveMeasureRepeatContentMeasure` | MusicXML repeat content lookup | Rust MusicXML exporter using normalized measure metadata | Task 4 | Port/delete |
| `VoiceId`, `voiceForTrack`, `stemDirectionForVoice` | Voice assignment/output helper | Normalized events and Rust MusicXML/layout logic | Tasks 4, 5 | Replace/delete |
| `calculateTokenWeightAsFraction` | Token duration semantics | Rust event/normalizer tests | Task 5 | Replace/delete |
| `groupingSegmentIndex`, `getGroupingBoundaries` | Grouping boundary helpers | Rust normalizer/layout or normalized output tests | Tasks 5, 7 | Replace/delete |
| `isBeamable`, `visualDurationForEvent` | MusicXML duration/beam helper | Rust MusicXML local helper | Task 4 | Port/delete |
| `InstrumentSpec` | MusicXML instrument metadata | Rust track/instrument metadata | Task 4 | Port/delete |
| `VoiceEventGroup`, `VoiceEntry`, `groupVoiceEvents`, `buildVoiceEntries` | MusicXML voice grouping | Rust MusicXML event grouping | Task 4 | Port/delete |
| `resolveFallbackTrack` | Token resolution fallback | Rust resolver tests | Task 5 | Replace/delete |

## Test Migration Rows

| Test file | Legacy dependency | Behavior covered | Replacement location | Owning task | Disposition |
|-----------|-------------------|------------------|----------------------|-------------|-------------|
| `src/dsl/logic.test.ts` | `logic.ts` | Fraction math and legacy logic helpers | Rust core fraction/resolution/duration tests | Task 5 | Replace then delete/update |
| `src/dsl/parser.test.ts` | `parseDocumentSkeleton` | Header parsing, track lines, compact spacing, comments, errors | Native parser AST WASM tests and Rust parser tests | Task 6 | Replace then delete/update |
| `src/dsl/ast.test.ts` | `buildScoreAst` | ScoreAst paragraphs, repeats, explicit measures, grouping validation | Rust parser/normalizer tests and WASM AST tests | Task 6 | Replace then delete/update |
| `src/dsl/benchmark.test.ts` | `parseDocumentSkeleton` | Regex parser benchmark | Optional Rust benchmark outside app tests | Task 8 | Obsolete-contract deletion |
| `src/dsl/normalize_parity.test.ts` | `buildNormalizedScoreFromRegex` | Rust-vs-TS normalizer parity | Rust/WASM fixture contract tests | Task 8 | Obsolete-contract deletion |
| `src/dsl/wasm_cutover_blockers.test.ts` | `parseDocumentSkeletonFromWasmSync` | WASM parser cutover regressions | Native parser AST WASM tests | Task 6 | Replace then delete/update |
| `src/dsl/spec-c01-headers.test.ts` | `parseDocumentSkeleton` | Header defaults, invalid headers, time/divisions/note/grouping | Rust parser tests and WASM AST contract tests | Task 6 | Replace/update |
| `src/dsl/spec-c02-tracks.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Track registry, unknown tracks, paragraph tracks | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c03-tokens.test.ts` | `parseDocumentSkeleton` | Token parsing and token variants | Rust parser AST tests | Task 6 | Replace/update |
| `src/dsl/spec-c05-durations.test.ts` | `logic.ts`, `TokenGlyph`, `parseDocumentSkeleton` | Dots, halves, stars, duration math, parser duration tokens | Rust duration tests and WASM normalized tests | Tasks 5, 6 | Replace/update |
| `src/dsl/spec-c06-groups.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Group parsing and validation | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c07-modifiers.test.ts` | `parseDocumentSkeleton` | Modifier parsing and modifiers on normalized events | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c09-combined-hits.test.ts` | `parseDocumentSkeleton` | Combined hits parsing and normalization | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c11-repeat-barlines.test.ts` | `parseDocumentSkeleton`, `buildScoreAst`, `parseDocumentSkeletonFromWasmSync` | Repeat starts/ends, repeat counts, repeat barline validation | Rust parser/normalizer tests and WASM AST tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c12-voltas.test.ts` | `buildScoreAst` | Volta AST and normalized propagation | Rust normalizer tests | Task 7 | Replace/update |
| `src/dsl/spec-c12-anonymous-voltas.test.ts` | `buildScoreAst` | Anonymous volta routing | Rust normalizer tests | Task 7 | Replace/update |
| `src/dsl/spec-c13-measure-repeat.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Measure repeat syntax, count, repeat content | Rust parser/normalizer tests and MusicXML golden if XML-specific | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c14-navigation.test.ts` | `parseDocumentSkeleton` | Segno/coda/fine navigation parsing and validation | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c15-multi-rest.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Multi-rest parsing and AST behavior | Rust parser/normalizer tests and MusicXML golden | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c16-inline-repeat.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Inline repeat parsing, validation, normalized expansion | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c18-layout.test.ts` | `parseDocumentSkeleton` | Layout hints/comments/source line parsing | Native parser AST and layout-boundary tests | Task 6 | Replace/update |
| `src/dsl/spec-c19-errors.test.ts` | `parseDocumentSkeleton`, `buildScoreAst` | Parser and normalizer errors | Rust parser/normalizer error tests and WASM error contract tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c21-trailing-modifiers.test.ts` | `parseDocumentSkeleton` | Trailing modifier parsing and validation | Rust parser/normalizer tests | Tasks 6, 7 | Replace/update |
| `src/dsl/spec-c23-dynamics.test.ts` | `buildScoreAst` | Dynamics routing and MusicXML export | Rust normalizer tests and MusicXML goldens | Tasks 4, 7 | Replace/update |
| `src/dsl/spec-c08-modifier-legality.test.ts` | old TS validation diagnostic contract | Modifier legality and parser/normalizer diagnostic text | Rust validation tests and normalized WASM boundary coverage | Task 7 | Obsolete old-message contract deletion |
| `src/dsl/spec-c17-validation.test.ts` | old TS validation diagnostic contract | Duration, grouping, and repeat validation diagnostics | Rust validation tests and parser/normalizer WASM error contract | Task 7 | Obsolete old-message contract deletion |
| `src/dsl/spec-c20-note-value.test.ts` | old normalized compatibility contract | Measure note value propagation and duration scaling | Rust normalizer tests plus example corpus normalized output | Task 7 | Replace/update |
| `src/dsl/spec-c22-hairpins.test.ts` | old TS hairpin shape and diagnostic contract | Hairpin start/end routing and validation | Rust hairpin tests, layout parity tests, and example corpus normalized output | Task 7 | Obsolete old-shape contract deletion |

## Non-Legacy Tests That May Need Contract Updates

These tests do not necessarily import old parser/AST helpers directly, but may need updates when MusicXML moves to source-based WASM output or `score.ast` is removed.

| Test file | Reason | Owning task | Disposition |
|-----------|--------|-------------|-------------|
| `src/dsl/musicxml.test.ts` | `buildMusicXml` currently accepts normalized score and TypeScript exporter behavior | Tasks 3, 4 | Replace with Rust MusicXML golden/contract tests |
| `src/dsl/durations.test.ts` | MusicXML dotted-note coverage and normalized duration checks | Tasks 3, 4, 5 | Keep/update against Rust contracts |
| `src/dsl/spec-c10-sticking.test.ts` | MusicXML sticking output | Tasks 3, 4 | Cover in MusicXML goldens |
| `src/cli_runtime.test.ts` | CLI XML/AST/IR output routing | Tasks 2, 4, 12 | Update for parser AST and source-based XML |
| `src/cli_output.test.ts` | JSON formatting for CLI score output | Tasks 2, 9 | Update if `ast` output separates from normalized score |
| `src/dsl/example_corpus.test.ts` | Normalized corpus expectations | Tasks 7, 12 | Keep/update against Rust normalized contract |
| `src/dsl/normalize.test.ts` | Normalized score contract still asserted old compatibility fields and old repeat fixture semantics | Tasks 7, 9 | Replace with Rust normalizer tests, WASM boundary tests, and example corpus normalized output |

## Task 4 MusicXML Golden Differences

Rust MusicXML generation intentionally becomes the source of truth after Task 4. The frozen TS corpus exposed compatibility behavior that should not be preserved:

| Area | Old TS behavior | Rust behavior | Rationale |
|------|-----------------|---------------|-----------|
| Explicit rests inside an otherwise active voice | Some rest positions were emitted as pitched notes because the old exporter was built around pre-explicit-rest assumptions | Explicit rest events are emitted as MusicXML rests | Rust normalizer now represents rests explicitly; MusicXML should preserve that semantic contract |
| Hairpin kind field | TS exporter read `hairpin.type`, while Rust WASM currently serializes `hairpin.kind`, causing some legacy baseline wedges to drift | Rust exporter reads `HairpinKind` directly | Avoid carrying a TS adapter field-name bug into Rust |
| Source-based XML export | TS exporter accepted `NormalizedScore` and reused TS helper logic | Rust exporter accepts source, normalizes internally, and returns `{ xml, errors }` | Matches approved proposal and avoids keeping TS semantic helpers alive |
