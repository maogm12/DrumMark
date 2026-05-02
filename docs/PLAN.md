# DrumMark Spec Gap Closure Plan

## Goal

Bring the implementation into alignment with the current [DRUMMARK_SPEC.md](./DRUMMARK_SPEC.md) until every item in [TASKS.md](./TASKS.md) is checked off.

Constraint:

- One task item = one commit.
- No commit should partially complete two task items.

## Current Baseline

Current tests pass, but the implementation is still a narrow subset of the spec.

Verified gaps:

- Track registry is incomplete. Code only knows `HH HF SD BD T1 T2 T3 RC C ST`; spec also requires `BD2 T4 RC2 C2 SPL CHN CB WB CL`.
- Token registry is incomplete. Parser/types do not cover `b2 r2 c2 t4 spl chn cb wb cl` and their accented forms.
- Modifier registry is incomplete. Code supports `accent open close choke rim cross bell flam ghost drag`; spec also requires `half-open roll dead`.
- Event/IR model is out of date. Current `NormalizedEvent` uses `kind: hit | accent | pedal | sticking`, optional single `modifier`, and measure objects without spec metadata; spec requires a more canonical event/measure shape.
- Repeat/navigation support is partial. Code has simple repeat spans and inline expansion, but no canonical `%`/`%%` measure-repeat intent, no marker/jump model, and no volta intent in IR.
- Track ordering does not match the spec. AST currently sorts named tracks by a fixed registry order instead of preserving first appearance.
- Renderer/exporter still derive some semantics ad hoc instead of consuming canonical IR fields.
- Test coverage is too small for the current language surface.

## Delivery Strategy

Work bottom-up. Do not start renderer/exporter polish before the parser, AST, and normalized IR are stable.

### Phase 1: Core Language Surface

1. Expand track/token/modifier registries and baseline types.
2. Extend parser grammar for the spec token set and syntax corrections.
3. Align AST semantics with spec-level track registration and measure metadata.

### Phase 2: Canonical IR

4. Redesign normalized event/measure/score types to match the current spec.
5. Rebuild normalization so parser output maps deterministically into the new IR.
6. Rework shared music logic to consume the new track and event model.

### Phase 3: Consumers

7. Update MusicXML export to read canonical IR and cover the spec-defined instrument set.
8. Update VexFlow rendering to read canonical IR and cover the same surface.
9. Add remaining repeat/navigation rendering/export semantics that are intentionally in-scope for the current product.

### Phase 4: Verification

10. Add parser tests for the expanded grammar.
11. Add AST/normalization tests for semantic rules and canonical IR shape.
12. Add consumer tests for MusicXML/VexFlow-visible behavior.
13. Run the full test suite and close any regressions introduced by the gap-fill commits.

## Commit Discipline

Follow the task IDs in `TASKS.md` in order unless a dependency forces a different sequence.

Recommended commit subject pattern:

- `T01 expand DrumMark registries`
- `T02 extend parser grammar`
- `T03 align AST track registration`
- `...`

Rules:

- A task is checked only when code, tests, and docs needed for that task are in the same commit.
- If a task reveals missing prerequisite work, create a new task item rather than silently broadening the current one.
- Do not mark a consumer task done if it relies on temporary compatibility shims that are meant to be removed later in another task.

## Done Criteria

The gap-closure effort is complete only when all of the following are true:

- Every checkbox in [TASKS.md](./TASKS.md) is checked.
- `npm test` passes.
- `docs/DRUMMARK_SPEC.md` and the implementation no longer disagree on the features covered by the checklist.
- Remaining unsupported features, if any, are explicitly represented as unchecked tasks rather than hidden drift.
