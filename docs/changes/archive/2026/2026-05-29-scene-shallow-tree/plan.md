# LayoutScene Shallow Tree (Page → System → …)

## Status

merged

## Problem

`LayoutScene` pages expose `systems`, `measures`, `items`, and `composites` as **parallel flat lists**. Items do not carry `system_id`; staff lines and preamble glyphs have `measure_id: None`. Tooling and pagination must **re-infer** system membership (Y bands, `system-N-` id prefixes after assembly).

This diverges from the system-box pagination model in `RENDER_LAYOUT_CONTRACT.md` (“render each planned system into a `SystemLayoutBox`”) and makes debugging ownership unnecessarily indirect.

## Goal

Restructure the published `LayoutScene` so each page is a **shallow tree**:

```text
Page
├── header?          # page-0 title/subtitle/composer/tempo (items + composites)
└── systems[]
    ├── measures[]
    ├── items[]      # includes staff-line, clef, time-sig, measure-scoped glyphs
    └── composites[] # system-local fragments; cross-system spans = one fragment per system
```

After this change:

1. Every rendered item (except page header) is reachable under exactly one `systems[]` entry without geometric inference.
2. Adapters may traverse nested systems or call a small `flatten_page(page)` helper; they must not re-measure for layout.
3. Coordinates remain **absolute page-space** after pagination assembly (unchanged adapter contract).
4. `npm run drummark -- … --format scene` and snapshot tests reflect the nested shape.

## Non-goals

- No change to `RenderScore`, parser, or normalization.
- No switch to system-local coordinates in the wire scene (still page-space `x_pt`/`y_pt`).
- No deep tree of primitives (items remain leaves with `ScenePrimitive`).
- No new user-facing Settings.
- Do not remove `SceneMeasure.system_id` in this change (keep for validation and span anchors); may deprecate later.

## Workflow

- **Type**: Spec / Contract Change (`RENDER_LAYOUT_CONTRACT.md` addendum).
- **Human stamp required** before implementation (`APPROVED_FOR_IMPLEMENTATION` in `history.md`).

## Spec Delta

Append to `docs/RENDER_LAYOUT_CONTRACT.md`:

### Addendum 2026-05-29: LayoutScene Shallow Tree

`ScenePage` is a shallow tree, not a flat item pool.

**Page structure**

- `header` (optional): `PageHeader { items, composites }` for page-0 chrome (title, subtitle, composer, tempo text block). Absent on pages with no header content.
- `systems[]`: ordered placed systems on the page. Each entry is a `SceneSystemBlock` carrying geometry **and** nested content.

**System block**

`SceneSystemBlock` contains:

- System geometry: `id`, `index`, `page_index`, `x_pt`, `y_pt`, `width_pt`, `height_pt`
- `measures[]`: measures belonging to this system (page-space coordinates)
- `items[]`: all items owned by this system (staff lines, clef, time signature, notes, barlines, dynamics, navigation glyphs, etc.)
- `composites[]`: composites whose fragments belong to this system

**Ownership rules**

- An item appears under exactly one system on a page, except header items under `page.header`.
- `SceneItem.measure_id` remains optional; when set, the referenced measure must be in the same system block.
- `SceneSystemBlock` does not use a parallel `measure_ids` list; measure membership is `measures[].id` only.
- Cross-system span composites emit one composite per system fragment; each composite’s `child_item_ids` reference items in that system’s `items` list.

**Traversal**

- Platform adapters may iterate `page.systems` and nested arrays directly, or use layout-provided flatten helpers for legacy paint loops.
- Scene snapshots and `--format scene` JSON must serialize the nested structure.

**Versioning**

- Bump layout scene `version` when the wire shape changes. Consumers must not assume flat `page.items`.

## Affected Specs / Contracts

- `docs/RENDER_LAYOUT_CONTRACT.md`

## Tasks

### Task 1: Contract types and version bump

Status: Done

Scope:
- `crates/drummark-layout/src/contract.rs`
- `LAYOUT_SCENE_VERSION`

Action:
- Introduce `PageHeader`, `SceneSystemBlock` (or extend `SceneSystem`) with nested `measures`, `items`, `composites`.
- Remove flat `measures` / `items` / `composites` from `ScenePage`; remove `measure_ids` from system geometry struct.
- Add `flatten_page_items(page) -> Vec<&SceneItem>` (and composites if needed) for internal reuse.

Acceptance:
- `cargo check -p drummark-layout` with updated types (may break callers until Task 2–4).

### Task 2: Pagination assembly emits nested page

Status: Done

Scope:
- `pagination.rs`, `scene.rs`, `validation.rs`, `snapshot.rs`, `wire.rs`

Action:
- `assemble_placed_system_box` appends to `system.items` / `system.measures` / `system.composites` instead of `page.items`.
- `paginate_unpaginated_page` places header into `pages[0].header`.
- Delete `system_boxes_from_page` Y-band item filtering for ownership (box already owns items from render path).
- Update validator: contiguous ids, measure/item system consistency, page bounds.

Acceptance:
- `cargo test -p drummark-layout` green; golden snapshot format documents nested systems.

### Task 3: Scene build path tags system ownership at emit time

Status: Done

Scope:
- `scene.rs`, `scene_builder.rs` (if needed)

Action:
- During `build_layout_scene`, emit into per-system buffers (or tag + reorganize once per system before pagination) so staff/clef/time-sig never land in a page-flat pool pre-pagination.
- Prefer emitting directly into the system’s item list for the unpaginated single-page pass, then pagination copies nested subtrees.

Acceptance:
- No `measure_id: None` staff lines rely on Y-band heuristics in pagination.

### Task 4: CLI, WASM wire, TypeScript adapter

Status: Done

Scope:
- `crates/drummark-cli/src/json.rs`, `svg.rs`, `pdf.rs`
- `src/renderer/svgRenderer.ts`, tests under `src/renderer/`
- `wire.rs` / wasm JSON export

Action:
- Update `--format scene` JSON: `systems[].measures|items|composites`.
- SVG/PDF renderers flatten per page or walk nested systems.
- Update TS `ScenePage` types and tests.

Acceptance:
- `cargo test -p drummark-cli`, `npm test` (renderer tests), `npm run wasm:build`.

### Task 5: Spec merge and archive prep

Status: Done

### Task 6: Layout engraving follow-ups (same branch)

Status: Done

Scope:
- `planning.rs`, `scene.rs` — system preamble metric spacing; non-first-system `|: ` after clef
- `engraving/barlines.rs`, `lib.rs` — barline rect height spans top/bottom staff lines only
- `engraving/beams.rs`, `engraving/notes.rs` — secondary beam offset includes ribbon thickness + gap
- `tests/goldens/cross_system_scene_snapshot.txt`, WASM rebuild

Acceptance:
- `test_second_system_first_measure_repeat_start_clears_clef`
- `test_regular_barline_vertical_extent_matches_staff_lines`
- `cargo test -p drummark-layout` green

Scope:
- `docs/RENDER_LAYOUT_CONTRACT.md` (append addendum from Spec Delta)
- `history.md` consolidated changes

Action:
- Append approved addendum after implementation review.
- Record `## Consolidated Changes` before spec merge.

Acceptance:
- Spec addendum matches shipped wire shape.

## Verification

- `cargo test -p drummark-layout -p drummark-cli`
- `npm run drummark -- examples/<fixture>.drum --format scene` — items nested under `systems[]`
- Update `cross_system_scene_snapshot.txt` golden
- `npm run wasm:build`

## Linked Items

- Follows `docs/changes/active/2026-05-29-layout-magic-numbers-cleanup/` Phase 1 (committed).
