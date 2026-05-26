## Render Layout Contract

This document defines the repository-owned contract for VexFlow replacement work.

### Ownership Chain

The active architectural target is:

`source -> parser AST -> normalized musical model -> RenderScore -> LayoutScene -> platform adapter`

Where:

- `drummark-core` owns parsing and normalization
- `drummark-core` derives `RenderScore`
- `drummark-layout` owns canonical metrics and layout
- platform renderers consume `LayoutScene` and only translate it to drawing APIs

### `RenderScore`

`RenderScore` is the parser-independent render input contract. It must contain all data required for deterministic drum layout without source rescans.

Required surface:

- header timing and title metadata
- explicit track list with render families
- measures with stable indices and source-line provenance
- resolved note/rest/sticking events with timing fractions
- voice, beam, tuplet, and visible modifier data
- repeat-span, navigation, volta, hairpin, measure-repeat, and multi-rest semantics

`RenderScore` is a closed contract. New layout dependencies must be added explicitly, not tunneled through ad hoc metadata.

### Canonical Metrics

All layout-affecting measurement is repository-owned.

That includes:

- drum notehead glyph metrics
- rest glyph metrics
- repeat/navigation glyph metrics
- title/subtitle/composer/tempo/sticking/count text metrics

Adapters do not measure text or glyphs to influence layout.

### `LayoutScene`

`LayoutScene` is the platform-neutral layout output.

Contract rules:

- coordinates are absolute page-space coordinates
- stable ids are preserved for systems, measures, items, and composites
- semantic composites are first-class for spans and text blocks
- system-break span fragments are encoded explicitly
- scene snapshots are a valid test oracle independent of pixel rendering

Minimum scene structure:

- pages
- systems
- measures
- items
- composites

### Thin Adapter Rule

A platform renderer may only do:

- scene traversal
- unit conversion
- glyph/path lookup
- paint execution
- optional accessibility/event tagging

A platform renderer may not do:

- text or glyph measurement for layout
- line breaking
- collision resolution
- span reconstruction
- position nudging beyond device-space rounding

## Addendum 2026-05-14: Approved Platform-Neutral Layout Constraints

The approved repository contract for the current migration additionally requires:

- `RenderScore` remains the explicit render-facing boundary between normalization and layout
- `LayoutScene` remains the only adapter input for active rendering paths
- canonical metrics and layout-affecting geometry are owned by `drummark-layout`, not by adapters

### Approved Engraving Constraints

- System starts are decomposed into explicit reservation components:
  - opening barline at the staff left boundary
  - repeated percussion clef width plus trailing gap
  - optional time-signature width plus trailing gap
  - first-note entry offset after the rendered components
- No unnamed extra start-padding bucket is allowed outside those explicit components.
- The first playable slot starts immediately after the sum of the rendered components and their canonical inter-component gaps.
- Later systems may not retain phantom time-signature spacing when no time signature is rendered.
- The rightmost closing barline of a system terminates at the visible staff boundary.
- Default tempo uses a quarter-note beat unit unless the source specifies otherwise.
- Tempo output must be reviewable as a resolved composite with distinct beat-unit, equals-sign, and numeric child geometry or equivalent canonical spacing ownership.
- Drum vertical placement must come from one authoritative checked-in mapping table covering all supported render families.
- Up-stems must attach on the notehead's right side with enough outward offset to avoid piercing the glyph body.
- Down-stems must also attach on the notehead's right side unless a specific notehead family has a separately documented exception.
- Stem anchors must be derived from canonical notehead metrics rather than line-centering guesses.
- Unbeamed flags must use dedicated glyph roles or canonical paths, not fallback strokes.
- Slanted beams must be emitted as real beam bodies with vertically cut endcaps, and participating stems must terminate at the resolved beam boundary.

### Migration Gate

The supported-corpus gate for final migration and cutover requires the full supported drum corpus. Representative slices are allowed only for intermediate fixture development, not for final parity approval.

## Addendum 2026-05-18: System Box Pagination Contract

The approved multi-page layout strategy is system-box pagination:

- Plan systems from known page width and content width.
- Render each planned system into a `SystemLayoutBox` in system-local coordinates.
- Compute every system box's `visual_top` and `visual_bottom` from actual emitted item bounds after structural stacking.
- Render page-0 title, subtitle, composer, and tempo content into a separate `HeaderLayoutBox`.
- Paginate ordered system boxes deterministically, then assemble final page scenes by translating local geometry into absolute page-space coordinates.

### Box Placement

`SystemLayoutBox` carries global system identity, local staff origin, local visual bounds, width, local measures, local systems, items, and composites.

`HeaderLayoutBox` carries page-0 header items and actual visual bounds. Page 0's first system cursor is:

`max(top_margin_pt + header_height_pt + header_staff_spacing_pt, header_visual_bottom + header_staff_spacing_pt)`

