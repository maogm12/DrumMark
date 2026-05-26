## Tasks v1.0: Native Rust CLI Export Pipeline

### Task 1: Export Strategy Prototype
- [x] **Status**: Done
- **Scope**: throwaway prototype or focused implementation spike under `crates/drummark-cli` only after proposal approval
- **Commits**: `chore(cli): prototype native svg and pdf export strategy`
- **Acceptance Criteria**: A minimal Rust program can convert a hand-built `LayoutScene` containing text, line, path, and glyph primitives into SVG and PDF; the PDF starts with `%PDF` and preserves page dimensions.
- **Dependencies**: Approved proposal and user stamp.

### Task 2: CLI Crate And Argument Contract
- [x] **Status**: Done
- **Scope**: root `Cargo.toml`, `crates/drummark-cli/Cargo.toml`, `crates/drummark-cli/src/main.rs`, `crates/drummark-cli/src/args.rs`, `package.json`
- **Commits**: `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: `cargo run -p drummark-cli -- --help` shows supported formats and input/output behavior; invalid flags return exit code `2`; `npm run drummark:native -- --help` invokes the new crate.
- **Dependencies**: Task 1.

### Task 3: Shared Parse And Export Pipeline
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`, limited public API adjustments in `crates/drummark-core` only if required
- **Commits**: `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: The CLI can read file and stdin source, produce normalized diagnostics on stderr, and call MusicXML/layout paths without TypeScript or WASM wrappers.
- **Dependencies**: Task 2.

### Task 4: Native SVG Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, SVG-focused tests
- **Commits**: `feat(cli): render layout scenes to svg`
- **Acceptance Criteria**: `--format svg` emits valid SVG containing staff lines and notehead roles for `docs/examples/overview.drum`; exporter logic translates only `LayoutScene` primitives and approved composite fallbacks.
- **Dependencies**: Task 3.

### Task 5: Native PDF Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, font asset handling if needed
- **Commits**: `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: `--format pdf --output /tmp/overview.pdf docs/examples/overview.drum` creates a non-empty multi-page-capable PDF with `%PDF` header and no placeholder text for music glyph primitives.
- **Dependencies**: Task 1, Task 3, Task 4 if PDF reuses SVG conversion; otherwise Task 3 only.

### Task 6: Developer JSON Formats
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/json.rs`, targeted DTOs or serialization derives
- **Commits**: `feat(cli): expose native ast and ir json outputs`
- **Acceptance Criteria**: `--format ast` and `--format ir` produce parseable JSON envelopes with representative header and measure data; implementation avoids broad serialization churn unless justified by tests.
- **Dependencies**: Task 3.

### Task 7: Integration Tests And Docs
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, project docs, `LEARNINGS.md`
- **Commits**: `test(cli): cover native export formats`, `docs(cli): document native export command`
- **Acceptance Criteria**: Required tests from the proposal pass; docs describe format support and PDF font behavior; `LEARNINGS.md` receives an append-only note for any discovered exporter or crate constraints.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8: Spec Consolidation And Proposal Archival
- [x] **Status**: Done
- **Scope**: `docs/proposals/ARCHITECTURE_proposal_native_cli_exports.md`, `docs/proposals/ARCHITECTURE_tasks_native_cli_exports.md`, relevant architecture/spec docs, `docs/archived/`
- **Commits**: `docs(cli): consolidate native cli proposal`
- **Acceptance Criteria**: Approved proposal content is consolidated into the appropriate append-only documentation location, implementation branch has passed pre-merge review, and proposal/task files are moved to `docs/archived/` after merge.
- **Dependencies**: All implementation tasks and pre-merge review.

### Local Review Round 1

Reviewer context: the required sub-agent review could not complete because the spawned agent failed before writing to the file. This local review is a fallback critique and does not satisfy the repository's mandatory sub-agent approval requirement.

Findings:

- Task 1 is not truly independent if it lives under `crates/drummark-cli`, because that crate does not exist until Task 2. Either create the crate first or make the prototype a throwaway script outside the future crate.
- Task 2 depends on Task 1, but Task 1 as written depends on approved proposal and user stamp only. This creates a circular practical ordering: the prototype wants a crate location that Task 2 creates.
- Task 5 depends on Task 4 only conditionally. Conditional dependencies are hard to track in a ledger; the tasks should split direct-PDF and SVG-mediated PDF strategy after Task 1 chooses the implementation path.
- Task 8 violates the repository sequence. Spec consolidation happens immediately after user stamp and before implementation, while archival happens only after reviewed branch merge. These should be separate tasks.
- Task 6 risks blocking the primary user-requested work. Developer JSON formats should be optional or placed after primary exports, with acceptance criteria that let the branch succeed if `ast`/`ir` are postponed intentionally.
- No task explicitly covers the `drummark-core` feature/bin migration risk identified in the proposal. That work should not be hidden inside "limited public API adjustments".

STATUS: CHANGES_REQUESTED

### Author Response

- Replace permissive subsetting language with a hard prototype gate. Task 3 may not complete unless selected dependencies can subset Bravura OTF and at least one accepted CJK font input. Full-font embedding does not satisfy this proposal.
- Add strict explicit-override failure rules. Invalid `--font` never falls back to workspace Bravura; invalid `--cjk-font` never falls back to platform candidates.
- Add mixed-script `TextRun` routing. Production PDF must split text into contiguous CJK and non-CJK runs, preserve order, and advance positions using selected-font metrics.
- Make CJK success testing CI-safe. Use `DRUMMARK_TEST_CJK_FONT` first; otherwise use a prototype-documented platform candidate; otherwise skip only the success test with a clear reason. The invalid explicit `--cjk-font` failure test always runs.

### Revised Task Amendments v1.4

### Task 1 Amendment: Strict Font Flag Contract
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text includes `--font <PATH>` for Bravura notation/non-CJK text output and `--cjk-font <PATH>` for CJK text output. Help text states that explicit font paths are strict: invalid `--font` and invalid `--cjk-font` fail rather than falling back. Help text states first-release formats only: `musicxml`, `xml`, `svg`, and `pdf`.
- **Dependencies**: Task 0.

### Task 3 Amendment: Hard Font Subset Strategy Gate
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, font loading/subsetting prototype, `LEARNINGS.md`
- **Commits**: covered by `chore(cli): validate native svg and pdf export strategy`
- **Acceptance Criteria**: Prototype selects dependencies that deterministically subset-embed Bravura OTF from `public/fonts/bravura.otf` or a valid `--font`; subset-embed at least one accepted CJK sans/Hei font input; reject full-font embedding as insufficient for this proposal; treat invalid explicit font paths as hard failures with no fallback; record selected dependencies, accepted CJK font formats/paths, platform candidates, and TTC limitations in `LEARNINGS.md`.
- **Dependencies**: Task 2.

### Task 6 Amendment: Production PDF Font Routing And Mixed Script Runs
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, font resolution and text-run splitting
- **Commits**: covered by `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: Production PDF subsets Bravura for `GlyphRun` notation output and non-CJK `TextRun` runs; subsets a CJK sans/Hei font for CJK runs; splits mixed-script `TextRun` values into contiguous CJK/non-CJK font runs while preserving character order, baseline, and measured sequential advance; verifies glyph coverage before writing; fails with exit code `1` on invalid explicit `--font`, invalid explicit `--cjk-font`, missing Bravura, missing required glyph coverage, or CJK text without an embeddable CJK font.
- **Dependencies**: Tasks 3 and 4.

