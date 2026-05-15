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
