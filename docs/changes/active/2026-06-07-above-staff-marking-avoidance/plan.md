# Above-Staff Marking Avoidance

## Status

draft - pending plan review

## Problem

The layout engine currently handles above-staff items in a piecemeal way. Rehearsal / section marks, tempo marks, navigation symbols/text, voltas, other system text, and future staff-local annotations will increasingly compete for the same vertical space. Solving this only inside the rehearsal feature would duplicate policy and create inconsistent stacking rules.

## Goal

Define and implement a reusable above-staff avoidance policy for layout that:
- preserves semantic anchors,
- uses publishing-style priority rather than a single hard-coded y order,
- keeps related items on the same visual row when that improves readability,
- reserves span objects before local text placement,
- and gives renderer / WASM consumers stable, deterministic output.

## Non-goals

- No parser or DSL syntax changes.
- No new user-facing notation elements in v1 of this change.
- No adapter-side collision fixes.
- No attempt to solve all below-staff placement in the same change.
- No page-header / title-area redesign.

## Current Plan

Introduce an explicit layout policy for above-staff items, split into two scopes:

1. `system-top structural markings`
   - volta / ending brackets
   - rehearsal / section anchors
   - tempo marks
   - navigation symbols/text: Segno, Coda, Fine, D.S., D.C.
   - other system text

2. `staff-local above-staff text`
   - sticking text
   - technique hints
   - local annotations tied to one staff

The policy should follow publishing-style placement rather than a single absolute `y` order. Items keep semantic ownership of their anchor; layout may adjust horizontal position locally when the anchor remains visually clear, then escalate to higher vertical lanes, then increase system-top padding if required.

For this change, a `lane` is a system-local horizontal band shared by above-staff items across the system. Lanes are not per-anchor objects. Different markings may share one lane when their resolved horizontal bounds do not overlap after local adjustment. Lane assignment is computed after anchor resolution and before final system box bounds are frozen.

Recommended default priority:

```text
1. Volta / ending brackets
2. Rehearsal marks
3. Tempo marks
4. Navigation symbols/text
5. Other system text
6. Staff-local text / technique text
```

Core behavior:
- Volta brackets are span objects and reserve horizontal plus vertical space first.
- Rehearsal marks keep the strongest structural position and should stay visually tied to their anchor barline or measure-local offset.
- If tempo and rehearsal share the same anchor, layout should prefer one row, e.g. `[A] Allegro q = 120`, before vertical stacking.
- Navigation items stay close to their semantic target, but yield to volta and rehearsal / tempo combinations.
- Other system text avoids already-reserved boxes.
- Staff-local text moves first when collisions remain.

Collision policy:
- Prefer local horizontal adjustment first when semantic anchoring remains obvious.
- If horizontal adjustment is insufficient, move to another vertical lane.
- If markings still collide, increase system-top padding.
- Do not overlap text, brackets, or symbols.
- Do not compress or break volta brackets to make room for text.

Tie-breaking and lane rules:
- Lanes are allocated from lower to higher vertical priority bands within a system.
- Same-class or nearby-different-anchor items may share a lane only when their final horizontal bounds do not overlap.
- If two items of the same class still conflict after allowed local horizontal adjustment, the leftmost anchor keeps the lower lane and the later anchor escalates upward.
- Local horizontal adjustment must stay within the owning measure's visual width for measure-owned items, or within the local anchor cluster's obvious reading zone for system-owned items; if that cannot be done cleanly, the item escalates to a higher lane instead of drifting away.

## Spec Delta

Update the active spec/contract surfaces that may temporarily contain narrower rehearsal-specific avoidance wording:
- integrate the broader replacement wording into the relevant canonical sections of `DRUMMARK_SPEC.md` if the rehearsal change has already merged those temporary rules there,
- append the broader replacement wording to `RENDER_LAYOUT_CONTRACT.md`,
- and treat this change as the superseding owner for above-staff avoidance policy once both changes coexist.