### Task 7 Amendment: CI-Safe CJK PDF Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, small mixed-script CJK-title `.drum` fixture
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests cover successful mixed-script CJK-title PDF generation when `DRUMMARK_TEST_CJK_FONT` points to a readable embeddable CJK font or when a prototype-documented platform candidate is available; otherwise that success test is skipped with a clear reason. Tests always cover invalid explicit `--cjk-font` failure with CJK text and invalid explicit `--font` failure separately.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8 Amendment: Strict Font Documentation
- [x] **Status**: Done
- **Scope**: project docs, `LEARNINGS.md`
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs describe Bravura path resolution (`--font`, then `public/fonts/bravura.otf`), CJK font resolution (`--cjk-font`, then documented platform candidates only when no explicit CJK font is supplied), strict explicit-override failure behavior, font subsetting requirement, glyph coverage validation, mixed-script `TextRun` splitting, CI test font behavior, and failure behavior for missing or unembeddable fonts.
- **Dependencies**: Task 7.

### Author Response

- Reorder the plan so a minimal CLI crate skeleton comes before the exporter prototype. The prototype then has a stable home and can use the same dependency graph the implementation will use.
- Add an explicit core integration task for removing or renaming the legacy `drummark-core` bin and replacing the misleading `layout-wasm` gate for native render-score access.
- Split consolidation and archival: consolidation is an early post-stamp task before implementation; archival is the final post-merge task.
- Make PDF strategy selection an output of the prototype task. The later PDF task will have a single dependency path based on that selected strategy, not a conditional ledger dependency.
- Mark developer JSON formats as non-blocking for the primary export milestone. If serialization churn is high, the implementation may document them as deferred while still shipping `musicxml`, `svg`, and `pdf`.

### Revised Task Ordering v1.1

### Task 1: CLI Crate Skeleton And Command Contract
- [x] **Status**: Done
- **Scope**: root `Cargo.toml`, `crates/drummark-cli/Cargo.toml`, `crates/drummark-cli/src/main.rs`, `crates/drummark-cli/src/args.rs`, `package.json`
- **Commits**: `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: `cargo run -p drummark-cli --bin drummark -- --help` shows supported formats and input/output behavior; invalid flags return exit code `2`; `npm run drummark:native -- --help` invokes the new crate.
- **Dependencies**: Approved proposal, approved tasks, user stamp, and spec consolidation.

### Task 2: Core Native Integration
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/Cargo.toml`, `crates/drummark-core/src/main.rs`, feature gates around render-score access
- **Commits**: `refactor(core): expose native render score integration`
- **Acceptance Criteria**: The CLI can depend on parser, normalization, MusicXML, and render-score derivation without calling wasm APIs; the legacy `drummark-core` bin is removed, renamed, or documented as intentionally retained with no workspace command ambiguity.
- **Dependencies**: Task 1.

### Task 3: Export Strategy Prototype
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, `crates/drummark-cli/src/pdf.rs`, prototype tests using a hand-built `LayoutScene`
- **Commits**: `chore(cli): validate native svg and pdf export strategy`
- **Acceptance Criteria**: A minimal Rust test converts text, line, path, and glyph primitives into SVG and PDF; the PDF starts with `%PDF`, preserves page dimensions, and uses an explicit Bravura font embedding or outline strategy.
- **Dependencies**: Task 2.

### Task 4: Shared Parse And Export Pipeline
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`, layout option mapping
- **Commits**: `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: The CLI can read file and stdin source, emit lossy diagnostics on stderr, return exit code `0` when output is produced despite warnings, and call MusicXML/layout paths without TypeScript or WASM wrappers.
- **Dependencies**: Task 2.

### Task 5: Native SVG Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, SVG-focused tests
- **Commits**: `feat(cli): render layout scenes to svg`
- **Acceptance Criteria**: `--format svg` emits valid SVG containing staff lines and notehead roles for `docs/examples/overview.drum`; multi-page behavior is deterministic and documented; exporter logic translates only `LayoutScene` primitives and approved composite fallbacks.
- **Dependencies**: Tasks 3 and 4.

