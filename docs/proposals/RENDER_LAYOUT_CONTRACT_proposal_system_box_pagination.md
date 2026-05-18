## Addendum v0.1: System Box Pagination

### Problem

The layout engine needs true multi-page output without relying on guessed vertical extents or repeated full-scene repagination loops.

The stable abstraction is not "page first". It is:

`score -> planned systems at known width -> system-local rendered boxes -> deterministic pagination -> page scene assembly`

Once the available system width is known, each system can be rendered and stacked in local coordinates. The actual visual bounds of that rendered system form a reliable rectangle for pagination.

### Goals

- Paginate from actual rendered system bounds, not estimated structural margins.
- Avoid full-scene rebuild loops for pagination.
- Keep coordinates in final `LayoutScene` as absolute page-space coordinates.
- Preserve page-local composite/reference invariants.
- Keep adapters thin: adapters render pages; they do not paginate, nudge, or repair layout.
- Preserve current one-page output for scores that fit on one page.

### Non-Goals

- Do not change DrumMark syntax.
- Do not change `RenderScore`.
- Do not introduce adapter-side layout.
- Do not add horizontal wrapping inside a paragraph; current paragraph-to-system planning remains the source of system breaks unless a later proposal changes it.
- Do not manually draw fallback score elements outside the layout scene contract.

### Core Model

The layout pipeline is split into four stages:

1. **Plan systems by width**
   - Use page width, margins, and system-start reservation to create ordered planned systems.
   - This stage decides which measures belong to each system.

2. **Render each system into local coordinates**
   - Each system is emitted at a local origin, independent of page number.
   - Staff lines, notes, rests, beams, flags, measure numbers, navigation, voltas, hairpins, measure repeats, multi-rests, and structural stacking are all resolved in system-local coordinates.
   - The result is a `SystemLayoutBox`.

3. **Paginate system boxes**
   - Treat every `SystemLayoutBox` as an ordered rectangle with actual visual bounds.
   - Place boxes onto pages top-to-bottom.
   - Page 0 starts after the header/title area.
   - Later pages start at the top margin.

4. **Assemble page scenes**
   - Translate system-local items/measures/composites into page coordinates.
   - Group translated output by `ScenePage`.
   - Final scene coordinates remain absolute page-space coordinates.

### System Layout Box Contract

Each rendered system produces:

```text
SystemLayoutBox {
  system_index: u32,
  system_id: String,
  measures: Vec<SystemMeasure>,
  items: Vec<SceneItem>,
  composites: Vec<SceneComposite>,
  staff_top: f32,
  staff_bottom: f32,
  visual_top: f32,
  visual_bottom: f32,
  width_pt: f32,
}
```

All geometry in `SystemLayoutBox` is local to the system coordinate space.

`visual_top` and `visual_bottom` are computed from the actual emitted item bounds after structural stacking. They include above-staff and below-staff elements such as measure numbers, navigation, voltas, and hairpins.

The box height used for pagination is:

`visual_height = visual_bottom - visual_top`

When placed on a page at `page_y`, all local coordinates are translated by:

`dy = page_y - visual_top`

This ensures the top of the visual box lands at the page placement cursor.

### Pagination Rules

Input:

- ordered `SystemLayoutBox` values
- `page_width_pt`
- `page_height_pt`
- top/bottom/left/right margins
- `header_height_pt`
- `header_staff_spacing_pt`
- `system_spacing_pt`

Rules:

- Page indices are zero-based and contiguous.
- Page 0 placement starts at `top_margin_pt + header_height_pt + header_staff_spacing_pt`.
- Pages after page 0 start at `top_margin_pt`.
- Before placing a non-first system on a page, add `system_spacing_pt` to the cursor.
- A box fits when `cursor_y + visual_height <= page_height_pt - bottom_margin_pt`.
- If a box does not fit and the current page already has at least one system, start a new page and retry the same box.
- If a box does not fit on an empty page, place it anyway and append a non-fatal overflow issue.

