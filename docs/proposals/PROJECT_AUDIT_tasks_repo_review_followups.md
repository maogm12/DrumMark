# PROJECT_AUDIT_tasks_repo_review_followups.md

## Task Ledger v1.0: Repository Audit Follow-Ups

This tasks file turns the approved audit proposal into an execution ledger. It intentionally separates correctness closure, architecture decisions, targeted extractions, and future-feature backlog handling.

Rules for this ledger:

- Each task is acceptance-driven.
- Refactor tasks must preserve current user-visible DSL semantics unless the task explicitly says otherwise.
- Large-file cleanup is not a goal by itself; extraction must happen at named seams.
- Browser testing work is smoke-oriented unless a later proposal expands it.

### Task 1: Close the `*` Rule Spec/Parser Contradiction
- [x] **Status**: Done
- **Scope**: `docs/DRUMMARK_SPEC.md`, `src/dsl/parser.ts`, `src/dsl/logic.ts`, `src/dsl/normalize.ts`, `src/dsl/lezer_skeleton.ts`, `src/dsl/spec-c05-durations.test.ts`, `src/dsl/parser.test.ts`, `src/dsl/lezer_parity.test.ts`, `LEARNINGS.md`
- **Commits**:
  - `fix(dsl): align star modifier limits with spec`
  - `test(dsl): cover uncapped or recapped star semantics`
- **Acceptance Criteria**:
  - The repository has one explicit rule for per-token `*` handling across spec and implementation.
  - The authoritative Lezer path and any remaining transitional manual-parser checks reflect the same rule without reintroducing a production parser cap.
  - Large symmetric `*`/`/` cancellation remains exact, and truly overflowing duration modifier combinations emit an explicit diagnostic instead of hanging or producing silent parser-cap fallback behavior.
  - Automated tests cover the chosen rule at parser and duration/normalization boundary.
  - `npm run drummark -- <fixture> --format ir` reflects the chosen rule without parser-path drift.
- **Dependencies**: None

### Task 2: Record the Parser Ownership Decision
- [x] **Status**: Done
- **Scope**: repo parser-ownership doc, `src/dsl/parser.ts`, `src/dsl/lezer_skeleton.ts`, `src/dsl/ast.ts`, `src/dsl/lezer_parity.test.ts`, `LEARNINGS.md`
- **Commits**:
  - `docs(parser): record parser ownership model`
  - `test(parser): align parity coverage with ownership contract`
- **Acceptance Criteria**:
  - The repo documents that the Lezer-based parser is authoritative for normalized semantics.
  - The document states that the regex/manual parser is deprecated and records its temporary allowed uses.
  - The document states what the secondary deprecated path may and may not do.
  - The document states that no new syntax or semantic capability may land only on the deprecated parser path.
  - The document describes the intended retirement or removal path for the deprecated parser.
  - Parity tests or equivalent checks treat the deprecated parser as a transitional comparison harness rather than a production oracle.
- **Dependencies**: Task 1

### Task 3: Audit and Close Remaining Parser-Path Drift
- [x] **Status**: Done
- **Scope**: `src/dsl/parser.ts`, `src/dsl/lezer_skeleton.ts`, `src/dsl/ast.ts`, `src/dsl/*.test.ts`, `docs/DRUMMARK_SPEC.md`, `LEARNINGS.md`
- **Commits**:
  - `test(dsl): add drift fixtures for parser-path parity`
  - `fix(dsl): close parser-path rule drift`
- **Acceptance Criteria**:
  - Known drift-prone areas identified in the audit have explicit fixtures, including navigation placement and paragraph-level directives.
  - The authoritative parser and secondary parser no longer disagree on supported syntax or diagnostics in the covered cases.
  - Any remaining intentional divergence is documented in the parser ownership note rather than left implicit.
- **Dependencies**: Task 2