### Task 6: Native PDF Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, font asset handling
- **Commits**: `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: `--format pdf --output /tmp/overview.pdf docs/examples/overview.drum` creates a non-empty multi-page-capable PDF with `%PDF` header, preserved page dimensions, and no placeholder fallback text for music glyph primitives.
- **Dependencies**: Tasks 3 and 4.

### Task 7: MusicXML And Primary Export Integration Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, small `.drum` fixtures
- **Commits**: `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests cover `musicxml`, `svg`, `pdf`, stdin, invalid flags, and recoverable diagnostics. `cargo test -p drummark-cli`, `cargo test -p drummark-core`, and `cargo test -p drummark-layout` pass.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8: Developer JSON Formats
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/json.rs`, targeted DTOs or serialization derives
- **Commits**: `feat(cli): expose native ast and ir json outputs`
- **Acceptance Criteria**: `--format ast` and `--format ir` produce parseable JSON envelopes with representative header and measure data, or are explicitly documented as deferred if serialization changes would exceed the approved primary export scope.
- **Dependencies**: Task 4.

### Task 9: Docs And Learnings
- [x] **Status**: Done
- **Scope**: project docs, `LEARNINGS.md`
- **Commits**: `docs(cli): document native export command`
- **Acceptance Criteria**: Docs describe build/run commands, supported formats, stdin/stdout behavior, deterministic SVG page behavior, PDF font behavior, and any known limitations; `LEARNINGS.md` receives append-only notes for discovered exporter or crate constraints.
- **Dependencies**: Tasks 7 and 8.

### Task 10: Post-Merge Archival
- [ ] **Status**: Done
- **Scope**: `docs/proposals/ARCHITECTURE_proposal_native_cli_exports.md`, `docs/proposals/ARCHITECTURE_tasks_native_cli_exports.md`, `docs/archived/`
- **Commits**: `docs(cli): archive native cli proposal`
- **Acceptance Criteria**: After branch review and squash merge to `main`, proposal and task files are moved to `docs/archived/` as the permanent historical record.
- **Dependencies**: All implementation tasks, pre-merge review, and mainline integration.

### Review Round 2

Reviewer stance: constructively hostile task-ledger review of the Author Response and Revised Task Ordering v1.1. The revised order fixes the original circular dependency between the prototype and the CLI crate, and it correctly separates archival from implementation. It still has hidden coupling and one protocol-ordering gap that would make implementation begin before the approved proposal is fully consolidated.

Findings:

- The revised task list has no explicit spec consolidation task. Task 1 depends on "spec consolidation", but no task actually appends `### Consolidated Changes` to the proposal and appends the clean approved addendum to the relevant architecture/spec document before implementation. The repository protocol requires that consolidation happen after user stamp and before implementation. This must be a real task with scope, commits, acceptance criteria, and dependencies, not an implied precondition.
- Task 8 can mark `ast`/`ir` as deferred, but Task 9 depends on Task 8. That creates an ambiguous branch state: either documentation is blocked by optional developer formats, or Task 8 can be "done" without implementing its nominal feature. Split this into a primary-docs task that depends on Tasks 7 and 6, and an optional/deferred developer-format task, or define exactly how a documented deferral satisfies Task 8 without blocking release.
- Task 1 help text may list all supported formats before Task 8 implements `ast` and `ir`. If the first CLI contract includes those flags, then Tasks 2/4/8 are coupled through user-visible behavior and tests. The task plan should pin whether unsupported developer formats are hidden, accepted with a deliberate not-implemented error, or implemented before help text advertises them.
- Task 3 selects the PDF/SVG strategy but does not require recording the decision anywhere durable enough for later tasks. The acceptance criteria should require updating the proposal response, task note, `LEARNINGS.md`, or a small implementation note with the selected font and PDF strategy. Otherwise Tasks 5 and 6 can silently interpret "explicit Bravura font embedding or outline strategy" differently.
- Task 2's binary migration acceptance still permits "documented as intentionally retained with no workspace command ambiguity", but it does not define the objective check for ambiguity. Add a concrete check such as `cargo run -p drummark-cli --bin drummark -- --help` works, `npm run drummark:native -- --help` reaches the new crate, and no checked-in script relies on the old `drummark-core` bin name unless the shim is intentionally renamed.
- Task independence is mostly improved, but Task 6's PDF exporter can still be hiddenly coupled to Task 5 if the prototype chooses SVG-mediated PDF. The ledger says Task 6 depends only on Tasks 3 and 4. If the chosen strategy reuses SVG serialization, Task 6 must either depend on Task 5 or Task 3 must produce a reusable SVG primitive renderer sufficient for PDF before the full SVG CLI exporter exists.

Required changes before approval:

- Add an explicit early consolidation task after approval/user stamp and before CLI implementation.
- Resolve the optional `ast`/`ir` sequencing so primary export work cannot be blocked by developer JSON and help text cannot advertise unsupported behavior accidentally.
- Make the Task 3 strategy decision durable and adjust Task 6 dependencies based on whether PDF reuses Task 5 code.

STATUS: CHANGES_REQUESTED

### Author Response

- Add an explicit early consolidation task. It runs after proposal/tasks approval and user stamp, before any implementation task, and appends `### Consolidated Changes` plus the clean approved addendum to the relevant architecture/spec document.
- Remove `ast` and `ir` from the first implementation command contract. The primary export milestone supports `musicxml`, `xml`, `svg`, and `pdf` only. Developer JSON formats become a deferred follow-up task outside the primary release path.
- Make the PDF strategy durable in Task 3: the prototype must record the selected strategy in `LEARNINGS.md` and the implementation task notes. The selected strategy is embedded Bravura PDF output, not SVG-mediated PDF. Therefore PDF does not depend on the full SVG CLI exporter, but both SVG and PDF may share primitive translation helpers if those helpers are introduced during Task 3.
- Make binary migration objective: no package other than `drummark-cli` may expose a production binary named `drummark`; `npm run drummark:native -- --help` and `cargo run -p drummark-cli --bin drummark -- --help` must both reach the new crate.

### Revised Task Ordering v1.2

### Task 0: Approved Design Consolidation
- [x] **Status**: Done
- **Scope**: `docs/proposals/ARCHITECTURE_proposal_native_cli_exports.md`, relevant architecture/spec documentation
- **Commits**: `docs(cli): consolidate native cli design`
- **Acceptance Criteria**: After proposal and tasks receive `STATUS: APPROVED` and the user stamps the design, append `### Consolidated Changes` to the proposal file and append the clean approved CLI architecture addendum to the relevant append-only documentation file. No implementation code is changed in this task.
- **Dependencies**: Approved proposal, approved tasks, and user stamp.