Pagination is deterministic and single-pass over already-rendered system boxes.

### Header Items

Title, subtitle, composer, and tempo remain page-level items on page 0 only.

Header geometry participates in page 0's first-system starting cursor through `header_height_pt + header_staff_spacing_pt`. Header items are not part of any `SystemLayoutBox`.

Later pages do not repeat header items unless a future proposal adds running headers.

### Cross-System and Cross-Page Spans

Span fragmentation happens during system-local rendering.

The fragment unit is the intersection of one logical span with one visible system. Pagination does not change fragment geometry; it only decides which page receives each already-fragmented system.

Rules:

- A hairpin or volta that spans four systems emits four system-local fragments.
- After pagination, those fragments move with their containing system boxes.
- A span crossing a page boundary therefore remains page-local automatically because each fragment belongs to exactly one system and one final page.
- Volta labels render only on the logical start fragment.
- Continuation hooks follow existing cross-system volta visual rules.

### Page-Local Reference Invariant

During page assembly, every final `SceneComposite` stored on a `ScenePage` must reference only IDs visible on that same page:

- every `child_item_ids` entry resolves to an item in `page.items`
- `start_anchor_id`, when present, resolves to a measure or item visible on the same page
- `end_anchor_id`, when present, resolves to a measure or item visible on the same page

Because composites are system-local before pagination, page assembly must translate and copy only the composites belonging to systems placed on that page.

### ID Stability and Uniqueness

`SceneSystem.index` remains global across the score.

`SceneSystem.id` remains `system-{global_system_index}`.

`SceneSystem.page_index` equals the containing page index after pagination.

`SceneMeasure.id` remains `measure-{display_global_index}`.

`SceneItem.id` and `SceneComposite.id` must be globally unique within the final `LayoutScene`. The implementation may use a single global counter during system-box rendering or prefix local IDs with the global system id during page assembly.

### Adapter Contract

The TypeScript adapter becomes page-aware.

`renderScenePagesToSvgs(scene, options): string[]`

- returns one SVG per `ScenePage`
- uses `ScenePage.widthPt` / `heightPt` for each SVG
- returns pages in `scene.pages` order

`renderSceneToSvg(scene, options)` remains a compatibility function:

- renders page 0 only
- behaves as today for one-page scenes
- emits a development-time warning when `scene.pages.length > 1`

Full-score export/caller paths must use `renderScenePagesToSvgs`.

### Overflow Issues

If a single `SystemLayoutBox` is taller than an empty page's content area, the engine still places it and appends a non-fatal issue to `LayoutScene.issues`.

The issue must include:

- page index
- system id or global system index
- visual height or visual bottom
- available page content height or bottom

Existing score issues are preserved.

### Renderer Context Refactor

System-box rendering should use internal context/spec structs instead of long positional helper argument lists:

- `SystemRenderContext`: system id/index, local staff geometry, available width, layout options
- `MeasureRenderContext`: measure id, local measure bounds, left/right pads, source `DisplayMeasure`
- `SceneEmitSink`: mutable target for local system items/composites and item counters
- primitive specs: `LineItemSpec`, `GlyphItemSpec`, `TextItemSpec`, `RectItemSpec`, `PathItemSpec`

Only the sink owns mutation. Context structs carry immutable geometry and options.

### Acceptance Criteria

- `cargo test --workspace` passes.
- `cargo clippy --workspace --all-targets -- -D warnings` passes without a crate-level `too_many_arguments` allow.
- Existing one-page fixture snapshots remain stable unless page metadata changes are explicitly justified.
- A unit test renders a system with above-staff and below-staff structural elements into a `SystemLayoutBox` and verifies `visual_top` / `visual_bottom` come from actual emitted item bounds.
- A long-score fixture produces `scene.pages.len() > 1`.
- A pagination unit test with hand-crafted `SystemLayoutBox` values verifies page 0 header offset, later-page top margin, system spacing, and single-system overflow handling.
- A cross-page hairpin fixture remains page-local after pagination.
- A cross-page volta fixture remains page-local after pagination and does not repeat labels except on logical starts.
- All final `SceneItem.id` values are globally unique.
- All final `SceneComposite.id` values are globally unique.
- Every composite child and anchor reference resolves within its containing page.
- A TypeScript adapter test verifies page 1+ items render through `renderScenePagesToSvgs`.

