## Addendum v1.0: Content-Weighted Measure Widths Within a System

### Problem

Current system layout divides the available system width evenly across all measures:

- simple bars get more space than they need
- dense bars feel cramped
- local duration-weighted spacing helps inside a measure, but cannot solve a bar that is globally too narrow

This is most visible in grooves where one bar contains many short onsets, stickings, tuplets, or modifiers, while the neighboring bar is mostly empty.

### Goal

Distribute measure widths inside a system by content density, so:

- denser measures become wider
- simpler measures become narrower
- the result still feels stable and not jagged
- bar-to-bar differences stay compressed
- repeat overlays, volta spans, navigation, hairpins, and system-level annotations remain correct

### Scope

This proposal only changes width allocation **between measures inside one rendered system**.

It does not change:

- page-level or system-level line breaking
- the order of measures in a system
- the duration-weighted spacing algorithm already used inside a measure
- semantic timing or normalized score structure

### Proposed Layout Model

System layout becomes two-stage:

1. Compute a `layout weight` for each measure in the system.
2. Normalize those weights across the system width, subject to hard min/max clamps.
3. Render each stave with its assigned measure width.
4. Keep existing intra-measure spacing logic inside each measure.

This means:

- measure width solves coarse density
- intra-measure spacing solves fine rhythmic density

The two layers should complement each other, not compete.

### Measure Weight Function

Each measure gets:

`measureWeight = baseWeight + contentBonus + modifierBonus`

Where:

- `baseWeight = 1.0`
- `contentBonus` reflects rhythmic/event density
- `modifierBonus` reflects additional visual load from things like stickings or tuplets

### Rhythmic Density Input

The primary density signal should be the count of canonical onset segments already derived for intra-measure spacing.

Definitions:

- an onset segment is a unique start position of any note/rest entry in either voice
- simultaneous cross-voice starts count once

Reason:

- this aligns the system-width algorithm with the renderer's existing rhythmic model
- it avoids overcounting stacked hits
- it reflects actual horizontal pressure better than raw event count

### Base Density Formula

Proposed:

`contentBonus = beta * log2(segmentCount)`

With:

- `beta = 0.75` as the default

Examples:

- 1 segment: `0`
- 2 segments: `0.75`
- 4 segments: `1.5`
- 8 segments: `2.25`

So dense bars get more width, but not linearly more.

### Modifier Bonus

Some measures are visually dense even when onset count is similar.

Add small premiums for:

- tuplets
- sticking-heavy measures
- grace-note clusters
- dense above-staff navigation/modifier stacks

Proposed:

- tuplet present: `+0.15`
- sticking count above threshold: `+0.10`
- grace cluster present: `+0.10`
- complex top-of-staff stack: `+0.10`

These values must stay small. They should break ties, not dominate rhythmic density.

### What Should Not Increase Width

Do not widen a measure purely because it contains:

- a repeat-end barline
- a simple repeat-start barline
- a single tempo mark at system start
- a whole-measure rest
- a multi-measure rest placeholder

These are either already handled elsewhere or should not distort bar proportions by themselves.

### Clamps

Without clamps, content-weighted widths will become unstable.

For a system with `N` measures and total available width `W`:

- equal width = `W / N`
- minimum measure width = `0.72 * equalWidth`
- maximum measure width = `1.6 * equalWidth`

After clamping, renormalize widths to fill the system exactly.

This keeps the system visually coherent while still allowing meaningful variation.

### Special Cases

#### 1. Measure Repeat Pairs

Two-bar measure-repeat rendering currently depends on a stable pair geometry.

Rule:

- if a rendered `%%` expands into two physical measures, those two measures must share the same computed width

Use the maximum of the two source weights, then assign that shared width to both bars.

#### 2. Multi-Measure Rest

For rendered multi-rest placeholders:

- keep the current neutral width behavior
- do not apply density expansion

These measures are intentionally sparse and should not distort the system.

#### 3. Volta Spans

Volta layout must continue to derive x-positions from actual stave geometry after width assignment.

No special width bonus is needed for volta measures themselves.

#### 4. Cross-System Hairpins

Hairpins must continue to compute anchors from final note positions after measure widths are assigned.

No direct hairpin width bonus is needed.

### Integration Strategy

The current renderer computes:

- system width
- `measureWidth = width / measures.length`

This proposal replaces that one uniform width with a per-measure width array:

1. Build `measureWeights[]` for the measures in the system.
2. Convert them into `measureWidths[]`.
3. Compute cumulative `x` offsets from those widths.
4. Create each `Stave` with its own width and x-position.
5. Leave intra-measure formatter logic unchanged except for using the local stave width.

### Recommended Implementation Order

1. Add a pure helper that computes per-system measure weights from `RenderMeasure[]`.
2. Add a pure normalization helper that converts weights into clamped widths.
3. Change stave construction in `renderSystem()` to use cumulative widths.
4. Verify repeat overlays, volta spans, and hairpin clipping against non-uniform measure widths.
5. Add a debug-only compression control for tuning.

### Tuning Parameter

Expose one debug-only parameter:

- `Measure Width Compression`

Default:

- `0.75`

Effect:

- lower values pull widths back toward equal distribution
- higher values exaggerate density differences

This should mirror the existing debug-only approach for intra-measure spacing compression.

### Non-Goals

- automatic system reflow based on content width
- optical lyric-style engraving
- changing semantic grouping
- changing bar count per system
- cross-system width balancing

### Acceptance Criteria

- In a system with one sparse bar and one dense bar, the dense bar is visibly wider.
- The sparse/dense width ratio remains below `1.8x` under default settings.
- Systems with evenly dense bars still appear close to equal-width.
- Two-bar repeat overlays remain centered across their physical pair.
- Volta spans still align to the final bar geometry.
- Cross-system hairpins still compute stable continuation slices.
- Multi-measure rests do not become artificially wide.
- Existing render-probe tests for repeats, hairpins, and volta layout can be updated without introducing regressions.

### Consolidated Changes

- The implemented renderer now computes per-system measure weights before stave creation and assigns each rendered measure its own `x` and `width`.
- Width weighting is based primarily on unique onset-segment density, with small bonuses for tuplets, sticking-heavy bars, and grace clusters, then compressed and clamped back toward equal-width layout.
- A debug-only `Measure Width Compression` control was added so system-level width variation can be tuned live without changing the default renderer architecture.
