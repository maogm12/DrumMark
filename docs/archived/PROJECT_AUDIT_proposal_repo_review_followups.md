# PROJECT_AUDIT_proposal_repo_review_followups.md

## Addendum v1.0: Repository Audit Follow-Ups

### Motivation

This proposal captures the main gaps found in a repo-wide audit of the current DrumMark workspace: spec drift, duplicated parser architecture, renderer maintainability debt, CLI/tooling rough edges, test blind spots, and a small set of spec-defined features that are still intentionally unimplemented.

The goal is not to change the DSL immediately. The goal is to create one tracked backlog document that:

- records concrete findings with file evidence
- separates correctness issues from maintainability issues
- identifies the next feature candidates that are already implied by the spec
- defines a phased cleanup order that reduces future drift

### Audit Inputs

The audit reviewed:

- `docs/DRUMMARK_SPEC.md`
- `src/dsl/*`
- `src/vexflow/*`
- `src/App.tsx`
- `src/cli.ts`
- `src/scoreWorker.ts`
- `docs/TASKS.md`
- `docs/SPEC_TEST_EXECUTION_CHECKLIST.md`
- active proposal artifacts in `docs/proposals/`

Validation run during the audit:

- `npm test`
- `npm run build`

Both commands passed. The current build still reports a large main bundle warning.

### Findings

#### F1. Confirmed spec/implementation mismatch: per-token `*` limit

Severity: High

Evidence:

- `docs/DRUMMARK_SPEC.md:1889` states: "There is no per-token star limit."
- `src/dsl/parser.ts:697` still raises `Too many stars (...) Maximum is 3.`

Impact:

- This is not editorial drift. It changes what valid source the parser accepts.
- The spec currently promises a strictly larger duration surface than the implementation actually supports.

Required outcome:

- Either remove the parser cap and keep the current spec, or explicitly roll the spec back.
- The parser and Lezer path must match whichever rule wins.

#### F2. Parser architecture is still split across two sources of truth

Severity: High

Evidence:

- Regex/manual parser path remains active through `src/dsl/parser.ts` and `buildNormalizedScore(...)`.
- Lezer path remains active through `src/dsl/lezer_skeleton.ts`, `src/dsl/ast.ts`, and parity tests such as `src/dsl/lezer_parity.test.ts`.
- Active review notes in `docs/proposals/DRUMMARK_SPEC_proposal_rehearsal_marks.md` already call out uncertainty about which pathway is authoritative.

Impact:

- Every syntax addition risks being implemented twice.
- Error behavior and edge-case validation can drift even if parity tests pass on a curated set.
- Proposal authors are already reasoning against the wrong parser boundary, which is process debt and architecture debt at the same time.

Required outcome:

- Decide whether DrumMark keeps dual parser implementations long-term or consolidates onto one authority.
- If both remain, define hard ownership:
  - one parser is canonical for production
  - the other is either editor-only or a parity target with explicit coverage rules

#### F3. Core files are too large and overloaded

Severity: Medium-High

Evidence:

- `src/vexflow/renderer.ts`: 1795 lines
- `src/App.tsx`: 1525 lines
- `src/dsl/parser.ts`: 1478 lines
- `src/dsl/lezer_skeleton.ts`: 1308 lines
- `src/dsl/normalize.ts`: 903 lines

Impact:

- Rendering, UI state, parsing, and normalization each have multiple responsibilities collapsed into one file.
- Review cost is high and local regressions are easy to hide.
- Recent work already shows that small feature additions frequently touch these same hotspot files.

Required outcome:

- Split renderer by concern: stave/system layout, note building, overlays, and page assembly.
- Split app shell from settings controls and preview/export coordination.
- Split parser validation helpers from token scanning and document assembly.

#### F4. Renderer type debt is substantial

Severity: Medium

Evidence:

- `src/vexflow/renderer.ts` contains many `any`-typed note, modifier, stave, and layout references.
- `src/cli.ts` uses `as any` repeatedly for the JSDOM bootstrap and arg parsing.

Impact:

- The highest-risk rendering code has the weakest compile-time guarantees.
- Refactors around spacing, hairpins, voltas, or navigation overlays remain more fragile than they need to be.

Required outcome:

- Introduce local typed wrappers for the VexFlow objects DrumMark actually uses.
- Isolate unavoidable external `any` boundaries in one adapter layer instead of letting them leak across the renderer.

#### F5. Build output is heavier than it needs to be

Severity: Medium

Evidence:

- `npm run build` reports `dist/assets/main-*.js` at about 1.77 MB before gzip and warns about chunks larger than 500 kB.
- `package.json` still includes `opensheetmusicdisplay`, but current source usage appears to be limited to an explanatory comment in `src/dsl/musicxml.ts:770`.

Impact:

- Page load, especially mobile cold-start, is likely worse than necessary.
- The current app/preview/docs combination is pushing all rendering and editor code into one heavy front-end payload.

Required outcome:

- Confirm whether `opensheetmusicdisplay` is still required.
- Code-split editor, docs, and preview-only surfaces where feasible.
- Add a bundle-budget check so chunk growth becomes visible before release.

#### F6. CLI/runtime bootstrap is ad hoc

Severity: Medium

Evidence:

- `src/cli.ts` inlines a JSDOM/canvas environment with several global mutations and a comment that it was copied from another entrypoint.
- The command usage is now `ast|ir|svg|xml`, but the bootstrap path is still tightly coupled to rendering concerns.

Impact:

- The CLI is useful and increasingly central, but its runtime environment is not yet a clean reusable module.
- Future output modes or test harnesses will likely duplicate this setup again.

Required outcome:

- Extract Node rendering/bootstrap setup into a shared helper with explicit typing and a single ownership point.
- Keep CLI argument parsing narrow and validated.

#### F7. Test coverage is good for unit semantics, thinner for full-surface integration

Severity: Medium

Evidence:

- `npm test` passed with 373 tests, including parser, normalization, renderer probes, and parity tests.
- `package.json` includes `playwright`, but there is no active browser E2E or visual regression suite.
- Current renderer validation is strong for targeted probes, but not yet for full-page rendering regressions, theme regressions, or docs example rendering at scale.

Impact:

- Logic bugs are likely to be caught.
- Layout drift, mobile interaction regressions, dark-mode regressions, and docs rendering regressions are less protected.

Required outcome:

- Add a small but deterministic browser-level regression layer.
- At minimum cover:
  - preview render success
  - settings interactions
  - dark/light mode preview behavior
  - docs example rendering smoke tests

#### F8. Process debt: active proposal backlog is not empty

Severity: Medium

Evidence:

- `docs/proposals/DRUMMARK_SPEC_proposal_rehearsal_marks.md`
- `docs/proposals/DRUMMARK_SPEC_tasks_rehearsal_marks.md`

Impact:

- The proposal ledger is currently carrying at least one live design thread.
- A broad cleanup effort should not blur together unrelated DSL work unless the dependency is explicit.

Required outcome:

- Keep rehearsal marks as its own tracked stream.
- This audit proposal should not silently absorb or supersede that proposal without a deliberate merge decision.

#### F9. Spec backlog is partially formalized already

Severity: Low-Medium

Evidence:

- `docs/DRUMMARK_SPEC.md:1035` lists features defined but not yet implemented or not storable in IR:
  - inline tempo changes
  - inline time-signature changes
  - pickup/anacrusis measures
  - dashed barlines

Impact:

- The project already has an explicit feature backlog inside the spec.
- New roadmap work should distinguish between "bug/debt cleanup" and "spec-defined feature completion."

Required outcome:

- Treat these as a separate feature lane after correctness and architecture cleanup.

### Proposed Workstreams

#### Workstream A: Correctness and drift closure

Scope:

- close confirmed spec/implementation mismatches
- audit the parser and Lezer path for remaining rule drift
- revalidate error wording consistency

Initial target items:

- F1 per-token `*` rule
- navigation and paragraph-level directive parity
- any spec claims that still say "implemented" while code disagrees

#### Workstream B: Parser architecture consolidation

Scope:

- define the authoritative parser boundary
- reduce duplicate logic between `parser.ts` and `lezer_skeleton.ts`
- make proposal authorship align with the real implementation path

Decision options:

- full consolidation onto one parser pipeline
- dual-path retention with explicit role split and stronger parity guarantees

#### Workstream C: Renderer and UI decomposition

Scope:

- split `renderer.ts` and `App.tsx`
- isolate layout planners, note builders, overlay layers, and settings controls
- replace ambient `any` with local typed adapters

#### Workstream D: Tooling and bundle hygiene

Scope:

- modularize CLI/bootstrap setup
- verify and remove dead dependencies
- introduce bundle budgets or size checks
- consider lazy-loading heavy surfaces

#### Workstream E: Browser-level regression protection

Scope:

- add deterministic preview/docs smoke tests
- use the existing Playwright dependency or remove it if the project does not want browser tests

#### Workstream F: Spec-defined feature lane

Scope:

- inline tempo changes
- inline meter changes
- pickup measures
- dashed barlines
- rehearsal marks after the existing active proposal is resolved

### Prioritization

Recommended order:

1. Workstream A
2. Workstream B
3. Workstream C
4. Workstream D
5. Workstream E
6. Workstream F

Rationale:

- Closing correctness drift first prevents the spec from losing credibility.
- Consolidating parser ownership next reduces the cost of every later feature.
- Refactors to renderer/UI/tooling are safer once the language surface is stable.

### Acceptance Criteria For This Proposal

This proposal is considered successful if it is used to generate one follow-up tasks file that:

- separates correctness fixes from architectural refactors
- gives the parser question explicit ownership
- includes bundle/test/tooling work, not just DSL work
- treats spec-defined future features as a distinct lane

### Non-Goals

- No immediate DSL syntax change is approved by this proposal alone.
- No active proposal is implicitly cancelled.
- No renderer rewrite is mandated yet; only decomposition and ownership cleanup are in scope.

### Review Round 1

The proposal identifies the right categories of debt, but it is not yet sharp enough to serve as the basis for an implementation tasks file without creating scope bleed.

Critiques:

1. F2 is underspecified at the decision boundary. The proposal says parser ownership must be decided, but it does not define the allowed end states tightly enough. Before tasking begins, this proposal should explicitly enumerate the supported architecture outcomes and the proof required for each:
   - single canonical parser
   - dual parser with a production/editor split
   - dual parser with one parser reduced to a narrow skeleton-only role
   Without that, Workstream B can expand into open-ended redesign.

2. F3 and F4 currently mix symptoms with remedies. Large files and `any` usage are real smells, but the proposal does not distinguish "must-fix because it blocks correctness" from "opportunistic cleanup during nearby work". A tasks file derived from this text would likely over-refactor. The proposal should define a threshold for action, such as:
   - extraction only when a hotspot already changes for a correctness fix
   - or explicit targeted splits with named seams and non-goals

3. F5 needs stronger evidence before it becomes a workstream. The current text infers that `opensheetmusicdisplay` may be dead based on grep-level evidence. That is enough for an audit note, but not enough to justify removal work. The proposal should downgrade this to "verify dependency reachability" unless import graph proof is added.

4. Workstream E is too vague on determinism. "browser-level regression protection" is directionally right, but the proposal should constrain what counts as acceptable coverage. Otherwise visual and interaction testing can expand without bound. It should state whether the goal is:
   - smoke-only render/assertion coverage
   - screenshot snapshots for fixed fixtures
   - interaction tests for settings/theme only

5. Workstream F currently mixes backlog tracking with implementation readiness. Inline tempo, inline meter, pickup measures, dashed barlines, and rehearsal marks are not equally mature. The proposal should separate:
   - spec-listed but intentionally unimplemented features
   - features with an already active proposal
   - features lacking IR/render design entirely
   Otherwise the later tasks file will blur discovery work with implementation work.

6. The proposal is missing a repo-wide invariant section. Several findings span spec, parser, IR, renderer, CLI, docs, and tests. The tasks file will need stable cross-cutting invariants such as:
   - every spec claim marked implemented must have at least one automated test at parser or render boundary
   - CLI outputs (`ast`, `ir`, `xml`, `svg`) must remain usable as debugging surfaces during refactors
   - docs examples must stay buildable under `npm run build-docs`
   These should be stated here, not invented later in tasks.

7. The acceptance criteria are too proposal-centric and not outcome-centric. "used to generate one follow-up tasks file" is process output, not project value. The proposal should also define what closure looks like for the audit stream itself, for example:
   - no known high-severity spec/implementation contradictions remain
   - parser ownership is explicitly documented
   - browser regression coverage exists or Playwright is intentionally removed

Validations:

- F1 is concrete and should remain the first closure item.
- F8 correctly keeps the rehearsal-mark proposal out of this umbrella effort.
- The proposed ordering A -> B -> C -> D -> E -> F is defensible once Workstream B is better bounded.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The proposal is amended here without rewriting the original addendum.

Response to critique 1:

- Workstream B is now explicitly bounded to three acceptable end states only:
  - `B1` Single canonical production parser, with the second path removed or reduced to tests only.
  - `B2` Dual parser with explicit production/editor split, where only one path is allowed to define normalized semantics.
  - `B3` Dual parser with one path reduced to a skeleton/highlighting/parity-only role and prohibited from carrying independent semantic validation rules.
- Any tasks file derived from this proposal must choose one of `B1/B2/B3` first. "Investigate parser architecture" is not an acceptable standalone implementation task.
- Proof of closure for Workstream B must include a short architecture note committed into repo docs that states which path is authoritative, what the secondary path is allowed to do, and where parity is enforced.

Response to critique 2:

- F3 and F4 are re-scoped from "general cleanup" to "targeted extraction only."
- File splitting and `any` reduction are required only in these cases:
  - when a hotspot must already change for a correctness fix
  - when a seam can be extracted with stable acceptance criteria and no DSL behavior change
  - when a type wrapper removes ambiguity around a known high-risk rendering path
- Non-goal clarification:
  - no repo-wide style cleanup
  - no extraction done purely to reduce line count
  - no renderer rewrite under this audit stream

Response to critique 3:

