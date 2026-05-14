## Addendum v1.0: Rust/WASM Parser Cutover and Lezer Deprecation

### Goal

The repository currently has a Rust/WASM parser in production shape, but parser ownership still belongs to the Lezer path. This addendum defines the cutover required to make the Rust/WASM parser the sole production parser and to deprecate the Lezer parser completely.

### Problem Statement

The current system is internally inconsistent:

- Rust/WASM parser code exists and is user-selectable in the app.
- `buildScoreAst(...)` and `buildNormalizedScore(...)` still default to `parseMode: "lezer"`.
- UI, worker messaging, tests, and ownership docs still treat Lezer as the authoritative parser.
- Existing Rust parser parity gaps include acceptance of malformed paragraph `note` overrides, silent header parse failures, and incorrect signed inline-repeat handling.

This means the repository has not actually completed parser migration. It has only added a second parser.

### End State

After this cutover:

- Rust/WASM is the only production parser path.
- Lezer is no longer the semantic oracle for any production-facing behavior.
- The app no longer exposes a parser toggle.
- `ast.ts` and `normalize.ts` no longer accept parser-mode branching for production parsing.
- All correctness tests assert directly against the spec-defined behavior of the Rust/WASM path.
- Any remaining Lezer code is either removed or explicitly isolated as non-production historical tooling.

### Repository Invariants

1. Supported syntax, diagnostics, AST shape, and normalized semantics must be defined by the Rust/WASM parser path.
2. No user-facing flow may depend on Lezer selection, Lezer fallback, or Lezer-only repair logic.
3. Parser errors must not silently downgrade into missing headers or fabricated defaults.
4. Paragraph-level `note 1/N` overrides are valid only at paragraph start and only in the complete `note Integer "/" Integer` form.
5. Negative or zero inline repeat counts remain invalid and must survive parsing as invalid values so validation can reject them explicitly.
6. Deleting Lezer must not remove any spec-covered syntax, diagnostics class, or normalization behavior.

### Scope

In scope:

- Rust parser correctness closure for the remaining cutover-blocking drift.
- Parser ownership flip in runtime code, settings, worker protocol, and public parser API.
- Test migration from Lezer-oracle parity to WASM/spec oracle.
- Documentation and dependency cleanup needed to make Lezer fully deprecated.

Out of scope:

- Moving the normalizer to Rust.
- Rewriting editor syntax highlighting.
- Opportunistic refactors unrelated to parser cutover.

### Design Decisions

#### 1. Cutover Criterion

The cutover is not "WASM equals Lezer everywhere." The cutover criterion is:

- WASM matches the spec on all supported syntax.
- Existing Lezer-vs-WASM differences are either closed or explicitly classified as Lezer bugs.
- Production entry points no longer branch on parser choice.

This prevents Lezer's legacy behavior from blocking correct Rust fixes.

#### 2. Parser API Ownership

The public production API should collapse to a single parser path:

- `buildScoreAst(source)` builds from WASM-backed skeleton only.
- `buildNormalizedScore(source)` builds from WASM-backed normalization only.
- `ParseMode` is removed from production code.

If a temporary comparison harness is still needed during transition, it must live in test-only helpers rather than in app/runtime code.

#### 3. Error Semantics

Malformed structural forms must become explicit parse errors rather than silent omissions:

- malformed header values
- malformed paragraph `note` override
- malformed shorthand suffixes whose sign or count matters

The parser must not fabricate values such as `4/4` to recover from incomplete `note` lines.

#### 4. UI and Runtime Ownership

The `useWasmParser` setting and app toggle are migration scaffolding. They must be removed as part of cutover, not left behind as a permanent product choice.

The worker protocol must stop accepting parser-mode selection. Runtime initialization should always ensure WASM readiness before parsing.

#### 5. Test Ownership

Tests should be split into three categories:

- Rust unit tests for tokenization and parser-edge correctness.
- JS/WASM integration tests for skeleton/AST/IR behavior.
- Spec-facing feature tests that assert end behavior directly.

Lezer-comparison tests may exist only as temporary migration harnesses during Task execution. They are not part of the final ownership model.

### Required Closure Before Lezer Removal

The following blockers must be closed before Lezer deletion:

- malformed paragraph `note` override acceptance
- silent header parse failures
- negative inline repeat sign loss
- any remaining test fixtures where WASM differs from spec-correct behavior
- runtime API reliance on `parseMode`
- UI reliance on `useWasmParser`

### Acceptance Bar for Full Deprecation

The repository is ready to fully deprecate Lezer only when all of the following are true:

- app parse requests do not carry parser mode
- parser settings UI contains no parser selector
- `ParseMode` no longer includes `"lezer"`
- `buildScoreAst(...)` and `buildNormalizedScore(...)` have no Lezer branch
- spec-facing parser tests run against WASM only
- parser ownership docs name Rust/WASM as authoritative
- Lezer parser source, generated artifacts, and dependencies are removed or clearly isolated as dead historical tooling

### Review Round 1

