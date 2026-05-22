# RENDER_LAYOUT_CONTRACT_tasks_rest_placement.md

### Task 1: Extract slot obstacle geometry for rest placement
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `refactor(layout): extract slot obstacle geometry for rest placement`
- **Acceptance Criteria**:
  - Introduce internal obstacle structs/helpers for notehead, ledger line, stem, beam, accent, and emitted-rest bounds.
  - Obstacle extraction is computed from existing layout data and helper functions; it does not read back from SVG output.
  - Helper output is testable in isolation from rest lane selection.
  - Existing slot-center alignment tests still pass unchanged.
- **Dependencies**: None

### Task 2: Implement canonical rest lane resolver
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `feat(layout): add collision-aware rest lane resolver`
- **Acceptance Criteria**:
  - Voice-specific canonical lane sequences are defined in one place.
  - Resolver accepts rest event + slot center + obstacle list and returns a deterministic placement.
  - Resolver chooses the first collision-free lane, else the least-overlapping fallback lane.
  - Resolver is unit-tested with hand-built obstacle fixtures, without requiring full scene rendering.
- **Dependencies**: Task 1

### Task 3: Integrate rest lane resolution into slot rendering
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs` (`render_slot_group()` and adjacent helpers)
- **Commits**: `feat(layout): place rests using slot-local collision model`
- **Acceptance Criteria**:
  - `render_slot_group()` keeps current X-center behavior for rests.
  - Rest Y placement is driven by Task 2's resolver instead of the current fixed `staff_top + 20/30` constants.
  - Rest placements emitted earlier in the same slot are fed back as obstacles for later rests.
  - `hide_voice2_rests` still short-circuits hidden rests before placement.
  - No adapter-side geometry nudging is introduced.
- **Dependencies**: Task 2

### Task 4: Preserve special-case behavior for pure-rest and whole-measure slots
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs`, rest-related layout tests
- **Commits**: `test(layout): preserve whole-measure and pure-rest placement semantics`
- **Acceptance Criteria**:
  - Whole-measure rests remain aligned to the first-beat grid.
  - Pure-rest slots still produce deterministic positions without requiring any hit in the slot.
  - Hidden voice-2 rests do not reserve space.
  - Tests cover whole-measure rest, pure-rest slot, and alternating two-voice rest/hit patterns.
- **Dependencies**: Task 3

### Task 5: Add collision regressions for stems, beams, accents, and dual rests
- [ ] **Status**: Pending
- **Scope**: `crates/drummark-layout/src/lib.rs`, any layout-scene assertions needed by renderer tests
- **Commits**: `test(layout): add rest collision regression coverage`
- **Acceptance Criteria**:
  - Add at least one test where a rest avoids a same-slot accented hit.
  - Add at least one test where a rest avoids a beamed same-slot hit.
  - Add at least one test where two visible rests in the same slot resolve to distinct vertical lanes.
  - Assertions are based on layout scene geometry, not visual guesswork.
- **Dependencies**: Task 4

### Task 6: Verify end-to-end behavior and consolidate spec
- [ ] **Status**: Pending
- **Scope**: Rust tests, CLI verification, docs consolidation
- **Commits**: `chore(layout): verify smart rest placement and append contract addendum`
- **Acceptance Criteria**:
  - Relevant Rust tests pass.
  - `npm run drummark -- docs/examples/basic.drum --format svg` succeeds.
  - Approved addendum text is appended to `docs/RENDER_LAYOUT_CONTRACT.md`.
  - This tasks file marks completed tasks as done during implementation.
- **Dependencies**: Task 5

### Review Status

Sub-agent review is still required by repository policy before implementation begins. This turn prepares the task breakdown only.

### Review Round 1

1. **Task 1 is not a complete foundation task yet; it hides a refactor dependency that currently lives inside `render_hit_cluster()`.**
   The current layout code does not expose enough pre-emission geometry to satisfy Task 1 as written. `render_hit_cluster()` emits noteheads and ledger lines immediately, and `HitClusterPlan` only carries note placements plus stem/beam metadata, not ledger-line boxes, predicted stem boxes, predicted accent boxes, or any beam occupancy geometry. That means Task 2 cannot truly depend on Task 1 alone, because the obstacle list promised by Task 1 cannot be produced from the current returned data shape. Action: either broaden Task 1 so it explicitly refactors `render_hit_cluster()` to return a richer cluster-geometry plan before scene emission, or split out a new prerequisite task for that intermediate geometry model. The acceptance criteria should name which obstacle kinds are produced directly by Task 1 outputs and how they are unit-tested without going through scene items.