- Accepted. F5 is downgraded from "remove dead dependency" to "verify dependency reachability and then decide."
- No removal task should be created for `opensheetmusicdisplay` unless import-graph proof or runtime-path proof confirms it is unused.
- Bundle work remains in scope because the build warning is factual, but the first deliverable is evidence and budgeting, not dependency deletion.

Response to critique 4:

- Workstream E is narrowed to deterministic smoke and fixture-based regression protection, not open-ended visual QA.
- Acceptable first-stage coverage is:
  - preview render smoke for a fixed DSL fixture
  - docs example render smoke for generated docs output
  - theme-mode smoke for explicit light/dark overrides
  - one settings interaction path that proves controls still affect rendered preview
- Screenshot snapshot expansion is optional follow-on work, not required for first closure of this audit stream.

Response to critique 5:

- Workstream F is now split conceptually into three buckets:
  - `F-spec`: spec-listed but intentionally unimplemented features already recorded in Appendix C
  - `F-active`: features that already have an active proposal stream, currently rehearsal marks
  - `F-discovery`: feature ideas that still need IR/render design before tasking
- The future tasks file must not mix these buckets into one implementation tranche.

Response to critique 6:

- A repo-wide invariant section is added here for downstream tasks:
  - every spec claim presented as implemented must have at least one automated verification point at parser, normalize, CLI, or render boundary
  - `npm run build-docs` must remain green throughout audit-stream refactors
  - CLI `ast`, `ir`, `xml`, and `svg` outputs must remain available as debugging surfaces during refactors
  - parser ownership must be documented explicitly before any new syntax proposal depending on that boundary is approved

Response to critique 7:

- Closure criteria for the audit stream are expanded from "tasks file exists" to result-oriented outcomes:
  - no known high-severity spec/implementation contradiction remains open in the tracked audit set
  - parser ownership is documented in-repo
  - build/doc generation remains green
  - either browser smoke coverage exists for the agreed fixed surfaces, or Playwright is intentionally removed with rationale
  - targeted hotspot cleanup tasks, if taken, land with unchanged user-visible DSL semantics unless explicitly marked otherwise

Amended workstream guidance:

- Workstream B must begin with an architecture-decision task, not an implementation spread.
- Workstream C must be expressed as seam-based extractions, not file-size goals.
- Workstream D must begin with measurement and dependency reachability checks.
- Workstream E must remain smoke-oriented unless a later proposal explicitly promotes snapshot coverage.
- Workstream F remains backlog classification work unless a separate approved feature proposal exists.

### Review Round 2

The author response resolves the main taskability problems from Round 1. The proposal is now sufficiently bounded to support a follow-up tasks file without turning into a general cleanup bucket.

Validation of prior concerns:

1. Workstream B is now properly constrained. `B1/B2/B3` gives the downstream tasks file a closed decision set, and the required architecture note makes closure testable.

2. Workstreams C and D are now framed as targeted interventions instead of aesthetic refactors. The added non-goals materially reduce scope bleed.

3. Dependency hygiene is now evidence-first. Downgrading `opensheetmusicdisplay` work from assumed removal to reachability verification fixes the earlier overreach.

4. Workstream E is now narrow enough to task. The listed smoke surfaces are concrete and finite.

5. Workstream F is correctly split into `F-spec`, `F-active`, and `F-discovery`, which prevents feature backlog work from being mistaken for implementation-ready scope.

6. The new repo-wide invariants are the right cross-cutting guardrails for a tasks file derived from this proposal.

7. Closure criteria are now outcome-oriented rather than process-oriented.

Residual guidance for the tasks author:

- The tasks file should keep Workstream A front-loaded and should call out the `*` contradiction as the first correctness item rather than burying it in a larger audit tranche.
- The Workstream B architecture-decision task should have an explicit artifact in scope, such as a short repo doc or appendix update, so completion is unambiguous.
- Workstreams C, D, and E should stay decomposed into small acceptance-driven slices; if any task starts reading like a broad refactor, it is drifting from this approved proposal.

STATUS: APPROVED

### Author Response

User direction received: the repository should settle this audit-stream parser decision by deprecating the original regex/manual parser path.

This decision resolves Workstream B's architecture choice as follows:

- Lezer-based parsing becomes the authoritative path for normalized semantics.
- The existing regex/manual parser path is placed on a deprecation path immediately.
- The deprecated regex/manual parser may remain temporarily only as a migration aid, comparison harness, or rollback guard during transition work.
- No new syntax or semantic capability should be introduced exclusively on the deprecated regex/manual path.
- Audit-stream closure for parser ownership now requires repo documentation to state:
  - Lezer is authoritative
  - the regex/manual parser is deprecated
  - the deprecated parser's temporary allowed uses, if any
  - the intended removal or retirement path

This amendment supersedes the earlier open decision set for Workstream B. Workstream B is no longer a choice among multiple end states; it is now an execution plan for deprecating the regex/manual parser under a Lezer-authoritative model.