### Task 4: Extract the CLI Node Runtime Bootstrap
- [x] **Status**: Done
- **Scope**: `src/cli.ts`, shared Node/bootstrap helper module(s), `src/cli_output.test.ts`, renderer-facing CLI smoke coverage, `LEARNINGS.md`
- **Commits**:
  - `refactor(cli): extract node render bootstrap`
  - `test(cli): preserve ast ir xml svg command surfaces`
- **Acceptance Criteria**:
  - JSDOM/canvas/global bootstrap logic has a single shared ownership point.
  - `src/cli.ts` is reduced to argument parsing and orchestration.
  - `ast`, `ir`, `xml`, and `svg` outputs remain available and validated by automated coverage or deterministic command probes.
- **Dependencies**: None

### Task 5: Add Bundle Measurement and Dependency Reachability Checks
- [x] **Status**: Done
- **Scope**: `package.json`, build tooling/config if needed, dependency audit notes, optional scripts/docs, `LEARNINGS.md`
- **Commits**:
  - `build(web): add bundle budget reporting`
  - `chore(deps): verify heavyweight dependency reachability`
- **Acceptance Criteria**:
  - The build records or checks main bundle size in a deterministic way.
  - `opensheetmusicdisplay` reachability is proved or disproved with stronger evidence than grep alone.
  - No dependency removal occurs unless reachability evidence supports it.
  - `npm run build` remains green.
- **Dependencies**: None

### Task 6: Add Browser-Level Smoke Coverage for Preview and Docs
- [x] **Status**: Done
- **Scope**: `src/vexflow/smoke.test.ts`, `package.json`, `LEARNINGS.md`
- **Commits**:
  - `test(web): add preview and docs smoke coverage`
- **Acceptance Criteria**:
  - The repo either uses the existing Playwright dependency for smoke tests or removes it in a deliberate follow-up.
  - Smoke coverage includes:
    - preview render success for a fixed DSL fixture
    - explicit light/dark theme render smoke
    - one settings interaction that changes preview output
    - generated docs example render smoke
  - The tests are deterministic and fixture-based rather than open-ended manual visual checks.
- **Dependencies**: None

### Task 7: Perform Targeted Renderer Seam Extraction
- [x] **Status**: Done
- **Scope**: `src/vexflow/renderer.ts`, `src/vexflow/layout.ts`, `src/vexflow/render-probe.test.ts`, `src/vexflow/smoke.test.ts`, `LEARNINGS.md`
- **Commits**:
  - `refactor(render): extract renderer layout seam`
- **Acceptance Criteria**:
  - At least one named seam is extracted from `renderer.ts` without DSL behavior change.
  - Extraction targets a high-risk concern already identified in the audit, such as layout planning, overlays, or typed VexFlow adapters.
  - Render probes remain green before and after the extraction.
  - New extraction boundaries reduce ambient `any` exposure rather than merely moving code around.
- **Dependencies**: Task 3

### Task 8: Perform Targeted App/Settings Seam Extraction
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, extracted UI/helper module(s), relevant tests or smoke coverage, `LEARNINGS.md`
- **Commits**:
  - `refactor(ui): extract app settings seams`
- **Acceptance Criteria**:
  - At least one named seam is extracted from `App.tsx`, such as settings controls, preview orchestration, or theme wiring.
  - User-visible settings behavior remains unchanged.
  - Existing build and smoke coverage remain green.
- **Dependencies**: Task 6

### Task 9: Classify the Future-Feature Lane
- [ ] **Status**: Pending
- **Scope**: `docs/DRUMMARK_SPEC.md`, audit follow-up docs if needed, `docs/proposals/`, `LEARNINGS.md`
- **Commits**:
  - `docs(roadmap): classify future feature lanes`
- **Acceptance Criteria**:
  - Future-feature backlog items are separated into `F-spec`, `F-active`, and `F-discovery`.
  - Rehearsal marks remain tracked by their own active proposal stream.
  - Inline tempo, inline meter, pickup measures, and dashed barlines have explicit backlog classification rather than being mixed into cleanup work.
- **Dependencies**: Task 2

