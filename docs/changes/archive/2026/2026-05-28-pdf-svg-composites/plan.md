# Fix Layout Engine: Replace Hardcoded Font Sizes with `staff_space_pt`

## Status

implementing

## Problem

Layout engine hardcoded all notation font sizes for `staff_scale: 0.75` (7.5pt staff space). Browser and CLI compensated with platform-specific scaling hacks (viewBox, page/margin division). No single source of truth for staff size.

## Design Decision

`staff_space_pt` (default 7.5pt) as the single source parameter. All notation dimensions derive from it. Remove `staff_scale`. Remove platform scaling.

## Current State (Phases 1-4 Complete)

- `staff_space_pt` added to `LayoutOptions`, `staff_scale` removed
- All font sizes derive from `staff_space_pt * factor`
- Browser/CLI layout scaling removed, staff_space_pt passed directly
- Duplicate tempo items fixed (pagination header_box_from_page filtering)
- System Y position fixed (pagination tempo exclusion from visual_bottom)
- Font sizes scaled ×0.75 for visual parity with old viewBox output

101/101 Rust tests pass. WASM rebuilt.

## Phase 5: Fix Positioning (Decouple Position from Render Font Sizes)

### Problem

Phase 4 scaled all font sizes ×0.75 globally. But positioning calculations use `font_size_pt / 4.0` as SMuFL SS→PT conversion factor. With font_size_pt = 22.5 (was 30pt), all notehead/stem/barline positions shifted 25%.

### Solution

Decouple: position-pt = SMuFL-correct for SS→PT math, render-font-pt = visual rendering for scene `fontSizePt`.

### Notation Size Functions (in `lib.rs`)

```
glyph_position_pt(ss)     = ss * 4.0       // notehead, clef, time sig, rest, repeat barline pos
notation_render_font_pt(ss)= ss * 3.0       // notehead, clef, time sig, rest, repeat barline render
flag_position_pt(ss)       = ss * 2.933     // flag anchor SS→PT
flag_render_font_pt(ss)    = ss * 2.2       // flag render
grace_position_pt(ss)      = ss * 2.133     // grace note anchor SS→PT
grace_render_font_pt(ss)   = ss * 1.6       // grace note render
nav_position_pt(ss)        = ss * 2.667     // nav glyph anchor SS→PT
nav_render_font_pt(ss)     = ss * 2.0       // nav glyph render
coda_position_pt(ss)       = ss * 2.133     // coda glyph anchor SS→PT
coda_render_font_pt(ss)    = ss * 1.6       // coda glyph render
tempo_position_pt(ss)      = ss * 3.333     // tempo glyph anchor SS→PT
tempo_render_font_pt(ss)   = ss * 2.5       // tempo glyph render
```

### Task 5.1: Add Notation Size Functions

Scope: `crates/drummark-layout/src/lib.rs`

Replace `base_font_size_pt` and `note_flag_font_size_pt` with the 12 functions above.

### Task 5.2: Route All Split Sites

**notes.rs:**

| Line | Context | Current | New |
|------|---------|---------|-----|
| ~324 | notehead_obstacles render | `base_font_size_pt(sp)` | `notation_render_font_pt(sp)` |
| ~521 | rest_font_size | `base_font_size_pt(sp)` | `notation_render_font_pt(sp)` |
| ~713 | note_font_size (dual-use) | `base_font_size_pt(sp)` | split: `glyph_position_pt(sp)` for position math, `notation_render_font_pt(sp)` for scene output |
| ~745,769,793,816 | note_font_size in position math | same variable | `glyph_position_pt(sp)` |
| ~1108,1159 | grace scene items | `grace_font_size` | `grace_render_font_pt(sp)` |
| ~1095 | grace smufl_ss | `grace_font_size / 4.0` | `grace_position_pt(sp) / 4.0` |
| ~1316 | stem smufl_ss | `base_font_size_pt(sp) / 4.0` | `glyph_position_pt(sp) / 4.0` |
| ~1391 | accent_font_size | `base_font_size_pt(sp)` | `notation_render_font_pt(sp)` |

**beams.rs:**

| Line | Context | Current | New |
|------|---------|---------|-----|
| ~54 | flag smufl_ss | `flag_font_size / 4.0` | `flag_position_pt(sp) / 4.0` |
| ~71 | flag render | `flag_font_size` | `flag_render_font_pt(sp)` |

**barlines.rs:**