### Review Round 1

#### 1. System-local to page-space translation omits the horizontal origin

The contract says every `SystemLayoutBox` is local to system coordinate space and gives only:

`dy = page_y - visual_top`

That is sufficient for vertical placement but not for page assembly. A box rendered at local origin needs an explicit horizontal translation into the page content area, usually `dx = left_margin_pt` or an explicit planned-system x origin. Otherwise implementers can either accidentally render system-local X values as page X values, or bake page X into a supposedly local box and violate the stated locality.

Action required: add `x_origin` / `page_x` to the pagination placement output, or define that system-local X coordinates are already relative to the page content left edge and are translated by a specified `dx` during assembly. The assembly rule should explicitly translate items, measures, systems, and path/polyline primitives in both axes.

#### 2. `SystemLayoutBox` lacks enough data to assemble `SceneSystem` deterministically

The box contract includes `measures`, `items`, and `composites`, but not a `SceneSystem` or enough system geometry to reconstruct one without hidden conventions. Later sections require `SceneSystem.index`, `SceneSystem.id`, `SceneSystem.page_index`, and page-local `measure_ids`, but page assembly is not told whether those come from the box, from planned-system metadata, or from scanning `SystemMeasure`.

Action required: extend `SystemLayoutBox` to carry system geometry needed for final `SceneSystem` emission, or define a separate `PlacedSystemBox` with page index, page-space x/y placement, global system index/id, width, height, and measure IDs. The contract should state whether `SceneSystem.yPt` is the staff/system origin, the visual top, or another existing baseline.

#### 3. Header and tempo reservation is under-specified and can overlap the first system

The proposal moves title, subtitle, composer, and tempo into page-level page-0 items and excludes them from `SystemLayoutBox`. Page 0 only reserves `header_height_pt + header_staff_spacing_pt` before placing the first visual box. That is not enough unless those header constants are guaranteed to cover the actual canonical bounds of all header items, including tempo and any user offsets. In the current renderer, tempo sits near the first system gap rather than in the title block; excluding it from the first system box can let tempo collide with above-staff items or with a first system whose `visual_top` extends upward.

Action required: define the header box contract. Either header items must have their own canonical `HeaderLayoutBox` whose visual bottom determines the first-system cursor, or `header_height_pt + header_staff_spacing_pt` must be specified as an invariant that encloses all page-0 header/tempo bounds. Add an acceptance criterion that validates no page-0 header item overlaps the first system visual box under non-default tempo/header offsets.

#### 4. "Actual emitted item bounds" needs a canonical bounds algorithm

The proposal depends on `visual_top` / `visual_bottom` from actual emitted item bounds, but does not define how bounds are computed for each `ScenePrimitive`. This is not a cosmetic gap: text runs need canonical ascent/descent, glyph runs need SMuFL bounding boxes with anchor semantics, line segments need stroke width, and paths need either a real path-bounds parser or a stored canonical bounding box. If one primitive returns no bounds, pagination can silently underestimate system height.

Action required: add a `SceneItemBounds` contract covering `TextRun`, `GlyphRun`, `LineSegment`, `Rect`, `Polyline`, and `Path`, including stroke widths and empty/unsupported path behavior. If path parsing is intentionally limited, path-emitting helpers should carry explicit bounds or tests should cover every path command used by beams/flags.

#### 5. Page-local anchor rules conflict with adapter behavior if item anchors are allowed

The page-local reference invariant permits `start_anchor_id` and `end_anchor_id` to resolve to either a measure or an item. The current TypeScript composite rendering path resolves composite anchors through a page-local measure map, not an item map. If this proposal blesses item anchors for composites that adapters draw, a valid scene can still render missing repeat/volta output.