### Task 10: Consolidate Audit Outcomes and Archive the Audit Artifacts
- [ ] **Status**: Pending
- **Scope**: `docs/DRUMMARK_SPEC.md` if any approved spec-side clarifications are still outstanding, parser-ownership repo docs, `docs/proposals/PROJECT_AUDIT_proposal_repo_review_followups.md`, `docs/proposals/PROJECT_AUDIT_tasks_repo_review_followups.md`, `docs/archived/`, `LEARNINGS.md`
- **Commits**:
  - `docs(audit): consolidate audit outcomes`
  - `docs: archive completed audit proposal artifacts`
- **Acceptance Criteria**:
  - Any approved spec clarifications produced by this audit stream are consolidated into their long-lived destination.
  - Parser ownership and audit closure status are documented in-repo.
  - Proposal/tasks artifacts move from `docs/proposals/` to `docs/archived/` only after all accepted tasks are complete.
  - Audit closure confirms:
    - no tracked high-severity contradiction remains open
    - build/doc generation is green
    - browser smoke coverage exists for the agreed fixed surfaces, or Playwright was intentionally removed
- **Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9

### Review Round 1

The task slicing is close, but several dependencies and acceptance criteria are still loose enough to create unnecessary blocking or scope expansion during execution.

Critiques:

1. Task 4 does not need to wait for Task 2. CLI bootstrap extraction is orthogonal to parser ownership documentation and should not inherit that dependency unless a shared parser bootstrap change is actually in scope.

2. Task 6 does not need to depend on Task 5. Browser smoke coverage and bundle measurement are separate tracks right now. Keeping them coupled would slow one for no technical reason.

3. Task 2 is not self-contained enough. Its acceptance criteria rely on proposal shorthand (`B1/B2/B3`) rather than restating the allowed outcomes in task-local language. The task should stand on its own if someone reads only the tasks file.

4. Task 3 needs a more concrete boundary on what "remaining parser-path drift" means. Without named fixture classes or an explicit target list, this can easily turn into open-ended archaeology.

5. Task 5 should say what kind of artifact counts as bundle measurement: script output, CI check, or committed report. "records or checks" is too broad as written.

6. Task 7 and Task 8 need stronger seam specificity. "At least one named seam" is directionally correct but still leaves too much room for cosmetic extraction. The tasks should require a seam tied to one of the audited hotspots, not just any split.

7. Task 10 should define what happens if some low-priority audit items are intentionally deferred. Right now it reads as if every listed task must finish before closure, which may not match how a backlog-style audit stream should close. Either say all tasks are mandatory for closure, or allow documented deferral criteria.

Validation:

- Task 1 is correctly first and should stay first.
- The overall separation between correctness, tooling, extraction, and backlog classification is good.
- The final archive task is appropriate once closure semantics are tightened.

STATUS: CHANGES_REQUESTED

### Author Response

Task 2 implementation note:

- The later parser-ownership decision override in this ledger supersedes the earlier broader "secondary parser responsibilities" wording for Task 2.
- The operative Task 2 end state is:
  - Lezer is the only authoritative parser for normalized semantics.
  - The regex/manual parser is deprecated.
  - Its allowed temporary uses are narrowed to migration aid, comparison harness, rollback guard, or explicitly documented transitional support.
  - Any older task-language implying a broader long-term secondary-parser role is overridden by this later narrowing.

Task 3 completion note:

- The covered drift buckets for Task 3 are explicitly:
  - uncapped duration suffix handling
  - positional navigation diagnostics, including shorthand fallback cases
  - paragraph-level `note 1/N` overrides
- This completion note supersedes any earlier looser wording that named parser drift areas without spelling out the three fixture buckets above.

### Review Round 3

The tasks file is now approvable in its current ledger form. The latest `Author Response` adds explicit operative overrides, and those overrides are specific enough to govern execution without requiring readers to infer intent from earlier review prose alone.

Validation:

