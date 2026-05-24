## Addendum v1.0: Remove Legacy TypeScript DSL Pipeline

### Motivation

The parser and normalizer are now owned by `drummark-core` and exposed to the app through WASM. The current repository still keeps the former TypeScript DSL pipeline alive through compatibility files and tests:

```
src/dsl/parser.ts      # legacy manual parser
src/dsl/ast.ts         # legacy ScoreAst builder and compatibility adapter
src/dsl/logic.ts       # legacy fraction/resolution helpers, still used by MusicXML
src/dsl/normalize.ts   # thin Rust/WASM adapter, but still attaches score.ast
```

This leaves two sources of truth for language semantics. It also keeps failing or stale TypeScript tests around after the Rust normalizer cutover. The cleanup should make Rust/WASM the only parser and normalization authority, then delete the old TypeScript parser/AST/normalizer support instead of carrying it as a shadow implementation.

### Goals

- Production parsing and normalization use only Rust/WASM APIs.
- MusicXML export no longer depends on `src/dsl/parser.ts`, `src/dsl/ast.ts`, or `src/dsl/logic.ts`.
- `NormalizedScore.ast` is removed from production data flow once MusicXML and tests no longer require it.
- TypeScript tests are migrated from legacy implementation details to Rust/WASM contract assertions.
- Obsolete TypeScript parser, AST, normalizer parity, and regex benchmark files are deleted.
- CLI formats keep working: `ast`, `ir`, `xml`, and `svg`.

### Non-Goals

- No new DSL syntax.
- No MusicXML feature expansion beyond preserving existing supported output.
- No layout or engraving redesign.
- No renderer-side compatibility patching for deleted AST behavior.
- No broad UI changes beyond compile fixes caused by API removal.

### Current Inventory

#### Production Imports

`src/cli_runtime.ts` imports both `buildMusicXml` and `buildNormalizedScore`. `buildNormalizedScore` now routes through Rust/WASM, but MusicXML still lives in TypeScript and imports helper logic from `src/dsl/logic.ts`.

`src/dsl/normalize.ts` is a compatibility adapter over the Rust WASM normalizer. It still imports `buildScoreAst` and attaches `score.ast` to satisfy consumers that have not migrated.

`src/dsl/index.ts` re-exports `ast`, `logic`, `musicxml`, and `normalize`, which makes legacy modules part of the public TypeScript surface even when production no longer needs them.

#### Test Imports

Many `src/dsl/spec-c*.test.ts` files still import `parseDocumentSkeleton` from `parser.ts` or `buildScoreAst` from `ast.ts`. These tests verify the old TypeScript shape, not the current Rust/WASM contract. They should either move to Rust unit tests or become TypeScript WASM-boundary tests against the actual exported JSON.

`src/dsl/normalize_parity.test.ts` compares Rust output against the old TypeScript normalizer. After the TypeScript normalizer deletion, this test no longer protects the desired architecture and should be deleted or replaced by fixture-based Rust/WASM contract tests.

`src/dsl/benchmark.test.ts` benchmarks the regex parser path. It should be removed or replaced with a Rust parser benchmark outside the app test suite.

### Target Architecture

```
Source
  -> drummark-core parser
  -> drummark-core normalizer
  -> NormalizedScore JSON via parser WASM package
  -> TypeScript consumers: renderer, UI, CLI, MusicXML adapter if still TypeScript
```

The TypeScript side should contain only:

- WASM package loaders under `src/wasm/`.
- Type definitions for the JSON contracts under `src/dsl/types.ts`, or a renamed contract module if desired.
- Small adapters that translate WASM JSON into existing app-friendly objects.
- MusicXML code only if it consumes `NormalizedScore` directly and has no dependency on legacy parser/AST/logic modules.

### MusicXML Migration

MusicXML is the main blocker to deleting old TypeScript DSL files.

#### Preferred Path: Rust MusicXML Export