Action required: either restrict adapter-rendered composites to measure anchors, or update the adapter contract to require both page-local measure and item anchor resolution. Add a TypeScript test with the chosen anchor type on page 1+, not only a test that raw item primitives render.

#### 6. ID rewriting during page assembly is a hidden coupling point

The proposal allows system-box rendering to use either a global counter or system-id prefixes. If IDs are made unique during page assembly by prefixing or remapping local IDs, then every `child_item_ids`, `anchor_item_id`, `start_anchor_id`, and `end_anchor_id` inside the copied composites/items must be rewritten consistently. If boxes are rendered independently for testability or future parallelism, a single global counter is also an implicit cross-box dependency.

Action required: specify one deterministic ID strategy. If local IDs are allowed inside `SystemLayoutBox`, define an explicit assembly-time ID remap table and require all item and composite references to be rewritten through it. Add a unit test with two boxes containing identical local child IDs to prove the final scene is globally unique and references still resolve.

#### 7. Overflow issue shape conflicts with the current `LayoutScene.issues` type

The proposal says overflow issues must include page index, system id/index, visual height/bottom, and available height/bottom. The current scene contract exposes `issues` as strings. A string can contain those facts, but then callers and tests cannot reliably distinguish parser/score errors from non-fatal layout overflow warnings or inspect the fields without brittle text matching.

Action required: choose either a structured layout issue type or a stable machine-readable string prefix/schema. The contract should state that parser/normalization errors remain preserved and that overflow warnings do not make `buildLayoutSceneFromSource` throw when pages are present.

#### 8. Single-pass pagination can still fail after structural stack mutation unless validated at page scope

The proposal paginates after system-local structural stacking, which is the right direction. However, page assembly still translates and combines header items plus placed systems, and any bounds omission or ID-remap mistake will only appear in the final page scene. The current acceptance criteria test box bounds and hand-crafted pagination, but they do not require an end-to-end assertion that every bounded item on every non-overflow page stays inside page bounds and resolves references after final assembly.

Action required: add an acceptance criterion for a final `LayoutScene` validator that checks page index order, page-local reference resolution, global ID uniqueness, and item visual bounds against page dimensions for all non-overflow pages. This should include page 0 with headers and at least one later page.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The v0.1 proposal had the right system-box direction but underspecified assembly details that would cause hidden coupling. v0.2 below clarifies coordinate translation, final system geometry, header layout, bounds, anchors, ID remapping, issue schema, and final scene validation.

## Addendum v0.2: System Box Assembly Contract

### Placement Translation

A system box remains fully local before pagination. Final page placement creates a `PlacedSystemBox`:

```text
PlacedSystemBox {
  page_index: u32,
  system_index: u32,
  system_id: String,
  page_x: f32,
  page_y: f32,
  local_visual_top: f32,
  local_visual_bottom: f32,
  width_pt: f32,
  measure_ids: Vec<String>,
}
```

Page assembly translates every local primitive by:

`dx = page_x`

`dy = page_y - local_visual_top`

The translation applies to systems, measures, items, composites, line endpoints, rect origins, text/glyph origins, polyline points, and path coordinates or explicit path bounds.

`page_x` is normally `left_margin_pt`, unless a future proposal introduces horizontal centering/indentation.

### SceneSystem Geometry

Final `SceneSystem` records are emitted from `PlacedSystemBox` plus system-local staff geometry.

`SceneSystem.y_pt` is the page-space staff/system origin, not the visual top. It is computed as:

`system_origin_y_page = local_system_origin_y + dy`

`SceneSystem.height_pt` remains the staff/system height used by the existing scene contract, not the full visual box height. Visual box data is for pagination and validation, not a replacement for `SceneSystem` semantics.

`measure_ids` comes from the ordered system-local measures carried by the box.

### Header Layout Box

Page 0 gets a separate `HeaderLayoutBox` for title, subtitle, composer, and tempo page-level items.