Later pages start at `top_margin_pt`. A non-first system on a page receives `system_spacing_pt` before placement.

`PlacedSystemBox` carries page index, `page_x`, `page_y`, and the system metadata needed to assemble `SceneSystem` records. Page assembly applies:

`dx = page_x`

`dy = page_y - local_visual_top`

The translation applies to systems, measures, items, composites, line endpoints, rect origins, text/glyph origins, polyline points, path coordinates, and explicit path bounds.

Final `SceneSystem.y_pt` remains the page-space staff/system origin, computed from the local staff origin plus `dy`; it is not the visual top.

### Bounds and Overflow

Every primitive emitted by the layout engine must have deterministic bounds. Bounds cover text runs, glyph runs, line segments, rects, polylines, and all path commands emitted by the engine. Unsupported or unbounded primitives are test failures.

A system taller than an empty page is placed anyway and emits a non-fatal issue using this schema:

`LAYOUT_WARNING overflow page=<index> system=<id> visualHeight=<pt> availableHeight=<pt>`

Existing parser and normalization issues remain preserved in `LayoutScene.issues`.

### References and Adapters

System-local item and composite IDs are remapped during page assembly with deterministic `system-{system_index}-` prefixes. Composite child IDs and item references are rewritten through the remap table. Measure anchors use final measure IDs directly.

For this contract, adapter-rendered composite `start_anchor_id` and `end_anchor_id` must be page-local measure IDs. Item anchors remain valid for individual item attachment, but composite item anchors require a future adapter contract update.

The TypeScript adapter exposes `renderScenePagesToSvgs(scene, options): string[]`, returning one SVG per `ScenePage`. The legacy `renderSceneToSvg(scene, options)` remains page-0-compatible and emits a development warning when asked to render a multi-page scene.

### Validation Gate

Layout tests must validate final scenes for:

- contiguous page indices matching array order
- system page indices matching containing pages
- global item and composite ID uniqueness
- page-local composite child references
- page-local composite measure anchors
- page-local item references
- bounded item containment within page dimensions

Overflow suppresses only bounds failures for the explicitly overflowing system named by a `LAYOUT_WARNING overflow ...` issue. Page order, ID uniqueness, page-local references, header bounds, and unrelated system bounds remain validated.

## Addendum 2026-05-25: Native CLI Export Contract

The approved native command line architecture adds a Rust-owned `drummark` CLI in `crates/drummark-cli`.

The first-release native CLI formats are:

- `musicxml`: MusicXML output from the Rust normalized score.
- `svg`: complete-score SVG output.
- `pdf`: complete-score PDF output.
- `ast`: developer/debug parser AST JSON with an unstable schema.
- `ir`: developer/debug normalized or render-ready JSON with an unstable schema.
- `scene`: developer/debug raw `LayoutScene` JSON with an unstable schema.

The native CLI does not support `xml` as a `musicxml` alias.

The CLI reads source from a file or stdin. Text outputs may write to stdout or `--output`; PDF writes to an output file.

The native CLI uses Rust-owned parser, normalizer, MusicXML, render-score, and layout APIs. It must not call WASM entrypoints. `drummark-core` exposes render-score derivation through a native `layout` feature; `layout-wasm` may remain for WASM packages but must build on the native layout feature instead of being the only render-score gate. Only `crates/drummark-cli` may expose a production binary named `drummark`.

SVG and PDF exports always include every `LayoutScene` page. SVG emits one SVG document with pages stacked vertically using a fixed page gap. PDF emits each `LayoutScene` page as a separate PDF page preserving page dimensions. The first-release CLI does not expose a page-selection option.

PDF export uses deterministic subset-embedded fonts:

- Notation `GlyphRun` output uses Bravura.
- Bravura is resolved from explicit `--font <PATH>` or `public/fonts/bravura.otf`.
- Explicit invalid `--font` values fail without fallback.
- Text `TextRun` output is split into contiguous runs by actual Bravura glyph coverage.
- Bravura-covered text runs use Bravura.
- Text runs not covered by Bravura use a fallback Hei/CJK sans font.
- The fallback font is resolved from explicit `--fallback-font <PATH>` or documented platform candidates only when fallback text is actually needed.
- Explicit invalid `--fallback-font` values fail without platform fallback.
- Missing glyph coverage or unavailable subset-embeddable fallback fonts are export failures, not viewer-dependent substitutions.

Exporter adapters remain thin. SVG and PDF exporters translate `LayoutScene` primitives and approved composite fallbacks only; engraving and layout decisions remain owned by `drummark-layout`.

## Addendum 2026-05-18: Split Parser/Layout WASM and Default Layout Rendering

The approved web runtime architecture separates parser startup from layout rendering:

- parser WASM is the startup package for parser, worker, diagnostics, and editor state
- layout WASM is loaded only when the layout renderer is invoked
- VexFlow remains available as a lazy legacy renderer