### Task 1: CLI Crate Skeleton And Command Contract
- [x] **Status**: Done
- **Scope**: root `Cargo.toml`, `crates/drummark-cli/Cargo.toml`, `crates/drummark-cli/src/main.rs`, `crates/drummark-cli/src/args.rs`, `package.json`
- **Commits**: `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: `cargo run -p drummark-cli --bin drummark -- --help` shows first-release formats `musicxml`, `xml`, `svg`, and `pdf`; it does not advertise `ast` or `ir`; invalid flags return exit code `2`; `npm run drummark:native -- --help` invokes the new crate.
- **Dependencies**: Task 0.

### Task 2: Core Native Integration
- [x] **Status**: Done
- **Scope**: `crates/drummark-core/Cargo.toml`, `crates/drummark-core/src/main.rs`, feature gates around render-score access
- **Commits**: `refactor(core): expose native render score integration`
- **Acceptance Criteria**: `drummark-core` exposes render-score derivation through a native `layout` feature; `layout-wasm` depends on that feature rather than being the only render-score gate; the CLI depends on native library APIs and does not call wasm-bindgen entrypoints; only `crates/drummark-cli` exposes a production binary named `drummark`.
- **Dependencies**: Task 1.

### Task 3: Export Strategy Prototype
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, `crates/drummark-cli/src/pdf.rs`, primitive translation helpers, prototype tests using a hand-built `LayoutScene`, `LEARNINGS.md`
- **Commits**: `chore(cli): validate native svg and pdf export strategy`
- **Acceptance Criteria**: A minimal Rust test converts text, line, path, and glyph primitives into SVG and PDF; PDF uses embedded Bravura from `--font` or `public/fonts/Bravura.otf`, fails rather than substituting a font when Bravura is missing, starts with `%PDF`, preserves page dimensions, and records the selected strategy in `LEARNINGS.md`.
- **Dependencies**: Task 2.

### Task 4: Shared Parse And Export Pipeline
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`, layout option mapping
- **Commits**: `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: The CLI can read file and stdin source, emit lossy diagnostics on stderr, return exit code `0` when output is produced despite warnings, and call MusicXML/layout paths without TypeScript or WASM wrappers.
- **Dependencies**: Task 2.

### Task 5: Native SVG Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, SVG-focused tests
- **Commits**: `feat(cli): render layout scenes to svg`
- **Acceptance Criteria**: `--format svg` emits valid SVG containing staff lines and notehead roles for `docs/examples/overview.drum`; default `--pages all` emits all pages in one stacked SVG document; `--pages first` emits page 0 only; exporter logic translates only `LayoutScene` primitives and approved composite fallbacks.
- **Dependencies**: Tasks 3 and 4.

### Task 6: Native PDF Exporter
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, Bravura font resolution
- **Commits**: `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: `--format pdf --output /tmp/overview.pdf docs/examples/overview.drum` creates a non-empty multi-page-capable PDF with `%PDF` header, preserved page dimensions, and detectable embedded Bravura font resource/name; missing Bravura font causes exit code `1` with a clear error.
- **Dependencies**: Tasks 3 and 4.

### Task 7: MusicXML And Primary Export Integration Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, small `.drum` fixtures
- **Commits**: `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests cover `musicxml`, `svg`, `pdf`, stdin, invalid flags, recoverable diagnostics, `--pages all`, `--pages first`, and missing-font PDF failure. `cargo test -p drummark-cli`, `cargo test -p drummark-core`, and `cargo test -p drummark-layout` pass.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8: Primary Docs And Learnings
- [x] **Status**: Done
- **Scope**: project docs, `LEARNINGS.md`
- **Commits**: `docs(cli): document native export command`
- **Acceptance Criteria**: Docs describe build/run commands, supported first-release formats, stdin/stdout behavior, `--pages all|first`, PDF font resolution/failure behavior, and known limitations. Docs do not advertise native `ast` or `ir` support.
- **Dependencies**: Task 7.

### Task 9: Deferred Developer JSON Formats
- [x] **Status**: Done
- **Scope**: future proposal/task or explicit follow-up issue
- **Commits**: none in the primary export branch unless separately approved
- **Acceptance Criteria**: Native `ast` and `ir` are either left unimplemented and absent from help text, or implemented only after a separate approved scope update. This task is a recorded deferral and does not block primary export completion.
- **Dependencies**: None for primary export completion.

### Task 10: Post-Merge Archival
- [ ] **Status**: Done
- **Scope**: `docs/proposals/ARCHITECTURE_proposal_native_cli_exports.md`, `docs/proposals/ARCHITECTURE_tasks_native_cli_exports.md`, `docs/archived/`
- **Commits**: `docs(cli): archive native cli proposal`
- **Acceptance Criteria**: After branch review and squash merge to `main`, proposal and task files are moved to `docs/archived/` as the permanent historical record.
- **Dependencies**: Tasks 1 through 8, pre-merge review, and mainline integration.

### Review Round 3

Reviewer stance: constructively hostile task-ledger review limited to whether Revised Task Ordering v1.2 resolves the Review Round 2 blockers.

Findings:

- The missing pre-implementation consolidation step is fixed. Task 0 is explicit, has a no-code acceptance criterion, depends on approval plus user stamp, and Task 1 depends on Task 0. That satisfies the required protocol ordering before implementation begins.
- SVG behavior is now acceptance-testable. Task 5 requires default `--pages all` as a single stacked SVG and `--pages first` as page 0 only; Task 7 adds integration coverage for both. This closes the earlier "deterministic but undocumented" loophole.
- PDF font behavior is deterministic at task level. Task 3 prototypes embedded Bravura with `--font` or `public/fonts/Bravura.otf`, missing-font failure, `%PDF`, page dimensions, and `LEARNINGS.md` recording. Task 6 carries that into the production exporter with an embedded Bravura resource/name check and clear exit-code behavior.
- `ast` and `ir` are no longer able to poison the first implementation contract. Task 1 help text excludes them, Task 8 docs must not advertise them, and Task 9 is an explicit non-blocking deferral outside primary export completion.
- Binary ownership and feature gating are now concrete acceptance criteria in Task 2. The task requires a native `layout` feature, makes `layout-wasm` depend on it rather than monopolizing render-score access, blocks wasm-bindgen entrypoint usage from the CLI, and requires only `drummark-cli` to own the production `drummark` binary.
- The SVG-mediated PDF coupling is removed. Task 3 records embedded-Bravura PDF as the selected strategy, Task 6 depends only on Tasks 3 and 4, and Task 5 is not a hidden prerequisite for PDF. Shared primitive helpers are acceptable because they are explicitly introduced at the prototype/helper layer rather than smuggled through the full SVG exporter.

The task list is now independently implementable for the primary milestone. The only caution is operational: Task 9 should remain a recorded deferral and should not be marked as required for the primary branch unless the user separately approves developer JSON scope.

STATUS: APPROVED

### Author Response

User-requested amendment after Round 8 approval: add raw layout scene debug output and change PDF text font routing from script-based routing to glyph-coverage-based routing.

### Revised Task Amendments v1.8

### Task 1 Amendment: Scene Format And Fallback Font Flag
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text lists first-release formats `musicxml`, `svg`, `pdf`, `ast`, `ir`, and `scene`; identifies `ast`, `ir`, and `scene` as developer/debug formats with unstable JSON schemas; includes `--font <PATH>` for Bravura and `--fallback-font <PATH>` for text glyphs not covered by Bravura; does not include `--cjk-font`, `--pages`, or `xml`.
- **Dependencies**: Task 0.

### Task 4 Amendment: Raw Layout Scene Output
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`, `crates/drummark-cli/src/json.rs` or equivalent DTO module
- **Commits**: covered by `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: `--format scene` emits parseable JSON for the raw `LayoutScene` produced by `drummark-layout`; it can write to stdout by default or to `--output`; schema stability is not promised. `--format ast` and `--format ir` behavior from v1.6 remains intact.
- **Dependencies**: Task 2.

### Task 3 Amendment: Coverage-Based Font Subset Prototype
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, font coverage/subsetting prototype, `LEARNINGS.md`
- **Commits**: covered by `chore(cli): validate native svg and pdf export strategy`
- **Acceptance Criteria**: Prototype selects dependencies that can inspect Bravura glyph coverage, split text by Bravura-covered versus fallback-required glyph runs, subset-embed Bravura OTF from `public/fonts/bravura.otf` or valid `--font`, and subset-embed at least one accepted fallback Hei/CJK sans font input. Full-font embedding remains insufficient. The prototype treats invalid explicit `--font` and invalid explicit `--fallback-font` as hard failures with no fallback, records selected dependencies, fallback candidate paths/formats, and TTC limitations in `LEARNINGS.md`.
- **Dependencies**: Task 2.

### Task 6 Amendment: Production PDF Coverage-Based Text Routing
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, font resolution and text-run splitting
- **Commits**: covered by `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: Production PDF subsets Bravura for `GlyphRun` notation output and for `TextRun` character runs covered by Bravura; subsets the fallback Hei/CJK sans font for `TextRun` character runs not covered by Bravura; splits each `TextRun` into contiguous coverage-based font runs while preserving character order, baseline, and measured sequential advance; verifies glyph coverage before writing; fails with exit code `1` on invalid explicit `--font`, invalid explicit `--fallback-font`, missing Bravura, missing required notation glyphs, or any text glyph not covered by Bravura when no subset-embeddable fallback font covers it.
- **Dependencies**: Tasks 3 and 4.