`HeaderLayoutBox` contains emitted header items and actual bounds computed with the same `SceneItemBounds` rules used for system boxes.

The first system cursor on page 0 is:

`max(top_margin_pt + header_height_pt + header_staff_spacing_pt, header_visual_bottom + header_staff_spacing_pt)`

This prevents tempo/title content from overlapping an upward-extending first system visual box. Later pages have no header box unless a future proposal adds running headers.

### Scene Item Bounds Contract

`visual_top` / `visual_bottom` are computed only from primitives with defined bounds. Every primitive emitted by the layout engine must have bounds.

Bounds rules:

- `TextRun`: canonical text metric ascent/descent/line height for `text_role`, adjusted for text anchor only in X.
- `GlyphRun`: canonical SMuFL glyph bbox scaled by `font_size_pt / 4`.
- `LineSegment`: min/max endpoints expanded by half `stroke_width` in both axes.
- `Rect`: rect origin and dimensions, expanded by stroke width when a stroke exists.
- `Polyline`: min/max of all points, expanded by stroke width when present.
- `Path`: either parsed by the supported path command subset used by the renderer, or emitted with explicit bounds stored alongside the path primitive.

Unsupported or unbounded primitives are layout errors in tests; they must not silently contribute no bounds.

### Composite Anchor Scope

Adapter-rendered composites must anchor to page-local measures. Item anchors remain valid for individual item attachment (`anchor_item_id`) but not for composite `start_anchor_id` / `end_anchor_id` unless the TypeScript adapter is explicitly updated to resolve item anchors too.

The implementation should prefer measure anchors for span/navigation/measure-repeat composites. If item anchors are introduced for composites later, the adapter contract and tests must be updated in the same proposal.

### Deterministic ID Strategy

`SystemLayoutBox` may use local IDs for testability. Page assembly must produce final globally unique IDs by applying a deterministic remap table.

Required strategy:

- prefix every local system item id with `system-{system_index}-`
- prefix every local system composite id with `system-{system_index}-`
- rewrite every `SceneComposite.child_item_ids` through the item id remap table
- rewrite every `SceneItem.anchor_item_id` through the item id remap table
- rewrite composite anchor ids only when they refer to local item ids; measure anchors use final measure ids directly

A unit test must assemble two boxes with identical local IDs and verify final id uniqueness plus reference resolution.

### Layout Issue Schema

`LayoutScene.issues` remains `Vec<String>` for this proposal.

Layout warnings must use a stable machine-readable prefix:

`LAYOUT_WARNING overflow page=<index> system=<id> visualHeight=<pt> availableHeight=<pt>`

Parser/normalization errors remain preserved as existing strings. The front-end should not throw merely because a scene contains `LAYOUT_WARNING` entries when pages are present. Parse failures that produce zero pages may still throw as today.

### Final Scene Validator

Implementation tests must include a final `LayoutScene` validator that checks:

- page indices are contiguous and match array order
- system page indices match containing pages
- item ids are globally unique
- composite ids are globally unique
- composite child references resolve on the same page
- composite measure anchors resolve on the same page
- item anchor references resolve on the same page
- bounded items on non-overflow pages fit within page dimensions

Validator coverage must include page 0 with header items and at least one later page.

### Review Round 2

Addendum v0.2 resolves the Round 1 blockers sufficiently for implementation.

1. Horizontal translation is now explicit. `PlacedSystemBox.page_x`, `dx = page_x`, and the primitive-by-primitive translation rule remove the prior ambiguity between system-local and page-space X coordinates. The "normally `left_margin_pt`" caveat is acceptable because it still makes the placement origin explicit and leaves future indentation/centering out of scope.

2. `SceneSystem` geometry is now implementable. The addendum defines `SceneSystem.y_pt` as the page-space staff/system origin and separates it from the visual top used for pagination. The text relies on "system-local staff geometry" for `local_system_origin_y`; that field is not shown directly in `PlacedSystemBox`, but the contract is still deterministic as long as `SystemLayoutBox` carries or can derive that local origin from its staff geometry. This is not a blocker, but the implementation should make that origin a named field rather than an implicit convention.