1. Task 2 is now self-contained enough to execute. The override names the required parser-ownership document shape directly and no longer depends on unexplained proposal shorthand.

2. Task 3 now has bounded closure criteria. The drift scope is explicitly limited to duration-suffix handling, navigation placement/diagnostic parity, and paragraph-level directives/overrides, which is sufficiently narrow for a commit-driven ledger.

3. Task 4 and Task 6 no longer have a blocking dependency problem. The operative overrides clearly replace their dependency lines with `None`, and the response explicitly states that the overrides supersede conflicting earlier task text.

4. Task 5 now requires a deterministic bundle-measurement artifact and a repo-runnable mechanism, which is concrete enough for implementation. The remaining reachability language is slightly flexible, but no longer so vague that it blocks task execution.

5. Task 7 and Task 8 are now constrained to enumerated audited seams and explicitly reject cosmetic extraction. That is sufficient to prevent these tasks from collapsing back into generic cleanup.

6. Task 10 now has workable closure semantics, including what may be deferred, what may not be deferred, and what must be recorded before archival.

Non-blocking note:

- Ledger numbering drift is still present in earlier appended sections, but the current operative meaning is recoverable and the latest overrides are clear. That is not a reason to block approval from this point forward.

STATUS: APPROVED

### Author Response

User direction received: the original regex/manual parser is to be deprecated. These operative overrides narrow the approved tasks file accordingly.

#### Parser Ownership Decision Override

Task 2 override:

- **Acceptance Criteria** are further narrowed to:
  - the repo contains a plain-language parser ownership document
  - the document states that the Lezer-based parser is the authoritative parser for normalized semantics
  - the document states that the regex/manual parser is deprecated
  - the document states the deprecated parser's temporary allowed uses, limited to migration aid, comparison harness, rollback guard, or explicitly documented transitional support
  - the document states that no new syntax or semantic capability may land only on the deprecated parser path
  - the document describes the intended retirement or removal path for the deprecated parser

Task 3 override:

- **Acceptance Criteria** gain one additional requirement:
  - any parser-path drift closure performed during this task must treat the regex/manual parser as deprecated transition surface, not as a co-equal long-term authority

Task 10 override:

- **Acceptance Criteria** gain one additional requirement:
  - audit closure must confirm that parser ownership docs explicitly record Lezer as authoritative and the regex/manual parser as deprecated

### Review Round 2

The file is not ready for approval yet. The latest appended review at the end of the ledger still requests concrete changes, and there is no subsequent author response in this file addressing those points. Under the Linear Ledger Protocol, approval should only follow the most recent unresolved review round, not an earlier approved state.

Current blocking issues remain:

1. Task 4 still needs its dependency state resolved in the task body itself. The earlier author response says it should be `None`, but the canonical task entry still shows a dependency that can unnecessarily block execution.

2. Task 6 has the same issue. The response says it should be independent, but the task entry still needs to reflect that directly so implementers are not forced to interpret review prose as the operative task definition.

3. Task 2 still needs self-contained acceptance criteria in the task body. The latest review correctly calls out that the task should not depend on external shorthand or proposal cross-reference to understand the allowed parser-ownership outcomes.

4. Task 3, Task 5, Task 7, and Task 8 still need the tighter acceptance wording to be incorporated into the operative task entries rather than left in review commentary. Right now the task list still leaves too much room for execution-time scope drift.

5. Task 10 still needs explicit generated-doc refresh requirements when docs/spec inputs change during the audit stream. The final closure task should make that obligation unambiguous.

6. Ledger hygiene needs attention on the next author pass. The second appended review is labeled `### Review Round 1` again. That does not block the substance of the work by itself, but the next response/review pair should restore correct round numbering from this point forward.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The tasks file is amended here without rewriting the original entries.

Response to critique 1:

- Task 4 dependency is reduced from `Task 2` to `None`.
- Rationale: CLI runtime/bootstrap extraction is an independent tooling seam and should not wait on parser-ownership documentation.

Response to critique 2:

- Task 6 dependency is reduced from `Task 5` to `None`.
- Rationale: browser smoke coverage and bundle measurement are both audit workstreams, but neither is a technical prerequisite for the other.

Response to critique 3:

- Task 2 is clarified to be self-contained. The allowed outcomes are restated here and must be copied into implementation notes for that task:
  - one parser is declared authoritative for normalized semantics
  - any secondary parser is explicitly limited to editor, skeleton, highlighting, or parity-support responsibilities
  - the repo docs state where divergence is forbidden and where it is tolerated
- The task must not rely on unexplained shorthand in its final implementation artifact.

Response to critique 4:

- Task 3 is narrowed to the audit-identified drift classes only:
  - duration-suffix handling where spec and parser semantics may diverge
  - navigation placement/diagnostic parity
  - paragraph-level directive and override handling
- Task 3 is not a general parser cleanup pass.

Response to critique 5:

- Task 5 bundle measurement is made concrete:
  - acceptable outputs are a script, build-time check, or committed deterministic report that records bundle size for the main client artifact
  - the chosen mechanism must be runnable from the repo and stable enough to catch regressions over time

Response to critique 6:

- Task 7 and Task 8 are constrained to audited hotspots:
  - Task 7 must target one renderer seam from layout planning, overlay rendering, or typed VexFlow adapter boundaries
  - Task 8 must target one app seam from settings controls, preview orchestration, or theme wiring
- Cosmetic extraction with no risk reduction does not satisfy either task.

Response to critique 7:

- Task 10 closure semantics are clarified:
  - the audit stream may close with documented deferrals only for low-priority items in Workstreams C, D, E, or F
  - no high-severity contradiction or parser-ownership item may be deferred
  - any deferred item must be explicitly recorded as backlog carry-forward in the closure artifact before archiving

Amended task guidance:

- Task 2 implementation must restate the parser-authority contract in plain repo documentation.
- Task 3 implementation must use named fixture classes drawn from the audit findings, not open-ended drift hunting.
- Task 5 implementation must choose one deterministic measurement artifact and document it.
- Task 10 may archive the audit stream only after mandatory items are closed and any allowed deferrals are recorded.

### Review Round 2

The file is still not approvable because the intended fixes remain in review prose rather than the operative task definitions.

Critiques:

1. Task 4 and Task 6 still carry the original dependency lines in their task bodies.

2. Task 2, Task 3, Task 5, Task 7, Task 8, and Task 10 still rely on the older broader wording in their acceptance criteria. The tightened constraints need to be promoted into operative task text, not left only in commentary below.

3. Ledger hygiene issue: the prior append reused `### Review Round 1`. Continue numbering from here.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The task definitions are amended here as operative overrides. These overrides supersede the conflicting earlier dependency and acceptance-criteria lines for the listed tasks.

#### Operative Overrides

Task 2 override:

- **Acceptance Criteria** are replaced with:
  - the repo contains a plain-language parser ownership document
  - the document names exactly one authoritative parser for normalized semantics
  - the document states what any secondary parser is allowed to do, limited to editor, skeleton, highlighting, or parity-support responsibilities as applicable
  - the document states where divergence is forbidden and where it is tolerated
  - parity tests or equivalent checks are aligned to that documented contract

Task 3 override:

- **Acceptance Criteria** are replaced with:
  - the task adds explicit fixtures for the audit-identified drift classes only:
    - duration-suffix handling where spec and parser semantics may diverge
    - navigation placement and diagnostic parity
    - paragraph-level directive and override handling
  - the authoritative parser and secondary parser no longer disagree in those covered cases
  - any remaining intentional divergence is documented in the parser ownership note
- This task is not a general parser cleanup pass.

Task 4 override:

- **Dependencies** are replaced with: `None`

Task 5 override:

- **Acceptance Criteria** are replaced with:
  - the repo gains one deterministic bundle-measurement artifact for the main client bundle, implemented as either:
    - a script
    - a build-time check
    - or a committed deterministic report
  - the chosen mechanism is runnable from the repo and stable enough to detect regressions over time
  - `opensheetmusicdisplay` reachability is proved or disproved with stronger evidence than grep alone
  - no dependency removal occurs unless reachability evidence supports it
  - `npm run build` remains green

Task 6 override:

- **Dependencies** are replaced with: `None`

Task 7 override:

- **Acceptance Criteria** are replaced with:
  - extraction targets exactly one audited renderer hotspot seam from this list:
    - layout planning
    - overlay rendering
    - typed VexFlow adapter boundaries
  - the extraction does not change user-visible DSL semantics
  - render probes remain green before and after the extraction
  - the change reduces ambient `any` exposure or isolates it more tightly at the seam
- Cosmetic extraction with no risk reduction does not satisfy this task.

Task 8 override:

- **Acceptance Criteria** are replaced with:
  - extraction targets exactly one audited app hotspot seam from this list:
    - settings controls
    - preview orchestration
    - theme wiring
  - the extraction does not change user-visible settings behavior
  - existing build and smoke coverage remain green
- Cosmetic extraction with no risk reduction does not satisfy this task.

Task 10 override:

- **Acceptance Criteria** are replaced with:
  - any approved spec clarifications produced by this audit stream are consolidated into their long-lived destination
  - parser ownership and audit closure status are documented in-repo
  - the audit stream may close with documented deferrals only for low-priority items in Workstreams C, D, E, or F
  - no high-severity contradiction or parser-ownership item may be deferred
  - any deferred item is explicitly recorded as backlog carry-forward in the closure artifact before archiving
  - proposal/tasks artifacts move from `docs/proposals/` to `docs/archived/` only after all mandatory items are complete
  - audit closure confirms:
    - no tracked high-severity contradiction remains open
    - build/doc generation is green
    - browser smoke coverage exists for the agreed fixed surfaces, or Playwright was intentionally removed

### Review Round 1

1. Task ordering still has avoidable coupling that will slow the stream down without buying safety. Task 4 (`Extract the CLI Node Runtime Bootstrap`) depends on Task 2 (`Record the Parser Ownership Decision`), but the CLI bootstrap extraction is orthogonal to parser ownership. As written, a docs/architecture decision can block a targeted runtime cleanup for no technical reason.

2. Task 6 (`Add Browser-Level Smoke Coverage for Preview and Docs`) depends on Task 5 (`Add Bundle Measurement and Dependency Reachability Checks`), but the acceptance criteria do not require any artifact from Task 5. Browser smoke coverage should either be independent, or the dependency should be justified by a concrete shared harness/output.

3. Task 2 is still not sufficiently self-contained to be taskable. Its acceptance criteria require the repo to document one approved end state, but only reference external labels (`B1`, `B2`, `B3`) from the audit proposal. The task file should state the concrete allowed decision set or required document output directly, so execution does not rely on implicit cross-document shorthand.

4. Task 3 needs sharper closure criteria. "Known drift-prone areas identified in the audit" is too open-ended for a ledger that is supposed to drive commits. The task should name the minimum required drift fixture buckets explicitly in the task file, otherwise scope can expand during execution and never clearly close.

5. Task 5 has one evidentiary gap. "Reachability is proved or disproved with stronger evidence than grep alone" is directionally correct, but still vague as an acceptance test. The task should require a concrete mechanism such as bundle graph evidence, import tracing, or removal proof via green build/tests.

6. Task 7 and Task 8 correctly avoid "cleanup for cleanup's sake", but their acceptance criteria are still weak on extraction targets. Each should require the author to name the chosen seam at task start or in the resulting commit/docs, otherwise "at least one named seam" can be satisfied post hoc with a low-value split.

7. Task 10 should explicitly require regeneration checks for generated docs artifacts if any spec/docs changes happen during this audit stream. Right now it says build/doc generation is green, which is close, but it does not say the generated outputs must be refreshed when inputs changed.

STATUS: CHANGES_REQUESTED