1. The proposal does not define a hard invariant for editor-only Lezer usage. "Out of scope: Rewriting editor syntax highlighting" and "removed or clearly isolated as dead historical tooling" leave an architectural hole: if CodeMirror highlighting still imports the Lezer grammar/package, then Lezer is not actually deprecated at the repository level, only at the production parse path. The addendum needs an explicit rule for the allowed residual footprint:
   - either Lezer may remain only as a lexer/highlighting asset with no AST/normalization/diagnostic authority and no runtime parse entrypoint,
   - or full deprecation means all Lezer grammar/codegen/dependencies must leave the repo, in which case syntax highlighting replacement becomes in-scope.
   Without this, "fully deprecate Lezer" is not testable.

2. The cutover criterion is underspecified for diagnostics compatibility. "WASM matches the spec on all supported syntax" is not enough, because the repo invariants also claim supported diagnostics are defined by Rust/WASM. That requires a concrete acceptance surface:
   - which diagnostic classes must remain stable,
   - whether location/range fidelity is part of the contract,
   - how parse errors vs validation errors are separated after Lezer removal.
   Otherwise a change can satisfy syntax acceptance while regressing editor/CLI error UX and still claim compliance.

3. The runtime readiness rule is operationally incomplete. "Runtime initialization should always ensure WASM readiness before parsing" does not say what production behavior is when WASM load/init fails. Lezer currently appears to be the migration fallback; after cutover there is no fallback path. The proposal needs an explicit invariant for failure mode, for example: parse requests fail closed with a surfaced initialization error and no silent retry on an alternate parser. Without that, implementers can reintroduce hidden fallback logic under a different name.

4. "Existing Lezer-vs-WASM differences are either closed or explicitly classified as Lezer bugs" is not actionable under the Linear Ledger protocol because there is no required ledger of those differences. The proposal should require an append-only inventory of each known divergence, its disposition, and the spec citation or rationale for treating it as a Lezer bug. Otherwise the cutover can be declared complete while unresolved drift is only held in conversational context.

5. The acceptance bar mixes two incompatible end states: "Lezer parser source, generated artifacts, and dependencies are removed or clearly isolated as dead historical tooling." "Removed" and "isolated as dead historical tooling" have very different maintenance consequences, and the proposal never defines the isolation boundary. If the chosen end state is isolation, it needs explicit constraints such as:
   - not built in production bundles,
   - not imported by runtime parser code,
   - not used as a test oracle,
   - not required by default contributor workflows.
   Without those constraints, dead tooling can stay semantically live.

6. The proposal does not state the normalization ownership boundary precisely enough for a parser cutover. It says normalizer rewrite to Rust is out of scope, but it does not say whether JS normalization is allowed to depend on AST quirks that only existed to mirror Lezer tree shape. A deprecation-grade cutover needs an invariant that JS normalization consumes a stable WASM-owned AST/skeleton contract, with no Lezer-compat adapter left in production code. Otherwise `parseMode` can disappear while Lezer-shaped compatibility logic survives indefinitely.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The proposal was too loose on the post-cutover boundary. The following operative clarifications amend the proposal:

1. **Residual Lezer footprint is now explicit.**
   - "Fully deprecate Lezer" at the production-parser level means: no Lezer-based AST builder, no Lezer-based normalized-semantics path, no runtime parser toggle, no worker/API/parser ownership branch, and no Lezer-oracular correctness tests.
   - Lezer may remain only if it is reduced to **editor-only non-authoritative syntax-highlighting support**.
   - If Lezer remains for highlighting, it must satisfy all of these:
     - not imported by `ast.ts`, `normalize.ts`, `scoreWorker.ts`, CLI parse flows, or any production parser entrypoint
     - not used as a correctness oracle in parser/normalizer tests
     - not required for `npm run drummark`
     - not required for WASM parser initialization or runtime fallback
   - If the repo chooses complete physical removal instead, that is also valid; the tasks file must choose one end state and make it testable.

2. **Diagnostics contract is now part of cutover scope.**
   - Parser cutover includes preservation of diagnostic classes for spec-covered syntax failures and validation failures.
   - The contract is:
     - malformed structural syntax must still surface parser errors
     - semantic invalidity must still surface validation/normalization errors
     - line/column fidelity remains required for parser diagnostics at user-visible granularity
   - Exact message text does not need byte-for-byte preservation unless tests already pin it, but error class and source location must remain stable enough for CLI/editor debugging.

3. **WASM initialization failure mode is now defined.**
   - After cutover, production parsing fails closed if WASM init/load fails.
   - The surfaced result must be an explicit initialization error visible to the caller; there is no silent fallback to Lezer or any alternate parser.
   - Reintroducing hidden parser fallback under another name is prohibited.

4. **Known parser drift requires a ledger.**
   - Before Lezer ceases to be compared as part of migration work, the repo must maintain an append-only disposition ledger of known Lezer/WASM divergences.
   - Each entry must record:
     - fixture or input class
     - observed difference
     - disposition (`fixed in wasm`, `lezer bug`, or `dropped as irrelevant after cutover`)
     - spec citation or technical rationale
   - This ledger may live in `LEARNINGS.md`, the proposal/tasks stream, or a dedicated cutover note, but it must exist as a persistent repository artifact.

