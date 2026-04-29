# DrumMark Gap Tasks

This checklist is the acceptance ledger for closing the gap between the current implementation and `docs/DRUMMARK_SPEC.md`.

Rules:

- One item = one commit.
- An item is checked only when its implementation and task-local tests are complete.
- The effort is done only when every item below is checked.

## Core Model

- [x] `T01` Expand the core registries in `src/dsl/types.ts` to the current spec surface.
Acceptance:
  Add missing tracks `BD2 T4 RC2 C2 SPL CHN CB WB CL`, missing magic tokens (`b2 r2 c2 t4 spl chn cb wb cl` plus accented forms), and missing modifiers `half-open roll dead`.

- [x] `T02` Replace the outdated normalized type model with a spec-aligned canonical IR shape.
Acceptance:
  `NormalizedEvent`, `NormalizedMeasure`, and `NormalizedScore` carry the fields needed by the current spec, including canonical `kind`, `glyph`, modifier representation, and measure-level metadata slots for repeat/volta/navigation intent.

## Parser

- [x] `T03` Extend parser glyph/token support to the full current token registry.
Acceptance:
  Parser accepts the new track summons and track lines required by the spec and rejects unknown ones with stable errors.

- [x] `T04` Align parser handling of `%`, `%%`, `*N`, and `|--N--|` with the current spec wording.
Acceptance:
  `%` and `%%` are measure-level constructs, `*N` means total run length, and multi-rest allows `N >= 1`.

- [x] `T05` Add parser support for the current repeat-navigation syntax surface.
Acceptance:
  Parser can represent markers/jumps such as `@segno`, `@coda`, `@fine`, `@to-coda`, `@da-capo`, `@dal-segno`, `@dc-al-fine`, `@dc-al-coda`, `@ds-al-fine`, and `@ds-al-coda`.

## AST And Semantics

- [x] `T06` Fix AST track registration and ordering to follow first appearance rather than fixed registry order.
Acceptance:
  Tracks introduced by line headers, routing scopes, or summon prefixes remain active and preserve first-seen order across the score.

- [x] `T07` Extend AST measure semantics for canonical repeat/volta/navigation intent.
Acceptance:
  AST carries the information needed downstream for repeat barlines, `%` shorthand, voltas, markers, jumps, and multi-rest without relying on legacy ad hoc expansion only.

- [x] `T08` Tighten semantic validation to match the current spec.
Acceptance:
  Validation enforces the clarified duration model, grouping boundary rules, legal measure-repeat usage, and the current sticking/token constraints.

## Normalization And Shared Logic

- [ ] `T09` Rebuild normalization so every parsed construct lands in canonical IR.
Acceptance:
  Normalization resolves all supported track summons and produces spec-shaped events and measures for the expanded registry.

- [ ] `T10` Update shared logic helpers for the expanded track families and canonical voice/beam ownership.
Acceptance:
  Voice assignment, fallback routing, beam grouping helpers, and duration helpers work for the full track set and new IR model.

## MusicXML

- [ ] `T11` Extend MusicXML instrument mapping to the full track registry.
Acceptance:
  Exporter maps `BD2 T4 RC2 C2 SPL CHN CB WB CL` correctly and removes stale assumptions such as hi-hat-local crash sugar.

- [ ] `T12` Update MusicXML notation export for the current modifier surface.
Acceptance:
  Exporter has explicit behavior for `half-open`, `roll`, and `dead`, and preserves the existing supported modifier behavior under the new IR model.

- [ ] `T13` Export measure-level structural intent from canonical IR.
Acceptance:
  Exporter reads canonical repeat barline, `%` shorthand, multi-rest, and in-scope volta/navigation fields from IR instead of reconstructing them from legacy structures.

## VexFlow

- [ ] `T14` Extend VexFlow note/instrument mapping to the full track registry.
Acceptance:
  Renderer handles every current spec track and removes stale special-casing that contradicts the current token model.

- [ ] `T15` Extend VexFlow modifier rendering to the current modifier surface.
Acceptance:
  Renderer has explicit behavior for `half-open`, `roll`, and `dead` in addition to the already-supported modifiers.

- [ ] `T16` Render measure-level structural intent from canonical IR.
Acceptance:
  Renderer consumes repeat barlines, `%` shorthand, multi-rest, and any currently in-scope volta/navigation fields from IR.

## Tests

- [ ] `T17` Expand parser tests to cover the full current token and syntax surface.
Acceptance:
  Tests cover new tracks, new magic tokens, `%`/`%%`, `*N`, multi-rest with `N=1`, and repeat-navigation markers/jumps.

- [ ] `T18` Expand AST and normalization tests to cover canonical semantics.
Acceptance:
  Tests cover first-appearance track ordering, canonical event/measure shape, grouping validation, and repeat/volta/navigation intent.

- [ ] `T19` Expand MusicXML tests for the new track and modifier surface.
Acceptance:
  Tests assert the new instrument mappings and notation output for the gap-closure features.

- [ ] `T20` Add renderer-facing tests or probes for the new track and modifier surface.
Acceptance:
  Tests or stable probes verify that VexFlow rendering paths accept the expanded registry and structural intent without regression.

## Final Verification

- [ ] `T21` Run the full suite and close any fallout from the gap-closure series.
Acceptance:
  `npm test` passes after the last task commit, and no earlier task must be reopened to achieve green tests.