### Task 7 Amendment: Scene And Fallback Font Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, mixed-text fixture
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests verify `--format scene` returns parseable JSON with representative page/item data; tests verify successful mixed-text PDF generation when `DRUMMARK_TEST_FALLBACK_FONT` points to a readable subset-embeddable fallback font or when a prototype-documented platform candidate is available; otherwise only that success case is skipped with a clear reason. Tests always cover invalid explicit `--fallback-font` failure and invalid explicit `--font` failure.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8 Amendment: Scene And Fallback Font Documentation
- [x] **Status**: Done
- **Scope**: project docs, `LEARNINGS.md`
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs describe `scene` as an unstable developer/debug `LayoutScene` JSON output; docs describe Bravura path resolution (`--font`, then `public/fonts/bravura.otf`), fallback font resolution (`--fallback-font`, then documented platform candidates only when needed), strict explicit-override failure behavior, font subsetting requirement, Bravura glyph coverage detection, fallback routing for glyphs not covered by Bravura, test font behavior, and failure behavior for missing or unembeddable fonts.
- **Dependencies**: Task 7.

### Author Response

User-requested amendment after Round 7 approval: remove the `xml` alias from the first-release CLI and expose only `musicxml` for MusicXML output.

### Revised Task Amendments v1.7

### Task 1 Amendment: Remove XML Alias
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text lists first-release formats `musicxml`, `svg`, `pdf`, `ast`, and `ir`; it does not list or accept `xml`; `ast` and `ir` remain developer/debug formats with unstable JSON schemas; `--pages` remains absent.
- **Dependencies**: Task 0.

### Task 4 Amendment: MusicXML Format Name
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`
- **Commits**: covered by `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: `--format musicxml` emits MusicXML; `--format xml` is rejected as an invalid format with CLI usage exit code `2`.
- **Dependencies**: Task 2.

### Task 7 Amendment: No XML Alias Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests cover successful `--format musicxml` output and invalid-format rejection for `--format xml`.
- **Dependencies**: Task 4.

### Task 8 Amendment: MusicXML Documentation
- [x] **Status**: Done
- **Scope**: project docs
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs use `musicxml` as the only MusicXML format name and do not document `xml` as an alias.
- **Dependencies**: Task 7.

### Author Response

User-requested amendment after Round 6 approval: add `ast` and `ir` back to the first-release CLI as developer formats for the project author's own debugging use.

### Revised Task Amendments v1.6

### Task 1 Amendment: Developer Formats In Help Text
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text lists first-release formats `musicxml`, `xml`, `svg`, `pdf`, `ast`, and `ir`; identifies `xml` as a `musicxml` alias; identifies `ast` and `ir` as developer/debug formats with unstable JSON schemas; still omits `--pages`.
- **Dependencies**: Task 0.

