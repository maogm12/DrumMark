# Cowbell Notehead Position

## Classification

- Workflow: Planned Change
- Spec Impact: Yes
- Large / Risky: No

## Status

draft - pending plan review and human stamp

## Summary

Change cowbell (`CB`) so it renders as an upward-pointing triangle notehead and sits in the fourth space of the percussion staff, instead of using the current generic percussion black notehead placement.

## Problem

Current cowbell behavior is too generic:

- layout renders `CB` with the default black notehead used by non-cymbal tracks
- layout places `CB` at `staff_y_for_track("CB") = 2.0`, which is not the requested fourth-space placement
- MusicXML exports `CB` without a dedicated notehead mapping

This makes authored cowbell notation read incorrectly compared with the intended release semantics.

## Goal

Make `CB` render and export with stable cowbell-specific semantics:

- notehead: upward-pointing triangle
- staff position: fourth space
- browser, CLI, and MusicXML paths all agree

## Non-goals

- No new DSL syntax or modifiers.
- No changes to `WB` or `CL` in this change.
- No broader percussion remapping audit.
- No adapter-side drawing logic; the change must come from `RenderScore -> LayoutScene`.

## Current Plan

Implement the change through the existing track-based notehead and staff-position logic:

1. confirm the canonical glyph and coordinate choice for the requested cowbell notation
2. update layout notehead selection and `staff_y_for_track("CB")`
3. align MusicXML notehead output for `CB`
4. add focused tests that lock the new semantics

Assumption for this change:

- "fourth space" follows standard bottom-up staff-space numbering, so `CB` moves to the top space of the five-line percussion staff.

## Spec Delta

Append an addendum to `docs/DRUMMARK_SPEC.md`:

```md
## Addendum: Cowbell Rendering Semantics

Date: 2026-06-07
Source change: `docs/changes/active/2026-06-07-cowbell-notehead-position/plan.md`
Status: Accepted

The `CB` (cowbell) track renders with an upward-pointing triangle notehead and is placed in the fourth space of the five-line percussion staff.

MusicXML export for `CB` must use a triangle notehead so browser, CLI, and export outputs describe the same notation intent.
```

Append an addendum to `docs/RENDER_LAYOUT_CONTRACT.md`:

```md
## Addendum: Cowbell Track Mapping

Date: 2026-06-07
Source change: `docs/changes/active/2026-06-07-cowbell-notehead-position/plan.md`
Status: Accepted

`staff_y_for_track("CB")` resolves to the fourth space of the percussion staff.

`notehead_glyph("CB", modifiers, glyph)` resolves to the canonical upward-triangle cowbell notehead unless a higher-priority modifier-specific mapping explicitly overrides it.
```

## Affected Specs / Contracts

- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Confirm Glyph and Position Mapping

Status: Pending

Scope:
- `crates/drummark-layout/src/metrics.rs`
- `crates/drummark-layout/src/instruments.rs`
- `crates/drummark-core/src/musicxml.rs`

Action:
- Identify the canonical SMuFL glyph for the requested upward triangle notehead.
- Pin the exact `staff_y_for_track("CB")` value for the fourth space assumption.
- Record the current and target MusicXML notehead representation for `CB`.

Acceptance:
- The implementation target is explicit before source behavior changes.

Verification:
- Targeted source audit notes recorded in `history.md`.

### Task 2: Implement Layout and Export Behavior

Status: Pending

Scope:
- `crates/drummark-layout/src/metrics.rs`
- `crates/drummark-layout/src/instruments.rs`
- `crates/drummark-core/src/musicxml.rs`

Action:
- Update `CB` notehead selection to the canonical upward triangle glyph.
- Update `staff_y_for_track("CB")` to the fourth-space position.
- Update MusicXML notehead export for `CB`.

Acceptance:
- `CB` renders with the requested notehead and vertical placement.
- MusicXML export uses a stable triangle notehead representation.

Verification:
- Focused Rust tests.
- `npm run drummark -- docs/examples/full-example.drum --format svg`
- `npm run drummark -- docs/examples/full-example.drum --format xml`

### Task 3: Lock Spec and Regression Coverage

Status: Pending

Scope:
- `docs/DRUMMARK_SPEC.md`
- `docs/RENDER_LAYOUT_CONTRACT.md`
- layout and MusicXML tests

Action:
- Append the accepted spec/contract addenda.
- Add or update tests that assert `CB` notehead role/glyph, staff position, and MusicXML output.

Acceptance:
- Spec/contract text and implementation match.
- Regression coverage exists for layout and export.

Verification:
- `cargo test -p drummark-layout cowbell -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`