2. **Task 2 and Task 3 split one algorithm across two tasks, which creates hidden coupling around fallback behavior and warnings.**
   The proposal requires more than “pick a deterministic lane”: when all candidates collide, the solver must choose the least-overlapping lane, prefer the default lane when scores tie, and surface a non-fatal warning into `LayoutScene.issues`. Task 2 currently stops at placement selection, while Task 3 owns integration. That leaves the fallback scoring contract and warning emission partially unspecified between tasks. Action: make Task 2 return the full resolver result needed by integration, including overlap/tie-break outcome and whether a warning should be emitted, so Task 3 only wires the result into scene generation instead of re-implementing solver policy.

3. **The current plan does not define a stable ordering rule for multiple visible rests in one slot.**
   The proposal says later rests must avoid earlier placed rests, but the tasks never state what “earlier” means. In the current code, slot events are sorted by start, then voice, then staff position; relying on that incidental ordering would make Task 2 fixtures and Task 3 integration fragile. Action: add an explicit ordering rule to the tasks file, such as solving visible rests in stable voice/event order after `hide_voice2_rests` filtering, and require Task 2 or Task 3 tests to assert that order.

4. **Task 3 and Task 4 are sequenced incorrectly; the “special cases” are part of the integration contract, not a post-integration add-on.**
   Pure-rest fallback centering, whole-measure first-beat alignment, and `hide_voice2_rests` short-circuiting all live on the same `render_slot_group()` path that Task 3 modifies. If those rules are postponed to Task 4, then Task 3 can pass while still breaking existing semantics, which means the tasks are not independently valid. Action: move the semantic requirements for pure-rest slots, whole-measure rests, and hidden voice-2 rests into Task 3 acceptance criteria, and leave Task 4 as regression coverage only. If Task 4 is meant to include code, then it should be re-scoped as a prerequisite integration task rather than a preservation pass.

5. **Coverage is incomplete relative to the proposal acceptance criteria.**
   The proposal requires collision avoidance against noteheads, stems, beams, and accents. Task 5 only requires accent, beam, and dual-rest regressions; its title mentions stems, but its acceptance criteria do not. There is also no explicit notehead-collision regression after the new Y-placement work. Action: add at least one geometry assertion for notehead avoidance and one for stem avoidance, both based on layout-scene bounds rather than rendered SVG inspection.

6. **Task 6’s verification gate is narrower than the proposal’s stated acceptance criteria.**
   The proposal’s acceptance criteria call for the CLI SVG check plus the related Rust and TypeScript test suites. Task 6 currently requires only “relevant Rust tests pass” and one CLI smoke check. If the intent is Rust-only verification, that should be justified explicitly; otherwise the task is incomplete. Action: either add the relevant adapter/TS verification step or state clearly why no TypeScript-side contract is affected by this change.

STATUS: CHANGES_REQUESTED

### Review Round 3

1. **The beam-envelope coupling issue is now resolved.**
   The new Task 2 clarification makes the non-local beam inputs explicit: obstacle extraction must use finalized slot geometry plus already-assembled beam-group context for run membership and stem direction, and it must document whether the envelope comes from predicted same-run stem-tip geometry, beam-thickness budget, or both. That closes the earlier ambiguity about whether beam avoidance depended on reading back final emitted beam scene items or on hidden later-stage assembly.

2. **The final verification gate is now concrete enough to be executable.**
   The new Task 7 clarification replaces the vague conditional with an actionable rule: run the active TypeScript rendering checks that consume rest geometry when they exist, and if they no longer exist, record that fact and treat Rust-side, CLI SVG, and corpus verification as the active contract gate. That is specific enough for implementation-time completion without interpretation drift.

3. **No new critical hidden coupling appears in the Round 3 amendment.**
   The remaining task order still reads as independently testable and correctly sequenced: geometry plan, obstacle extraction, resolver policy, slot integration, preservation regressions, collision regressions, then final verification and consolidation.

STATUS: APPROVED

### Author Response