### Task 4 Amendment: AST And IR Pipeline Outputs
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/export.rs`, `crates/drummark-cli/src/json.rs` or equivalent DTO module
- **Commits**: covered by `feat(cli): wire parser normalizer layout export pipeline`
- **Acceptance Criteria**: `--format ast` emits parseable JSON with a parser AST/debug envelope; `--format ir` emits parseable JSON with normalized or render-ready score data sufficient for CLI debugging; both formats can write to stdout by default or to `--output`; schema stability is not promised.
- **Dependencies**: Task 2.

### Task 7 Amendment: Developer Format Smoke Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests verify `--format ast` and `--format ir` return parseable JSON and include representative header/measure data. Tests intentionally avoid locking the full schema.
- **Dependencies**: Task 4.

### Task 8 Amendment: Developer Format Documentation
- [x] **Status**: Done
- **Scope**: project docs
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs mention `ast` and `ir` as developer/debug formats for local inspection and state that their JSON schemas are unstable. Docs continue to describe `musicxml`, `svg`, and `pdf` as the user-facing export formats.
- **Dependencies**: Task 7.

### Task 9 Amendment: Deferral Removed
- [x] **Status**: Done
- **Scope**: task ledger only
- **Commits**: none
- **Acceptance Criteria**: The previous Task 9 deferral for developer JSON formats is superseded by v1.6. Implementation should treat `ast` and `ir` as first-release developer formats rather than deferred work.
- **Dependencies**: Task 7.

### Author Response

User-requested amendment after Round 5 approval: remove `--pages all|first` from the first-release CLI. Primary exports should always include the complete score.

### Revised Task Amendments v1.5

### Task 1 Amendment: Remove Page Selection From CLI Contract
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text does not include `--pages`; first-release SVG and PDF exports are documented as complete-score exports.
- **Dependencies**: Task 0.

### Task 5 Amendment: SVG Always Exports All Pages
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/svg.rs`, SVG-focused tests
- **Commits**: covered by `feat(cli): render layout scenes to svg`
- **Acceptance Criteria**: `--format svg` emits one SVG document containing every `LayoutScene` page stacked vertically with a fixed page gap; the SVG width is the maximum page width and the height is the sum of page heights plus gaps. There is no `--pages first` behavior in the first release.
- **Dependencies**: Tasks 3 and 4.

### Task 7 Amendment: Complete-Score Page Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, multi-page fixture
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests verify SVG export includes all pages for a multi-page score and PDF export emits every `LayoutScene` page as a PDF page. Tests no longer cover `--pages first`.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8 Amendment: Complete-Score Export Documentation
- [x] **Status**: Done
- **Scope**: project docs
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs state SVG and PDF exports include the complete score. Docs do not mention `--pages`.
- **Dependencies**: Task 7.

### Author Response

User-requested amendment after Round 3 approval: PDF font handling should use font subsetting and route title/text fonts by script. This changes Task 3, Task 6, Task 7, and Task 8 acceptance criteria, so the task ledger needs another review round.

### Revised Task Amendments v1.3

### Task 1 Amendment: CLI Font Flags
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/args.rs`, help text
- **Commits**: covered by `feat(cli): add native drummark command contract`
- **Acceptance Criteria**: Help text includes `--font <PATH>` for Bravura notation/non-CJK text output and `--cjk-font <PATH>` for CJK text output. Help text states first-release formats only: `musicxml`, `xml`, `svg`, and `pdf`.
- **Dependencies**: Task 0.

### Task 3 Amendment: Font Subset Strategy Prototype
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, font loading/subsetting prototype, `LEARNINGS.md`
- **Commits**: covered by `chore(cli): validate native svg and pdf export strategy`
- **Acceptance Criteria**: Prototype proves that the selected PDF crate can subset Bravura from `public/fonts/bravura.otf` or `--font`; can route CJK text to `--cjk-font` or a documented platform CJK sans/Hei candidate; fails clearly when CJK text is present but no embeddable CJK font is available; records the chosen font/subset strategy and any TTC limitations in `LEARNINGS.md`.
- **Dependencies**: Task 2.

### Task 6 Amendment: Production PDF Font Routing
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/src/pdf.rs`, PDF-focused tests, font resolution
- **Commits**: covered by `feat(cli): render layout scenes to pdf`
- **Acceptance Criteria**: Production PDF output subsets Bravura for `GlyphRun` notation output and non-CJK `TextRun` text; subsets a CJK sans/Hei font for CJK characters; verifies glyph coverage before writing; fails with exit code `1` on missing Bravura, missing required Bravura glyph coverage, or CJK text without an embeddable CJK font.
- **Dependencies**: Tasks 3 and 4.

### Task 7 Amendment: CJK PDF Tests
- [x] **Status**: Done
- **Scope**: `crates/drummark-cli/tests/`, small CJK-title `.drum` fixture
- **Commits**: covered by `test(cli): cover native primary export formats`
- **Acceptance Criteria**: Tests cover successful CJK-title PDF generation when `--cjk-font` or a documented platform candidate is available, plus failure when CJK text is present and the configured CJK font path is missing. Tests still cover missing Bravura failure separately.
- **Dependencies**: Tasks 4, 5, and 6.

### Task 8 Amendment: Font Documentation
- [x] **Status**: Done
- **Scope**: project docs, `LEARNINGS.md`
- **Commits**: covered by `docs(cli): document native export command`
- **Acceptance Criteria**: Docs describe Bravura path resolution (`--font`, then `public/fonts/bravura.otf`), CJK font resolution (`--cjk-font`, then documented platform candidates), font subsetting behavior, glyph coverage validation, and failure behavior for missing fonts.
- **Dependencies**: Task 7.

### Review Round 4

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.3 are implementation-ready and consistent with the approved v1.2 task order.

Findings:

- The amendments preserve the v1.2 ordering shape. Task 1 adds CLI flags after Task 0, Task 3 prototypes font mechanics after core integration, Task 6 implements production PDF routing after the prototype and pipeline, Task 7 tests after exporters, and Task 8 documents after tests. That does not introduce a hidden dependency on the SVG exporter or reorder the approved primary path.
- The Bravura path is corrected to the actual checked-in lowercase asset, `public/fonts/bravura.otf`, in Tasks 3 and 8. That resolves the concrete path mismatch from v1.2.
- Task 3 is too permissive about subsetting. "Prototype proves that the selected PDF crate can subset" is directionally right, but the task does not say the prototype must reject a crate/path that only embeds full fonts. The task should explicitly require a selected strategy that subsets Bravura OTF and the accepted CJK font format before Task 6 may start.
- Task 1 and Task 6 do not fully define override failure precedence. The plan should state that an invalid explicit `--font` fails instead of falling back to workspace Bravura, and an invalid explicit `--cjk-font` fails instead of falling back to platform candidates. Without this, tests and implementation can disagree about whether explicit user configuration has strict precedence.
- Task 6 has a hidden text-shaping/routing detail. It requires Bravura for non-CJK `TextRun` text and CJK sans/Hei for CJK characters, but it does not say mixed-script text must be split into font-specific PDF text runs while preserving character order and positions. That is a real implementation boundary, not cosmetic detail, because otherwise a CJK title containing Latin text can be rendered with the wrong font or fail coverage checks unnecessarily.
- Task 7's success test is host-dependent. It says CJK-title PDF generation succeeds when `--cjk-font` or a documented platform candidate is available, but it does not define what happens on CI or developer machines without such a font. The task needs either a checked-in/free test CJK font, an environment-variable-controlled test path with explicit skip semantics, or an acceptance criterion that the success case is skipped with a clear reason while the missing-font failure test always runs.
- Task 8 documentation coverage is close but should include the strict explicit-override rule, mixed-script routing behavior, and the test/prototype-discovered platform candidate list. Otherwise docs can accurately describe the happy path while omitting the failure modes that protect users from garbled PDF output.

Required changes before approval:

- Add a hard Task 3 gate that selected dependencies must support deterministic font subsetting for the required font inputs, with full-font embedding rejected for this proposal.
- Add strict `--font` and `--cjk-font` explicit-path failure rules to Task 1, Task 6, Task 7, and Task 8 as appropriate.
- Add mixed-script `TextRun` splitting/routing acceptance criteria to Task 6.
- Add a CI-safe CJK font test contract to Task 7.

STATUS: CHANGES_REQUESTED

### Review Round 5

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.4 close the Round 4 task-ledger blockers while preserving the approved v1.2 ordering.

Findings:

- Task 3 now makes font subsetting a hard gate. It requires deterministic subset embedding for Bravura OTF and at least one accepted CJK sans/Hei input, rejects full-font embedding as insufficient, and records dependencies, accepted formats, paths, platform candidates, and TTC limitations in `LEARNINGS.md`.
- Task 1, Task 3, Task 6, Task 7, and Task 8 now carry strict explicit-path behavior consistently. Invalid explicit `--font` and `--cjk-font` are hard failures; Task 8 also documents that platform CJK candidates are considered only when no explicit CJK font is supplied.
- Platform CJK behavior is bounded enough for implementation. v1.4 requires accepted candidates to be prototype-documented, requires CJK PDF output to fail when no embeddable CJK font is available, and documents missing or unembeddable font failure behavior.
- Task 6 now defines the mixed-script `TextRun` boundary. Production PDF must split mixed-script text into contiguous CJK and non-CJK font runs while preserving character order, baseline, and measured sequential advance before writing.
- Task 7 is CI-safe. The CJK success test uses `DRUMMARK_TEST_CJK_FONT` first, then a prototype-documented platform candidate, and otherwise skips only that success case with a clear reason; invalid explicit `--cjk-font` and invalid explicit `--font` failure tests always run.
- The amendments remain consistent with the v1.2 ordering. They attach to Tasks 1, 3, 6, 7, and 8 without changing dependencies or making PDF depend on the SVG exporter beyond the already-approved primary integration-test grouping.

No Round 4 task blocker remains open. The task amendments are independently implementable within the v1.2 plan and do not introduce hidden coupling.

STATUS: APPROVED

### Review Round 6

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.5 are coherent, implementation-ready, and consistent with the approved v1.2/v1.4 task ordering.

Findings:

- Task 1 Amendment correctly removes page selection from the first-release command contract. Help text must omit `--pages`, and first-release SVG/PDF behavior is framed as complete-score export rather than a user-selectable page mode.
- Task 5 Amendment is implementation-ready and does not introduce hidden coupling. It depends on Tasks 3 and 4 as before, consumes `LayoutScene` pages from the shared pipeline, and only changes the SVG exporter acceptance criteria from `--pages all|first` to unconditional all-page stacked output.
- Task 7 Amendment correctly updates integration coverage. It removes `--pages first` tests and replaces them with multi-page complete-score assertions for both SVG and PDF. That is consistent with Task 6's PDF exporter dependency and does not require SVG to be complete before PDF beyond the already-approved integration-test grouping.
- Task 8 Amendment correctly updates documentation scope. Docs must state that SVG and PDF include the complete score and must not mention `--pages`; this supersedes older v1.2 Task 8 language requiring `--pages all|first` documentation.
- The v1.5 amendments remain compatible with v1.4 font-routing work. They do not alter Task 3's font-subsetting prototype gate, Task 6's production PDF font routing, or Task 7's CI-safe CJK tests; they only remove page slicing from the public CLI and tests.
- Multi-page tests are feasible. A small fixture can force multiple `LayoutScene` pages through existing layout settings or a purpose-built fixture; SVG can assert repeated page groups and total stacked dimensions, while PDF can assert page count and per-page dimensions without inspecting notation glyph rendering in detail.

No v1.5 task blocker remains open. The amendments are independently implementable within the existing task order, provided implementers treat older `--pages all|first` acceptance criteria in v1.2 as superseded by this latest amendment.

STATUS: APPROVED

### Review Round 7

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.6 coherently restore first-release `ast` and `ir` developer formats without disrupting the approved primary export plan.

Findings:

- Task 1's help-text amendment is coherent. It lists `musicxml`, `xml`, `svg`, `pdf`, `ast`, and `ir`, keeps `xml` identified as a `musicxml` alias, marks `ast` and `ir` as developer/debug formats with unstable JSON schemas, and still omits `--pages`.
- Task 4's pipeline amendment is implementation-ready. It scopes `ast` and `ir` to parseable JSON debug envelopes, allows stdout or `--output`, and explicitly avoids promising schema stability. Depending on Task 2 is acceptable because the native CLI binary ownership, feature gating, and command shell need to exist before these pipeline outputs are wired.
- Task 7's test amendment avoids the old optional-format blocking ambiguity. The tests require parseable JSON and representative header/measure data, but intentionally avoid locking the full schema. That is enough to prevent broken outputs without turning unstable debug JSON into a stable external contract.
- Task 8's documentation amendment preserves the primary export hierarchy. It documents `ast` and `ir` for local inspection while continuing to describe `musicxml`, `svg`, and `pdf` as the user-facing export formats.
- Task 9's deferral removal is clear. The previous recorded deferral is superseded by v1.6, so implementers should no longer treat `ast` and `ir` as optional later work; they are first-release developer formats. This does not reintroduce ambiguity because the amended tasks attach them to existing CLI, pipeline, test, and docs milestones.
- The dependency graph remains coherent. `ast` and `ir` ride on the core CLI/pipeline path and their smoke tests depend on Task 4; they do not become prerequisites for the PDF font-subsetting prototype, production PDF routing, complete-score SVG/PDF behavior, or CJK font tests.
- The complete-score and font-subsetting requirements remain intact. v1.6 does not modify Task 3, Task 5, Task 6, or the v1.5/v1.4 amendments, so SVG/PDF all-page export and deterministic PDF font subsetting remain primary acceptance criteria.

No v1.6 task-ledger blocker remains open. The amendments are implementation-ready, with the important constraint that `ast`/`ir` tests and docs must stay smoke-level and developer-facing rather than freezing a full JSON schema.

STATUS: APPROVED

### Review Round 8

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.7 are coherent, implementation-ready, and compatible with the approved task graph.

Findings:

- Task 1's amendment correctly narrows the first-release help and argument contract to `musicxml`, `svg`, `pdf`, `ast`, and `ir`. It also preserves the already-approved constraints that `ast` and `ir` are developer/debug formats with unstable JSON schemas and that `--pages` remains absent.
- Task 4's amendment is implementation-ready for the MusicXML spelling change. `--format musicxml` is the only successful MusicXML path, while `--format xml` is rejected with CLI usage exit code `2`; this is clear enough to implement either in typed argument parsing or in the format-dispatch boundary.
- Task 7's amendment closes the compatibility risk. Tests must cover successful `musicxml` output and explicit invalid-format rejection for `xml`, so the old TS CLI alias cannot survive unnoticed.
- Task 8's amendment removes stale documentation risk. Project docs must use `musicxml` as the only MusicXML format name and must not preserve `xml` in examples, help-derived text, or alias notes.
- The dependency graph remains coherent. Task 1 still depends only on Task 0, Task 4 still follows the pipeline foundation in Task 2, Task 7 still depends on Task 4, and Task 8 still follows test coverage. No new hidden dependency is introduced for SVG, PDF, font subsetting, or developer JSON output.
- The v1.7 task amendments do not disturb complete-score SVG/PDF behavior or PDF font work. Tasks 3, 5, and 6 remain governed by the prior approved amendments for deterministic font subsetting, all-page SVG export, and all-page PDF export.

No v1.7 task-ledger blocker remains open. The amendments are implementation-ready, with earlier v1.6 `xml` alias acceptance criteria now superseded by v1.7 wherever they conflict.

STATUS: APPROVED

### Review Round 9

Reviewer stance: constructively hostile review limited to whether Revised Task Amendments v1.8 are coherent, implementation-ready, and compatible with the approved task graph.

Findings:

- Task 1's amendment correctly updates the CLI contract. Help text must list `musicxml`, `svg`, `pdf`, `ast`, `ir`, and `scene`; mark `ast`, `ir`, and `scene` as unstable developer/debug JSON formats; expose `--font` and `--fallback-font`; and omit stale `--cjk-font`, `--pages`, and `xml` entries.
- Task 4's amendment is implementation-ready for raw scene output. `--format scene` is scoped to parseable raw `LayoutScene` JSON from `drummark-layout`, can write to stdout or `--output`, and does not promise schema stability. This composes cleanly with the existing `ast` and `ir` debug outputs.
- Task 3's prototype gate remains strong after the fallback-font change. It still requires deterministic subset embedding, rejects full-font embedding as insufficient, adds Bravura glyph-coverage inspection, and requires prototype documentation of fallback candidate paths, accepted formats, dependencies, and TTC limitations in `LEARNINGS.md`.
- Task 6 defines the production PDF routing boundary clearly enough. It requires Bravura subsets for notation `GlyphRun` output and Bravura-covered `TextRun` character runs; fallback Hei/CJK sans subsets for `TextRun` characters not covered by Bravura; contiguous coverage-based run splitting; preserved character order, baseline, and measured sequential advance; and glyph coverage validation before writing.
- Strict explicit-font failure behavior is covered in the right places. Task 3 prototypes invalid explicit `--font` and `--fallback-font` as hard failures with no fallback, Task 6 requires exit code `1` for those production failures, and Task 7 always tests both invalid explicit paths.
- Platform fallback usage stays conditional rather than ambient. Task 7's success path uses `DRUMMARK_TEST_FALLBACK_FONT` or a prototype-documented platform candidate and skips only that success case when neither is available; Task 8 documents platform fallback candidates as used only when needed. This preserves host-safe testing without permitting silent viewer or platform substitution.
- The dependency graph remains coherent. `scene` attaches to Task 4 and is tested/documented in Tasks 7 and 8; fallback-font prototype work remains in Task 3 before production PDF routing in Task 6; integration tests still follow exporters. No amendment makes PDF depend on SVG or weakens complete-score SVG/PDF export requirements.
- The v1.8 task amendments supersede CJK-only wording without dropping the original safety properties. The broader fallback-font rule keeps subsetting, glyph coverage validation, strict override failure, and skipped-when-unavailable success tests intact while making routing coverage-based instead of script-based.

No v1.8 task-ledger blocker remains open. The amendments are independently implementable within the existing task order, with older `--cjk-font` and script-classification criteria treated as obsolete where they conflict with v1.8.

STATUS: APPROVED
