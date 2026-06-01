# Grace Modifier Parity

Date: 2026-05-31
Change id: `2026-05-31-grace-modifier-parity`
Status: Implementation

## Summary

Make flam/drag grace-note behavior consistent between layout rendering and MusicXML export.

## Linked Items

- User request: review follow-up to fix grace note issues found in recent commits.

## Scope

- Define a single priority for notes carrying both `flam` and `drag`.
- Update layout rendering to follow that priority.
- Update MusicXML export to follow that priority and export beaming for drag grace notes.
- Add focused tests for combined modifiers and drag grace beams.

## Out of Scope

- The existing MusicXML corpus failures around default tempo output.
- Broader DSL/spec changes.
- Visual redesign of grace note spacing.

## Plan Review Skipped

Skip reason: low-risk Normal Change with a narrow bug-fix scope, no public API or DSL syntax changes, and existing focused Rust tests for the affected layout and MusicXML paths.

## Tasks

1. [x] Add shared internal grace modifier classification in layout and MusicXML paths.
2. [x] Make `drag` take precedence over `flam` when both modifiers are present.
3. [x] Emit explicit MusicXML beams for the two drag grace notes.
4. [x] Add focused Rust tests for combined `flam:drag` and drag beam XML.
5. [x] Run relevant layout/core tests and CLI SVG/XML reproductions.

## Test Plan

- `cargo test -p drummark-layout grace -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run drummark -- /tmp/grace-review.drum --format svg`
- `npm run drummark -- /tmp/grace-review.drum --format xml`