5. **The end state must be singular, not mixed.**
   - The proposal allows two possible repository outcomes:
     - **Outcome A**: complete Lezer removal from the active source tree
     - **Outcome B**: Lezer retained only as editor-highlighting-only dead-adjacent tooling
   - The tasks file must pick one outcome explicitly.
   - If Outcome B is chosen, "isolated" means:
     - not built into production parser flows
     - not used as a semantic oracle
     - not required by default parsing/test/build workflows except editor-highlighting assets
     - documented as non-authoritative in parser ownership docs

6. **Normalization ownership boundary is now explicit.**
   - Keeping the JS normalizer is allowed.
   - What is not allowed is production normalization depending on Lezer-shaped compatibility glue after cutover.
   - Post-cutover production normalization must consume a stable WASM-owned skeleton/AST contract with no Lezer branch and no Lezer-only adapter semantics in the production path.
   - Any temporary Lezer-shape adapter used during migration must be removed before the cutover is declared complete.

These clarifications make the proposal's acceptance bar testable without forcing a Rust normalizer migration into scope.

### Review Round 2

The `### Author Response` resolves the six blocking issues at the proposal level.

1. Residual Lezer usage now has an explicit boundary. The proposal no longer leaves "deprecated" ambiguous between parser deprecation and total repository erasure. The allowed Outcome A / Outcome B split is acceptable because the response also requires the tasks file to choose one concrete outcome and make it testable.

2. Diagnostics compatibility is now defined tightly enough for cutover planning. The distinction between parser errors and validation/normalization errors, plus the requirement for user-visible line/column fidelity, closes the prior acceptance gap.

3. WASM initialization failure semantics are now explicit. "Fail closed" with a surfaced initialization error and no hidden fallback removes the runtime loophole that would otherwise allow parser branching to survive under a different mechanism.

4. Divergence tracking is now actionable. Requiring an append-only disposition ledger with fixture/input class, observed difference, disposition, and rationale is sufficient to prevent unresolved Lezer/WASM drift from remaining implicit.

5. The end-state ambiguity is resolved. The proposal now distinguishes full removal from editor-only residual use and defines the isolation boundary for the latter well enough to prevent semantically live "historical tooling."

6. The normalization ownership boundary is now explicit. The response clearly forbids Lezer-shaped compatibility glue in the production normalization path after cutover while keeping a JS normalizer in scope, which is the architectural distinction that was previously missing.

No additional proposal-level logic gaps block approval. The remaining risk is execution discipline: the companion tasks file must select Outcome A or Outcome B explicitly and map the new ledger/diagnostic/runtime invariants into independently testable tasks. That is a tasks-file review concern, not a reason to hold this proposal open.

STATUS: APPROVED

### Consolidated Changes

This approved addendum defines the Rust/WASM parser cutover that is required before Lezer can be considered deprecated in this repository.

The production end state is:

- Rust/WASM is the only authoritative production parser for syntax, diagnostics, AST shape, and normalized semantics.
- Production code no longer branches on parser choice.
- The app no longer exposes parser selection.
- JS normalization may remain, but it must consume a WASM-owned contract and must not retain Lezer-shaped compatibility glue in the production path.

The operational cutover rules are:

- malformed structural syntax must surface parser errors rather than silent omission or fabricated defaults
- invalid-but-parseable semantic input must remain validation/normalization error territory
- parser diagnostics must retain user-visible line/column fidelity
- if WASM initialization fails, production parsing fails closed with an explicit initialization error and no hidden parser fallback

Lezer/WASM parity is governed by a persistent divergence ledger:

- each known difference must be recorded with fixture/input class, observed difference, disposition, and spec/rationale
- a mismatch may be waived only when it is explicitly classified as a Lezer bug

User direction further narrows the target repository outcome:

- the intended end state is **Outcome A: complete Lezer removal from the active source tree**
- the cutover gate is the repository example corpus:
  - WASM must parse the supported checked-in example DSL files
  - normalized IR on that corpus must match the current Lezer path except for divergences explicitly recorded as Lezer bugs

Any future deviation from Outcome A requires a new explicit approval step.

### User Direction

User direction received after proposal approval:

- The preferred repository end state is **Outcome A: complete Lezer removal from the active source tree**.
- The practical cutover gate is:
  - the Rust/WASM parser can parse all repository example DSL inputs
  - the resulting normalized IR is consistent with the current Lezer path on those examples
- Exception:
  - if a mismatch is clearly attributable to an existing Lezer bug, strict IR equality is not required for that case
  - such cases must still be recorded in the divergence ledger with rationale

This direction narrows the earlier Outcome A / Outcome B branch. Outcome B remains architecturally valid in the abstract, but it is no longer the intended plan for this repository unless later blocked by execution reality and explicitly re-approved.