1. Accepted. The beam-obstacle task needs an explicit statement about what non-local beam context is available before final beam emission.
2. Accepted. The final verification gate should name concrete TypeScript checks instead of leaving them to implementation-time interpretation.

### Task Plan Amendment v1.2

This section supersedes conflicting details in Task Plan Amendment v1.1.

### Task 2 Clarification: Beam-envelope inputs are explicit

Task 2 additionally requires:

- obstacle extraction for the conservative same-slot beam envelope must be derived from finalized slot geometry plus the beam-group context already assembled for that slot's run membership and stem-direction data
- the helper must document whether the envelope is based on predicted same-run stem-tip geometry, local beam-thickness budget, or both
- the helper must be unit-tested without reading final emitted beam scene items back out

### Task 7 Clarification: TypeScript verification is concrete

Task 7 additionally requires:

- run the TypeScript rendering checks that consume `LayoutScene` rest geometry, at minimum the active SVG adapter/parity coverage for rests if those suites are present in the repository at implementation time
- if no such TypeScript suite exists anymore, record that the active contract verification is Rust-side plus CLI SVG and corpus checks only

### Author Response

1. Accepted. The current task stream hid a prerequisite geometry refactor. The revised plan adds an explicit foundation task that makes hit-cluster geometry available before scene emission.
2. Accepted. The resolver task must own the full fallback policy, including tie-breaks and diagnostic intent, so integration does not re-implement solver semantics.
3. Accepted. The revised plan adds an explicit stable same-slot rest ordering rule.
4. Accepted. Pure-rest fallback, whole-measure alignment, and `hide_voice2_rests` semantics are moved into the integration task instead of being deferred.
5. Accepted. The regression task now explicitly requires notehead and stem avoidance assertions in addition to accent, beam, and dual-rest coverage.
6. Accepted. End-to-end verification now includes the relevant TypeScript-side checks only where the contract surface is actually affected.

### Task Plan Amendment v1.1

The following task stream supersedes the earlier task list for implementation planning.

### Task 1: Refactor hit-cluster planning into reusable finalized geometry
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `refactor(layout): expose finalized hit-cluster geometry for slot planning`
- **Acceptance Criteria**:
  - Extract a reusable geometry plan that includes finalized displaced `NotePlacement` data before scene emission.
  - The plan exposes enough information to derive notehead, ledger-line, stem, and accent obstacle boxes without reading scene items back out.
  - The task is independently testable with targeted geometry assertions and does not yet change rest placement behavior.
- **Dependencies**: None

### Task 2: Add slot obstacle extraction helpers
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `refactor(layout): derive slot obstacle boxes from finalized cluster geometry`
- **Acceptance Criteria**:
  - Introduce internal obstacle structs/helpers for notehead, ledger line, stem, accent, conservative same-slot beam envelope, and emitted-rest bounds.
  - Obstacle extraction is computed from Task 1's finalized geometry outputs and existing helper logic.
  - Helper output is unit-tested in isolation from rest lane selection.
- **Dependencies**: Task 1

### Task 3: Implement canonical rest lane resolver with full fallback policy
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `feat(layout): add collision-aware rest lane resolver`
- **Acceptance Criteria**:
  - Voice-specific canonical lane sequences are defined in one place.
  - Lane values are defined against rest glyph bbox centers, not glyph origins.
  - Resolver accepts visible-rest ordering, slot center, obstacle list, and rest metric inputs.
  - Resolver returns the chosen placement plus fallback/tie-break metadata and diagnostic intent when no collision-free lane exists.
  - Resolver is unit-tested with hand-built obstacle fixtures, including deterministic tie-breaking.
- **Dependencies**: Task 2

### Task 4: Integrate resolver into slot rendering with stable rest order
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs` (`render_slot_group()` and adjacent helpers)
- **Commits**: `feat(layout): place rests using finalized slot geometry`
- **Acceptance Criteria**:
  - `render_slot_group()` keeps current X-center behavior for rests.
  - After `hide_voice2_rests` filtering, visible rests are solved by voice ascending and stable source event order.
  - Rest Y placement is driven by Task 3's resolver instead of the fixed `staff_top + 20/30` constants.
  - Rest placements emitted earlier in the same slot are fed back as obstacles for later rests.
  - Pure-rest slots, whole-measure rests, and hidden voice-2 rests preserve their current semantics during integration.
  - Diagnostic intent from Task 3 is plumbed to the scene issue assembly layer without adapter-side geometry nudging.
- **Dependencies**: Task 3

### Task 5: Add semantic preservation regressions for existing rest behavior
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`
- **Commits**: `test(layout): preserve existing whole-measure and alternating-rest semantics`
- **Acceptance Criteria**:
  - Whole-measure rests remain aligned to the first-beat grid.
  - Pure-rest slots still produce deterministic positions without requiring a hit in the slot.
  - Hidden voice-2 rests do not reserve space.
  - Existing alternating two-voice rest/hit center-alignment coverage remains green.
