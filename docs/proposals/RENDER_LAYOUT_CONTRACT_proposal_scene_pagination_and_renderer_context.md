## Addendum v0.1: Scene Pagination and Renderer Context Refactor

### Problem

The Rust `LayoutScene` builder currently emits exactly one page. Systems are stacked by increasing `y` coordinates and can overflow past `page_height_pt - bottom_margin_pt`. The scene contract already has `pages` and `SceneSystem.page_index`, but the current implementation leaves those fields underused.

The same builder also has many helper functions with long argument lists. Those argument lists obscure ownership boundaries: some parameters describe page/system geometry, some describe current measure geometry, and some describe primitive drawing style.

### Goals

- Render long scores into multiple `ScenePage` entries.
- Keep all coordinates absolute within each page.
- Preserve stable system, measure, item, and composite ids across pagination.
- Keep platform adapters thin: no adapter-side page breaking, line breaking, or collision repair.
- Refactor renderer internals around explicit context/spec structs so high-level functions pass domain objects rather than long positional argument lists.
- Preserve current single-page output for scores that fit on one page.

### Non-Goals

- Do not change DrumMark syntax.
- Do not change `RenderScore`.
- Do not introduce adapter-side layout.
- Do not change the SVG adapter contract beyond consuming multiple existing `pages`.
- Do not add horizontal system wrapping inside a paragraph; current paragraph-to-system behavior remains unchanged unless a later proposal changes it.

### Contract Additions

`LayoutScene.pages` may contain more than one page. Each page owns only the systems, measures, items, and composites whose visible geometry appears on that page.

`ScenePage.index` remains zero-based.

`SceneSystem.page_index` must equal its containing page's `index`.

`SceneSystem.index` remains global across the score, not per-page. This preserves stable `system-{index}` ids.

`SceneMeasure.id` remains `measure-{global_index}`. Expanded display measures, such as two-bar repeats, keep using display global indices as they do now.

Item ids may remain page-local counter output as long as ids are unique within the whole `LayoutScene`. The implementation should keep a single item counter across pages.

### Pagination Algorithm

The layout engine computes `planned_systems` exactly as today, then assigns each planned system to a page before emitting scene items.

For each system:

- The first system on page 0 starts at `top_margin + header_height + header_staff_spacing`.
- Later systems on the same page start at previous system origin plus the existing vertical system advance.
- The first system on pages after page 0 starts at `top_margin`.
- A system fits when its staff bottom plus the reserved system advance does not exceed `page_height - bottom_margin`.
- If a system does not fit and the current page already has at least one system, start a new page and emit the system there.
- If a single system is taller than the available page content area, emit it on the current empty page and add a layout issue rather than dropping it.

Header/title/tempo items are emitted only on page 0 unless a later proposal adds repeated running headers.

### Structural Spans Across Pages

Voltas and hairpins are currently fragmented by system. Pagination must preserve that behavior and additionally isolate fragments by page.

- Span fragment generation samples only measures on the same page.
- A span crossing a page boundary emits a fragment on each page it touches.
- Fragment kind remains based on global span position: `start`, `continuation`, `end`, or `singleSegment`.
- Continuation visual rules for cross-system voltas remain unchanged.

### Renderer Context Refactor

Introduce internal context/spec structs:

- `PageEmitContext`: current page, page index, global item counter, layout options.
- `SystemEmitContext`: system id/index/page index, staff top/bottom/mid, system bounds.
- `MeasureEmitContext`: measure id, measure bounds, left/right pads, source `DisplayMeasure`.
- Primitive specs such as `LineItemSpec`, `GlyphItemSpec`, `TextItemSpec`, `RectItemSpec`, and `PathItemSpec`.

High-level render functions should accept context structs:

- `render_measure_events(..., MeasureEmitContext, ...)`
- `render_nav_markers(..., MeasureEmitContext, ...)`
- `render_right_barline(..., MeasureEmitContext, ...)`
- `push_volta_segment(..., VoltaSegmentSpec)`

Primitive item constructors should accept one spec object instead of many positional parameters.

### Acceptance Criteria

- `cargo test --workspace` passes.
- `cargo clippy --workspace --all-targets -- -D warnings` passes without a crate-level `too_many_arguments` allow.
- Existing one-page fixture snapshots remain stable unless page metadata changes are explicitly justified.
- A new unit test with enough paragraph systems to exceed one page produces `scene.pages.len() > 1`.
- The multi-page test verifies page indices, per-page systems, and that no system on a non-overflow page extends below `page_height_pt - bottom_margin_pt`.
- A cross-page hairpin or volta fixture emits fragments on each affected page with correct `fragment` semantics.
