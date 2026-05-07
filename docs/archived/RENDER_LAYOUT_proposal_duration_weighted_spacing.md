## Addendum v1.0: Duration-Weighted Intra-Measure Spacing

### Problem

The current VexFlow integration effectively formats each measure with near-uniform horizontal distribution once the measure width is fixed. This makes sixteenth/eighth/quarter-note passages feel too evenly spaced, so longer values do not visually read as more structurally important.

At the same time, fully proportional spacing would over-expand long notes and make drum notation feel sparse and unstable, especially in dense groove writing.

### Goal

Adopt a measure-internal spacing rule where:

- longer durations receive more width than shorter durations
- the difference stays intentionally compressed
- simultaneous voices remain aligned at the same rhythmic anchors
- grouping boundaries still read clearly
- the algorithm can be layered onto the existing `renderMeasureVoices()` / `Formatter` pipeline without replacing the renderer architecture

### Proposed Layout Model

For each measure:

1. Build a canonical ordered list of rhythmic segments from all note/rest entry boundaries across both voices.
2. Assign each segment a width weight derived from the *longest sounding or resting duration that starts at that segment*.
3. Normalize those weights to the available stave width.
4. Place notes by segment anchor, not by naive equal subdivision.

This keeps cross-voice alignment strict while giving longer values moderately more breathing room.

### Segment Construction

Let the measure be partitioned into `N` ordered segments:

- segment starts at every entry start in either voice
- segment ends at the next segment start or measure end

Example in `4/4`:

- `HH: x x x x x x x x`
- `BD: b - - - b - - -`

Canonical segment starts are still the eighth-note grid, because that is where events/rest entries begin.

Example with mixed values:

- `HH: x - x - x - x -`
- `SD: - - d... -`

The segment list includes the starts of the eighths and the dotted-quarter start. The dotted-quarter does not create giant empty width by itself; it only raises the weight at its own onset.

### Width Weight Function

Each segment receives:

`weight = baseSlotWeight + durationBonus`

Where:

- `baseSlotWeight = 1.0`
- `durationBonus = alpha * log2(duration / minUnit + 1)`

Definitions:

- `duration` = duration of the longest entry starting at this segment
- `minUnit` = smallest notated unit active in the measure after normalization
- `alpha` = compression factor, proposed default `0.6`

This gives longer notes extra width, but on a logarithmic curve rather than linearly.

### Suggested Relative Weights

Using `minUnit = eighth note`:

- eighth: `1.0 + 0.6 * log2(1 + 1)` = `1.6`
- quarter: `1.0 + 0.6 * log2(2 + 1)` ≈ `1.95`
- dotted quarter: `1.0 + 0.6 * log2(3 + 1)` = `2.2`
- half: `1.0 + 0.6 * log2(4 + 1)` ≈ `2.39`

So quarter notes are visibly wider than eighths, but only by about `22%`, not `2x`.

That is the intended character: readable, not literal.

### Clamps

To avoid pathological measures:

- minimum segment width: `0.7 * equalWidth`
- maximum segment width: `1.8 * equalWidth`

Where `equalWidth = availableWidth / N`.

After clamping, renormalize all segment widths to the total available width.

This prevents a half-note onset in a sparse bar from swallowing the entire measure.

### Grouping Bias

Grouping should remain legible even when duration weights compress aggressively.

Add a small boundary premium to the first segment in each grouping chunk:

- `groupBoundaryBonus = 0.12`

Final weight:

`weight = baseSlotWeight + durationBonus + groupBoundaryBonusIfApplicable`

This keeps `2+2`, `3+3+2`, etc. readable without introducing hard visual gaps.

### Multi-Voice Rule

When both voices start entries at the same segment:

- choose the maximum of the starting durations from all voices for the duration bonus

Reason:

- the shared anchor should reflect the most structurally significant onset
- summing both voices would over-inflate stacked drum hits

### Rests

Rests participate exactly like notes for width weighting:

- a quarter rest onset should earn more width than an eighth rest onset
- whole-measure voice-rest collapsing stays unchanged and happens after entry analysis

This avoids visually inconsistent spacing where silent structure gets ignored.

### Integration Strategy

Do not replace the overall VexFlow rendering model.

Instead:

1. Build segment anchors before `Formatter.format(...)`.
2. Derive explicit x-positions from normalized segment widths.
3. Apply those positions to tick contexts or note absolute x values before draw.
4. Keep beaming, tuplets, modifiers, skyline, repeat overlays, and hairpins on the existing code path.

If VexFlow's formatter API resists direct anchor injection, a fallback implementation is:

- format normally only to compute glyph metrics
- then overwrite note x positions from the custom segment map

That fallback is acceptable if it preserves stave-relative alignment and beam integrity.

### Non-Goals

- full optical spacing like engraved concert notation
- replacing grouping semantics with duration semantics
- proportional spacing across measures or systems
- changing measure widths at the system layout level

### Recommended Default

Ship with:

- logarithmic duration bonus
- `alpha = 0.6`
- boundary bonus `0.12`
- clamp range `0.7x .. 1.8x` of equal-slot width

This should produce the visual character:

- longer values read wider
- short-note grooves remain compact
- bars do not become wildly uneven

### Acceptance Criteria

- In one measure containing only eighth notes, spacing remains effectively even.
- In one measure mixing quarters and eighths, quarter-note onsets are visibly wider than eighth-note onsets.
- The quarter/eighth width ratio stays below `1.3x` under default settings.
- Cross-voice simultaneous events stay vertically aligned.
- Grouping readability remains intact in `2+2`, `3+3+2`, and tuplet-heavy measures.
- Existing hairpin, sticking, volta, and measure-number layout does not regress.

### Consolidated Changes

- The implemented renderer keeps VexFlow's baseline formatter pass, then applies a second-pass `TickContext.setX(...)` remap inside each measure.
- The remap uses duration-weighted offsets derived from voice-entry starts, but preserves the first and last onset anchors from VexFlow so existing hairpin, volta, and modifier layout stays stable.
- A debug-only `Duration Spacing Compression` control was added to the settings panel so the weighting strength can be tuned live.