Add a Rust MusicXML exporter in `drummark-core` that consumes the same normalized score model used by rendering:

```
source -> build_normalized_score(source) -> build_music_xml(source)
```

The WASM parser package exports `build_music_xml(source: &str) -> String` or an equivalent fallible API returning a typed error object. The TypeScript `buildMusicXml` function becomes a thin wrapper over that export, then can be deleted or reduced to CLI/app glue.

This path best matches the cleanup goal because fraction math, duration semantics, track resolution, dynamics, hairpins, repeats, voltas, and dotted notes all remain in Rust.

#### Fallback Path: NormalizedScore-Only TypeScript MusicXML

If a full Rust XML exporter is too large for the first cleanup branch, keep a TypeScript MusicXML module temporarily, but it must consume only `NormalizedScore` and local XML formatting helpers. It must not import `parser.ts`, `ast.ts`, or `logic.ts`.

This fallback is acceptable only as an intermediate step. Any helper retained for MusicXML must be scoped to MusicXML and must not preserve the old DSL parser or normalizer surface.

### Parser and AST Removal

After MusicXML no longer needs legacy structures:

- Remove `score.ast` from `NormalizedScore`.
- Remove `buildScoreAst`, `buildScoreAstFromRegex`, and `buildScoreAstFromWasm` from production exports.
- Remove `parseDocumentSkeleton` from the public TypeScript DSL surface.
- Delete `src/dsl/parser.ts` and `src/dsl/ast.ts` once all tests and imports are migrated.
- Keep Rust parser AST inspection available through WASM for `--format ast` and targeted tests.

### Logic Helper Removal

`src/dsl/logic.ts` currently mixes reusable math with DSL-specific semantic resolution. Rust already owns those semantics. The cleanup should:

- Move any still-needed generic TypeScript XML formatting helpers into a MusicXML-local module.
- Keep no TypeScript fraction or token-resolution implementation in production.
- Move remaining fraction/resolution behavior tests to Rust unit tests in `crates/drummark-core`.
- Delete `src/dsl/logic.ts` when no production or test imports remain.

### Test Migration Strategy

Tests should be grouped by contract rather than by old implementation layer.

#### Rust Unit Tests

Move parser and normalizer semantic cases to `crates/drummark-core` when they validate:

- Header parsing and validation.
- Track registry and token resolution.
- Duration math, dots, halves, stars, and tuplets.
- Repeat barlines, inline repeats, measure repeats, multi-rests, and voltas.
- Navigation markers and validation errors.
- Hairpins and dynamics.

These tests should assert Rust structs or normalized JSON snapshots before WASM serialization where possible.

#### TypeScript WASM Boundary Tests

Keep focused TypeScript tests for:

- WASM loader behavior in node/browser wrappers.
- JSON shape compatibility with `src/dsl/types.ts`.
- CLI output routing for `ast`, `ir`, `xml`, and `svg`.
- App-visible error conversion from WASM strings or objects.

#### Deleted Tests

Delete tests whose only purpose is to preserve old TypeScript internals:

- Regex parser benchmark tests.
- Rust-vs-TypeScript normalizer parity tests.
- `buildScoreAst` shape tests with no Rust/WASM contract equivalent.

### Public API After Cleanup

The intended TypeScript DSL surface is:

```ts
export type {
  NormalizedScore,
  NormalizedMeasure,
  NormalizedEvent,
  ParseError,
} from "./types";

export {
  buildNormalizedScore,
} from "./normalize";

export {
  buildMusicXml,
} from "./musicxml";
```

No public export should expose old parser skeletons, old `ScoreAst`, or regex-backed implementations.

### Acceptance Criteria