### Package Boundaries

Browser production code uses web packages only:

- `src/wasm/parser-pkg-web/`
- `src/wasm/layout-pkg-web/`

CLI and Node initialization use Node packages only:

- `src/wasm/layout-pkg-node/`
- `src/wasm/parser-pkg-node/`, only if needed

The Rust WASM crate is built with explicit features:

- parser: `--target web --no-default-features --features parser-wasm`
- browser layout: `--target web --no-default-features --features layout-wasm`
- Node layout: `--target nodejs --no-default-features --features layout-wasm`

The parser package must not expose layout exports or link `drummark-layout`.

### Render Source Coherence

The app's active parsed score state carries:

`{ score, source, sourceRevision }`

Layout rendering receives `source` and `sourceRevision` explicitly with the score. Production rendering does not use a module-level source cache or `setLayoutSource`.

If parsing is asynchronous, stale parse results cannot replace newer active score/source revisions.

### Default Renderer

The layout engine is the default renderer for users without an explicit saved renderer preference. Explicit saved VexFlow preferences remain respected.

User-facing renderer labels are:

- `Layout Engine`
- `Legacy VexFlow`

### Lazy Runtime Gates

Default app/settings/layout production code must not import VexFlow runtime modules. Shared render settings and option ranges used outside VexFlow live in renderer-neutral modules.

Verification must prove:

- startup can fetch parser WASM without fetching layout WASM or VexFlow
- first default layout render fetches layout WASM and not VexFlow
- first legacy render fetches VexFlow
- CLI SVG output uses the Node layout WASM package
- parser/layout semantic parity holds for successful and failed source fixtures

## Addendum 2026-05-20: Remove Legacy VexFlow Renderer

This addendum supersedes the legacy-renderer availability rule in the split-WASM addendum above.

The current rendering architecture is:

`RenderScore -> LayoutScene -> thin platform adapter`

VexFlow is no longer a supported product renderer, fallback path, dependency, or active test oracle. All score layout decisions belong to `drummark-layout` through the repository-owned `RenderScore -> LayoutScene` contract. Platform adapters may only translate resolved scene geometry into drawing commands, glyphs, paths, text, and accessibility/event metadata; they may not perform spacing, collision resolution, span reconstruction, or notation-specific layout fixes.

### Removal Requirements

- App preview rendering uses the layout-engine SVG adapter only.
- CLI SVG rendering uses the Node layout WASM package.
- Docs/example rendering uses the Node layout source API.
- Saved legacy renderer preferences resolve to the layout route.
- Active tests do not import VexFlow or compare against VexFlow output.
- Corpus reports use layout-owned scene and SVG semantic summaries, not VexFlow oracle reports.
- Build configuration, TypeScript aliases, package metadata, generated chunks, and import-boundary checks contain no active VexFlow route.

Historical VexFlow divergence notes may remain archived as migration evidence. They are not active contracts.

## Addendum 2026-05-22: Collision-Aware Rest Placement

The layout contract continues to anchor rests to their resolved rhythmic slot centers. This addendum changes only vertical rest placement.

### Ownership

Rest collision handling belongs to `drummark-layout` inside the repository-owned `RenderScore -> LayoutScene` pipeline. Platform adapters must not nudge rests to avoid notes, stems, beams, accents, or other rests.

### Placement Rules

- Rest X placement remains anchored to the resolved slot center.
- Rest Y placement is solved from slot-local geometry using canonical candidate lanes rather than fixed per-voice constants.
- Candidate lanes are defined against the rest glyph bbox center in staff-space units, not glyph origin.
- The solver consumes finalized hit-cluster geometry:
  - displaced notehead placements
  - derived ledger-line geometry
  - derived stem geometry
  - derived accent geometry
  - previously placed visible rests in the same slot

### Beam Contract

Phase-1 rest avoidance must protect a conservative local beam envelope.

Minimum invariants:

- For an isolated beamable note that would otherwise render with flags, the protected envelope must cover the local stem tip and the flag-side vertical reach that the renderer would occupy.
- For a note participating in a multi-slot beam group, the protected envelope must at minimum cover the local stem tip plus the beam-side thickness budget used by `render_beam_groups()` for that slot's stem direction.
- The envelope may over-approximate those local occupied regions, but it may not under-approximate them.

This addendum does not require exact final cross-slot beam polygons to be known before rest solving. Continued-beam regressions remain mandatory verification because they are the highest-risk case in the current two-pass beam pipeline.

### Multi-Rest Ordering In A Slot

When more than one visible rest shares a slot, solve them in this deterministic order after `hide_voice2_rests` filtering:

1. `voice` ascending
2. `duration` descending
3. `staff_y_for_track(track)` ascending
4. `track` string ascending
5. existing order in the already-sorted slot slice only as the final tie-break

