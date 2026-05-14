### Task 1: Close Rust Parser Cutover Blockers
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/src/parser.rs`, `crates/drummark-core/src/lexer.rs`, Rust parser tests, JS/WASM regression fixtures
- **Commits**:
  - `fix(parser): reject malformed paragraph note overrides`
  - `fix(parser): emit explicit errors for malformed headers`
  - `fix(parser): preserve signed inline repeat counts for validation`
  - `test(parser): add cutover regression fixtures for malformed forms`
- **Acceptance Criteria**:
  - Bare `note` at paragraph start is rejected with a parse error; it is not converted into `note 4/4`
  - `note 1/16` inside an already-started paragraph is rejected per paragraph-placement rules
  - `time 4`, `tempo fast`, `grouping 3+`, and analogous malformed headers produce parse errors instead of silently disappearing
  - `*-1` and `*0` survive parsing with their sign/count intact so validation rejects them explicitly
  - `cargo test --manifest-path crates/drummark-core/Cargo.toml` passes
  - `npm run drummark -- <fixture> --format ast` and `--format ir` confirm the expected failures/successes for the new regression fixtures
- **Dependencies**: None

### Task 2: Replace Lezer-Oracular Parity with Spec-Oracular Fixtures
- [x] **Status**: Done
- **Scope**: `src/dsl/wasm_parity.test.ts`, parser/normalizer fixture tests, any drift fixtures still comparing production semantics against Lezer
- **Commits**:
  - `test(parser): classify remaining wasm-vs-lezer differences by spec ownership`
  - `test(parser): convert cutover fixtures to direct wasm/spec assertions`
- **Acceptance Criteria**:
  - Every current WASM-vs-Lezer difference is resolved into one of:
    - fixed in WASM
    - documented as a prior Lezer bug with direct WASM expectation
    - removed as no longer relevant after cutover
  - No production correctness test requires Lezer equality to pass
  - Remaining comparison harness tests, if any, are clearly marked transitional and non-authoritative
- **Dependencies**: Task 1

### Task 3: Make WASM the Default Production Path
- [x] **Status**: Done
- **Scope**: `src/dsl/ast.ts`, `src/dsl/normalize.ts`, `src/scoreWorker.ts`, app bootstrap/WASM init helpers
- **Commits**:
  - `refactor(parser): make wasm the default production parser`
  - `refactor(worker): remove runtime parser branching`
- **Acceptance Criteria**:
  - `buildScoreAst(source)` uses the WASM-backed skeleton path only
  - `buildNormalizedScore(source)` uses the WASM-backed path only
  - `scoreWorker` parse requests no longer include `parseMode`
  - WASM initialization happens automatically before production parsing in browser and worker flows
  - `npm run drummark` still works end-to-end after the ownership flip
- **Dependencies**: Task 2

### Task 4: Remove Parser-Selection Product Surface
- [x] **Status**: Done
- **Scope**: `src/App.tsx`, `src/components/SettingsPanel.tsx`, `src/hooks/useAppSettings.ts`, i18n keys/json, saved-settings migration
- **Commits**:
  - `refactor(app): remove parser selection setting and toggle`
  - `chore(i18n): delete wasm parser toggle strings`
- **Acceptance Criteria**:
  - The settings panel has no parser toggle
  - `App.tsx` no longer branches between `"wasm"` and `"lezer"`
  - Persisted settings with `useWasmParser` load without breaking other settings
  - No user-facing string mentions "Use WASM Parser" as a choice
- **Dependencies**: Task 3

### Task 5: Remove Production Lezer API Branches and Docs Drift
- [x] **Status**: Done
- **Scope**: parser ownership docs, type exports, public parse APIs, CLI/runtime docs, any code path still naming Lezer as authoritative
- **Commits**:
  - `refactor(api): remove lezer from production parse mode types`
  - `docs(parser): flip ownership from lezer to rust-wasm`
- **Acceptance Criteria**:
  - `ParseMode` no longer exposes `"lezer"` in production code, or the type is removed entirely if no longer needed
  - `docs/PARSER_OWNERSHIP.md` names Rust/WASM as the authoritative parser
  - No product/runtime doc instructs users to choose between Lezer and WASM
  - Any remaining Lezer mention is explicitly historical or transitional
- **Dependencies**: Task 4

### Task 6: Migrate and Prune Test Surface
- [x] **Status**: Done
- **Scope**: `src/dsl/*.test.ts`, `src/renderer/*.test.ts`, benchmark/parser harness tests, test helpers importing Lezer directly
- **Commits**:
  - `refactor(test): migrate parser tests to wasm-backed helpers`
  - `chore(test): delete lezer-only comparison suites`
- **Acceptance Criteria**:
  - Spec-facing parser tests import the WASM-backed parser helpers only
  - Lezer-only suites are deleted or rewritten:
    - `lezer_parity.test.ts`
    - `lezer_drift.test.ts`
    - `lezer_skeleton.test.ts`
    - other direct-Lezer suites that no longer serve post-cutover ownership
  - Remaining tests do not import `parseDocumentSkeletonFromLezer(...)`
  - `npm run test` passes with WASM as the only production parser path
- **Dependencies**: Task 5

### Task 7: Remove Lezer Implementation and Dependency Tail
- [x] **Status**: Done
- **Scope**: `src/dsl/lezer_skeleton.ts`, `src/dsl/drum_mark.grammar`, generated parser artifacts, package dependencies, build scripts, historical compatibility stubs
- **Commits**:
  - `refactor(parser): remove lezer implementation files`
  - `chore(deps): remove lezer packages`
- **Acceptance Criteria**:
  - Production code no longer imports Lezer parser files
  - Lezer parser source and generated artifacts are removed from the active source tree, or moved behind explicit archival/non-production boundaries
  - `package.json` no longer depends on `@lezer/*` packages required solely for production parsing
  - `npm run build` passes after dependency removal
- **Dependencies**: Task 6

### Task 8: Consolidate, Verify, and Archive the Cutover
- [x] **Status**: Done
- **Scope**: proposal/tasks archival, spec/doc consolidation, final verification matrix
- **Commits**:
  - `docs(parser): consolidate rust-wasm parser cutover`
  - `chore(archive): archive completed cutover proposal and tasks`
- **Acceptance Criteria**:
  - Final repository state satisfies the proposal's "Acceptance Bar for Full Deprecation"
  - `npm run drummark`, `npm run test`, and `npm run build` all pass in the post-Lezer tree
  - Proposal/tasks files are archived per repository protocol
  - Any required architecture/spec append is completed before archival
- **Dependencies**: Task 7

### User Direction

User direction received after tasks drafting:

- Choose **Outcome A**. The target end state is complete Lezer removal from the active source tree, not editor-only residual retention.
- Promote repository examples to a cutover gate:
  - WASM must parse all DSL inputs under the repository's examples/docs-example corpus chosen for production support
  - normalized IR on that corpus must match the current Lezer path except where the mismatch is explicitly classified as a Lezer bug
- "Obvious Lezer bug" is not an informal escape hatch. Each exception must be written into the divergence ledger with:
  - example/fixture name
  - observed IR difference
  - spec citation or technical rationale
  - disposition: `Lezer bug; WASM kept`

These directives amend the tasks above as operative overrides:

- Task 2 must produce the divergence ledger and classify example-corpus mismatches.
- Task 6 must include example-corpus WASM assertions as direct coverage, not only ad hoc parser fixtures.
- Task 7 must execute Outcome A, not Outcome B.
- Task 8 cannot be marked complete unless the example corpus passes under WASM and Lezer has been removed from the active source tree.

### Review Round 1

1. The tasks do not make the example-corpus gate independently executable, so the preferred Outcome A cutover is not actually testable. The user direction says repository examples are a gating corpus, but no task defines:
   - which directories/files are the supported corpus,
   - how that corpus is enumerated,
   - which command produces normalized IR for the full corpus,
   - what artifact records corpus pass/fail status.
   Task 2 says to classify mismatches, and Task 6 says to include example-corpus assertions, but neither one establishes a concrete harness such as "run all `examples/**` and `docs/**` DSL fixtures through `npm run drummark --format ir` and assert expected outputs." Without that, Task 8 cannot objectively verify the cutover bar.

2. Task 2 and Task 6 are still coupled in a way that violates the task-independence rule. Task 2 is supposed to classify Lezer/WASM drift and produce the divergence ledger, but Task 6 is where example-corpus WASM assertions are introduced. In practice that means Task 2 cannot finish cleanly because its output contract depends on test infrastructure and corpus assertions that do not exist until Task 6. One of these tasks needs to own the corpus harness end-to-end:
   - either Task 2 defines the corpus runner plus the divergence ledger and produces direct expected IR fixtures,
   - or Task 6 owns the corpus harness and Task 2 is reduced to pure classification against an already-defined harness.
   As written, the drift-ledger work and the corpus-test work are split across hidden dependencies.

3. Task 3 misses a required acceptance criterion from the approved proposal: fail-closed behavior on WASM initialization failure. "WASM initialization happens automatically" is insufficient. The proposal requires that production parsing surface an explicit initialization error and never silently fall back to Lezer or another parser. This needs a direct acceptance criterion, ideally with a testable condition in browser/worker flows. Without it, the runtime fallback loophole remains open.

4. Task 5 is ordered too early relative to the evidence-producing work it depends on. Flipping `docs/PARSER_OWNERSHIP.md` to mark Rust/WASM authoritative before the example corpus, divergence ledger, and test migration are complete makes the docs claim a repository state that has not been proven yet. The ownership/doc flip should depend on the corpus gate and the replacement of Lezer-oracular tests, not merely on UI toggle removal. At minimum, Task 5 should depend on the completion of the corpus ledger/harness work and the production-path cutover evidence.

5. Task 6 does not fully cover the approved diagnostics contract. The proposal requires preservation of parser-vs-validation error class boundaries and user-visible line/column fidelity. Task 6 only asserts that tests import WASM helpers and that Lezer-only suites are deleted or rewritten. It does not require:
   - parser diagnostic location assertions on cutover blockers,
   - validation error coverage for invalid values that survive parsing,
   - any corpus-level checks that diagnostics class did not collapse during migration.
   This is a missing acceptance surface, not a cosmetic gap.

6. Task 7 does not fully commit to Outcome A. Its acceptance criteria still allow "removed from the active source tree, or moved behind explicit archival/non-production boundaries," which is Outcome B language carried forward into a task that the user explicitly narrowed to complete removal. If Outcome A is the operative plan, Task 7 must require physical removal from the active source tree and from default build/test/dependency workflows, not archival isolation as an alternative.

7. The final verification task is underspecified for a deprecation-grade end state. Task 8 references the proposal's acceptance bar, but it does not enumerate the concrete checks that prove Lezer is gone:
   - no `@lezer/*` runtime dependencies in `package.json`/lockfile,
   - no production or test imports of Lezer parser entrypoints,
   - no `parseMode: "lezer"` or `useWasmParser` remnants,
   - example corpus IR pass report with documented exceptions only from the divergence ledger.
   A task that verifies archival and broad commands (`npm run drummark`, `npm run test`, `npm run build`) is not enough by itself, because those commands can still pass while dead Lezer code or dependencies remain.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The tasks file left several execution boundaries implicit. The following operative overrides amend the tasks without rewriting earlier entries:

1. **A concrete example-corpus harness is now required.**
   - The supported cutover corpus is the repository's checked-in example DSL files used as production examples/documentation examples.
   - The implementation must define this corpus explicitly in code or test configuration rather than relying on ad hoc globbing at verification time.
   - The harness output must produce a persistent pass/fail artifact for the corpus, not only console output.
   - This artifact must include:
     - corpus member list
     - parse success/failure
     - normalized IR comparison result
     - linked divergence-ledger exception when parity is intentionally waived as a Lezer bug

2. **Task boundary between drift classification and corpus coverage is now explicit.**
   - Task 2 owns the corpus harness definition and the divergence ledger.
   - Task 2 output contract is:
     - the enumerated example corpus
     - the corpus runner
     - the initial divergence ledger with disposition for every mismatch found during cutover analysis
   - Task 6 does not invent the corpus harness. It consumes Task 2's harness and converts it into stable ongoing test coverage after production cutover.

3. **Task 3 must prove fail-closed WASM initialization behavior.**
   - Add a required acceptance condition:
     - if WASM init/load fails in production parse flow, the caller receives an explicit initialization error
     - no silent fallback parser path executes
   - This must be covered by an automated test or equivalent deterministic harness in worker/runtime code.

4. **Docs/ownership flip must follow evidence, not precede it.**
   - Task 5 is amended to depend on both:
     - Task 3 production-path cutover
     - Task 6 test-surface migration
   - The ownership document must not claim Rust/WASM authority until the corpus harness, divergence ledger, production-path cutover, and Lezer-oracle test removal are complete.

5. **Diagnostics contract is now a required test surface.**
   - Task 6 must include direct assertions that:
     - parser errors remain parser errors for malformed syntax
     - validation/normalization errors remain semantic errors for invalid-but-parseable input
     - line/column fidelity is preserved for representative user-visible diagnostics, including the known cutover blockers
   - These checks must be automated and live in the post-cutover WASM-owned test surface.

6. **Task 7 is narrowed to Outcome A only.**
   - Remove Outcome B latitude from execution semantics.
   - For this repository, Task 7 completion means:
     - Lezer parser source and generated parser artifacts are physically removed from the active source tree
     - `@lezer/*` parser dependencies needed for parsing are removed from active build/test flows
     - no production or correctness-test workflow depends on Lezer parser code
   - Editor-highlighting retention is not part of this plan unless re-approved later in a new ledger entry.

7. **Task 8 final verification is now concrete.**
   - Task 8 must verify all of the following explicitly:
     - no `parseMode: "lezer"` remnants in active production code
     - no `useWasmParser` remnants in app settings/UI
     - no active imports of Lezer parser entrypoints in production or correctness-test code
     - no active Lezer parser source or generated parser artifacts in the active source tree
     - no `@lezer/*` parser dependencies required by default parse/build/test workflows
     - the example corpus pass artifact is green except for divergences already recorded as Lezer bugs in the ledger
   - Broad command success (`npm run drummark`, `npm run test`, `npm run build`) remains necessary but is not sufficient alone.

These overrides make the tasks independently executable and align them with the approved proposal plus the user's Outcome A direction.

### Review Round 2

The `### Author Response` resolves the seven blocking issues at the tasks-file level.

1. The example-corpus gate is now concretely testable. The response requires an explicitly enumerated production-support corpus, a defined harness, and a persistent pass/fail artifact that includes IR comparison status and divergence-ledger linkage. That closes the prior "Task 8 cannot verify cutover objectively" gap.

2. Task independence between Task 2 and Task 6 is now explicit enough. Task 2 owns the corpus harness definition, corpus runner, and initial divergence ledger; Task 6 consumes that harness to turn it into durable post-cutover coverage. That gives each task a distinct input/output contract and removes the hidden dependency from the earlier draft.

3. The fail-closed runtime requirement is now covered. The response adds a direct Task 3 acceptance condition requiring surfaced initialization error behavior with no silent fallback path, plus automated or deterministic coverage in worker/runtime code. That addresses the proposal-level runtime invariant.

4. The ownership-doc ordering issue is resolved. Task 5 is now explicitly downstream of both production-path cutover and test-surface migration, so `docs/PARSER_OWNERSHIP.md` will not claim Rust/WASM authority before the evidence-producing work is complete.

5. The diagnostics contract is now represented in the test plan. The response requires Task 6 to assert parser-vs-validation error boundaries and representative line/column fidelity for user-visible diagnostics, including the known blocker cases. That is sufficient coverage for the approved proposal's diagnostics compatibility bar.

6. Outcome A is now singular and enforceable. The response removes Outcome B latitude from Task 7 execution semantics and requires physical removal of Lezer parser source, generated artifacts, and parser-specific dependency/workflow usage from the active tree. That matches the user's narrowing direction.

7. Final-state verification is now concrete enough for deprecation-grade closure. Task 8 is amended to check code/config remnants, active imports, active source/artifact presence, parser dependency presence in default workflows, and the example-corpus pass artifact with ledgered exceptions only. Combined with the broad command checks, that makes the end state auditable rather than inferred.

No remaining task-structure or ordering issue blocks approval. The remaining risk is execution quality during implementation, not a planning defect in the tasks file.

STATUS: APPROVED