- `rg "from \"./parser\"|from \"./ast\"|from \"./logic\"|buildScoreAst|parseDocumentSkeleton|buildNormalizedScoreFromRegex" src scripts` returns no production references. Any remaining hits are only in archived docs or intentionally retained migration notes.
- `src/dsl/parser.ts`, `src/dsl/ast.ts`, and `src/dsl/logic.ts` are deleted, or `logic.ts` is replaced by a narrowly named MusicXML-local helper with no parser/normalizer semantics.
- `src/dsl/normalize.ts` does not import `buildScoreAst` and does not attach `score.ast`.
- `src/dsl/index.ts` exports only supported contract types and WASM-backed functions.
- MusicXML export works through Rust or a `NormalizedScore`-only TypeScript adapter.
- `npm run drummark -- docs/examples/musicxml.drum --format xml` produces valid MusicXML.
- `npm run drummark -- docs/examples/full-example.drum --format ast`, `ir`, and `svg` still work.
- `npm run build` passes.
- `npm test` passes after stale TypeScript implementation tests are migrated or removed.
- `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
- `cargo test --manifest-path crates/drummark-layout/Cargo.toml` passes.

### Risks

#### MusicXML Behavioral Drift

The TypeScript MusicXML exporter may contain implicit behavior not covered by current tests. Before deleting it, create a small golden corpus covering titles, tempo, dotted notes, rests, dynamics, hairpins, repeats, voltas, sticking, ghost notes, rolls, and multi-rests.

#### Error Shape Drift

The UI and CLI expect stable parse/normalization errors. The WASM boundary must preserve the current `ParseError` fields or update all consumers in the same task.

#### Over-Broad Test Deletion

Deleting old tests without moving semantic coverage to Rust risks losing real DSL behavior. Each deleted test file must be mapped to either Rust coverage, WASM-boundary coverage, or an explicit obsolete-contract note.

#### Public API Churn

Consumers importing `src/dsl` directly may rely on old exports. This repository should remove old internal exports now, but the cleanup branch should include a targeted `rg` audit before deletion.

### Implementation Order

1. Inventory and classify every remaining import of `parser.ts`, `ast.ts`, and `logic.ts`.
2. Add MusicXML golden coverage for current supported behavior.
3. Move or isolate MusicXML away from legacy DSL helpers.
4. Remove `score.ast` from normalized output and update consumers.
5. Migrate parser/AST/logic tests to Rust or WASM-boundary tests.
6. Delete legacy TypeScript files and stale tests.
7. Run full JS, Rust, CLI, and corpus verification.

### Spec Consolidation Target

This proposal should consolidate into an architecture note rather than a language syntax spec. The final addendum should state that Rust/WASM is the sole authoritative parser and normalizer, while TypeScript is limited to WASM loading, app adapters, rendering adapters, and optional output-format wrappers that consume normalized contracts only.

### Review Round 1

The proposal has the right direction, but it is not yet implementation-safe. It names the old TypeScript files to delete, but several remaining compatibility surfaces are not covered tightly enough to prevent either a half-deletion or a silent reimplementation of the old pipeline under different filenames.

1. `src/wasm/skeleton.ts` is a missing first-class migration target. The proposal says to remove `parseDocumentSkeleton` and `buildScoreAst`, but `src/wasm/skeleton.ts` still adapts Rust parser output back into the old `DocumentSkeleton`, `TokenGlyph`, `ParsedMeasure`, and related `src/dsl/types.ts` shapes. If this survives as the backing for `--format ast` or tests, the old AST contract remains alive even after deleting `parser.ts` and `ast.ts`. The proposal needs an explicit decision: either delete `skeleton.ts` with the legacy parser/AST surface, or rename/rewrite it to expose the native Rust parser JSON without old TypeScript skeleton types.

2. The `--format ast` acceptance criteria are underspecified. Today `ast` output is effectively `formatScoreJson(score, "ast")` from `NormalizedScore`, while the proposal also says to "Keep Rust parser AST inspection available through WASM." Those are different contracts: normalized score with an attached legacy `score.ast`, native Rust parser JSON, or some reduced diagnostic AST. The proposal must define the exact post-cleanup `ast` output shape before implementation starts, otherwise removing `score.ast` can break CLI behavior or accidentally preserve `buildScoreAst` just to keep the command working.

3. MusicXML has a strategy fork but no decision gate. The preferred Rust exporter and fallback TypeScript exporter have very different blast radius, task ordering, test strategy, and deletion guarantees. The proposal allows either, but its acceptance criteria still permit `MusicXML export works through Rust or a NormalizedScore-only TypeScript adapter`. That is too loose for a cleanup whose goal is "completely clear out TS parts." Require a concrete selected path before tasks are written, or define a two-branch plan with separate acceptance criteria and an explicit temporary-debt marker if the fallback is chosen.

4. `src/dsl/logic.ts` deletion is not decomposed enough. `musicxml.ts` imports generic fraction arithmetic, beam/grouping helpers, voice grouping, repeat-content resolution, visual duration, and instrument specs from `logic.ts`. Some of those are pure utility, some are renderer/MusicXML interpretation, and some are old normalizer semantics. The proposal says "move XML formatting helpers" but does not account for these non-formatting helpers. It needs an inventory table that classifies every exported symbol from `logic.ts` as: port to Rust, move to MusicXML-local utility, replace from normalized data, or delete. Without that, implementation can stall on hidden coupling or copy the whole file under a new name.

5. Test migration is described by category, but deletion safety needs a per-file mapping. Current test imports include `parser.test.ts`, `ast.test.ts`, many `spec-c*.test.ts`, `logic.test.ts`, `benchmark.test.ts`, and `normalize_parity.test.ts`. The proposal's risk section says each deleted file must be mapped, but the proposal does not require that mapping as a deliverable before deletion. Add an acceptance criterion requiring a checked-in migration matrix that lists each legacy TS test file and its replacement Rust test, WASM-boundary test, golden fixture, or obsolete-contract rationale.

6. `src/dsl/types.ts` is treated as a stable contract module, but it still contains many legacy parser/AST types: `DocumentSkeleton`, `TrackParagraph`, `ParsedTrackLine`, `ParsedMeasure`, `TokenGlyph`, `MeasureToken`, source-line preprocessing types, and legacy glyph enums. If `types.ts` remains public with those exports, consumers can still compile against the removed DSL surface. The proposal should split the target type surface into `NormalizedScore`/runtime contracts versus legacy parser types, then require removal or archival of the legacy types after `skeleton.ts` and tests migrate.

7. Error handling is too vague for a parser cutover. The proposal says preserve `ParseError` fields or update consumers, but deleting the skeleton adapter may change default header recovery, parser error aggregation, and line/column normalization. The post-cleanup contract should specify whether Rust parser errors are returned as an array, embedded in normalized score, thrown by WASM wrappers, or all three depending on call site. This matters for CLI warnings, UI preview states, and `npm run drummark -- --format ast` behavior.

8. Acceptance criteria rely too much on `rg` patterns that miss public-surface leakage. For example, old types can remain exported without matching `from "./parser"` or `buildScoreAst`, and a renamed `musicxml_logic.ts` could still carry token-resolution semantics. Add negative checks for `DocumentSkeleton`, `TokenGlyph`, `ParsedMeasure`, `parseDocumentSkeletonFromWasm`, and old `ScoreAst` in production exports, plus a positive check that the only `src/dsl/index.ts` exports are the intended normalized contracts.

9. The implementation order has a sequencing risk around golden coverage. It adds MusicXML golden coverage before deciding whether output is generated from legacy TypeScript, NormalizedScore-only TypeScript, or Rust. That is fine as a baseline, but the proposal should require golden generation to be frozen before exporter changes and compared after changes. Otherwise implementation can regenerate goldens after drift and still satisfy "valid MusicXML" without preserving behavior.

10. There is no explicit branch or consolidation target artifact. The proposal says it should consolidate into an architecture note, but does not name the file or append-only section that will receive the final text. Before approval, identify whether this lands in `docs/DRUMMARK_SPEC.md`, `docs/RENDER_LAYOUT_CONTRACT.md`, a new architecture document, or `LEARNINGS.md`/proposal archive only. The repo protocol requires a concrete consolidation target.

Required changes before approval:

- Add a dedicated section for parser AST output and `src/wasm/skeleton.ts`, including the exact post-cleanup `--format ast` JSON contract.
- Choose the MusicXML migration path for this proposal, or split the fallback into a separately scoped temporary proposal with explicit debt and cleanup criteria.
- Add a symbol-level `logic.ts` migration table and a type-level `types.ts` cleanup plan.
- Add a required legacy-test migration matrix as a proposal deliverable before deletion.
- Strengthen acceptance criteria with negative export/type checks and MusicXML golden parity checks, not just "valid XML."
- Name the final architecture/spec document where the approved addendum will be consolidated.

STATUS: CHANGES_REQUESTED

### Author Response

The review is accepted. The initial proposal was directionally correct but left too many compatibility surfaces available. The cleanup goal is not "hide the old TypeScript DSL behind different names"; it is to remove the legacy parser/AST/normalizer contract from production and tests.

The following v1.1 amendments supersede the loose parts of v1.0.

## Addendum v1.1: Required Clarifications

### Parser AST Output and `src/wasm/skeleton.ts`

`src/wasm/skeleton.ts` is a legacy adapter because it converts Rust parser output back into the old TypeScript `DocumentSkeleton` shape. It must not survive as the implementation of `--format ast`.

Post-cleanup rules:

- `src/wasm/skeleton.ts` is deleted, or replaced by a differently named native Rust parser JSON wrapper that does not import legacy parser/AST types from `src/dsl/types.ts`.
- `parseDocumentSkeletonFromWasmSync` is removed from production and test imports.
- `--format ast` outputs the native Rust parser JSON contract exported by parser WASM, not `NormalizedScore` with an attached `score.ast`.
- `--format ir` remains the Rust normalized score JSON.
- `src/cli_runtime.ts` routes `ast` and `ir` separately:
  - `ast`: initialize parser WASM, call Rust parser export, format parser JSON.
  - `ir`: call Rust normalizer export, format normalized JSON.

The post-cleanup `ast` JSON contract is:

```ts
type ParserAstOutput = {
  version: "drummark-parser-ast/v1";
  headers: unknown[];
  paragraphs: unknown[];
  errors: ParseError[];
};
```

The exact inner Rust AST node fields may remain Rust-owned, but the top-level envelope, `version`, and `errors` field are stable CLI/WASM boundary contract. Tests may assert specific inner nodes for supported syntax, but TypeScript production code must not depend on old `DocumentSkeleton`, `ParsedMeasure`, or `TokenGlyph` shapes.

### MusicXML Path Decision

This proposal chooses the preferred path: MusicXML export moves to Rust for the cleanup branch.

Required implementation shape:

- Add a Rust MusicXML exporter in `crates/drummark-core`.
- The exporter consumes the Rust normalized score model, not TypeScript AST or parser skeletons.
- Parser WASM exports a MusicXML function, tentatively `build_music_xml(source: &str) -> String` or `build_music_xml(source: &str) -> JsValue` if structured errors are required.
- TypeScript `buildMusicXml` becomes a thin WASM wrapper during migration and can be deleted or retained only as app/CLI glue.
- A `NormalizedScore`-only TypeScript MusicXML fallback is out of scope for this proposal. If needed, it requires a separate temporary-debt proposal and explicit cleanup criteria.

MusicXML parity must be tested against frozen goldens generated before the exporter swap. Valid XML alone is insufficient.

### `logic.ts` Symbol Migration Table

Every exported `logic.ts` symbol must be handled before deletion:

| Symbol(s) | Classification | Target |
|-----------|----------------|--------|
| `Fraction` re-export | Contract type | Keep only if needed by normalized contract; otherwise move to Rust tests and remove from public TS exports |
| `MAX_EXACT_POWER_OF_TWO_EXPONENT`, `basicTokenExceedsExactDurationRange` | Normalizer semantics | Rust normalizer tests; delete TS export |
| `gcd`, `lcm`, `simplify`, `addFractions`, `subtractFractions`, `multiplyFractions`, `divideFractions`, `multiplyFraction`, `divideFraction`, `fractionFromNumber`, `fractionsEqual`, `compareFractions` | Fraction arithmetic | Rust `fraction` module tests; delete TS export |
| `resolveMeasureRepeatContentMeasure` | Repeat semantics / MusicXML support | Replace from normalized measure repeat data in Rust MusicXML exporter |
| `VoiceId`, `voiceForTrack`, `stemDirectionForVoice` | Normalized/render semantics | Keep voice data in normalized events and layout; Rust MusicXML reads normalized voice |
| `calculateTokenWeightAsFraction` | Duration semantics | Rust event/normalizer tests; delete TS export |
| `groupingSegmentIndex`, `getGroupingBoundaries` | Grouping/layout helper | Rust normalizer/layout as appropriate; MusicXML must not recompute token grouping from old parser data |
| `isBeamable`, `visualDurationForEvent` | Output-duration helper | Rust MusicXML exporter local helper if XML requires it |
| `InstrumentSpec` | Output mapping | Move to Rust MusicXML instrument metadata, or derive from existing Rust track registry |
| `VoiceEventGroup`, `VoiceEntry`, `groupVoiceEvents`, `buildVoiceEntries` | MusicXML event grouping | Port into Rust MusicXML exporter using normalized events |
| `resolveFallbackTrack` | Old token-resolution fallback | Rust resolver tests already own this behavior; delete TS export |

No implementation task may copy `logic.ts` wholesale into another TypeScript filename.

### `types.ts` Cleanup Plan

`src/dsl/types.ts` must stop exposing legacy parser and AST types as public contract.

Keep or move to a runtime contract module:

- `ParseError`
- `TrackName`, `Modifier`, dynamic/nav/barline enums if still used by app/renderers
- `Fraction` only if normalized JSON still uses it
- `NormalizedEvent`
- `NormalizedMeasure`
- `NormalizedHeader`
- `NormalizedTrack`
- `NormalizedScore`
- `RepeatSpan` if still part of normalized output

Remove or archive after test migration:

- `BasicGlyph`
- `TokenGlyph`
- `MeasureToken`
- `PreprocessedLineKind`
- `PreprocessedLine`
- `ParsedMeasure`
- `ParsedTrackLine`
- `ParsedHeaders`
- `TrackParagraph`
- `DocumentSkeleton`
- `ScoreMeasure`
- `ScoreTrackParagraph`
- `ScoreParagraph`
- `ScoreAst`
- `ParsedStartNav`
- `ParsedEndNav`
- parser-only intent types that are not normalized output contracts

If an old type is still needed for a Rust parser AST fixture, it must live in a test-only file and must not be exported from `src/dsl/index.ts`.

### Required Legacy Test Migration Matrix

Before deleting old TS DSL files, the cleanup branch must add a checked-in migration matrix under `docs/parser-cutover/` or `docs/proposals/`, tentatively:

```
docs/proposals/ARCHITECTURE_legacy_ts_dsl_test_migration_matrix.md
```

The matrix must list every TypeScript test file that imports any of:

- `src/dsl/parser.ts`
- `src/dsl/ast.ts`
- `src/dsl/logic.ts`
- `parseDocumentSkeletonFromWasmSync`
- `buildScoreAst`
- `buildNormalizedScoreFromRegex`

Each row must include:

- old test file
- behavior covered
- replacement location: Rust unit test, TypeScript WASM-boundary test, MusicXML golden, CLI test, or deleted obsolete contract
- deletion/update task

No old TS test file may be deleted without a row in this matrix.

### Error Contract

Post-cleanup parser and normalizer errors use one shared app-facing shape:

```ts
type ParseError = {
  line: number;
  column: number;
  message: string;
};
```

Rules:

- Parser AST output includes `errors: ParseError[]`.
- Normalized score output includes `errors: ParseError[]`.
- CLI warnings continue to read from normalized score errors for `ir`, `xml`, and `svg`.
- `--format ast` prints parser errors in the AST envelope and does not require normalized score construction.
- WASM wrapper initialization failures may throw explicit initialization errors; parse/normalization diagnostics should be returned in output objects when Rust can recover.

### Strengthened Acceptance Criteria

The original acceptance criteria remain, with these additions:

- `rg "parseDocumentSkeletonFromWasmSync|DocumentSkeleton|TokenGlyph|ParsedMeasure|ScoreAst" src scripts` has no production hits and no exports from `src/dsl/index.ts`.
- `src/wasm/skeleton.ts` is deleted or replaced by a native parser JSON wrapper with no legacy TypeScript skeleton types.
- `npm run drummark -- docs/examples/full-example.drum --format ast` outputs `version: "drummark-parser-ast/v1"` and does not include `NormalizedScore.ast`.
- MusicXML output is compared against frozen golden fixtures covering title/subtitle/composer, tempo, dotted notes, rests, dynamics, hairpins, repeats, voltas, sticking, ghost/dead/roll modifiers, and multi-rests.
- The legacy TS test migration matrix is checked in and accounts for every old parser/AST/logic/parity/benchmark test file.
- `src/dsl/types.ts` or its replacement exports only normalized runtime contracts and app-supported enums, not old parser skeleton or `ScoreAst` types.
- `src/dsl/index.ts` exports only the approved public API after cleanup.

### Consolidation Target

The approved addendum consolidates into `docs/PARSER_OWNERSHIP.md` as a new append-only section:

```
## Addendum YYYY-MM-DD: Rust/WASM Owns Parser, Normalizer, and DSL Output Contracts
```

That section will supersede the older parser-ownership notes by stating:

- Rust/WASM is the only authoritative parser and normalizer.
- TypeScript does not own parser skeleton, AST, token-resolution, duration, or normalization semantics.
- TypeScript may contain WASM loaders, app adapters, renderer adapters, and output wrappers only when they consume normalized Rust contracts.
- MusicXML is generated from Rust-owned normalized semantics.

### Review Round 2

The v1.1 response resolves the blocking issues from Round 1 at proposal level. The proposal now has concrete deletion targets, a selected MusicXML path, explicit handling for `src/wasm/skeleton.ts`, a post-cleanup `--format ast` envelope, symbol/type cleanup requirements, a mandatory legacy-test migration matrix, strengthened acceptance criteria, and a named consolidation target.

Prior required changes check:

1. Parser AST output and `src/wasm/skeleton.ts`: resolved. The proposal now states that `skeleton.ts` is deleted or replaced by a native parser JSON wrapper, removes `parseDocumentSkeletonFromWasmSync`, and defines `--format ast` as native Rust parser JSON with a stable top-level envelope. The remaining `unknown[]` inner-node shape is acceptable for this architecture proposal because ownership is explicitly Rust-side, but the tasks file should include a focused acceptance test for at least one header, one paragraph, one measure, and one recoverable error so the CLI output is not a meaningless envelope.

2. MusicXML path decision: resolved. The proposal chooses Rust MusicXML and makes the TypeScript fallback out of scope. This removes the largest ambiguity from v1.0. The tasks file should decide whether the WASM export returns `String` plus embedded diagnostics elsewhere or `JsValue` with structured errors before implementation starts, but that is a task design detail rather than a proposal blocker.

3. `logic.ts` migration: resolved. The symbol-level table is specific enough to prevent wholesale copy-forward of the legacy semantic layer. The main implementation risk is `voiceForTrack`/`buildVoiceEntries` parity for MusicXML, so the tasks file should place golden coverage before porting and require explicit before/after comparison.

4. `types.ts` cleanup: resolved. The proposal now distinguishes normalized runtime contracts from legacy parser/AST types and forbids exporting the old shapes through `src/dsl/index.ts`.

5. Legacy test migration matrix: resolved. The proposal makes the matrix a checked-in prerequisite and requires rows for parser, AST, logic, WASM skeleton, regex, and parity consumers. This is the right guard against deleting coverage accidentally.

6. Strengthened acceptance criteria and consolidation target: resolved. The new negative checks catch public-surface leakage better than the original import-only `rg`, and `docs/PARSER_OWNERSHIP.md` is a concrete append-only consolidation target.

Remaining non-blocking cautions for the tasks file:

- The `--format ast` implementation must not build a normalized score as a side effect. Add an explicit task/test that an input with parser errors can still produce the parser AST envelope without invoking normalization-only recovery.
- The MusicXML golden set should include both raw fixture files and expected XML outputs committed before the exporter swap, not only regenerated post-port outputs.
- The test migration matrix should be reviewed before any mass deletion task. Otherwise the matrix can become a retrospective justification rather than a planning control.
- If `docs/PARSER_OWNERSHIP.md` does not already exist when consolidation begins, create it as the architecture target and keep the proposal's final addendum clean, without review-thread text.

No remaining blocker prevents proposal approval. The next step should be a tasks file that preserves these sequencing constraints and passes an independence review before implementation.

STATUS: APPROVED

### Consolidated Changes

The approved architecture cleanup removes the legacy TypeScript DSL pipeline from production and tests. Rust/WASM is the sole owner of parser and normalizer semantics, and MusicXML generation moves to Rust so output semantics are derived from the same normalized Rust model used by rendering.

Post-cleanup `--format ast` uses a native Rust parser AST WASM export with top-level envelope `version: "drummark-parser-ast/v1"` and `errors: ParseError[]`. It does not depend on `NormalizedScore.ast`, `src/wasm/skeleton.ts`, or old TypeScript `DocumentSkeleton` types.

The legacy compatibility files are deletion targets:

- `src/dsl/parser.ts`
- `src/dsl/ast.ts`
- `src/dsl/logic.ts`
- `src/wasm/skeleton.ts`

The TypeScript DSL public surface is reduced to normalized runtime contract types and WASM-backed wrapper functions. `NormalizedScore.ast`, `buildScoreAst`, `parseDocumentSkeleton`, `parseDocumentSkeletonFromWasmSync`, and regex-backed normalizer/parity exports are removed.

MusicXML export is implemented in Rust and exposed through WASM as a structured source-based contract:

```ts
type MusicXmlOutput = {
  xml: string;
  errors: ParseError[];
};
```

TypeScript `buildMusicXml` becomes app/CLI glue over this Rust export. It does not import old parser, AST, or logic helpers.

Before deleting legacy tests, the branch must add a checked-in migration matrix mapping every old parser/AST/logic/parity/benchmark test to Rust unit tests, TypeScript WASM-boundary tests, CLI tests, MusicXML goldens, or an explicit obsolete-contract deletion rationale. MusicXML output must be protected by frozen golden fixtures generated before the Rust exporter swap and compared after the migration.

The implementation sequence is:

1. Consolidate this approved architecture into `docs/PARSER_OWNERSHIP.md`.
2. Work on a dedicated `proposal/remove-legacy-ts-dsl` branch.
3. Freeze migration inventory and MusicXML goldens.
4. Add native Rust parser AST CLI/WASM contract.
5. Port MusicXML export to Rust.
6. Migrate logic, parser/AST, normalized semantics, parity, and benchmark tests.
7. Remove `score.ast`, legacy type exports, and old TypeScript DSL files.
8. Run full JS, Rust, CLI, and MusicXML verification.
9. Perform one concentrated pre-merge branch review, squash-merge to `main`, then archive proposal artifacts.
