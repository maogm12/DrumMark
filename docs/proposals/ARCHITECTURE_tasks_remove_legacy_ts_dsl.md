## Tasks: Remove Legacy TypeScript DSL Pipeline

### Task 1: Inventory Legacy Surfaces and Freeze Migration Matrix
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/ARCHITECTURE_legacy_ts_dsl_test_migration_matrix.md`, import audits, test inventory
- **Input/Output Contract**:
  - Input: current repository imports and tests referencing legacy DSL files or types.
  - Output: checked-in migration matrix mapping every legacy test/import to a replacement, update, or obsolete-contract deletion rationale.
- **Commits**:
  - `docs(architecture): map legacy ts dsl migration coverage`
- **Acceptance Criteria**:
  - Matrix lists every test importing `parser.ts`, `ast.ts`, `logic.ts`, `parseDocumentSkeletonFromWasmSync`, `buildScoreAst`, or `buildNormalizedScoreFromRegex`.
  - Matrix lists every production import of `parser.ts`, `ast.ts`, `logic.ts`, `skeleton.ts`, old parser skeleton types, and old `ScoreAst` types.
  - Each row has behavior covered, replacement location, owning task, and deletion/update disposition.
  - No code deletion is performed in this task.
  - The matrix can be reviewed independently before implementation deletes legacy files.
- **Dependencies**: None

### Task 2: Define Native Parser AST WASM and CLI Contract
- [x] **Status**: Done
- **Scope**: `crates/drummark-core` parser WASM export, `src/wasm/parser_runtime.ts`, parser node/browser wrappers, `src/cli_runtime.ts`, CLI AST tests
- **Input/Output Contract**:
  - Input: source text and Rust parser diagnostics.
  - Output: `ParserAstOutput` JSON with `version: "drummark-parser-ast/v1"`, native Rust parser AST payload, and `errors: ParseError[]`.
- **Commits**:
  - `feat(parser): expose native parser ast json through wasm`
  - `fix(cli): route ast output to parser ast export`
- **Acceptance Criteria**:
  - `--format ast` calls parser AST export directly and does not build a normalized score.
  - `npm run drummark -- docs/examples/full-example.drum --format ast` outputs `version: "drummark-parser-ast/v1"`.
  - A parser-error fixture can produce an AST envelope with `errors` without invoking normalization-only recovery.
  - Tests assert one header, one paragraph, one measure, and one recoverable error in native AST output.
  - `src/wasm/skeleton.ts` is not used by CLI AST output after this task.
- **Dependencies**: Task 1

### Task 3: Freeze MusicXML Golden Corpus
- [x] **Status**: Done
- **Scope**: MusicXML fixture inputs, expected XML goldens, golden comparison test/script
- **Input/Output Contract**:
  - Input: current TypeScript MusicXML exporter output for representative fixtures.
  - Output: committed fixture inputs and expected XML goldens used as parity baseline before the Rust exporter swap.
- **Commits**:
  - `test(musicxml): freeze legacy exporter golden corpus`
- **Acceptance Criteria**:
  - Goldens cover title/subtitle/composer, tempo, dotted notes, rests, dynamics, hairpins, repeats, voltas, sticking, ghost/dead/roll modifiers, and multi-rests.
  - Golden generation happens before the Rust MusicXML exporter replaces the TypeScript implementation.
  - A comparison test fails on output drift and does not regenerate goldens during normal test runs.
  - `npm run drummark -- docs/examples/musicxml.drum --format xml` is included in the baseline.
- **Dependencies**: Task 1

### Task 4: Port MusicXML Export to Rust
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-core` MusicXML module, parser WASM exports, TypeScript `buildMusicXml` wrapper
- **Input/Output Contract**:
  - Input: source text parsed and normalized by Rust.
  - Output: MusicXML string generated from Rust-owned normalized semantics.
- **Commits**:
  - `feat(musicxml): generate musicxml from rust normalized score`
  - `feat(wasm): expose rust musicxml export`
- **Acceptance Criteria**:
  - Rust exporter consumes normalized Rust score data, not TypeScript parser/AST structures.
  - WASM exposes a MusicXML export used by CLI/app TypeScript glue.
  - Frozen MusicXML goldens from Task 3 pass or intentional differences are documented and approved in the matrix.
  - Dotted-note XML output remains covered by golden or focused tests.
  - TypeScript `musicxml.ts` no longer imports `src/dsl/logic.ts`, `src/dsl/ast.ts`, or `src/dsl/parser.ts`.