Later solved rests must treat earlier solved rests as occupied geometry.

### Fallback And Diagnostics

If every candidate lane collides, the resolver must choose a deterministic best-effort fallback and return structured diagnostic intent. The caller that assembles `LayoutScene.issues` owns whether and how that non-fatal layout diagnostic is emitted.

### Semantic Preservation

This addendum does not change existing rhythm semantics:

- pure-rest slots remain deterministic even with no hit in the slot
- whole-measure rests remain aligned to the first-beat grid
- hidden voice-2 rests do not reserve layout space

## Addendum 2026-05-24: Layout Library Modularization Contract

The approved layout-library refactor is behavior-preserving. It changes Rust module ownership inside `drummark-layout`; it does not change `RenderScore`, `LayoutScene`, score geometry, emitted scene semantics, or adapter responsibilities.

### Target Shape

`crates/drummark-layout/src/lib.rs` becomes a crate root containing module declarations and public re-exports. `scene.rs` owns `build_layout_scene`.

Required module ownership:

- `contract.rs`: public layout input/output data types, version constants, and `Fraction`
- `fraction.rs`: arithmetic and ordering helpers for `Fraction`
- `instruments.rs`: track family and staff-position mapping
- `metrics.rs`: glyph/text roles, canonical metric tables, notehead/rest/flag/text lookup, and metric-derived sizing
- `options.rs`: `LayoutOptions` and `StaffSpace`
- `roles.rs`: emitted `SceneItem.role` strings and role-class helpers
- `names.rs`: enum-to-string names for wire and snapshot serialization
- `scene_builder.rs`: deterministic item id state, primitive scene-item emission, read-only item access, and explicit item-id-targeted mutation helpers
- `scene_geometry.rs`: scene primitive bounds, path bounds, item translation, and item-id bounding boxes
- `collision.rs`: primitive collision obstacles and overlap scoring from resolved geometry
- `display.rs`: display-measure expansion and repeat-display semantic rewrites
- `planning.rs`: active system planning, measure widths, grouping helpers, padding, and measure-local fraction-to-x geometry
- `compat_planning.rs`: existing public prototype planning API retained as a compatibility surface
- `pagination.rs`: system-box pagination and page assembly
- `validation.rs`: final layout-scene diagnostics
- `wire.rs`: JavaScript wire conversion
- `snapshot.rs`: layout-scene snapshot formatting

Engraving modules:

- `engraving/barlines.rs`: barline emission
- `engraving/notes.rs`: slot groups, hit clusters, noteheads, rests, stems, accents, grace notes, ledger lines, rest-placement policy, and beam-anchor production
- `engraving/beams.rs`: flags, beam grouping, beam slopes, beam paths, secondary beams, and item-id-targeted stem-tip adjustment
- `engraving/tuplets.rs`: tuplet run grouping and bracket/label emission from explicit slot-event geometry

Structural modules:

- `structural/skyline.rs`: role-aware skyline sampling
- `structural/spans.rs`: volta, hairpin, dynamic, navigation, repeat-span, and span-fragment emission
- `structural/stacking.rs`: post-emission structural group stacking and translation

### Invariants

- Crate-root public API compatibility is preserved unless a later approved proposal deprecates an item.
- Emitted role string values are behavior and must not change during modularization.
- Wire and snapshot enum names come from `names.rs`, not from role helpers.
- `SceneBuilder` owns one shared deterministic item counter for a scene. Extracted modules may not create independent counters for the same scene.
- Target-state item mutation is by explicit item id or item-id list. `last_item_mut()` is temporary migration glue only unless a task explicitly justifies an immediately emitted-item configuration case.
- Tuplets are positioned from resolved slot-event geometry before beam slope and stem-tip adjustment; beam slope changes do not retroactively reposition tuplets in this proposal.
- Rest-placement policy stays with note engraving. `collision.rs` stays primitive and does not own musical rest policy.
- Bounds consumers must choose documented strict or forgiving semantics before pagination, validation, skyline, or stacking extraction.
- The TypeScript/SVG adapters remain thin consumers of `LayoutScene` and receive no layout ownership from this refactor.

### Verification

Implementation must preserve the approved task plan in `docs/proposals/ARCHITECTURE_tasks_layout_lib_modularization.md`. Final verification requires:

- `cargo test -p drummark-layout`
- `cargo clippy -p drummark-layout -- -W clippy::all` with no new warnings
- CLI SVG smoke checks for `docs/examples/modifiers.drum`, `docs/examples/repeats.drum`, and `docs/examples/hairpins.drum`
- `npm run wasm:build`, or a concrete implementation note explaining why no wasm-target verification was applicable
- a public API smoke test for crate-root exports
- a final visibility audit proving no unintended `pub` exports and no unjustified broad `pub(crate)` surface