- **Dependencies**: Task 4

### Task 6: Add collision regressions for noteheads, stems, accents, beams, and dual rests
- [x] **Status**: Done
- **Scope**: `crates/drummark-layout/src/lib.rs`, any scene assertions needed by renderer tests
- **Commits**: `test(layout): add rest collision regression coverage`
- **Acceptance Criteria**:
  - Add at least one test where a rest avoids a same-slot notehead.
  - Add at least one test where a rest avoids a same-slot stem.
  - Add at least one test where a rest avoids a same-slot accented hit.
  - Add at least one test where a rest avoids a beamed hit whose beam group continues into another slot.
  - Add at least one test where two visible rests in the same slot resolve to distinct vertical lanes.
  - Assertions are based on layout scene geometry or directly tested resolver geometry, not visual guesswork.
- **Dependencies**: Task 5

### Task 7: Verify end-to-end behavior and consolidate the contract addendum
- [x] **Status**: Done
- **Scope**: Rust tests, CLI verification, docs consolidation
- **Commits**: `chore(layout): verify smart rest placement and append contract addendum`
- **Acceptance Criteria**:
  - Relevant Rust tests pass.
  - `npm run drummark -- docs/examples/basic.drum --format svg` succeeds.
  - If any TypeScript-side adapter or corpus checks depend on rest scene bounds, run the affected checks and record that coverage.
  - Approved addendum text is appended to `docs/RENDER_LAYOUT_CONTRACT.md`.
  - This tasks file marks completed tasks as done during implementation.
- **Dependencies**: Task 6

### Review Round 2

1. **The earlier sequencing and independence issues are largely resolved.**
   The revised plan now has a real geometry foundation task, a separate obstacle-derivation task, a resolver task that owns fallback semantics, an explicit same-slot rest ordering rule, and integration coverage that keeps pure-rest / whole-measure / hidden-voice semantics inside the integration contract instead of deferring them. The coverage gap for notehead and stem avoidance is also fixed in the regression task. Those were the major structural problems from Round 1, and the amendment addresses them well.

2. **One critical hidden coupling remains around beam obstacles: the plan still does not make explicit where the “conservative same-slot beam envelope” gets the cross-slot information it needs.**
   Task 2 now names a conservative beam envelope, and Task 6 correctly requires a regression where the colliding beam continues into another slot. That is the right behavior target, but the task breakdown still leaves an implementation ambiguity: actual beam occupancy in the current layout pipeline is not purely slot-local, because beam slope/extent depends on beam-run context assembled across multiple slots. As written, Task 1 only guarantees finalized hit-cluster geometry, and Task 2 says obstacle extraction comes from Task 1 outputs plus “existing helper logic,” but it does not explicitly require the beam-group context or anchor prediction needed to make that envelope independently testable. Action: strengthen Task 2 so its acceptance criteria say exactly what non-local beam data is available to obstacle extraction for a beamed rest-collision check, or add a narrow prerequisite note to Task 1/Task 2 stating that the beam envelope is intentionally derived from predicted same-run stem-tip geometry rather than final emitted beam scene items. Without that clarification, the beam part of the plan still has hidden coupling to later measure-level beam assembly.

3. **Task 7’s TypeScript verification gate is improved, but still not a fully verifiable acceptance criterion.**
   “If any TypeScript-side adapter or corpus checks depend on rest scene bounds” is directionally right, but it leaves the completion condition to implementation-time judgment. Since this is the final gate, it should say either that no TS checks are expected because the adapter is geometry-transparent for rest placement, or name the concrete TS/corpus checks to run if scene-bound semantics are touched. Action: replace the conditional wording with an explicit verification rule so the final task can be marked done without interpretation drift.

STATUS: CHANGES_REQUESTED