- **Dependencies**: Task 3

### Task 5: Remove `score.ast` and Legacy Type Exports
- [ ] **Status**: Pending
- **Scope**: `src/dsl/normalize.ts`, `src/dsl/types.ts`, `src/dsl/index.ts`, app/renderer/CLI type imports
- **Input/Output Contract**:
  - Input: Rust normalized score JSON.
  - Output: TypeScript runtime contract types containing normalized score data only, with no attached legacy `ScoreAst`.
- **Commits**:
  - `refactor(dsl): remove legacy ast from normalized score contract`
  - `refactor(dsl): restrict public exports to normalized contracts`
- **Acceptance Criteria**:
  - `src/dsl/normalize.ts` does not import `buildScoreAst` and does not attach `score.ast`.
  - `src/dsl/index.ts` exports only approved normalized contract types and WASM-backed functions.
  - `DocumentSkeleton`, `TokenGlyph`, `ParsedMeasure`, `ScoreAst`, and parser-only types are not exported from production `src/dsl` modules.
  - Existing app, renderer, and CLI production code compile without legacy parser/AST types.
  - `npm run build` passes.
- **Dependencies**: Tasks 2, 4

### Task 6: Migrate Legacy Parser, AST, Logic, and Parity Tests
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-core` tests, TypeScript WASM-boundary tests, deleted/updated `src/dsl/*.test.ts`
- **Input/Output Contract**:
  - Input: migration matrix rows from Task 1 and current legacy TypeScript tests.
  - Output: Rust unit tests, TypeScript WASM-boundary tests, CLI tests, or documented obsolete-contract deletions matching every matrix row.
- **Commits**:
  - `test(core): move legacy dsl semantics to rust tests`
  - `test(wasm): replace legacy parser ast tests with wasm contract tests`
  - `test(dsl): remove obsolete regex and parity tests`
- **Acceptance Criteria**:
  - Every matrix row is marked replaced, updated, or obsolete with a concrete commit/task reference.
  - Fraction, token resolution, duration, repeat, navigation, volta, hairpin, dynamics, and validation semantics have Rust or WASM-boundary coverage.
  - `normalize_parity.test.ts` and regex parser benchmark tests are deleted or replaced according to the matrix.
  - No TypeScript test imports `parser.ts`, `ast.ts`, `logic.ts`, `buildScoreAst`, `parseDocumentSkeleton`, `parseDocumentSkeletonFromWasmSync`, or `buildNormalizedScoreFromRegex`.
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
- **Dependencies**: Tasks 2, 5

### Task 7: Delete Legacy TypeScript DSL Files and Skeleton Adapter
- [ ] **Status**: Pending
- **Scope**: `src/dsl/parser.ts`, `src/dsl/ast.ts`, `src/dsl/logic.ts`, `src/wasm/skeleton.ts`, stale exports/imports
- **Input/Output Contract**:
  - Input: codebase after MusicXML, CLI AST, type, and test migration.
  - Output: repository with legacy TypeScript parser/AST/logic files removed and no production/test import leaks.
- **Commits**:
  - `refactor(dsl): delete legacy typescript parser ast and logic`
- **Acceptance Criteria**:
  - Legacy files are deleted or, for any intentionally retained file, renamed and scoped to non-semantic output glue with reviewer-approved rationale.
  - `rg "parseDocumentSkeletonFromWasmSync|DocumentSkeleton|TokenGlyph|ParsedMeasure|ScoreAst|buildScoreAst|buildNormalizedScoreFromRegex" src scripts` has no production hits.
  - `rg "from \"./parser\"|from \"./ast\"|from \"./logic\"" src scripts` has no hits.
  - `npm run build` passes.
  - `npm test` passes.
- **Dependencies**: Tasks 4, 5, 6

### Task 8: Full Verification Gate
- [ ] **Status**: Pending
- **Scope**: JS tests, Rust tests, CLI examples, MusicXML goldens, parser/layout sanity
- **Input/Output Contract**:
  - Input: cleaned codebase without legacy TS DSL files.
  - Output: recorded passing verification set for branch review.
- **Commits**:
  - `test(architecture): verify rust-owned dsl cleanup`
- **Acceptance Criteria**:
  - `npm run build` passes.
  - `npm test` passes.
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
  - `cargo test --manifest-path crates/drummark-layout/Cargo.toml` passes.
  - `npm run drummark -- docs/examples/full-example.drum --format ast` passes and outputs parser AST envelope.
  - `npm run drummark -- docs/examples/full-example.drum --format ir` passes.
  - `npm run drummark -- docs/examples/full-example.drum --format svg` passes.
  - `npm run drummark -- docs/examples/musicxml.drum --format xml` passes and matches frozen MusicXML expectations.
- **Dependencies**: Task 7

### Task 9: Consolidate Proposal Into Parser Ownership Docs
- [ ] **Status**: Pending
- **Scope**: proposal file, `docs/PARSER_OWNERSHIP.md`, active proposal/task archival after merge
- **Input/Output Contract**:
  - Input: approved proposal, approved tasks file, and user stamp.
  - Output: append-only consolidation in proposal and clean architecture addendum in `docs/PARSER_OWNERSHIP.md`.
- **Commits**:
  - `docs(architecture): consolidate rust-owned dsl contracts`
- **Acceptance Criteria**:
  - Proposal file receives appended `### Consolidated Changes` after user stamp.
  - `docs/PARSER_OWNERSHIP.md` receives clean append-only addendum titled `## Addendum YYYY-MM-DD: Rust/WASM Owns Parser, Normalizer, and DSL Output Contracts`.
  - Consolidated addendum contains no review-thread noise.
  - Proposal and tasks files remain active until implementation branch passes pre-merge review.
  - After reviewed merge, proposal and tasks files move to `docs/archived/`.
- **Dependencies**: Approval of this tasks file and explicit user stamp before implementation.

### Review Round 1

The task file is directionally strong, but it is not yet protocol-safe or implementation-safe. It covers most proposal requirements, but the sequencing currently violates the repo's own proposal workflow and a few tasks still hide coupling behind broad labels.

1. Consolidation is in the wrong position. The repo protocol requires that after the proposal and tasks file are approved and the user gives the final stamp, the proposal receives `### Consolidated Changes` and the clean addendum is appended to the target spec/architecture document before implementation begins. This tasks file puts consolidation at Task 9 after full verification. That means Tasks 1-8 would implement before the required consolidation. Make consolidation the first post-stamp task, or split Task 9 into:
   - an early "Consolidate Approved Proposal" task that depends only on tasks-file approval and user stamp;
   - a final "Archive Proposal Artifacts After Merge" task that runs after branch review and merge.

2. The branch/pre-merge workflow is not represented as an actionable task. The proposal protocol requires implementation on a dedicated branch, one concentrated pre-merge review, squash merge into `main`, then archival. The tasks file mentions archival inside Task 9, but it does not include branch creation/use, pre-merge review, review-fix loop, or squash merge as acceptance criteria. Add explicit workflow tasks or acceptance criteria so implementation does not happen directly on `main`.

3. Task 4 leaves the MusicXML WASM error/output contract unresolved. The approved proposal allowed `String` or `JsValue` as a tentative note, but the task file is supposed to turn the proposal into implementable work. `build_music_xml(source)` must have an explicit return shape before coding starts: either string-only with parse/normalization diagnostics handled by separate normalized-score calls, or a structured object such as `{ xml, errors }`. This affects CLI warnings, app glue, test assertions, and whether MusicXML can report recoverable diagnostics without double-normalizing.

4. Task 4's input contract conflicts with current TypeScript call sites and needs a migration boundary. The current CLI calls `buildMusicXml(score)`, while Task 4 says the Rust exporter input is source text. If the TypeScript wrapper changes from score-in to source-in, Task 4 must explicitly update `src/cli_runtime.ts` and app callers. If the wrapper remains score-in, the Rust export must accept normalized JSON or expose an internal Rust normalized-score exporter. Pick one contract in the tasks file.

5. Task 5 before Task 6 is a hidden test coupling risk. Task 5 removes legacy types from `src/dsl/types.ts`; Task 6 later migrates tests that likely still import those types or legacy builders. `npm run build` may pass if tests are excluded, but the repository is not in a reviewable state until test migration catches up. Either move type export removal after test migration, or split Task 5 into production-only `score.ast` removal and a later legacy type deletion after Task 6.

6. Task 6 is too large to satisfy the Task Independence Rule. It groups parser, AST, logic, parity, benchmark, Rust semantic tests, WASM-boundary tests, CLI tests, and deletions into one task. That is exactly the kind of coupled bucket the protocol warns against. Split it into independently testable tasks, for example:
   - migrate parser/AST CLI/WASM contract tests;
   - migrate logic/fraction/duration semantics to Rust tests;
   - migrate repeats/navigation/volta/hairpin/dynamics validation coverage;
   - remove parity/benchmark tests after replacement rows are marked.
   Each should have a clear input/output contract and isolated verification.

7. Task 1's migration matrix acceptance criteria are good but incomplete for `logic.ts` symbols. The proposal added a symbol-level `logic.ts` table; the tasks should require Task 1 or a dedicated task to audit current exported symbols against that table and record the target per symbol. Otherwise Task 4/6 can miss helpers such as `buildVoiceEntries`, `visualDurationForEvent`, or `resolveMeasureRepeatContentMeasure`.

8. Task 3's MusicXML corpus does not name fixture locations or freeze mechanics. It should specify where raw inputs and expected XML live, and whether the test compares exact XML strings, normalized XML, or parsed XML. Without that, "intentional differences are documented and approved in the matrix" in Task 4 is too loose and can turn golden parity into regenerate-and-rationalize.

9. Task 7 acceptance permits "any intentionally retained file" renamed and scoped to non-semantic output glue. That is too permissive for this proposal unless it names allowable retained files. The approved proposal allowed TypeScript wrappers only when they consume Rust contracts. Tighten this to: `parser.ts`, `ast.ts`, `logic.ts`, and `skeleton.ts` are deleted; any retained replacement must be a new wrapper file named in the task and must not export legacy parser/AST/logic types.

10. Verification misses `npm run typecheck:test`, which was already important during the Rust normalizer cutover. Since this cleanup deletes TypeScript test surfaces, the final gate should include test typechecking explicitly if that script remains part of the repo's validation set.

11. The tasks file does not include the required user-stamp pause clearly enough. It lists Task 9 dependency as approval plus stamp, but the current ordering implies implementation could proceed through Task 8 first. Add a clear pre-implementation gate: after tasks approval, present approved proposal/tasks to the user and wait for explicit stamp before any implementation branch work.

Required changes before approval:

- Reorder consolidation to happen immediately after tasks-file approval and user stamp, before implementation tasks.
- Add explicit dedicated branch, pre-merge review, squash merge, and archival workflow coverage.
- Make the MusicXML WASM wrapper contract concrete, including whether `buildMusicXml` accepts source or normalized score and how diagnostics are surfaced.
- Split or reorder Task 5/Task 6 so legacy type deletion does not precede test migration that still depends on those types.
- Split Task 6 into smaller independently testable migration tasks.
- Add `logic.ts` symbol-audit coverage to the matrix/work plan.
- Tighten MusicXML golden fixture locations/comparison mechanics and delete-file acceptance criteria.
- Add the explicit user-stamp gate before implementation.

STATUS: CHANGES_REQUESTED

### Author Response

The review is accepted. The v1.0 task order put consolidation too late and made the test/type cleanup too broad. The task plan below supersedes the original task order. Implementation must follow the v1.1 tasks after this tasks file is approved and the user gives an explicit stamp.

## Tasks v1.1: Remove Legacy TypeScript DSL Pipeline

### Task 0: Pre-Implementation Stamp and Consolidation
- [x] **Status**: Done
- **Scope**: proposal file, `docs/PARSER_OWNERSHIP.md`
- **Input/Output Contract**:
  - Input: approved proposal, approved tasks file, explicit user stamp.
  - Output: append-only proposal consolidation and clean parser-ownership addendum before implementation begins.
- **Commits**:
  - `docs(architecture): consolidate rust-owned dsl contracts`
- **Acceptance Criteria**:
  - Stop after tasks approval and present approved proposal/tasks to the user.
  - Do not start implementation until the user explicitly stamps the approved proposal and tasks.
  - Proposal file receives appended `### Consolidated Changes`.
  - `docs/PARSER_OWNERSHIP.md` receives a clean append-only addendum titled `## Addendum YYYY-MM-DD: Rust/WASM Owns Parser, Normalizer, and DSL Output Contracts`.
  - Consolidated addendum contains no review-thread text.
- **Dependencies**: Proposal approval, tasks-file approval, explicit user stamp

### Task 1: Create Implementation Branch and Freeze Migration Inventory
- [x] **Status**: Done
- **Scope**: git branch, `docs/proposals/ARCHITECTURE_legacy_ts_dsl_test_migration_matrix.md`, import audits
- **Input/Output Contract**:
  - Input: main branch after Task 0 consolidation.
  - Output: dedicated implementation branch plus checked-in migration matrix.
- **Commits**:
  - `docs(architecture): map legacy ts dsl migration coverage`
- **Acceptance Criteria**:
  - Work happens on a dedicated branch, preferably `proposal/remove-legacy-ts-dsl`.
  - Matrix lists every test importing `parser.ts`, `ast.ts`, `logic.ts`, `parseDocumentSkeletonFromWasmSync`, `buildScoreAst`, or `buildNormalizedScoreFromRegex`.
  - Matrix lists every production import of `parser.ts`, `ast.ts`, `logic.ts`, `skeleton.ts`, old parser skeleton types, and old `ScoreAst` types.
  - Matrix includes a `logic.ts` symbol audit row for every exported symbol named in the proposal's symbol table.
  - Each row has behavior covered, replacement location, owning task, and deletion/update disposition.
  - No legacy file deletion is performed in this task.
- **Dependencies**: Task 0

### Task 2: Define Native Parser AST WASM and CLI Contract
- [x] **Status**: Done
- **Scope**: `crates/drummark-core` parser WASM export, parser wrappers, `src/cli_runtime.ts`, CLI AST tests
- **Input/Output Contract**:
  - Input: source text and Rust parser diagnostics.
  - Output: `ParserAstOutput` JSON with `version: "drummark-parser-ast/v1"`, native Rust parser AST payload, and `errors: ParseError[]`.
- **Commits**:
  - `feat(parser): expose native parser ast json through wasm`
  - `fix(cli): route ast output to parser ast export`
- **Acceptance Criteria**:
  - `--format ast` calls parser AST export directly and does not build a normalized score.
  - `npm run drummark -- docs/examples/full-example.drum --format ast` outputs `version: "drummark-parser-ast/v1"`.
  - A parser-error fixture can produce an AST envelope with `errors` without invoking normalization-only recovery.
  - Tests assert one header, one paragraph, one measure, and one recoverable error in native AST output.
  - `src/wasm/skeleton.ts` is not used by CLI AST output after this task.
- **Dependencies**: Task 1

### Task 3: Freeze MusicXML Golden Corpus
- [x] **Status**: Done
- **Scope**: `docs/musicxml-corpus/inputs/`, `docs/musicxml-corpus/goldens/`, comparison script/test
- **Input/Output Contract**:
  - Input: current TypeScript MusicXML exporter output for representative fixtures.
  - Output: committed fixture inputs and expected XML goldens used as parity baseline before the Rust exporter swap.
- **Commits**:
  - `test(musicxml): freeze legacy exporter golden corpus`
- **Acceptance Criteria**:
  - Raw fixture inputs live under `docs/musicxml-corpus/inputs/`.
  - Expected XML outputs live under `docs/musicxml-corpus/goldens/`.
  - Comparison uses normalized XML serialization so irrelevant whitespace does not cause failures.
  - Goldens cover title/subtitle/composer, tempo, dotted notes, rests, dynamics, hairpins, repeats, voltas, sticking, ghost/dead/roll modifiers, and multi-rests.
  - Golden generation happens before the Rust MusicXML exporter replaces the TypeScript implementation.
  - Normal test runs compare against goldens and do not regenerate them.
  - `npm run drummark -- docs/examples/musicxml.drum --format xml` is included in the baseline.
- **Dependencies**: Task 1

### Task 4: Port MusicXML Export to Rust With Concrete WASM Contract
- [x] **Status**: Done
- **Scope**: `crates/drummark-core` MusicXML module, parser WASM exports, `src/dsl/musicxml.ts`, app/CLI XML callers
- **Input/Output Contract**:
  - Input: source text.
  - Output: `MusicXmlOutput = { xml: string; errors: ParseError[] }` returned from Rust WASM through TypeScript glue.
- **Commits**:
  - `feat(musicxml): generate musicxml from rust normalized score`
  - `feat(wasm): expose structured rust musicxml export`
  - `fix(cli): build musicxml from source through rust wasm`
- **Acceptance Criteria**:
  - Rust exporter consumes Rust normalized score data internally.
  - WASM export accepts source text and returns `{ xml, errors }`.
  - TypeScript `buildMusicXml` wrapper accepts source text after this task; app and CLI XML callers are updated in the same task.
  - CLI XML warnings use `MusicXmlOutput.errors` without requiring a separate normalization pass solely for warnings.
  - Frozen MusicXML goldens from Task 3 pass, or intentional differences are documented in the migration matrix with explicit approval.
  - Dotted-note XML output remains covered by golden or focused tests.
  - TypeScript `musicxml.ts` no longer imports `src/dsl/logic.ts`, `src/dsl/ast.ts`, or `src/dsl/parser.ts`.
- **Dependencies**: Task 3

### Task 5: Migrate Logic and Duration Semantics to Rust Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-core` tests for fraction, duration, token resolution, voice assignment, grouping helpers
- **Input/Output Contract**:
  - Input: matrix rows and old `logic.test.ts` / logic-dependent spec behavior.
  - Output: Rust tests covering logic semantics without TypeScript helper imports.
- **Commits**:
  - `test(core): cover legacy logic semantics in rust`
- **Acceptance Criteria**:
  - Fraction arithmetic and exact-duration overflow behavior are covered in Rust.
  - Token weight, dotted/halved/star duration behavior, fallback track resolution, and voice assignment are covered in Rust.
  - Matrix rows for `logic.ts` symbols are updated with Rust replacement locations or deletion rationale.
  - This task does not delete `logic.ts`; it only adds replacement coverage and updates tests that can move independently.
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
- **Dependencies**: Task 1

### Task 6: Migrate Parser and AST Boundary Tests
- [x] **Status**: Done
- **Scope**: TypeScript WASM-boundary tests, CLI AST tests, old `parser.test.ts`, `ast.test.ts`, parser/AST spec files
- **Input/Output Contract**:
  - Input: matrix rows for parser/AST tests and native parser AST contract from Task 2.
  - Output: tests that assert Rust parser AST/WASM boundary behavior without old `parser.ts`, `ast.ts`, or `skeleton.ts` imports.
- **Commits**:
  - `test(wasm): replace legacy parser ast tests with native ast contract`
- **Acceptance Criteria**:
  - Parser/AST test rows are updated to Rust unit tests, WASM-boundary tests, CLI tests, or obsolete-contract deletion rationale.
  - No migrated test imports `parseDocumentSkeleton`, `buildScoreAst`, or `parseDocumentSkeletonFromWasmSync`.
  - `--format ast` tests cover success and recoverable parser diagnostics.
  - This task does not remove legacy type exports globally; it only migrates tests off them.
  - `npm run typecheck:test` passes.
- **Dependencies**: Task 2

### Task 7: Migrate Repeats, Navigation, Volta, Hairpin, Dynamics, and Validation Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-core` semantic tests, TypeScript WASM-boundary tests for normalized output
- **Input/Output Contract**:
  - Input: matrix rows for higher-level normalized behavior tests.
  - Output: Rust or WASM-boundary tests asserting current normalized contracts.
- **Commits**:
  - `test(core): cover legacy normalized dsl semantics in rust`
  - `test(wasm): assert normalized output contract at boundary`
- **Acceptance Criteria**:
  - Repeat barlines, inline repeats, measure repeats, multi-rests, navigation markers, voltas, hairpins, dynamics, modifier legality, and validation diagnostics are covered.
  - Tests assert current Rust normalized shapes, not old TypeScript AST shapes.
  - Matrix rows for covered spec files are updated with replacement locations.
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
  - Relevant TypeScript WASM-boundary tests pass.
- **Dependencies**: Tasks 1, 2

### Task 8: Remove Obsolete Parity and Benchmark Tests
- [x] **Status**: Done
- **Scope**: `src/dsl/normalize_parity.test.ts`, `src/dsl/benchmark.test.ts`, matrix rows
- **Input/Output Contract**:
  - Input: completed replacement coverage from Tasks 5-7.
  - Output: obsolete parity/benchmark tests removed with matrix rationale.
- **Commits**:
  - `test(dsl): remove obsolete ts parser parity tests`
- **Acceptance Criteria**:
  - `normalize_parity.test.ts` is deleted or replaced by Rust/WASM fixture contract tests.
  - Regex parser benchmark tests are deleted or moved to Rust benchmark infrastructure if still desired.
  - Matrix rows explicitly mark these old tests as obsolete-contract deletion or replaced coverage.
  - No semantic coverage is removed without a matrix row.
- **Dependencies**: Tasks 5, 6, 7

### Task 9: Remove `score.ast` From Production Contract
- [x] **Status**: Done
- **Scope**: `src/dsl/normalize.ts`, `src/dsl/types.ts`, consumers of `NormalizedScore`
- **Input/Output Contract**:
  - Input: Rust normalized score JSON.
  - Output: normalized TypeScript contract without attached legacy `ScoreAst`.
- **Commits**:
  - `refactor(dsl): remove legacy ast from normalized score contract`
- **Acceptance Criteria**:
  - `src/dsl/normalize.ts` does not import `buildScoreAst` and does not attach `score.ast`.
  - `NormalizedScore` type no longer includes legacy `ast`.
  - Production consumers compile without `score.ast`.
  - Tests migrated in Tasks 6-8 do not rely on `score.ast`.
  - `npm run build` and `npm run typecheck:test` pass.
- **Dependencies**: Tasks 4, 6, 7, 8

### Task 10: Delete Legacy Type Exports and Public DSL Surface
- [x] **Status**: Done
- **Scope**: `src/dsl/types.ts`, `src/dsl/index.ts`, production/test imports
- **Input/Output Contract**:
  - Input: tests and production code no longer depending on legacy parser/AST types.
  - Output: public TypeScript DSL surface containing normalized runtime contracts only.
- **Commits**:
  - `refactor(dsl): remove legacy parser ast type exports`
- **Acceptance Criteria**:
  - `src/dsl/index.ts` exports only approved normalized contract types and WASM-backed functions.
  - `DocumentSkeleton`, `TokenGlyph`, `ParsedMeasure`, `ScoreAst`, and parser-only types are not exported from production `src/dsl` modules.
  - Any test-only fixture type lives in a test-only file and is not exported from `src/dsl/index.ts`.
  - `npm run build` and `npm run typecheck:test` pass.
- **Dependencies**: Task 9

### Task 11: Delete Legacy TypeScript DSL Files and Skeleton Adapter
- [x] **Status**: Done
- **Scope**: `src/dsl/parser.ts`, `src/dsl/ast.ts`, `src/dsl/logic.ts`, `src/wasm/skeleton.ts`
- **Input/Output Contract**:
  - Input: codebase after MusicXML, CLI AST, type, and test migration.
  - Output: repository with legacy TypeScript parser/AST/logic files removed and no import leaks.
- **Commits**:
  - `refactor(dsl): delete legacy typescript parser ast and logic`
- **Acceptance Criteria**:
  - `src/dsl/parser.ts`, `src/dsl/ast.ts`, `src/dsl/logic.ts`, and `src/wasm/skeleton.ts` are deleted.
  - Any replacement wrapper is explicitly named in its task, consumes Rust contracts only, and does not export legacy parser/AST/logic types.
  - `rg "parseDocumentSkeletonFromWasmSync|DocumentSkeleton|TokenGlyph|ParsedMeasure|ScoreAst|buildScoreAst|buildNormalizedScoreFromRegex" src scripts` has no production hits.
  - `rg "from \"./parser\"|from \"./ast\"|from \"./logic\"" src scripts` has no hits.
  - `npm run build`, `npm run typecheck:test`, and `npm test` pass.
- **Dependencies**: Tasks 4, 9, 10

### Task 12: Full Verification Gate
- [x] **Status**: Done
- **Scope**: JS tests, Rust tests, CLI examples, MusicXML goldens, parser/layout sanity
- **Input/Output Contract**:
  - Input: cleaned implementation branch without legacy TS DSL files.
  - Output: recorded passing verification set for branch review.
- **Commits**:
  - `test(architecture): verify rust-owned dsl cleanup`
- **Acceptance Criteria**:
  - `npm run build` passes.
  - `npm run typecheck:test` passes.
  - `npm test` passes.
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes.
  - `cargo test --manifest-path crates/drummark-layout/Cargo.toml` passes.
  - `npm run drummark -- docs/examples/full-example.drum --format ast` passes and outputs parser AST envelope.
  - `npm run drummark -- docs/examples/full-example.drum --format ir` passes.
  - `npm run drummark -- docs/examples/full-example.drum --format svg` passes.
  - `npm run drummark -- docs/examples/musicxml.drum --format xml` passes and matches frozen MusicXML expectations.
- **Dependencies**: Task 11

### Task 13: Pre-Merge Review, Squash Merge, and Archive
- [ ] **Status**: Pending
- **Scope**: implementation branch review, merge to `main`, proposal/task archival
- **Input/Output Contract**:
  - Input: implementation branch passing Task 12 verification.
  - Output: reviewed branch squash-merged to `main`, proposal artifacts archived.
- **Commits**:
  - `chore(architecture): archive completed ts dsl cleanup proposal`
- **Acceptance Criteria**:
  - A sub-agent reviews the full implementation branch against approved proposal and tasks.
  - Review findings are fixed on the implementation branch before merge.
  - Branch is squash-merged into `main` after review approval.
  - Proposal content is verified present in `docs/PARSER_OWNERSHIP.md`.
  - Proposal and tasks files move to `docs/archived/` after merge.
- **Dependencies**: Task 12

### Review Round 2

The v1.1 task plan resolves the blockers from Round 1 and now matches the approved proposal closely enough to approve.

Prior blocker check:

1. Stamp and consolidation ordering: resolved. Task 0 is now a pre-implementation gate that requires approved proposal/tasks plus explicit user stamp, then appends `### Consolidated Changes` and the clean `docs/PARSER_OWNERSHIP.md` addendum before implementation starts.

2. Branch and merge workflow: resolved. Task 1 requires a dedicated implementation branch, and Task 13 covers full-branch review, fixes before merge, squash merge to `main`, verification of consolidation, and archival.

3. MusicXML WASM contract: resolved. Task 4 now chooses a concrete source-text input and `MusicXmlOutput = { xml: string; errors: ParseError[] }` output, updates TypeScript callers in the same task, and prevents a separate normalization pass solely for CLI warnings.

4. Task 5/6 hidden coupling: resolved. The old broad type/test cleanup is split so replacement coverage comes first, `score.ast` removal happens after test migration, public type export deletion follows that, and physical file deletion comes last.

5. Task 6 size and independence: resolved. The old monolithic migration task is split into logic/duration Rust tests, parser/AST boundary tests, higher-level normalized behavior tests, obsolete parity/benchmark removal, `score.ast` removal, type export cleanup, and final file deletion. Each has a clearer input/output contract and local verification.

6. `logic.ts` symbol audit: resolved. Task 1 requires symbol-audit rows for every exported symbol named in the proposal table, and Task 5 updates those rows with Rust replacements or deletion rationale.

7. MusicXML golden mechanics: resolved. Task 3 names fixture and golden directories, requires normalized XML comparison, and forbids regeneration during normal tests.

8. Delete-file criteria: resolved. Task 11 explicitly deletes `parser.ts`, `ast.ts`, `logic.ts`, and `skeleton.ts`, and only allows separately named replacement wrappers that consume Rust contracts and do not export legacy semantics.

9. Verification coverage: resolved. `npm run typecheck:test` is included in relevant intermediate tasks and in the final verification gate.

Task independence check:

- Task 1 produces the migration matrix without deleting legacy files, so it is reviewable on its own.
- Task 2 produces a parser AST boundary that downstream tasks can consume without requiring MusicXML or type deletion.
- Task 3 freezes MusicXML behavior before Task 4 changes the exporter.
- Task 4 is large but has a single coherent contract: source text to structured MusicXML output through Rust/WASM. Its dependency on Task 3 is appropriate.
- Tasks 5-8 divide test migration by semantic domain and are independently verifiable against either Rust tests, WASM-boundary tests, or matrix updates.
- Tasks 9-11 correctly handle removal in increasing destructiveness: remove `score.ast`, then restrict public types, then delete files.
- Task 12 and Task 13 cover final verification and project workflow rather than hiding implementation work.

Non-blocking cautions for implementation:

- Task 4 should update any app/UI XML export caller, not only CLI, in the same commit set that changes `buildMusicXml` from score input to source input.
- Task 1's matrix should be treated as a living control document during Tasks 5-8, but rows should not be rewritten to obscure originally identified coverage.
- Task 13's archival commit may naturally happen on `main` after the squash merge; that is consistent with the protocol as long as proposal/task files remain active until the reviewed implementation has landed.

No remaining blocker prevents tasks-file approval.

STATUS: APPROVED