| Line | Context | Current | New |
|------|---------|---------|-----|
| ~58,77,103 | repeat barline render | `note_flag_font_size_pt(sp)` | `notation_render_font_pt(sp)` |

**spans.rs:**

| Line | Context | Current | New |
|------|---------|---------|-----|
| ~523 | nav glyph (dual-use) | `sp * 2.0` | `nav_position_pt(sp)` for width, `nav_render_font_pt(sp)` for scene |
| ~544 | nav render | `start_glyph_font_size` | `nav_render_font_pt(sp)` |
| ~572 | coda glyph (dual-use) | `sp * 1.6` | `coda_position_pt(sp)` for width, `coda_render_font_pt(sp)` for scene |
| ~602 | coda render | `glyph_font_size` | `coda_render_font_pt(sp)` |

**scene.rs:**

| Line | Context | Current | New |
|------|---------|---------|-----|
| ~118,377 | tempo glyph render | `sp * 2.5` | `tempo_render_font_pt(sp)` |
| ~106,365 | tempo glyph width pos | `* 25.0 / 4.0` | `* tempo_position_pt(sp) / 4.0` |
| ~569,595 | measure repeat bbox pos | `bbox_center_x_pt(30.0)`, `bbox_center_y_pt(30.0)` | `glyph_position_pt(sp)` |
| ~573,599 | measure repeat render | `sp * 3.0` | `notation_render_font_pt(sp)` |

### Task 5.3: Fix Hardcoded `* 10.0` SS→PT

Scope: `notes.rs`, `compat_planning.rs`

- `notes.rs:733`: `staff_position_ss * 10.0` → `staff_position_ss * sp`
- `notes.rs:768`: `ledger_y_offset * 10.0` → `ledger_y_offset * sp`
- `notes.rs:818`: `dot_y_ss * 10.0` → `dot_y_ss * sp`
- `compat_planning.rs:102,103,127`: `* 10.0` → `* opts.staff_space_pt`. Note: `place_barlines()` needs `opts` added to its signature (currently has no opts param).

### Task 5.4: Update Test Assertions

| Test Function | Field | Old Expected | New Expected |
|---|---|---|---|
| lib.rs:339 | clef font_size_pt (test uses ss=10.0) | 40.0 | 30.0 (=render at ss=10.0) |
| lib.rs:344 | time_sig font_size_pt (test uses ss=10.0) | 40.0 | 30.0 (=render at ss=10.0) |
| lib.rs:1083 | nav-start font_size_pt | 15.0 | 15.0 (unchanged: nav_render=sp×2.0) |
| lib.rs:1121 | accent font_size_pt | 30.0 | 22.5 (render at ss=7.5) |
| lib.rs:2303 | rest_bounds font_size_pt (test uses ss=10.0) | base(10.0) | glyph_render(10.0)=30.0 |
| lib.rs:5425 | repeat fs | note_flag(7.5)=16.5 | notation_render(7.5)=22.5 |
| lib.rs:5674 | shared repeat fs | note_flag(7.5)=16.5 | notation_render(7.5)=22.5 |
| cli.rs:161 | notehead fs at ss=10 | 30.0 | 30.0 (10×3.0) |
| cli.rs:172 | notehead fs at ss=12 | 36.0 | 36.0 (12×3.0) |
| golden | cross_system snapshot | - | regenerate |

## Test Plan

1. `cargo test -p drummark-layout --lib` — all 95 pass
2. `cargo test -p drummark-cli` — all 6 pass
3. `npm run wasm:build && npx tsc --noEmit`
4. Browser preview visual check: noteheads properly centered on stems, repeat barlines aligned with staff
5. CLI PDF: positions match browser

## Revision Log

| Round | Date | Summary |
|-------|------|---------|
| 1 | 2026-05-28 | Initial draft (wrong: composites) |
| 2 | 2026-05-28 | Corrected to LayoutOptions alignment |
| 3 | 2026-05-28 | Expanded: fix font-size constants, remove platform scaling |
| 4 | 2026-05-28 | Review fixes: staffScale as display zoom |
| 5 | 2026-05-28 | Redesign: staff_space_pt as single source parameter |
| 6 | 2026-05-28 | Pagination root cause found, duplicate + Y fixed |
| 7 | 2026-05-28 | Font sizes ×0.75 for visual parity |
| 8 | 2026-05-28 | Phase 5 added: decouple position from render font sizes |