```md
## Addendum: Above-Staff Marking Avoidance

Date: 2026-06-07
Source change: `docs/changes/active/2026-06-07-above-staff-marking-avoidance/plan.md`
Status: Accepted

The layout engine owns collision avoidance for above-staff markings. Platform adapters must not add engraving-side overlap fixes.

Above-staff items are grouped into placement classes:
1. volta / ending brackets
2. rehearsal / section anchors
3. tempo marks
4. navigation symbols/text
5. other system text
6. staff-local above-staff text

For this contract, a lane is a system-local horizontal band shared by multiple above-staff items when their resolved horizontal bounds do not overlap. Lanes are allocated per system, not per anchor.

Placement rules:
- Volta / ending brackets are span objects and reserve geometry first.
- Rehearsal / section anchors preserve their semantic x ownership; tempo marks at the same anchor should prefer same-row composition to the right before vertical stacking.
- Navigation items remain near their semantic target but yield vertically to higher-priority structural classes.
- Staff-local above-staff text yields before system-top structural classes.

Collision rules:
- Prefer local horizontal adjustment before vertical-lane escalation when the semantic anchor remains visually clear.
- If needed, move to higher lanes.
- If lanes are insufficient, increase system-top padding.
- Layout must not compress or break volta brackets to accommodate text.
- Same-class or nearby-different-anchor items may share a lane only when their resolved horizontal bounds do not overlap.
- If same-class conflicts remain after allowed local horizontal adjustment, earlier anchors keep lower lanes and later anchors escalate upward.

The resulting scene must remain deterministic for identical `RenderScore` input.

This addendum supersedes any narrower temporary local priority rules for rehearsal / section anchors once both changes are implemented together.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Audit Current Above-Staff Owners

Status: Pending

Scope:
- `crates/drummark-layout/src/lib.rs`
- any layout helpers that currently place volta, tempo, navigation, or other top-of-system markings

Action:
- Identify all current above-staff item producers and their existing implicit priority/offset rules.
- Document which are system-top structural markings versus staff-local items.
- Identify cases where current placement is adapter-implicit or duplicated.
- Document which current rules from the active rehearsal / section-mark plan are temporary and will be superseded by this broader contract.

Acceptance:
- The plan has an implementation-ready inventory of above-staff item types and owners.

Verification:
- targeted code audit notes recorded in `history.md`

### Task 2: Add Shared Structural Lane Policy

Status: Pending

Scope:
- `crates/drummark-layout/src/lib.rs`
- layout tests / snapshots

Action:
- Introduce a shared lane-based placement pass for system-top structural markings.
- Define lane allocation as system-local shared horizontal bands rather than per-anchor stacks.
- Reserve volta spans first.
- Support same-anchor rehearsal+tempo row composition before lane escalation.
- Keep navigation near its anchor while yielding to higher-priority classes.
- Define deterministic tie-breaking for same-class / nearby-different-anchor conflicts.

Acceptance:
- Same-anchor rehearsal+tempo combinations render on one row when space permits.
- Voltas retain span geometry without compression.
- Structural items no longer overlap in covered fixtures.
- Covered fixtures prove that any added system-top padding updates system-box bounds deterministically and does not violate page assembly expectations.

Verification:
- `cargo test -p drummark-layout section -- --nocapture`
- focused layout snapshot / geometry tests

### Task 3: Integrate Staff-Local Yielding

Status: Pending

Scope:
- `crates/drummark-layout/src/lib.rs`
- any staff-local text emitters already present in layout

Action:
- Make staff-local above-staff text avoid structural reservations.
- Keep this policy one-way in v1: staff-local text yields before structural items move.

Acceptance:
- Staff-local text does not collide with structural system-top items in covered fixtures.
- Staff-local yielding does not produce unstable `visual_top` / `visual_bottom` growth across equivalent page-layout inputs.

Verification:
- focused layout snapshot / geometry tests

### Task 4: Contract / WASM / Renderer Parity

Status: Pending

Scope:
- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`
- `src/wasm/*`
- renderer parity tests

Action:
- If the earlier rehearsal change has already integrated temporary narrow avoidance wording into canonical `DRUMMARK_SPEC.md`, replace that wording with the broader policy owned by this change.
- Append the final contract addendum.
- Record the supersession of the rehearsal plan's temporary narrow priority wording in the consolidated changes / final contract merge notes.
- Verify that no adapter-side fallback logic is needed.
- Rebuild WASM if layout scene serialization changes.

Acceptance:
- Browser and CLI paths produce the same above-staff avoidance decisions from the same `RenderScore`.
- Page assembly and overflow diagnostics remain deterministic when system-top padding grows because of avoidance.

Verification:
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`
- pagination / overflow fixtures or equivalent layout tests that assert stable `visual_top`, `visual_bottom`, and overflow-warning behavior

## Test Plan

- `cargo test -p drummark-layout section -- --nocapture`
- Rehearsal + tempo at same anchor: prefer one-row composition
- Rehearsal near volta span: volta reserves first
- Navigation at same anchor as rehearsal+tempo: navigation yields to a higher lane
- Other system text avoids previously reserved structural boxes
- Staff-local above-staff text yields before structural items move
- No-overlap geometry assertions for text/bracket/symbol boxes
- Same-class nearby-anchor tie-break behavior is deterministic
- Lane sharing occurs only for non-overlapping horizontal bounds
- Pagination / overflow fixtures where increased system-top padding changes system box height without violating page assembly rules
- `npm run wasm:build`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

## Risks / Notes

- The hardest part is drawing the module boundary correctly: this change should own layout policy, not parser semantics.
- Same-row rehearsal+tempo composition must not become a special-case hack that bypasses the general lane model.
- Existing snapshots may shift even when semantics do not; intentional geometry changes must be audited carefully.
- If the layout engine currently lacks a clean distinction between structural and staff-local above-staff items, Task 1 may force a refactor before behavior changes.
- Because this change may increase system-top padding, it can affect `visual_top` / `visual_bottom`, pagination, and overflow diagnostics; those interactions must be tested explicitly.

## Linked Items

- Related change: `docs/changes/active/2026-06-01-rehearsal-section-marks/plan.md`
- GitHub Issue: N/A
- ADR: N/A
- PR: N/A

## Revision Log

| Round | Date | Summary of changes |
|-------|------|--------------------|
| 1 | 2026-06-07 | Initial draft split out from rehearsal / section mark planning to own general above-staff avoidance policy separately. |
| 2 | 2026-06-07 | Addressed review findings by defining system-local shared lanes, adding deterministic tie-break rules, recording supersession of rehearsal-local temporary rules, and expanding pagination/overflow coverage. |