3. Header overlap is addressed. A separate `HeaderLayoutBox` with actual item bounds and the `max(top_margin_pt + header_height_pt + header_staff_spacing_pt, header_visual_bottom + header_staff_spacing_pt)` cursor rule closes the tempo/title collision risk. The implementation should document whether `header_visual_bottom` is already page-space; the formula is correct under that reading.

4. Item bounds are now constrained enough to test. Text, glyph, line, rect, polyline, and path bounds all have required behavior, and unsupported/unbounded primitives are explicitly test failures instead of silent omissions. The path rule is intentionally flexible but acceptable because explicit path bounds are permitted when parsing is not complete.

5. Composite anchors now match adapter reality. Restricting adapter-rendered composite `start_anchor_id` / `end_anchor_id` to page-local measures avoids requiring a TypeScript item-anchor resolver in this proposal. Item anchors remain allowed for item attachment only, which matches current adapter behavior.

6. ID remapping is now deterministic. Prefixing local system item/composite IDs with `system-{system_index}-` plus mandatory rewrites of child IDs and item anchors removes the hidden coupling around counters. The identical-local-ID test is the right acceptance check. Header/page-level item IDs still need to be included in the final uniqueness validator, which v0.2 requires through global item ID validation.

7. Overflow issues now have a stable schema compatible with the current `Vec<String>` scene shape. The `LAYOUT_WARNING overflow ...` prefix is machine-readable enough for tests and callers, and the proposal preserves existing parser/normalization issue strings.

8. The final validator closes the page-assembly risk. It checks page order, system page indices, global item/composite uniqueness, page-local child/anchor resolution, and bounded item containment on non-overflow pages, with required coverage for page 0 headers and later pages.

Residual implementation notes, not approval blockers: make `local_system_origin_y` and header bounds coordinate space explicit in code/types, and ensure the validator treats `LAYOUT_WARNING overflow` pages as exempt only for the specific overflowing system/items rather than masking unrelated reference or ID failures.

STATUS: APPROVED

### Consolidated Changes

The approved layout contract changes the multi-page strategy from estimate-first pagination to system-box pagination:

- The layout engine first plans systems from the known page width and content width.
- Each planned system is rendered into a `SystemLayoutBox` in system-local coordinates.
- `SystemLayoutBox.visual_top` and `visual_bottom` are computed from actual emitted item bounds after structural stacking.
- Page 0 header/title/tempo content is rendered into a separate `HeaderLayoutBox`; it is not part of any system box.
- Pagination is deterministic over ordered boxes. Page 0 starts at `max(top_margin + header_height + header_staff_spacing, header_visual_bottom + header_staff_spacing)`, later pages start at the top margin, and non-first systems on a page receive `system_spacing`.
- A system taller than an empty page is placed anyway and emits a non-fatal `LAYOUT_WARNING overflow page=... system=... visualHeight=... availableHeight=...` issue.
- Page assembly translates local systems, measures, items, composites, and primitive geometry by explicit `dx` and `dy`.
- Final `SceneSystem.y_pt` remains the page-space staff/system origin, not the visual top.
- Local system item/composite IDs are remapped with deterministic `system-{system_index}-` prefixes, and all child/item references are rewritten through the remap table.
- Adapter-rendered composite `start_anchor_id` / `end_anchor_id` remain page-local measure IDs for this proposal.
- The TypeScript adapter exposes `renderScenePagesToSvgs(scene, options): string[]`; the legacy `renderSceneToSvg` remains page-0-compatible and warns for multi-page scenes in development.
- Final layout tests include a validator for page ordering, system page indices, global item/composite ID uniqueness, page-local references, composite measure anchors, item anchors, and bounded page containment. Overflow suppresses only bounds failures for the explicitly overflowing system.
