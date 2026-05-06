## Addendum 2026-05-04-C: Crescendo & Decrescendo Hairpins

### Status

Proposed

### Motivation

Crescendo (渐强) and decrescendo/diminuendo (渐弱) are fundamental dynamics markings in scored music. DrumMark currently has no notation for dynamics — no hairpins, no dynamic text marks (`pp`, `ff`, etc.). This addendum defines hairpin support for gradual volume changes.

Dynamic text marks (`pp`, `ff`, `mp`, `mf`, `sfz`, `fp` etc.) are related and will be addressed in a follow-up addendum.

### Syntax

Hairpins are inline tokens placed within a measure's event stream:

- **`<`** — start a crescendo hairpin (gets louder) from this position
- **`>`** — start a decrescendo hairpin (gets softer) from this position

Each hairpin extends from its start position to the **end of the current measure**. There is no explicit end marker in v1.

```
HH | d < d d d |
SD | - - d - d |
```

The `<` at position 2 starts a crescendo that spans the remainder of the measure (positions 2-4).

Multiple hairpins in the same measure are permitted:

```
HH | d < d > d d |
```

Beat 1: normal, beats 2-3: crescendo, beat 4: decrescendo.

**Rules:**
- `<` and `>` are standalone tokens — they occupy no rhythmic slot and do not consume divisions.
- They anchor to the rhythmic position where they appear in the token stream.
- At most one hairpin can start at any given rhythmic position.
- A `<` and `>` at the same position is a syntax error.
- Hairpins always extend to the end of the enclosing measure.
- Multi-measure hairpins: place `<` or `>` at the start of each consecutive measure.

```
[A] HH | < d d d d |        % measure 0: crescendo across full measure
        | d d d d |         % measure 1: no hairpin (continuation from previous measure)
        | d d d d > |       % measure 2: decrescendo to end
```

Wait — this multi-measure example doesn't work because the hairpin ends at the measure boundary automatically. For a true multi-measure hairpin, the renderer must recognize consecutive measures with the same hairpin type and merge them visually.

**Multi-measure hairpin rule:** When consecutive measures all contain a hairpin of the same type starting at position 0, the renderer merges them into a single continuous hairpin across those measures. The IR stores one HairpinIntent per measure; the renderer handles the visual merging.

```
HH | < d d d d |
    | d d d d |
    | d d d d > |
```

Measures 0-2 all have a `<` type hairpin starting at position 0. The renderer draws one continuous crescendo wedge spanning measures 0-2.

### Ambiguity Check

`<` and `>` are not currently used by any DrumMark token. They have no conflict with:
- Bar lines `|`, `:|`, `|:`, `:|:`
- Tuplets `(3`
- Groups `{...}`
- Navigation `@segno`, `@coda`
- Modifiers `^`, `~`, `@`
- Glyphs `x`, `d`, `g`, `r`, `b`, `c`, `h`, `s`, `t`, `f`, `S`, `C`, `R`, `B`, `H`, `T`, `F`

### Canonical IR Representation

Add an optional `hairpins` field to `NormalizedMeasure`:

```typescript
interface NormalizedMeasure {
  // ... existing fields ...
  hairpins?: HairpinIntent[];
}

interface HairpinIntent {
  type: "crescendo" | "decrescendo";
  start: Fraction;  // rhythmic position within the measure where the hairpin begins
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | `"crescendo" \| "decrescendo"` | **yes** | Direction of the hairpin |
| `start` | `Fraction` | **yes** | Position within the measure (`{ num: 0, den: 1 }` to `{ num: n, den: 1 }`) |

The hairpin implicitly extends to `{ num: measureDuration, den: 1 }` (end of the measure). The renderer is responsible for drawing the wedge.

Note: This supersedes the stub at Section 16.12 (Range Annotations), which defined a generic `type`/`subtype`/`start`/`end` structure. The HairpinIntent is a concrete, type-safe replacement for the "hairpin" range annotation type. The `end` field is omitted in v1 because hairpins always extend to the measure boundary.

### Lezer Grammar Support

**Token names:** `CrescendoStart`, `DecrescendoStart`

**Grammar rules:**
```
CrescendoStart: "<"
DecrescendoStart: ">"
```

**Integration points:**
- `<` and `>` are recognized as MeasureToken alternatives alongside existing tokens (GlyphToken, CombinedHit, GroupExpr, NavMarker, etc.).
- They are standalone statement nodes in the parse tree.
- During normalization, the parser/normalizer collects hairpin tokens for each measure:

```
For each measure:
  position = 0
  for each token in the measure event stream:
    if token is CrescendoStart:
      emit HairpinIntent { type: "crescendo", start: position }
    else if token is DecrescendoStart:
      emit HairpinIntent { type: "decrescendo", start: position }
    else:
      position += token.duration
```

- Hairpins within groups `{< d d}` are valid; the hairpin is extracted and moved to the enclosing measure's hairpins array during normalization.

### Rendering (VexFlow)

VexFlow 5 has no built-in hairpin wedge renderer. The renderer must draw hairpins as custom SVG elements:

- **Single-measure hairpin**: Draw a wedge (two diverging/converging lines) below the staff, from the start note's x-position to the end-of-measure x-position.
  - Crescendo: lines diverge (narrow → wide, left → right).
  - Decrescendo: lines converge (wide → narrow, left → right).
- **Multi-measure hairpin**: When consecutive measures share the same hairpin type at position 0, draw one continuous wedge across all measures.
- **Vertical offset**: 10px below the staff to avoid collision with lyrics/sticking annotations.
- **Line thickness**: 1px.
- **Aperture**: 8px (small end) to 20px (wide end) for single-measure; 8px to 24px for multi-measure hairpins spanning 2+ measures.

### MusicXML Export

Hairpins export as `<wedge>` elements within `<direction>` at the appropriate measure positions:

```xml
<direction placement="below">
  <direction-type>
    <wedge type="crescendo" number="1" spread="0"/>
  </direction-type>
  <offset>0</offset>
</direction>
<!-- ... notes ... -->
<direction placement="below">
  <direction-type>
    <wedge type="stop" number="1"/>
  </direction-type>
  <offset>0</offset>
</direction>
```

- `type="crescendo"` for `<` hairpins
- `type="diminuendo"` for `>` hairpins (MusicXML uses "diminuendo", not "decrescendo")
- `type="stop"` at the end of the hairpin (measure boundary or explicit end)
- `placement="below"` — standard for percussion staves
- Multi-measure hairpins: single `crescendo`/`diminuendo` wedge from first measure's start to last measure's end, with implicit `stop` at the final position

### Conflict Rules

- A hairpin at the same rhythmic position as a sticking marker is valid; they occupy different visual spaces (hairpin below staff, sticking above).
- A hairpin at the same position as a tuplet start is valid.
- Hairpins do not conflict with navigation markers, rehearsal marks, or other annotations.

### Edge Cases

- **Empty measure**: A hairpin in a measure with no events is a syntax error — there is nothing to attach the hairpin to.
- **Measure repeat `%`**: Hairpins in the source measure propagate to all generated measures; hairpins in generated measures are ignored (generated content cannot add new annotations).
- **Inline repeat `*N`**: The hairpin is duplicated across all expanded copies of the measure. Each copy's generated measure inherits the hairpin.
- **Tuplet overlap**: A hairpin starting inside a tuplet is valid. Position is calculated after tuplet normalization.
- **Multi-voice context**: Hairpins apply globally to the measure, not per-voice. Voice-specific dynamics are a future concern.
- **Grace notes**: Hairpins starting on a grace note position are valid; the wedge begins at the grace note's visual position.
- **Hairpin at measure position 0 vs. measure position n**: Position 0 means the hairpin starts at the barline. This is the conventional placement for full-measure hairpins.

### Examples

**Example 1: Simple crescendo**
```
time 4/4
divisions 4

HH | d < d d d |
SD | - - d - d |
```

IR (excerpt):
```json
{
  "measures": [
    {
      "index": 0,
      "hairpins": [
        { "type": "crescendo", "start": { "num": 1, "den": 1 } }
      ],
      "events": [
        { "track": "HH", "start": { "num": 0, "den": 1 }, "glyph": "d", ... },
        { "track": "HH", "start": { "num": 1, "den": 1 }, "glyph": "d", ... },
        { "track": "SD", "start": { "num": 2, "den": 1 }, "glyph": "d", ... },
        { "track": "HH", "start": { "num": 2, "den": 1 }, "glyph": "d", ... },
        { "track": "HH", "start": { "num": 3, "den": 1 }, "glyph": "d", ... }
      ]
    }
  ]
}
```

**Example 2: Crescendo then decrescendo in one measure**
```
time 4/4
divisions 8

SD | d - < d d > d - d d |
```

IR (excerpt):
```json
{
  "hairpins": [
    { "type": "crescendo", "start": { "num": 2, "den": 1 } },
    { "type": "decrescendo", "start": { "num": 5, "den": 1 } }
  ]
}
```

**Example 3: Multi-measure crescendo**
```
time 4/4
divisions 4

HH | < d d d d |
    | d d d d |
    | d d d d |
```

Measures 0-2 each have `{ type: "crescendo", start: { num: 0, den: 1 } }`. The renderer merges these into one continuous wedge across all three measures.

**Example 4: Hairpin with group**
```
time 4/4
divisions 4

SD | {< d d} d d |
```

The `<` inside the group is extracted to the measure's hairpins array at position 0.

### Open Questions for Review

1. Should hairpins always be placed below the staff (standard for percussion), or should the placement be configurable (above/below)?
2. Should we support an explicit end marker (e.g., `|` or `!`) for hairpins that terminate mid-measure, or defer to v2?
3. Should dynamic text marks (`pp`, `ff`, `mf` etc.) use a prefix character (e.g., `!pp`, `!ff`) to avoid ambiguity with glyph tokens, or use bare text and rely on grammar disambiguation?
4. Should the `end` field be added to HairpinIntent now (even if always set to end-of-measure in v1) to avoid a schema migration later?

### Review Round 1

#### 1. CRITICAL: Fraction field-name mismatch with codebase

The proposal uses `num`/`den` in its IR examples and schema table:

```typescript
interface HairpinIntent {
  type: "crescendo" | "decrescendo";
  start: Fraction;  // { num: 0, den: 1 }
}
```

The actual `Fraction` type in `src/dsl/types.ts` (line 257-260) uses `numerator`/`denominator`:

```typescript
export type Fraction = {
  numerator: number;
  denominator: number;
};
```

If `start` reuses the existing `Fraction` type, the proposal's examples and table are wrong. If it introduces a new shape, that creates a conflicting fraction representation. Either way, the examples need to be rewritten to use the canonical field names, and the semantic meaning of the fraction must be clarified (see next point).

#### 2. CRITICAL: `start` semantics are ambiguous -- slot index or musical time?

The proposal's examples show `{ "num": 1, "den": 1 }` for a hairpin starting at rhythmic position 1 within a measure. This looks like a slot index (0/1, 1/1, 2/1, ...).

However, the canonical `Fraction` type in the codebase represents **musical time** relative to a whole note. `NormalizedEvent.start` at beat 1 of a 4/4 measure with `note 1/16` would be `{ numerator: 4, denominator: 16 }` (or reduced: `{ numerator: 1, denominator: 4 }`).

These two interpretations are incompatible:
- **Slot-index**: `start: { numerator: 2, denominator: 1 }` means "position 2 in grid"
- **Musical time**: `start: { numerator: 2, denominator: 4 }` means "half note from measure start" (beat 3 in 4/4)

This matters deeply: the slot-index interpretation is coupled to the grid resolution (`note 1/N`), meaning the same hairpin would have different Fraction values under different `note` settings. The musical-time interpretation is grid-independent.

The existing `StartNav` anchor uses `{ eventAfter: Fraction }` where the Fraction is a musical position within the measure (line 377 in types.ts). `NormalizedEvent.start` is also musical time. So `HairpinIntent.start` should follow the same convention -- but the proposal's examples contradict this.

**Recommendation**: Rewrite examples using musical-time Fractions (e.g., `{ numerator: 1, denominator: 4 }` for beat 2 in 4/4), and explicitly state that `start` uses the same Fraction representation as `NormalizedEvent.start`.

#### 3. CRITICAL: MusicXML multi-measure hairpins require `type="continue"`

The proposal describes MusicXML export for multi-measure hairpins as "single crescendo/diminuendo wedge from first measure's start to last measure's end, with implicit stop at the final position." This is imprecise and would produce invalid MusicXML.

Per MusicXML 3.1, a wedge spanning three measures requires:
- Measure 0: `<wedge type="crescendo" number="1"/>`
- Measure 1: `<wedge type="continue" number="1"/>`
- Measure 2: `<wedge type="stop" number="1"/>`

The `continue` type is mandatory for intermediate measures. Without it, a MusicXML reader would see a crescendo start in measure 0, no wedge instruction in measure 1 (so it ends implicitly or produces undefined behavior), and a `stop` in measure 2 with no active wedge to stop.

**Recommendation**: Update the MusicXML export section to describe the three-element pattern (start / continue / stop) for multi-measure hairpins, with explicit `<direction>` blocks in each participating measure.

#### 4. CRITICAL: Hairpins inside rhythmic groups `[N: ...]` are unaddressed

The proposal states: "Hairpins within groups `{< d d}` are valid; the hairpin is extracted and moved to the enclosing measure's hairpins array during normalization."

This correctly covers `InlineBracedBlock` (routing/track groups). However, the Lezer grammar (`src/dsl/drum_mark.grammar` line 91-93) defines `GroupExpr` as:

```
GroupExpr {
  "[" Integer? ":" MeasureContent "]" |
  "[" MeasureContent "]"
}
```

Since `MeasureContent { MeasureToken* }` accepts any token type, adding `<` and `>` as MeasureToken alternatives would automatically allow them inside rhythmic groups too: `[2: < d d]`.

A hairpin inside a rhythmic group is semantically problematic: the group distributes duration among its items, but a hairpin has no duration. Where does the hairpin belong? At the group's start? At a specific sub-position? The proposal does not address this.

**Recommendation**: Either (a) explicitly prohibit hairpins inside rhythmic groups in the grammar by not adding them to `MeasureToken` but instead collecting them at a different grammar level, or (b) define clear semantics for extraction (the hairpin is extracted and anchored to the group's start position, the same as routing groups). Option (a) is safer for v1.

#### 5. MAJOR: Multi-measure merging is fragile and missing edge cases

The rule "When consecutive measures all contain a hairpin of the same type starting at position 0, the renderer merges them" has several unaddressed failure modes:

**5a. Paragraph boundaries**: The spec (Section 14, Paragraphs) says "Each paragraph starts a new system in the rendered score." Merging a hairpin across a paragraph boundary means drawing a continuous wedge across a system break, which is visually impossible. The merging rule must explicitly exclude measures separated by paragraph boundaries.

**5b. Time signature changes**: With `@time` (future) or per-paragraph `time` overrides, consecutive measures could have different widths. A continuous wedge across 4/4 and 3/4 would need proportional scaling. VexFlow would need to compute different widths per measure segment.

**5c. `note 1/N` changes**: Per-paragraph `note` overrides change the grid resolution, affecting visual measure width. A merged hairpin across different grid resolutions needs different scaling per segment.

**5d. Page breaks**: In page-layout mode, a multi-measure hairpin could cross a page boundary. The wedge must be split into two segments with the "continue" visual convention (a small hook at the end of the first segment and the beginning of the second). The proposal does not address this.

**5e. Non-position-0 starts**: The proposal implies only position-0 hairpins merge, but does not explicitly state that hairpins starting mid-measure never participate in merging. This should be stated.

**Recommendation**: Add explicit non-merge conditions: (a) paragraph boundaries, (b) non-position-0 starts, (c) time signature or note value changes. For page breaks, defer to v2 with a known limitation note.

#### 6. MAJOR: VexFlow custom SVG wedges across measures -- implementation risk

The proposal states "VexFlow 5 has no built-in hairpin wedge renderer" and mandates custom SVG elements. Drawing a single continuous wedge across multiple VexFlow-rendered measures is significantly harder than described:

- VexFlow renders measures independently via `Formatter.joinVoices` and `Formatter.format`. There is no cross-measure coordinate system exposed to callers.
- A single SVG `<polygon>` spanning three measures must be drawn after all measures are formatted, using the accumulated x-positions of each measure's start and end barlines.
- VexFlow's internal coordinate system may shift between measures depending on justification, system breaks, and staff grouping.
- In page-layout mode, the renderer must also handle page breaks (see 5d).

This is achievable but requires care. The proposal should acknowledge the architectural complexity: the renderer must collect all hairpin intents, perform a forward scan to identify mergeable spans, compute global x-coordinates after formatting, and emit a single SVG wedge per merged span in a post-render pass.

**Recommendation**: Add an implementation note describing the two-pass approach: (1) format all measures, (2) scan hairpin intents, merge consecutive same-type position-0 hairpins, compute global x-coordinates, and emit wedges in a post-format overlay pass.

#### 7. MAJOR: Interaction with voltas (first/second endings) is unaddressed

Consider a hairpin inside a volta bracket:

```
HH |: < d d d d |1. d d d d > :|2. d d d d |
```

Questions this raises:
- Does the hairpin in the first-ending measure restart on each repeat pass?
- Is the hairpin semantically tied to the volta, or does it exist independently of the repeat structure?
- In MusicXML export, should the wedge be inside or outside the volta bracket?
- What about hairpin cross-volta boundaries (e.g., hairpin in `|1.` measure that visually should not continue into `|2.`)?

The same questions apply to navigation jumps (DS al Coda, DC al Fine, etc.).

**Recommendation**: Add a statement that (a) hairpins are independent of repeat/navigation structure in v1 -- they are positioned per logical measure in score order, and (b) playback/export consumers that unfold repeats are responsible for replicating hairpin annotations appropriately. For cross-volta hairpins, explicitly prohibit or define the semantics.

#### 8. MAJOR: No explicit end marker -- a significant v1 gap

Open Question #2 asks whether to support explicit end markers. The answer significantly impacts the feature's utility:

- Without an end marker, a crescendo that starts mid-measure always extends to the barline, which is a genuine musical limitation. In real scores, hairpins frequently terminate mid-measure at a specific note.

- If an end marker is added later (`!` was suggested), it changes the grammar and requires schema migration (the `end` field becomes non-trivial).

- The simplest approach that preserves forward compatibility: add the `end` field to `HairpinIntent` NOW, defaulting it to end-of-measure in v1, but making it an explicit `Fraction`. This means the IR is always complete, even if v1 DSL syntax only sets it to the barline. When explicit end markers are added in v2, the IR schema is already ready.

- Example of a forward-compatible schema:
  ```typescript
  interface HairpinIntent {
    type: "crescendo" | "decrescendo";
    start: Fraction;
    end: Fraction;  // always measure end in v1; user-settable in v2
  }
  ```

**Recommendation**: Add the `end` field now with the value always computed as the full measure duration. This is zero-cost for v1 and eliminates a breaking schema change in v2. Explicitly answer Open Question #4 with "yes."

#### 9. MODERATE: Section 16.12 supersession is underspecified

The proposal says: "This supersedes the stub at Section 16.12 (Range Annotations), which defined a generic `type`/`subtype`/`start`/`end` structure."

Section 16.12 defines Range Annotations with three subtypes: `hairpin`, `slur`, and `dynamic`. The proposal only supersedes `hairpin`. What happens to `slur` and `dynamic`? They remain as stubs, but now the section has a fractured authority: hairpin is defined elsewhere, slurs and dynamics are still stubs.

**Recommendation**: Amend the supersession statement to say: "This addendum supersedes Section 16.12 for the `hairpin` subtype only. The `slur` and `dynamic` range annotation stubs remain as defined in Section 16.12 until superseded by their own addenda."

#### 10. MODERATE: Lezer grammar -- token precedence with `BasicGlyph`

The current `BasicGlyph` rule uses explicit string matches like `"x"`, `"d"`, `"s"`, etc. Adding `"<"` and `">"` as sibling alternatives in `MeasureToken` is syntactically safe since `<` and `>` do not match any existing glyph token string.

However, there is a subtle issue: `<` and `>` are single characters that could theoretically appear as the start of a future multi-character token (e.g., `<<` for something). Lezer's greedy matching means `<` would always win over `<<` if both are defined. This isn't a problem now but should be documented as a design constraint: once `<` is claimed as a single-character token, no future token can start with `<`.

The same concern applies to `>`.

**Recommendation**: Add a note to the grammar section acknowledging that `<` and `>` as single-character tokens preclude any future tokens starting with these characters. This is an acceptable trade-off.

#### 11. MINOR: Typo in Edge Cases

Line 176 (as rendered in markdown): "**Tuplet overlap**: A hairpin starting inside a tuplet is valid."

Should be: "**Tuplet overlap**"

#### 12. MINOR: Error classification for "at most one hairpin at a position"

The proposal states "At most one hairpin can start at any given rhythmic position" and "A `<` and `>` at the same position is a syntax error." But odd as it may seem, what about *two `<` at the same position* (e.g., on different tracks)? The proposal should clarify:
- Two `<` on different tracks at the same measure position: are they merged into one (since hairpins are global per the Multi-voice Context rule)? Or is it an error?
- Following the existing pattern for markers and jumps, hairpins should be global bar-level metadata. If Track A has `<` at position 2 and Track B also has `<` at position 2, they should merge into one `HairpinIntent`. If Track A has `<` at position 2 and Track B has `>` at position 2, that is the error case already described.

**Recommendation**: Add a global merge rule: hairpin declarations across tracks merge by position. Same type at same position collapses. Different types at same position is a hard error.

#### 13. MINOR: `NormalizedMeasure.hairpins` field naming

The proposal uses `hairpins?: HairpinIntent[]` for the field name. The existing `NormalizedMeasure` (types.ts line 357) uses `startNav`/`endNav` for navigation, `volta`/`measureRepeat`/`multiRest` for other metadata. The field name `hairpins` is consistent with this convention. No issue here -- just confirming.

#### 14. MINOR: Grace note visual position is imprecise

The proposal says "the wedge begins at the grace note's visual position." But a grace note (flam, drag) is rendered as a small note before the main note. Its visual position is to the left of the main note but not at a mathematically precise grid position. The renderer needs a concrete rule: does the wedge start at the x-position of the grace note's stem, its notehead center, or the main note's left edge? This is a rendering detail but should be specified so the MusicXML export (which only has Fraction-level precision) and the VexFlow renderer (which has pixel-level precision) produce consistent results.

**Recommendation**: Specify that the hairpin wedge starts at the x-position of the main note (not the grace note), since the hairpin's Fraction `start` aligns with the main note's grid position, not the grace note's. The grace note case in the proposal should be re-examined: does it even make musical sense to start a hairpin on a grace note?

#### Summary

The proposal is directionally sound but has three critical issues (Fraction field name mismatch, `start` semantics ambiguity, missing MusicXML `continue` type), three major issues (multi-measure merging fragility, VexFlow implementation complexity, missing volta/navigation interaction), and several moderate/minor issues that should be addressed before implementation.

**Bottom line**: The `<`/`>` syntax choice is good and unambiguous. The IR shape is minimal but needs the `end` field added now for forward compatibility. The multi-measure merging logic needs explicit non-merge conditions. And the MusicXML export description is incomplete and would produce invalid output as written.

STATUS: CHANGES_REQUESTED


### Author Response

**Date:** 2026-05-04

Response to all 14 issues from Review Round 1.

---

#### Critical Issues

**Issue 1 — Fraction field-name mismatch:** Fixed. All IR examples now use `numerator`/`denominator` matching the canonical `Fraction` type in `types.ts`.

**Issue 2 — `start` semantics ambiguity:** Fixed. The revised proposal explicitly states that `start` and `end` use musical-time `Fraction` (same as `NormalizedEvent.start`). All examples rewritten with correct musical-time values.

**Issue 3 — MusicXML `type="continue"`:** Fixed. Multi-measure hairpins now export with `crescendo`/`diminuendo` → `continue` → `stop` sequence across measures.

**Issue 4 — Hairpins inside rhythmic groups `[N: ...]`:** Fixed. Hairpins (`<`, `>`, `!`) are explicitly prohibited inside `GroupExpr` at the grammar level. They are collected at the measure level, not within grouped content.

#### Major Issues

**Issue 5 — Multi-measure merging fragility:** Fixed. Added explicit non-merge conditions:
- Paragraph boundaries break hairpin merge (system break)
- Only position-0 hairpins can merge across measures
- Per-paragraph `time` sig/`note` overrides break merge
- Page breaks deferred to v2 with known limitation note

**Issue 6 — VexFlow two-pass rendering:** Acknowledged. Added implementation note describing the two-pass approach: format all measures, then scan/merge hairpin intents in a post-format overlay pass.

**Issue 7 — Volta/navigation interaction:** Fixed. Added statement that hairpins are independent of repeat/navigation structure in v1. The renderer positions hairpins per logical measure in score order. Playback/export consumers handle repeat unfolding.

**Issue 8 — Explicit end marker (`!`):** Adopted. The revised proposal introduces `!` as a neutral hairpin terminator. The `end` field is always present in `HairpinIntent`. `!` sets `end` to the explicit position; omission of `!` causes `end` to default to measure boundary.

#### Moderate/Minor Issues

**Issue 9 — Section 16.12 supersession:** Fixed. Clarified that only the `hairpin` subtype is superseded; `slur` and `dynamic` stubs remain.

**Issue 10 — Token precedence:** Noted. Added a constraint note that `<`, `>`, and `!` as single-char tokens preclude future multi-char tokens starting with these characters.

**Issue 11 — Typo:** Fixed.

**Issue 12 — Cross-track merge rule:** Added. Same-type hairpins at the same position across tracks collapse to one `HairpinIntent`. Different types at the same position is a hard error.

**Issue 13 — Field naming:** Confirmed `hairpins` is consistent with existing `startNav`/`endNav` convention.

**Issue 14 — Grace note position:** Clarified. Hairpin wedge starts at the main note's x-position, not the grace note's. The grace note case example has been updated.

---

### Revised Proposal

The sections below replace the original proposal in its entirety. Changes from the original are summarized at the end.

---

## Addendum 2026-05-04-C (Revised): Crescendo & Decrescendo Hairpins

### Status

Proposed (Revised)

### Motivation

Crescendo (渐强) and decrescendo/diminuendo (渐弱) are fundamental dynamics markings in scored music. DrumMark currently has no notation for dynamics — no hairpins, no dynamic text marks (`pp`, `ff`, etc.). This addendum defines hairpin support for gradual volume changes, with explicit start and end markers.

Dynamic text marks (`pp`, `ff`, `mp`, `mf`, `sfz`, `fp` etc.) are related and will be addressed in a follow-up addendum.

### Syntax

Three inline tokens are added to the measure event stream:

- **`<`** — start a crescendo hairpin (gets louder)
- **`>`** — start a decrescendo hairpin (gets softer)
- **`!`** — terminate the currently open hairpin at this position

Hairpin start tokens are paired with an end token. If `!` is omitted, the hairpin implicitly ends at the measure boundary.

```
SD | d < d d ! d - d d |    crescendo: position 1 to 3
SD | d > d d ! d - d d |    decrescendo: position 1 to 3
SD | d < d d d d |          crescendo: position 1 to end of measure (no `!`)
SD | d < d d ! d > d ! |    crescendo 1→3, then decrescendo 3→4
SD | d < d ! d > d   |      two separate hairpins in one measure
```

**Rules:**
- `<`, `>`, and `!` are standalone tokens — they occupy no rhythmic slot and do not consume divisions.
- They anchor to the rhythmic position where they appear in the token stream.
- A `!` without a preceding `<` or `>` is a syntax error UNLESS a cross-measure hairpin is active (carried forward from the previous measure).
- An unclosed hairpin (started but not terminated before the next start token or end of measure) implicitly ends at the measure boundary within the same measure.
- Hairpins cannot nest: only one hairpin can be active at a time.
- `<` at the same position as `>` — within the same measure's source text, adjacent `<` and `>` with no duration-consuming token between them — is a syntax error.
- `<` or `>` adjacent to `!` at the same source-text position in the same measure (e.g., `!<`, `!>`, `<!`) is a syntax error.
- These co-positioning rules apply only to **source-text adjacency within a single measure**. When a hairpin originates from cross-measure carry-forward state (not from source text), transitions at position 0 are permitted: a carried-forward `<` implicitly closes at the barline when a `>` at position 0 starts a new hairpin, and `!<` at position 0 is valid (`!` terminates the carry-forward, `<` starts fresh).

**Multi-measure hairpins (cross-measure carry-forward):** When a measure ends with an open hairpin (started but not terminated by `!`), the hairpin type is carried forward into the next measure. The subsequent measure inherits the hairpin at position 0, producing a full-measure `HairpinIntent`. This continues across consecutive measures until:
- A `!` token terminates the hairpin at the given position.
- A new `<` or `>` token starts a different hairpin (the previous one implicitly ends at the previous measure's boundary).

```
HH | < d d d d |          measure 0: crescendo starts, open at end
    | d d d d |           measure 1: inherits crescendo (full-measure)
    | d d d d ! |         measure 2: inherits crescendo, ! closes it
```

The `!` in measure 2 is valid even though that measure has no `<` or `>`, because the cross-measure hairpin from measure 1 is active.

```
HH | < d d d d |          measure 0: crescendo starts at pos 0
    | > d d d d |         measure 1: > closes prev crescendo at m0-end, starts decrescendo
```

When consecutive measures form a continuous hairpin (same type, all at position 0, no paragraph break between them), the renderer merges them visually into one continuous wedge.

**Cross-track rule:** Hairpins are global to the measure, not per-track. If Track A has `<` at position 2 and Track B also has `<` at position 2, they collapse to a single `HairpinIntent`. Different types at the same position across tracks is a hard error. Hairpin tokens at different rhythmic positions across tracks (e.g., Track A `<` at 1/4, Track B `<` at 1/2) is a hard error — only one hairpin can be active at a time.

**Paragraph boundary rule:** Cross-measure hairpin carry-forward resets at paragraph boundaries. A hairpin open at the end of the last measure of paragraph N does NOT carry into paragraph N+1. To continue a hairpin across a paragraph boundary, place an explicit `<` or `>` at position 0 of the first measure in the new paragraph.

**Explicitly prohibited:** Hairpins are NOT allowed inside rhythmic groups (`[N: ...]` or `[...]`). They are measure-level annotations only.

### Canonical IR Representation

Add an optional `hairpins` field to `NormalizedMeasure`:

```typescript
interface NormalizedMeasure {
  // ... existing fields ...
  hairpins?: HairpinIntent[];
}

interface HairpinIntent {
  type: "crescendo" | "decrescendo";
  start: Fraction;  // musical time within the measure (same representation as NormalizedEvent.start)
  end: Fraction;     // musical time within the measure; explicit (`!`) or measure boundary
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | `"crescendo" \| "decrescendo"` | **yes** | Direction of the hairpin |
| `start` | `Fraction` | **yes** | Musical-time position where hairpin begins |
| `end` | `Fraction` | **yes** | Musical-time position where hairpin ends (explicit via `!`, or measure boundary) |

Both `start` and `end` use the canonical `Fraction` type from `types.ts` (`numerator`/`denominator`), representing musical time relative to the measure start — identical to `NormalizedEvent.start`. For example, in 4/4 time with `note 1/16`:
- Beat 1 (0/4): `{ numerator: 0, denominator: 1 }`
- Beat 2 (1/4): `{ numerator: 1, denominator: 4 }`
- Beat 3 (2/4): `{ numerator: 1, denominator: 2 }`
- Beat 4 (3/4): `{ numerator: 3, denominator: 4 }`

This addendum supersedes Section 16.12 (Range Annotations) for the `hairpin` subtype only. The `slur` and `dynamic` range annotation stubs in Section 16.12 remain until superseded by their own addenda.

### Lezer Grammar Support

**Token names:** `CrescendoStart`, `DecrescendoStart`, `HairpinEnd`

**Grammar rules:**
```
CrescendoStart: "<"
DecrescendoStart: ">"
HairpinEnd: "!"
```

**Integration points:**
- `<`, `>`, and `!` are collected at the measure level during parsing. They are NOT valid inside `GroupExpr` (rhythmic groups `[N: ...]`).
- They are valid inside routing groups `{...}` (InlineBracedBlock) — the hairpin is extracted and moved to the enclosing measure's `hairpins` array during normalization.
- During normalization, a cross-measure state tracks whether an unclosed hairpin carries forward. The key insight: cross-measure inheritance simply re-establishes the active hairpin state at position 0 of the new measure; the per-token loop then handles `!` and new `<`/`>` uniformly.

```
// Per-score normalization state:
carryForwardType = null  // "crescendo" | "decrescendo" | null

for each measure in score order:
  hairpins = []
  activeStart = null
  activeType = null
  position = 0

  // Inherit cross-measure hairpin: set active state at position 0
  if carryForwardType is not null:
    activeStart = { numerator: 0, denominator: 1 }
    activeType = carryForwardType
    carryForwardType = null  // will be re-set below if still open

  for each token in the measure event stream:
    if token is CrescendoStart or DecrescendoStart:
      if activeStart is not null and activeStart != position:
        hairpins.push({ type: activeType, start: activeStart, end: position })
      // if start == position, zero-length hairpin: skip (cross-measure carry-forward
      // implicitly closed at barline by new hairpin at position 0)
      activeStart = position
      activeType = token.type
    else if token is HairpinEnd:
      if activeStart is null:
        error: "! without preceding < or > and no cross-measure hairpin"
      if activeStart != position:
        hairpins.push({ type: activeType, start: activeStart, end: position })
      // if start == position, zero-length hairpin: skip (cross-measure ! at barline)
      activeStart = null
      activeType = null
    else:
      position += token.duration

  // End of measure: close any open hairpin
  if activeStart is not null:
    hairpins.push({ type: activeType, start: activeStart, end: measureDuration })
    carryForwardType = activeType  // carry forward to next measure

  // Paragraph boundary check: reset carry-forward between paragraphs
  if measure is the last measure of its paragraph:
    carryForwardType = null
```

**Grammar mechanism for GroupExpr exclusion:** The current grammar uses `MeasureToken*` in both `MeasureContent` (for measures and `InlineBracedBlock`) and `GroupExpr` (rhythmic groups). To allow hairpins in `{...}` but forbid them in `[N: ...]`, the grammar introduces a split:

```
MeasureToken (extends to include CrescendoStart, DecrescendoStart, HairpinEnd)
GroupToken — same as current MeasureToken (without hairpin tokens)

MeasureContent { MeasureToken* }        // used by MeasureSection, InlineBracedBlock
GroupContent   { GroupToken* }           // used by GroupExpr
```

This catches hairpin-in-rhythmic-group errors at parse time.

**Fraction comparison:** The algorithm uses `activeStart != position` where both are `Fraction` objects. This implies structural equality (same `numerator` and `denominator`), matching the existing codebase convention for Fraction comparison.

**Design constraint:** `<`, `>`, and `!` as single-character tokens preclude any future multi-character tokens starting with these characters. This is an acceptable trade-off.

### Rendering (VexFlow)

VexFlow 5 has no built-in hairpin wedge renderer. The renderer implements a two-pass approach:

**Pass 1 (format):** Format all measures via `Formatter.joinVoices` / `Formatter.format` as normal.

**Pass 2 (overlay):** After formatting, scan `hairpins` across all measures:
1. Collect x-positions from formatted measures.
2. Identify mergeable spans: consecutive measures with same-type hairpins starting at position 0, uninterrupted by paragraph breaks, time signature changes, or per-paragraph `note` overrides.
3. For each span (single or merged), draw a wedge (two diverging/converging lines) as an SVG `<polygon>` in a post-format overlay pass.

**Single-measure hairpin:** Wedge from start-x to end-x, below the staff.

**Multi-measure hairpin (merged):** One continuous wedge across all spanned measures, computed from the global x-coordinates of the first measure's start position to the last measure's end position.

**Non-merge conditions (hairpin resets):**
- Paragraph boundary (system break) — cannot visually merge across systems
- Non-position-0 start — hairpin starting mid-measure never participates in cross-measure merging
- Per-paragraph `time` or `note` override changes measure width — break the merge
- Page breaks — wedge splits with continuation hooks (deferred to v2; v1 knows this limitation)

**Rendering parameters:**
- **Vertical offset:** 10px below the staff
- **Line thickness:** 1px
- **Aperture:** 8px (narrow end) to 20px (wide end) for single-measure; 8px to 24px for multi-measure spans
- **Crescendo:** lines diverge left-to-right (narrow → wide)
- **Decrescendo:** lines converge left-to-right (wide → narrow)
- **Alignment:** Hairpin `start` wedge begins at the x-position of the main note at that Fraction position, not at grace-note visual positions

### MusicXML Export

Single-measure hairpins export as `<wedge>` within `<direction>` at start and end positions:

```xml
<!-- Start of hairpin -->
<direction placement="below">
  <direction-type>
    <wedge type="crescendo" number="1"/>
  </direction-type>
  <offset>0</offset>
</direction>
<!-- ... notes ... -->
<!-- End of hairpin -->
<direction placement="below">
  <direction-type>
    <wedge type="stop" number="1"/>
  </direction-type>
  <offset>0</offset>
</direction>
```

Multi-measure hairpins use the three-element pattern per MusicXML 3.1:

- Measure 0: `<wedge type="crescendo" number="1"/>`
- Measure 1: `<wedge type="continue" number="1"/>`
- Measure 2: `<wedge type="stop" number="1"/>`

Key points:
- `type="crescendo"` for `<` hairpins
- `type="diminuendo"` for `>` hairpins (MusicXML naming convention)
- `type="stop"` at the position where `!` appears, or at measure boundary if no explicit end
- `type="continue"` for intermediate measures in a multi-measure span
- `placement="below"` — standard for percussion staves
- `<offset>` reflects the Fraction position within the measure

### Conflict Rules

- A hairpin at the same rhythmic position as a sticking marker is valid; they occupy different visual spaces.
- A hairpin at the same position as a tuplet start is valid.
- Hairpins do not conflict with navigation markers, rehearsal marks, or other annotations.
- Cross-track: same-type hairpins at the same position merge; different types error.

### Interaction with Voltas, Repeats, and Navigation

- Hairpins are **independent of repeat/navigation structure** in v1.
- The renderer positions hairpins per logical measure in score order — it does not interpret or unfold repeats.
- Playback engines and MusicXML consumers that unfold repeats are responsible for replicating hairpin annotations appropriately.
- Hairpins inside volta brackets (first/second endings) are valid. The hairpin renders within the volta bracket visually. The consumer handles whether the hairpin restarts on each repeat pass.
- Hairpins across DS/DC jump boundaries are valid; the consumer handles jump semantics.

### Edge Cases

- **Empty measure:** A hairpin in a measure with no events is a syntax error.
- **Measure repeat `%`:** Hairpins in the source measure propagate to all generated measures. Hairpins in generated measures are ignored.
- **Inline repeat `*N`:** The hairpin is duplicated across all expanded copies. Each generated measure inherits the hairpin.
- **Tuplet overlap:** A hairpin starting inside a tuplet is valid. `start` position is calculated after tuplet normalization.
- **Multi-voice:** Hairpins are global to the measure, not per-voice.
- **Grace notes:** Hairpin `start` aligns to the main note's x-position, not the grace note's. It is musically unusual to start a hairpin on a grace note, but syntactically permitted.
- **Empty paragraph:** A paragraph with a rehearsal mark but no musical events in any measure cannot contain a hairpin — there is no content to attach the hairpin to. A rehearsal mark in a paragraph that has musical content has no effect on hairpin validity.
- **Paragraph boundaries break merged hairpins:** A `<` at position 0 in the last measure of paragraph N does not merge with a `<` at position 0 in the first measure of paragraph N+1 (different systems).

### Examples

**Example 1: Simple crescendo with explicit end**
```
time 4/4
note 1/16

SD | d < d d ! d - d d |
```

IR (excerpt):
```json
{
  "measures": [{
    "index": 0,
    "hairpins": [
      {
        "type": "crescendo",
        "start": { "numerator": 1, "denominator": 4 },
        "end": { "numerator": 3, "denominator": 4 }
      }
    ]
  }]
}
```

**Example 2: Decrescendo to end of measure (implicit end)**
```
time 4/4
note 1/16

SD | d - d > d d |
```

IR (excerpt):
```json
{
  "hairpins": [
    {
      "type": "decrescendo",
      "start": { "numerator": 1, "denominator": 2 },
      "end": { "numerator": 1, "denominator": 1 }
    }
  ]
}
```

**Example 3: Two hairpins in one measure**
```
time 4/4
note 1/16

SD | < d d ! d > d ! |
```

IR (excerpt):
```json
{
  "hairpins": [
    {
      "type": "crescendo",
      "start": { "numerator": 0, "denominator": 1 },
      "end": { "numerator": 1, "denominator": 2 }
    },
    {
      "type": "decrescendo",
      "start": { "numerator": 3, "denominator": 4 },
      "end": { "numerator": 1, "denominator": 1 }
    }
  ]
}
```

**Example 4: Multi-measure crescendo**
```
time 4/4
note 1/16

HH | < d d d d |
    | d d d d |
    | d d d d ! |
```

IR (excerpt, three measures):
```json
{
  "measures": [
    { "index": 0, "hairpins": [
      { "type": "crescendo", "start": { "numerator": 0, "denominator": 1 }, "end": { "numerator": 1, "denominator": 1 } }
    ]},
    { "index": 1, "hairpins": [
      { "type": "crescendo", "start": { "numerator": 0, "denominator": 1 }, "end": { "numerator": 1, "denominator": 1 } }
    ]},
    { "index": 2, "hairpins": [
      { "type": "crescendo", "start": { "numerator": 0, "denominator": 1 }, "end": { "numerator": 1, "denominator": 1 } }
    ]}
  ]
}
```

Measures 0 and 1 are unclosed: carryForwardType propagates. Measure 2 has `!` at position 4/4 (measure end), which closes the cross-measure hairpin normally (start 0, end 1/1). All three measures share `type: "crescendo"` starting at position 0 with no paragraph breaks. The renderer merges them into one continuous wedge.

**Example 5: Cross-measure hairpin with mid-measure end**
```
time 4/4
note 1/16

SD | d d < d d |
   | d d d ! d |
```

IR (excerpt):
```json
{
  "measures": [
    { "index": 0, "hairpins": [
      { "type": "crescendo", "start": { "numerator": 1, "denominator": 2 }, "end": { "numerator": 1, "denominator": 1 } }
    ]},
    { "index": 1, "hairpins": [
      { "type": "crescendo", "start": { "numerator": 0, "denominator": 1 }, "end": { "numerator": 3, "denominator": 4 } }
    ]}
  ]
}
```

Measure 0: `<` at beat 3, unclosed → carries forward. Measure 1: inherits crescendo at position 0, `!` at beat 4 closes it at `3/4`.

**Example 6: Cross-measure hairpin terminated at barline**
```
time 4/4
note 1/16

HH | < d d d d |
    | ! d d d d |
```

Measure 0: `{ type: "crescendo", start: 0, end: 1/1 }`. Measure 1: `!` at position 0 matches the inherited activeStart at position 0 → zero-length hairpin, skipped in IR. Measure 1 has no hairpins. The crescendo wedge in measure 0 ends at the barline.

**Example 7: Hairpin inside routing group**
```
time 4/4
note 1/16

SD | {< d d} d d ! |
```

The `<` inside the routing group is extracted to the measure's `hairpins` array at position 0. `!` at position 2. Hairpin span: 0 → 2.

### Open Questions for Review

1. Should hairpins always be placed below the staff (standard for percussion), or should the placement be configurable (above/below)?
2. Should dynamic text marks (`pp`, `ff`, `mf` etc.) use bare text tokens and rely on grammar disambiguation from glyph tokens? (Note: the `!` prefix approach is precluded since `!` is now reserved as `HairpinEnd`.)

### Summary of Changes from Original Proposal

| Aspect | Original | Revised |
|--------|----------|---------|
| End marker | None (always measure boundary) | `!` token for explicit termination |
| `HairpinIntent.end` | Absent (implicit) | Always present (`Fraction`) |
| Fraction field names | `num`/`den` (wrong) | `numerator`/`denominator` (canonical) |
| `start` semantics | Ambiguous (slot-index vs musical-time) | Musical-time, same as `NormalizedEvent.start` |
| MusicXML multi-measure | Described incorrectly (no `continue`) | Correct `crescendo` → `continue` → `stop` pattern |
| Rhythmic groups `[N: ...]` | No rule | Explicitly prohibited |
| Cross-track merge | Not specified | Same type + position → merge; different type → error |
| Multi-measure merge | Unconditional for position-0 | Non-merge: paragraph break, time/note change, non-position-0 |
| VexFlow implementation | One-pass assumption | Two-pass: format then overlay |
| Volta/navigation interaction | Not addressed | Independent of repeats; consumer handles unfolding |
| Section 16.12 supersession | Overstated (implied full) | Partial: hairpin only; slur/dynamic stubs remain |
| Token precedence constraint | Not noted | Documented (`<`, `>`, `!` block future multi-char tokens) |

### Review Round 2

**Date:** 2026-05-04

Review of the Revised Proposal against all issues raised in Review Round 1. The author addressed the bulk of Round 1 feedback: the `!` token, Fraction field names, `start` semantics, MusicXML `continue`, GroupExpr prohibition, non-merge conditions, cross-track merge, VexFlow two-pass, volta/navigation independence, and 16.12 scope. However, several issues persist or have been introduced by the revision itself.

---

#### 1. CRITICAL: Open Question #2 now contradicts the `!` token reservation

The Revised Proposal adds `!` as a single-character Lezer token (`HairpinEnd`). The design constraint in the Lezer Grammar Support section explicitly states:

> `<`, `>`, and `!` as single-character tokens preclude any future multi-character tokens starting with these characters.

Yet the Open Questions for Review section still asks:

> 2. Should dynamic text marks (`pp`, `ff`, `mf` etc.) use a prefix character (e.g., `!pp`, `!ff`) to avoid ambiguity with glyph tokens, or use bare text and rely on grammar disambiguation?

This question is now **internally inconsistent with the proposal's own design constraint**. The `!` prefix strategy (`!pp`, `!ff`) is already precluded by Lezer's tokenization — `!` will greedily match as `HairpinEnd` before any multi-character token can be recognized. This is not a hypothetical future conflict; it is a contradiction between two sections of the same proposal.

**Recommendation**: Remove or rewrite Open Question #2. It should state that the `!` prefix approach is no longer available and ask only whether bare-text tokens (e.g., `pp`, `ff`) or a different prefix character should be used for dynamic marks.

---

#### 2. CRITICAL: Algorithm produces zero-length hairpins when a new `<`/`>` at position 0 closes a carry-forward hairpin

The cross-measure carry-forward algorithm's Start token branch reads:

```
if token is CrescendoStart or DecrescendoStart:
  if activeStart is not null:
    hairpins.push({ type: activeType, start: activeStart, end: position })
  activeStart = position
  activeType = token.type
```

Contrast this with the End token branch, which has an explicit zero-length guard:

```
else if token is HairpinEnd:
  ...
  if activeStart != position:
    hairpins.push({ type: activeType, start: activeStart, end: position })
  // if start == position, zero-length hairpin: skip (cross-measure ! at barline)
```

The Start token branch has **no zero-length guard**. When a cross-measure carry-forward is closed by a new `<` or `>` at position 0, the algorithm pushes a zero-length hairpin:

```
HH | < d d d d |     % measure 0: unclosed crescendo to barline
    | > d d d ! d |   % measure 1: > at pos 0 closes carried-forward < at pos 0
```

Trace of measure 1:
1. Inherit: `activeStart = 0/1`, `activeType = "crescendo"`
2. Token `>`: `activeStart is not null` → push `{crescendo, start: 0/1, end: 0/1}` **(zero-length!)**
3. `activeStart = 0/1`, `activeType = "decrescendo"`
4. Token `d`: position = 1/4
5. Token `d`: position = 1/2
6. Token `d`: position = 3/4
7. Token `!`: push `{decrescendo, 0/1, 3/4}`
8. Token `d`: position = 1/1

Result: Measure 1 IR contains `[{type: "crescendo", start: 0, end: 0}, {type: "decrescendo", start: 0, end: 3/4}]`. The zero-length crescendo is nonsense — it represents an interval of zero musical duration, produces zero-width visual wedges, and would either crash or produce garbage in the renderer.

This is the same class of zero-length guard that was correctly applied to the `!` branch but omitted from the Start token branch. The multi-measure example in the proposal explicitly describes this scenario:

```
HH | < d d d d |
    | > d d d d |
```
> "measure 1: > closes prev crescendo at m0-end, starts decrescendo"

So the algorithm is supposed to support this pattern but will produce a zero-length artifact.

**Recommendation**: Add the same zero-length guard to the Start token branch: `if activeStart is not null and activeStart != position: push(...)`. Also add a test case for this exact cross-measure pattern.

---

#### 3. MAJOR: Rules on `!`/`<`/`>` co-positioning conflict with valid cross-measure patterns

The Rules section states:

> `<` at the same position as `>` is a syntax error (cannot start both simultaneously).
> `<` or `>` at the same position as `!` is a syntax error (cannot start and end at the same spot).

These rules are sound for same-measure scenarios. However, they produce false positives in the cross-measure carry-forward context. Consider:

```
HH | < d d d d |     % measure 0: unclosed crescendo
    | ! < d d d |     % measure 1: ! at pos 0 ends carry-forward, < at pos 0 starts new crescendo
```

Measure 1 has both `!` and `<` at rhythmic position 0. According to the rule, this is a syntax error. But the semantics are clear and musically valid: the `!` consumes the inherited crescendo from measure 0 (zero-length in IR, skipped), and `<` starts a fresh crescendo at position 0. The algorithm handles this correctly — after `!` clears `activeStart`/`activeType`, the `<` encounters `activeStart is null` and starts normally.

The rule should be scoped to **source-text adjacency within a single measure**. When a hairpin token originates from carry-forward state (not from the source text of the current measure), it should not trigger co-positioning errors with subsequent tokens.

Additionally, the same tension exists when a carry-forward crescendo is implicitly closed by an explicit `>` at position 0 (as described in the proposal's own multi-measure example):

```
HH | < d d d d |
    | > d d d d |
```

The rule "`<` at same position as `>` is a syntax error" would catch this, but the proposal explicitly blesses this pattern. The current specification is self-contradictory on this point.

**Recommendation**: Refine the co-positioning rules to distinguish source-level co-positioning from state-level interaction:
- "Within a single measure's source text, adjacent `<` and `>` tokens at the same position (with no duration-consuming token between them) is a syntax error."
- "Within a single measure's source text, adjacent end/start token pairs (`!<`, `!>`) at the same position is a syntax error."
- "When the first token is a carried-forward state (not a source token in the current measure), different-type or same-type transitions at position 0 are permitted (the previous hairpin closes at the barline)."

---

#### 4. MAJOR: `carryForwardType` behavior across paragraph boundaries is unspecified

The algorithm tracks `carryForwardType` as per-score normalization state and never resets it at paragraph boundaries. However, the rendering non-merge conditions state that paragraph boundaries break visual merging.

This creates an ambiguity: if measure 0 is the last measure of paragraph A and has an unclosed hairpin, `carryForwardType` will propagate into measure 1 (the first measure of paragraph B). Measure 1 will then have a `HairpinIntent` with `start: 0/1` but no visual merge partner (the previous measure is in a different system).

The question is: is this intended behavior? Two possible answers:

(a) **Reset `carryForwardType` at paragraph boundaries**: This prevents orphan hairpins at paragraph starts. Consequence: a user who wants a multi-paragraph crescendo must explicitly place `<` at position 0 in the first measure of the new paragraph.

(b) **Keep `carryForwardType` across paragraphs**: The IR correctly records that a hairpin is active at the start of the new paragraph, even though the renderer cannot visually merge. MusicXML consumers could handle this correctly (they operate on logical structure, not visual systems).

The proposal does not say which is intended. Option (a) is safer for visual rendering; option (b) preserves semantic information. Either way, the choice must be stated explicitly.

**Recommendation**: Declare a choice. Suggested: **Reset `carryForwardType` to `null` at paragraph boundaries** (option a). Add a rule: "Cross-measure hairpin carry-forward does not propagate across paragraph boundaries. A new paragraph requires an explicit `<` or `>` at position 0 to continue the hairpin." This is the safer default for v1 and still allows users to write the pattern by repeating the token.

---

#### 5. MAJOR: Cross-track hairpins at different positions have undefined behavior

The cross-track merge rule covers only same-position scenarios:

> "Same-type hairpins at the same position across tracks collapse to a single HairpinIntent. Different types at the same position is a hard error."

Combined with the global-hairpin rule: "Hairpins cannot nest: only one hairpin can be active at a time."

**What happens when Track A has `<` at position 1/4 and Track B has `<` at position 1/2?** Both are same-type, but at different positions. The same-position merge rule does not apply, so they would produce two separate `HairpinIntent` entries: one at {start: 1/4, ...} and one at {start: 1/2, ...}. But this violates "only one hairpin can be active at a time" — these two intents overlap in time.

Possible resolutions:
(a) **Reject**: Different-position hairpins across tracks is a hard error.
(b) **Merge to earliest**: Only the earliest `<` position across all tracks is kept. Subsequent `<` tokens at later positions are ignored (or warned).
(c) **Per-track relaxation**: "Only one hairpin can be active at a time" applies per-track, not globally, for same-type hairpins at different positions. (This contradicts the "global to the measure" rule for v1.)

**Recommendation**: Adopt option (a) for v1: a hairpin token at different positions across tracks is a hard error. This is consistent with the "global to the measure" design and the "only one hairpin at a time" rule. State this explicitly in the cross-track rule section.

---

#### 6. MODERATE: Grammar mechanism for GroupExpr exclusion is underspecified

The Revised Proposal states:

> "`<`, `>`, and `!` are collected at the measure level during parsing. They are NOT valid inside `GroupExpr` (rhythmic groups `[N: ...]`)."

And also: "They are valid inside routing groups `{...}` (InlineBracedBlock)."

However, the current grammar has:

```
MeasureContent { MeasureToken* }
GroupExpr { "[" Integer? ":" MeasureContent "]" | "[" MeasureContent "]" }
InlineBracedBlock { "{" MeasureContent "}" }
```

Both `GroupExpr` and `InlineBracedBlock` use `MeasureContent`, which uses `MeasureToken`. If `<`, `>`, and `!` are added as `MeasureToken` alternatives, they become valid inside BOTH group types. The proposal does not describe the grammar change that would exclude them from `GroupExpr` while allowing them in `InlineBracedBlock`.

There are two possible implementation approaches:
(a) **Separate token lists**: Define `GroupContent` (without hairpin tokens) for `GroupExpr` and keep `MeasureContent` (with hairpin tokens) for `MeasureSection` and `InlineBracedBlock`.
(b) **Post-parse validation**: Allow hairpins in `GroupExpr` in the grammar, then emit a parse error during normalization/semantic validation.

Neither approach is specified, and neither is called out as an implementation detail.

**Recommendation**: Explicitly describe the grammar change. Suggested approach (a) is cleaner — it catches the error at parse time and avoids allowing semantically invalid constructs to reach the AST. Add a brief note in the Lezer Grammar Support section describing the `GroupContent` vs `MeasureContent` distinction.

---

#### 7. MINOR: Algorithm uses Fraction object comparison without specification

The pseudocode algorithm uses constructs like:

```
if activeStart != position:
  hairpins.push(...)
// if start == position, zero-length hairpin: skip
```

Since `activeStart` and `position` are both of type `Fraction` (an object type `{ numerator, denominator }`), the `!=` operator here relies on structural equality — not referential identity and not JavaScript's default `!==`. In a real implementation, this would require a helper function such as `fractionEquals(a, b)` or `!fractionEqual(a, b)`.

The normalization algorithm in the codebase already handles Fraction comparison for event positioning, so this is not a novel problem. However, since the algorithm is presented as specification-level pseudocode, it is worth noting the assumption.

**Recommendation**: Not a blocking issue, but add a brief note: "Fraction comparison uses structural equality (same numerator and denominator, not necessarily reduced)."

---

#### 8. MINOR: Ambiguous edge case description for empty paragraphs

The Edge Cases section includes:

> "**Empty paragraph:** A hairpin in a paragraph with only a rehearsal mark is valid if the rehearsal mark is followed by music content in any measure."

The phrase "followed by music content in any measure" is unclear. A rehearsal mark is a label applied to a specific paragraph (line 421 in types.ts: `{ label, paragraphIndex }`). A paragraph "with only a rehearsal mark" presumably means the paragraph has a rehearsal mark as the only content annotation, but still contains measures with musical events.

The intended semantics seem to be: a rehearsal mark is a paragraph-level annotation, and the presence or absence of a rehearsal mark has no bearing on hairpin validity. The "empty paragraph" edge case should focus on whether any measure in the paragraph has parseable musical content to which a hairpin can attach.

**Recommendation**: Rephrase to: "A paragraph consisting solely of a rehearsal mark and a `<` token with no musical events in any measure is a syntax error (no content to attach the hairpin to). A rehearsal mark in a paragraph with musical content has no effect on hairpin validity."

---

### Summary

The revised proposal addresses the majority of Review Round 1 feedback, particularly the `!` token, Fraction corrections, MusicXML `continue`, GroupExpr prohibition, and multi-measure non-merge conditions. However, two critical issues remain: (1) the Open Questions section contains a question that is already answered (and contradicted) elsewhere in the proposal, and (2) the carry-forward algorithm produces zero-length hairpin artifacts when a new `<`/`>` at position 0 closes an inherited hairpin. Three major specification gaps also persist: the co-positioning rules are too broad for cross-measure patterns, paragraph-boundary carry-forward behavior is unspecified, and cross-track hairpins at different positions have no defined behavior. The grammar mechanism for GroupExpr exclusion and a few minor documentation issues round out the remaining concerns.

**Bottom line**: The core design (three tokens `<`, `>`, `!` with explicit termination and cross-measure carry-forward, musical-time Fraction positions, and explicit non-merge conditions) is sound. The specification needs targeted fixes to the algorithm (zero-length guard), rules (co-positioning refinement, paragraph-boundary reset, cross-track different-position resolution), and a documentation fix for the stale Open Question.

STATUS: CHANGES_REQUESTED


### Author Response Round 2

**Date:** 2026-05-04

All 8 issues from Review Round 2 have been addressed with targeted edits to the Revised Proposal section. No structural redesign was needed.

---

#### 1. CRITICAL — Open Question #2 contradiction

**Fix:** Rewrote OQ#2 to remove the `!pp`/`!ff` suggestion. The question now reads: "Should dynamic text marks use bare text tokens and rely on grammar disambiguation from glyph tokens? (Note: the `!` prefix approach is precluded since `!` is now reserved as `HairpinEnd`.)"

#### 2. CRITICAL — Zero-length hairpin in Start token branch

**Fix:** Added the same `activeStart != position` guard to the `CrescendoStart`/`DecrescendoStart` branch that was already present in the `HairpinEnd` branch. The pattern `<` in measure N followed by `>` at position 0 in measure N+1 now correctly skips the zero-length push.

#### 3. MAJOR — Co-positioning rules too broad

**Fix:** Refined the three rules to distinguish source-text adjacency from carry-forward state:
- `<` and `>` adjacent in same-measure source text → error
- `!<` or `!>` adjacent in same-measure source text → error
- When a token originates from cross-measure carry-forward (not source text), transitions at position 0 are permitted. This covers `!<` at position 0 and `<`→`>` carry-forward transitions.

#### 4. MAJOR — carryForwardType across paragraph boundaries

**Fix:** Added explicit reset in the algorithm: `if measure is the last measure of its paragraph: carryForwardType = null`. Added a corresponding rule in the syntax section: "Cross-measure hairpin carry-forward resets at paragraph boundaries. To continue a hairpin across a paragraph boundary, place an explicit `<` or `>` at position 0 of the first measure in the new paragraph."

#### 5. MAJOR — Cross-track hairpins at different positions

**Fix:** Added hard error rule: "Hairpin tokens at different rhythmic positions across tracks (e.g., Track A `<` at 1/4, Track B `<` at 1/2) is a hard error — only one hairpin can be active at a time."

#### 6. MODERATE — Grammar mechanism for GroupExpr exclusion

**Fix:** Added explicit grammar split description: `MeasureToken` (with hairpin tokens) vs `GroupToken` (without). `MeasureContent` uses `MeasureToken*` for measures and `InlineBracedBlock`. `GroupContent` uses `GroupToken*` for `GroupExpr`. This catches the error at parse time.

#### 7. MINOR — Fraction structural equality assumption

**Fix:** Added a note: "The algorithm uses `activeStart != position` where both are `Fraction` objects. This implies structural equality (same `numerator` and `denominator`), matching the existing codebase convention."

#### 8. MINOR — Empty paragraph wording

**Fix:** Rephrased to: "A paragraph with a rehearsal mark but no musical events in any measure cannot contain a hairpin — there is no content to attach the hairpin to. A rehearsal mark in a paragraph that has musical content has no effect on hairpin validity."


### Review Round 3

**Date:** 2026-05-04

Third review, focused exclusively on verifying that all 8 issues from Review Round 2 have been correctly applied to the Revised Proposal text (the section beginning at `## Addendum 2026-05-04-C (Revised)`). Each fix was verified by reading the actual Revised Proposal content, not by trusting the Author Response claims.

---

#### Fix 1 -- CRITICAL: Open Question #2 contradiction

**Claim:** Rewrote OQ#2 to remove the `!pp`/`!ff` suggestion and acknowledge that `!` is reserved as `HairpinEnd`.

**Verified text** (line 920 of the Revised Proposal):
> 2. Should dynamic text marks (`pp`, `ff`, `mf` etc.) use bare text tokens and rely on grammar disambiguation from glyph tokens? (Note: the `!` prefix approach is precluded since `!` is now reserved as `HairpinEnd`.)

**Assessment:** CORRECT. The `!pp`/`!ff` prefix suggestion is removed. The note explicitly precludes the `!` prefix approach, resolving the internal contradiction with the design constraint that `!` is a single-character Lezer token.

---

#### Fix 2 -- CRITICAL: Zero-length guard in Start token branch

**Claim:** Added `activeStart != position` guard to the `CrescendoStart`/`DecrescendoStart` branch.

**Verified text** (lines 634-639 of the Revised Proposal):
```
    if token is CrescendoStart or DecrescendoStart:
      if activeStart is not null and activeStart != position:
        hairpins.push({ type: activeType, start: activeStart, end: position })
      // if start == position, zero-length hairpin: skip (cross-measure carry-forward
      // implicitly closed at barline by new hairpin at position 0)
      activeStart = position
```

**Assessment:** CORRECT. The guard `activeStart != position` is present, matching the equivalent guard in the `HairpinEnd` branch. The comment explains the cross-measure carry-forward rationale. Traced through the problematic `<` in measure N followed by `>` at position 0 in measure N+1 pattern: the inherited activeStart (0) equals position (0), so the guard correctly prevents pushing a zero-length hairpin. The previous hairpin was already closed at end-of-measure in measure N.

---

#### Fix 3 -- MAJOR: Co-positioning rules distinguish source-text adjacency

**Claim:** Refined the three rules to distinguish source-text adjacency from carry-forward state transitions.

**Verified text** (lines 541-543 of the Revised Proposal):
> - `<` at the same position as `>` — within the same measure's source text, adjacent `<` and `>` with no duration-consuming token between them — is a syntax error.
> - `<` or `>` adjacent to `!` at the same source-text position in the same measure (e.g., `!<`, `!>`, `<!`) is a syntax error.
> - These co-positioning rules apply only to **source-text adjacency within a single measure**. When a hairpin originates from cross-measure carry-forward state (not from source text), transitions at position 0 are permitted: a carried-forward `<` implicitly closes at the barline when a `>` at position 0 starts a new hairpin, and `!<` at position 0 is valid (`!` terminates the carry-forward, `<` starts fresh).

**Assessment:** CORRECT. The rules now clearly separate two domains: (a) same-measure source-text adjacency is an error, and (b) carry-forward state transitions at position 0 are explicitly permitted. The previously self-contradictory pattern (`<` in measure N, `>` at pos 0 in measure N+1) is now resolved: the carry-forward `<` closes at the barline (via end-of-measure push in measure N), and the `>` starts fresh at position 0 in measure N+1.

---

#### Fix 4 -- MAJOR: Paragraph boundary reset for carryForwardType

**Claim:** Added explicit reset in the algorithm and a corresponding rule in the Syntax section.

**Verified algorithm text** (lines 657-659 of the Revised Proposal):
```
  // Paragraph boundary check: reset carry-forward between paragraphs
  if measure is the last measure of its paragraph:
    carryForwardType = null
```

**Verified rule text** (line 566 of the Revised Proposal):
> **Paragraph boundary rule:** Cross-measure hairpin carry-forward resets at paragraph boundaries. A hairpin open at the end of the last measure of paragraph N does NOT carry into paragraph N+1. To continue a hairpin across a paragraph boundary, place an explicit `<` or `>` at position 0 of the first measure in the new paragraph.

**Assessment:** CORRECT. The algorithm reset is placed after the end-of-measure close (so the last measure still gets its hairpin in the IR) but before the next iteration (so the next paragraph does not inherit). The rule provides clear guidance for users who want to continue a hairpin across a paragraph boundary.

---

#### Fix 5 -- MAJOR: Cross-track hairpins at different positions

**Claim:** Added hard error rule for hairpin tokens at different rhythmic positions across tracks.

**Verified text** (line 564 of the Revised Proposal):
> **Cross-track rule:** Hairpins are global to the measure, not per-track. If Track A has `<` at position 2 and Track B also has `<` at position 2, they collapse to a single `HairpinIntent`. Different types at the same position across tracks is a hard error. Hairpin tokens at different rhythmic positions across tracks (e.g., Track A `<` at 1/4, Track B `<` at 1/2) is a hard error — only one hairpin can be active at a time.

**Assessment:** CORRECT. The different-position case is explicitly called out as a hard error with a concrete example. This is consistent with the "global to the measure, not per-track" design and the "only one hairpin can be active at a time" rule.

---

#### Fix 6 -- MODERATE: Grammar mechanism for GroupExpr exclusion

**Claim:** Added explicit grammar split description with `MeasureToken` vs `GroupToken`.

**Verified text** (lines 662-672 of the Revised Proposal):
> **Grammar mechanism for GroupExpr exclusion:** The current grammar uses `MeasureToken*` in both `MeasureContent` (for measures and `InlineBracedBlock`) and `GroupExpr` (rhythmic groups). To allow hairpins in `{...}` but forbid them in `[N: ...]`, the grammar introduces a split:
>
> ```
> MeasureToken (extends to include CrescendoStart, DecrescendoStart, HairpinEnd)
> GroupToken — same as current MeasureToken (without hairpin tokens)
> 
> MeasureContent { MeasureToken* }        // used by MeasureSection, InlineBracedBlock
> GroupContent   { GroupToken* }           // used by GroupExpr
> ```
>
> This catches hairpin-in-rhythmic-group errors at parse time.

**Assessment:** CORRECT. The dual-content approach is explicitly described. The distinction between `MeasureContent` (allows hairpin tokens, used by measures and routing groups) and `GroupContent` (forbids them, used by rhythmic groups) is clear. Catches errors at parse time rather than deferring to semantic validation.

---

#### Fix 7 -- MINOR: Fraction comparison structural equality

**Claim:** Added note about Fraction object comparison assumption.

**Verified text** (lines 673-674 of the Revised Proposal):
> **Fraction comparison:** The algorithm uses `activeStart != position` where both are `Fraction` objects. This implies structural equality (same `numerator` and `denominator`), matching the existing codebase convention for Fraction comparison.

**Assessment:** CORRECT. The note explicitly acknowledges the structural-equality assumption and ties it to existing codebase convention. The pseudocode operator is a specification convenience; implementors understand that `Fraction` requires a structural comparison helper.

---

#### Fix 8 -- MINOR: Empty paragraph wording

**Claim:** Rephrased to clarify that rehearsal marks have no bearing on hairpin validity.

**Verified text** (line 766 of the Revised Proposal):
> - **Empty paragraph:** A paragraph with a rehearsal mark but no musical events in any measure cannot contain a hairpin — there is no content to attach the hairpin to. A rehearsal mark in a paragraph that has musical content has no effect on hairpin validity.

**Assessment:** CORRECT. The old ambiguous phrasing ("followed by music content in any measure") is replaced with two clear, independent statements: (1) no musical events means no hairpins, (2) rehearsal marks are irrelevant to hairpin validity when musical content exists.

---

### Additional Consistency Checks

Beyond verifying the 8 claimed fixes, the following cross-checks were performed:

1. **Algorithm trace for Example 4 (multi-measure crescendo):** `carryForwardType` correctly propagates across measures 0, 1, and 2. All three measures produce full-measure `HairpinIntent` entries with matching type and position 0. The `!` in measure 2 closes the final hairpin. Renderer merge conditions are satisfied. Consistent.

2. **Algorithm trace for Example 6 (`!` at barline):** Inherited carry-forward at position 0 meets `!` at position 0. The zero-length guard skips. Measure 1 produces no hairpin IR entries. The crescendo wedge from measure 0 ends at the barline. Consistent.

3. **Algorithm trace for the `<`→ `>` cross-measure transition:** Measure N's unclosed `<` is pushed with `end = measureDuration` and carried forward. Measure N+1 inherits at position 0, then `>` at position 0 triggers the zero-length guard (skip). The new decrescendo starts at position 0. No zero-length artifact. Consistent with both the rules and the examples.

4. **Internal contradiction between rules and algorithm for within-measure `<!`:** The rules (line 542) declare within-measure `<!` a syntax error. The algorithm's zero-length guard would silently skip it if it reached normalization. This is not a conflict because these are caught at the parser/validation level before normalization -- the algorithm serves as a normalization spec for valid input, not as a validator. No change needed.

### Summary

All 8 fixes claimed in Author Response Round 2 are verified as correctly applied to the Revised Proposal text. Each fix was checked against the actual proposal content, not the Author Response claims. No new critical or major issues were introduced by the fixes. The specification is internally consistent across the rules, algorithm pseudocode, and examples.

The core design -- three single-character tokens (`<`, `>`, `!`) with explicit termination, cross-measure carry-forward with zero-length guards, musical-time Fraction positions, paragraph-boundary reset, cross-track merge rules, and explicit non-merge conditions for rendering -- is sound and ready for implementation.

STATUS: APPROVED


### Consolidated Changes

**Date:** 2026-05-04
**Proposal:** Addendum 2026-05-04-C: Crescendo & Decrescendo Hairpins
**Review rounds:** 3 (R1: 14 issues, R2: 8 issues, R3: APPROVED)

#### Final Design Summary

**Syntax**: Three inline tokens — `<` (crescendo start), `>` (decrescendo start), `!` (end current hairpin). Unclosed hairpins implicitly end at measure boundary. Cross-measure carry-forward propagates open hairpins to the next measure (resets at paragraph boundaries).

**IR**: `NormalizedMeasure.hairpins?: HairpinIntent[]` where `HairpinIntent = { type: "crescendo" | "decrescendo", start: Fraction, end: Fraction }`. Both fields use musical-time Fraction (`numerator`/`denominator`) matching `NormalizedEvent.start`.

**Lezer grammar**: Three new tokens (`CrescendoStart`, `DecrescendoStart`, `HairpinEnd`). `MeasureToken` includes them; `GroupToken` (for rhythmic groups `[N: ...]`) excludes them. `InlineBracedBlock` (`{...}`) allows them via `MeasureContent`.

**Normalization**: Per-score cross-measure state (`carryForwardType`). Inherited hairpins re-establish active state at position 0 of the new measure. Zero-length guards in both Start and End token branches. Paragraph boundary resets carry-forward.

**Rendering**: Two-pass VexFlow approach — format all measures, then overlay SVG `<polygon>` wedges in post-format pass. Merge conditions: consecutive same-type position-0 hairpins, no paragraph break, no time/note overrides. Non-merge conditions: paragraph boundary, non-position-0 start, time/note change, page break (deferred to v2).

**MusicXML**: `<wedge>` elements with `crescendo`/`diminuendo` → `continue` → `stop` pattern for multi-measure spans. `placement="below"` for percussion staves.

**Cross-track**: Same type + same position → merge. Different type at same position → error. Different positions across tracks → error.

**Supersession**: Section 16.12 (Range Annotations) superseded for `hairpin` subtype only.

#### Key Decisions Made During Review

| Decision | Resolution |
|----------|------------|
| End marker | `!` as neutral terminator (R1#8) |
| Fraction field names | `numerator`/`denominator` (R1#1) |
| `start`/`end` semantics | Musical-time Fraction (R1#2) |
| MusicXML multi-measure | `crescendo` → `continue` → `stop` (R1#3) |
| Rhythmic groups | Prohibited via `GroupToken` exclusion (R1#4) |
| Paragraph boundaries | Reset carry-forward (R2#4) |
| Cross-track different position | Hard error (R2#5) |
| `!` prefix for dynamics | Precluded; `!` reserved as `HairpinEnd` (R2#1) |
| Zero-length guard | Active in both Start and End branches (R2#2) |
| Co-positioning rules | Scoped to source-text adjacency only (R2#3) |


## Post-Approval Amendment 2026-05-04: Paragraph Boundary Carry-Forward

### Status

Proposed

### Motivation

The approved proposal (R2#4) specified that `carryForwardType` resets at paragraph boundaries — a hairpin open at the end of paragraph N would NOT carry into paragraph N+1. The user would need an explicit `<` or `>` at the start of the new paragraph.

This was the wrong call. In real music scores, crescendo/decrescendo hairpins frequently span multiple systems (paragraphs). Forcing explicit re-declaration at each system break is unmusical and creates unnecessary repetition. The renderer should handle the visual split at system breaks, but the IR semantics should not be interrupted.

### Change

Revert the paragraph boundary reset (R2#4). Cross-measure carry-forward now propagates across paragraph boundaries:

**Before (approved):**
- Algorithm: `if measure is last in its paragraph: carryForwardType = null`
- Rule: "Carry-forward resets at paragraph boundaries."
- Edge case: "Carry-forward resets; explicit `<`/`>` needed at paragraph start."

**After (amended):**
- Algorithm: no paragraph boundary check — `carryForwardType` persists unconditionally
- Rule: "Carry-forward propagates across paragraph boundaries — a hairpin can span multiple systems."
- Renderer: at paragraph boundaries (system breaks), the wedge is visually split with continuation hooks, but the IR carry-forward is not interrupted

### Impact on Other Rules

- **Non-merge conditions:** Paragraph boundary is removed from the list. The renderer still splits the wedge visually at system breaks (can't draw a continuous polygon across two systems), but this is a rendering concern, not a semantic one.
- **Edge cases:** Paragraph boundaries no longer require explicit re-declaration of `<`/`>`.
- All other rules (cross-track, co-positioning, zero-length guard, etc.) are unaffected.

### Review Round 4

**Date:** 2026-05-04

Review of the Post-Approval Amendment only — the scope is the paragraph boundary carry-forward change.

---

#### Amendment Assessment

The amendment corrects a mistaken design decision from R2#4. The original rationale for resetting at paragraph boundaries was to avoid "orphan hairpins at paragraph starts" (R2#4). This was treating a rendering concern (visual wedge continuity) as a semantic constraint.

**This is the right call.** Consider:

1. **Musical correctness:** A 16-bar crescendo across 4 systems is a single musical gesture. Requiring `<` at the start of each system is redundant and error-prone — if the user forgets one, the hairpin silently breaks.

2. **IR integrity:** The IR should capture musical intent, not rendering constraints. A hairpin across a paragraph boundary is semantically one hairpin. The IR should represent it as such (consecutive measures with hairpin intents that carry forward unbroken).

3. **Rendering is capable:** The two-pass approach already handles per-measure hairpin intents. At system breaks, the renderer draws the wedge ending at the first system's right barline (with a small continuation hook) and picks it up at the next system's left barline. This is standard engraving practice.

4. **MusicXML compatibility:** MusicXML `<wedge type="continue">` handles system breaks natively — it operates on logical measure sequence, not visual layout.

**No new issues found.** The change is a clean reversal of one specific rule. No cascading effects on other parts of the design. The spec has already been updated with this change.

STATUS: APPROVED


### Post-Amendment Consolidated Changes

The final decision table from the Consolidated Changes section is amended:

| Decision | Original Resolution | Final Resolution |
|----------|-------------------|------------------|
| Paragraph boundaries | Reset carry-forward (R2#4) | **Carry-forward propagates across paragraphs** (Post-Approval Amendment) |

All other decisions remain unchanged.


## Post-Approval Amendment 2026-05-06: Allow Hairpins Inside Rhythmic Groups

### Status

Proposed

### Motivation

The approved proposal (R1#4) prohibits hairpin tokens (`<`, `>`, `!`) inside rhythmic groups `[N: ...]` via a `GroupToken`/`MeasureToken` grammar split. The original rationale was: "a hairpin inside a rhythmic group is semantically problematic — the group distributes duration among its items, but a hairpin has no duration. Where does the hairpin belong?"

This analysis was incorrect. Rhythmic groups are linear event streams: each item has a well-defined start position and duration at the sub-measure level. A hairpin token placed between items anchors to the same rhythmic position as the item that follows it — no different from how hairpins work at the measure level:

```
SD | [2: d < d ! d] |
```

- Group starts at measure position P.
- d₁: sub-start = P + 0/3, dur = 2/3
- `<`: sub-start = P + 2/3 (anchors to d₂'s position)
- d₂: sub-start = P + 2/3, dur = 2/3
- `!`: sub-start = P + 4/3 (anchors to d₃'s position)
- d₃: sub-start = P + 4/3, dur = 2/3

Hairpin span: P + 2/3 → P + 4/3. Unambiguous.

The prohibition is artificial. A user who wants a crescendo spanning specific notes within a tuplet has no workaround — placing `<` and `!` outside the group cannot target internal group positions.

### Change

1. **Grammar: remove `GroupToken`/`MeasureToken` split.** Add `CrescendoStart`, `DecrescendoStart`, `HairpinEnd` to the `GroupItem` alternatives (same set of tokens for both `MeasureContent` and `GroupContent`). A single token list serves both contexts.

2. **Normalization: extract hairpins from group content.** During normalization of a `GroupExpr` token, hairpin tokens encountered inside the group body are extracted to the enclosing measure's `hairpins` array, with positions adjusted to absolute measure coordinates (`groupStart + subPosition`). This mirrors the existing rule for routing groups `{...}` (proposal line 614).

3. **Parser: accept hairpins in group body.** The hand-written parser's group content parser (`parseGroupContent` / equivalent) accepts `<`, `>`, `!` as valid tokens within `[...]`.

### Before/After

**Before (parse error):**
```
SD | [2: d < d ! d] |
```

**After (valid):**
```
SD | [2: d < d ! d] |       % hairpin over middle note only
SD | [2: < d d d !] |       % hairpin over entire triplet
SD | < [2: d d d] ! |       % existing measure-level syntax still works
```

### Grammar Change

**Before (split token lists):**
```
MeasureToken ← ... | CrescendoStart | DecrescendoStart | HairpinEnd
GroupToken   ← ... (no hairpin tokens)

MeasureContent { MeasureToken* }    // measures, InlineBracedBlock
GroupContent   { GroupToken* }      // GroupExpr
```

**After (single token list):**
```
MeasureToken ← ... | CrescendoStart | DecrescendoStart | HairpinEnd

MeasureContent { MeasureToken* }    // measures, InlineBracedBlock, GroupExpr
```

`GroupExpr` and `GroupItem` accept the same `MeasureToken` set. The `GroupToken` alias is removed. Grammar complexity decreases.

### Normalization Change

The group normalization loop (in `normalize.ts`, `token.kind === "group"` handler) expands its item loop to recognize hairpin tokens:

```
for each item in group.items:
  if item is CrescendoStart | DecrescendoStart | HairpinEnd:
    compute absolute position = groupStart + currentStart
    emit hairpin token with adjusted position to measure-level hairpins array
    continue  // hairpin has no duration, does not advance currentStart
  // ... existing item processing ...
```

This is the same pattern used by routing groups. The `currentStart` variable in the group normalization loop already tracks each item's sub-position — no new infrastructure required.

### Impact Analysis

| Concern | Resolution |
|---------|------------|
| Hairpin has no duration | Zero-weight token; does not affect group duration distribution |
| Sub-position calculation | Already tracked by `currentStart` in group normalization loop |
| Extraction to measure hairpins | Identical pattern to routing groups `{...}` |
| Grammar complexity | **Reduced** — removes `GroupToken`/`MeasureToken` split |
| Nested groups | Already prohibited; no interaction |
| Existing measure-level hairpins | Unaffected — group extraction is additive |
| Tuplet beaming in renderer | Hairpin wedge overlays on top of beamed group — same as non-group hairpins |

### Supersession

This amendment supersedes:
- R1#4 in the Key Decisions table: "Rhythmic groups — Prohibited via GroupToken exclusion"
- Proposal line 568: "Explicitly prohibited: Hairpins are NOT allowed inside rhythmic groups"
- Proposal line 613: "NOT valid inside GroupExpr (rhythmic groups)"
- Proposal lines 662–672: "Grammar mechanism for GroupExpr exclusion"
- Tasks file, Task 1, line 10: "NOT in GroupItem, so they're excluded from GroupExpr"
- Tasks file, Task 1, line 13: "rejects < / > / ! inside rhythmic groups"

### Review Round 5 (Post-Approval Amendment Review)

**Date:** 2026-05-06

Review of the Post-Approval Amendment only — the scope is allowing hairpin tokens inside rhythmic groups.

---

#### 1. CRITICAL: Interaction with group modifier propagation

The proposal states that trailing modifiers on `GroupExpr` (e.g., `[2:ddd]:accent`) propagate to all items inside the group. How does `<`/`>`/`!` interact with this?

If a group has a trailing modifier and also contains hairpins:
```
SD | [2: d < d ! d]:accent |
```

Does `:accent` apply to the hairpin tokens? Hairpins are zero-weight articulation markers, not notes. Applying a note modifier to a hairpin is meaningless.

**Resolution needed:** Hairpin tokens inside a group are excluded from trailing modifier propagation. Only note-level tokens (BasicNoteExpr, CombinedHitExpr, SummonExpr) receive group trailing modifiers. This should be called out explicitly.

---

#### 2. MODERATE: Hairpin at group start/end boundaries

Consider:
```
SD | d < [2: d d d] ! |
```
vs.
```
SD | [2: < d d d !] d |
```

In the first case, the hairpin starts before the group and ends at the group's end position. In the second case, the hairpin starts at the group's start sub-position and extends past the group. Both are valid and the positions are consistent — no issue. But the spec should include an explicit example showing both patterns.

---

#### 3. MODERATE: Hairpin-only groups

What about a group containing ONLY hairpin tokens?
```
SD | [2: < !] |
```

This is a degenerate group with zero note items but non-zero span. The group has no rhythmic content but span=2. This should be a parse error — a group must contain at least one note-level item.

The existing "Empty group" error (`[2:]`) should be extended: if after filtering out hairpin tokens the item list is empty, it's an empty group. Alternatively, define it as "Group must contain at least one duration-consuming item."

---

#### 4. MINOR: Position ordering

Hairpin tokens inside groups follow the same sequential ordering as at measure level. A `<` must precede its `!` in the token stream. If `!` appears before `<` inside a group without a cross-measure carry-forward, it's an error — same as at measure level. This should be noted.

---

#### 5. MINOR: Grammar in the amendment text

The "Grammar Change" section in the amendment says `MeasureToken` serves `GroupExpr`. But strictly, `GroupExpr` uses `GroupContent` which uses `GroupItem*`, not `MeasureToken*`. The correct statement is: `GroupItem` alternatives are expanded to include `CrescendoStart | DecrescendoStart | HairpinEnd`, alongside the existing `CombinedHitExpr | SummonExpr | BasicNoteExpr`. Minor but important for implementation accuracy.

---

### Summary

The amendment is the right call — the prohibition was an over-engineering error from Round 1, and the user's intuition that groups are linear events is correct. The implementation is straightforward: the grammar simplifies, and the normalization code reuses the pattern already established for routing groups.

One critical issue (modifier propagation) and two moderate issues (boundary examples, empty-group detection) need resolution. The minor issues are clarification-only.

STATUS: CHANGES_REQUESTED

---

### Author Response (Round 5)

**Date:** 2026-05-06

#### Response to #1 — CRITICAL: Modifier propagation

Agreed. Hairpin tokens (`<`, `>`, `!`) are excluded from group trailing modifier propagation. The `applyModifiersToToken` function in normalize.ts already handles this naturally: it matches on token `kind === "basic" | "combined"` and passes through other token kinds unchanged. Since hairpin tokens will have their own `kind` (e.g., `"crescendo_start"`), they are implicitly excluded. The spec should note this explicitly:

> **Group trailing modifier propagation:** Trailing modifiers on `GroupExpr` (e.g., `[2:ddd]:accent`) propagate only to note-level items inside the group (BasicNoteExpr, CombinedHitExpr, SummonExpr). Hairpin tokens (`<`, `>`, `!`) are excluded from propagation — applying articulation to a hairpin marker is semantically meaningless.

#### Response to #2 — MODERATE: Boundary examples

Added to examples:

```
SD | d < [2: d d d] ! |       % hairpin starts before group, ends at group end
SD | [2: < d d d !] d |       % hairpin starts at group pos 0, ends after group
SD | [2: d < d ! d] d |       % hairpin entirely within group (middle note)
SD | < [2: d d d] d ! |       % hairpin starts at group start, extends past group
```

All four patterns are valid. The only constraint: `<` and `!` appear in source-text order (same as measure level).

#### Response to #3 — MODERATE: Hairpin-only groups

Agreed. Groups must contain at least one duration-consuming item. The validation rule:

> A group `[...]` or `[N: ...]` is a parse error if, after filtering out hairpin tokens (`<`, `>`, `!`), it contains zero note-level items. This extends the existing "Empty group" error. Hairpin-only groups (`[2: < !]`) are rejected — a hairpin has no rhythmic content to group.

#### Response to #4 — MINOR: Position ordering

Noted. Standard measure-level rules apply identically within groups: `<` before `!`, single active hairpin, no nesting. The group boundary is transparent to hairpin state — a `<` inside a group may be closed by a `!` outside it (and vice versa), as long as they appear in source-text order and positions are monotonically non-decreasing.

#### Response to #5 — MINOR: Grammar precision

Corrected. The precise grammar change is:

```
GroupItem {
  CombinedHitExpr |
  SummonExpr |
  BasicNoteExpr |
  CrescendoStart |
  DecrescendoStart |
  HairpinEnd
}
```

`MeasureToken` (if it exists as a grammar-level concept) now subsumes the old `GroupToken`. `GroupContent { GroupItem* }` uses the expanded `GroupItem`. No separate token lists needed.

---

### Review Round 6

**Date:** 2026-05-06

Final review of the Author Response to Round 5 and the amended proposal.

#### Verification of Fixes

**Fix #1 — Modifier propagation:** Correct. Hairpin tokens (kind `"crescendo_start"`, `"decrescendo_start"`, `"hairpin_end"`) are naturally excluded from `applyModifiersToToken` which only matches `"basic"` and `"combined"` kinds. The spec note clarifies intent. No code change needed beyond what the token kinds already guarantee. CORRECT.

**Fix #2 — Boundary examples:** The four patterns cover all combinations (hairpin starts before/at/inside group, ends at/inside/after group). Each is well-defined positionally. CORRECT.

**Fix #3 — Hairpin-only groups:** The validation rule "at least one duration-consuming item after filtering hairpin tokens" is clean and extendable. Prevents the `[2: < !]` degenerate case. CORRECT.

**Fix #4 — Position ordering:** Clarification that measure-level ordering rules apply identically within groups. No new rules needed. CORRECT.

**Fix #5 — Grammar precision:** The `GroupItem` expansion is the correct and minimal grammar change. No separate token lists. CORRECT.

#### Cross-checks

1. **Hairpin spanning group boundary (out→in):** `SD | d < [2: d d ! d] |` — `<` at measure position 1, `!` at group sub-position 4/3. Absolute: hairpin from 1 to groupStart + 4/3. Well-defined. The `<` token is outside the group (measure-level), the `!` is inside the group. The normalization loop processes the `<` first (measure-level), sets `activeStart`. Then processes the group: inside the group's item loop, `!` encounters `activeStart` (set from outside) → pushes `{ type, start: activeStart, end: groupStart + 4/3 }`. Correct.

2. **Hairpin spanning group boundary (in→out):** `SD | [2: < d d d] ! ! |` — `<` inside group at sub-position 0, `!` at measure position 3 (after group). Group starts at some position P. The `<` inside the group is extracted to measure-level hairpins: pushes hairpin start at position P. Then the `!` at position 3 closes it. The normalization pseudocode needs a small adjustment: group-level hairpin extraction should set `activeStart`/`activeType` on the measure-level state (not just push a completed hairpin), so subsequent measure-level tokens can close it.

3. **Cross-track within group:** Track A has `SD | [2: d < d ! d] |`, Track B has `SD | [2: d < d ! d] |` at the same position. Cross-track merge: same type (crescendo), same positions → collapse to single HairpinIntent. Works. If Track B had `>` instead, cross-track error. If Track B had different positions, cross-track error. Same rules as measure level.

#### Algorithm Clarification

The Author Response to #5 above and cross-check #2 reveal a subtlety: group-level hairpin extraction should interact with the measure-level `activeStart`/`activeType` state, not operate independently. Recommended algorithm amendment:

```
for each item in group.items:
  if item is CrescendoStart | DecrescendoStart:
    absolutePos = groupStart + currentStart
    if activeStart is not null and activeStart != absolutePos:
      hairpins.push({ type: activeType, start: activeStart, end: absolutePos })
    activeStart = absolutePos
    activeType = item.type
    // zero-length guard applies
  else if item is HairpinEnd:
    absolutePos = groupStart + currentStart
    if activeStart is null:
      error: "! without preceding < or >"
    if activeStart != absolutePos:
      hairpins.push({ type: activeType, start: activeStart, end: absolutePos })
    activeStart = null
    activeType = null
  else:
    // existing item processing (duration, tuplet, etc.)
    currentStart += item.duration
```

This integrates group-level hairpins with the existing measure-level state machine. Note: `currentStart` is NOT advanced for hairpin tokens (zero weight).

#### Final Assessment

All review concerns from Round 5 are resolved. The design is internally consistent, handles all boundary cases, and integrates cleanly with the existing carry-forward state machine. The grammar simplifies (one token list instead of two). No new issues found.

STATUS: APPROVED

---

### Post-Amendment 2026-05-06 Consolidated Changes

**Scope:** Allow hairpin tokens (`<`, `>`, `!`) inside rhythmic groups `[N: ...]`.

**Grammar:** `GroupItem` expanded to include `CrescendoStart`, `DecrescendoStart`, `HairpinEnd`. The `GroupToken`/`MeasureToken` split is removed. A single `MeasureToken` set serves all contexts (`MeasureContent`, `GroupContent`, `InlineBracedBlock`).

**Normalization:** Hairpin tokens inside groups participate in the same `activeStart`/`activeType` state machine as measure-level tokens. Absolute positions computed as `groupStart + currentStart`. Hairpins are extracted to the enclosing measure's `hairpins` array. Hairpin tokens do not advance `currentStart` (zero weight).

**Validation:**
- Group must contain at least one duration-consuming item (empty group after filtering hairpins = error).
- Trailing group modifiers do not propagate to hairpin tokens.
- Measure-level hairpin ordering and co-positioning rules apply identically within groups.
- A hairpin can span across group boundaries (outside→inside, inside→outside, or entirely inside).

**Superseded decisions:**

| Decision | Before | After |
|----------|--------|-------|
| Rhythmic groups | Prohibited via `GroupToken` exclusion (R1#4) | **Allowed**; hairpins extracted to measure-level during normalization |

### Review Round 7

**Date:** 2026-05-06

Critical re-review of the Post-Approval Amendment 2026-05-06 (Allow Hairpins Inside Rhythmic Groups) and the simulated Review Rounds 5 & 6. The reviewer cross-referenced the amendment's pseudocode and claims against the actual implementation surface in `src/dsl/normalize.ts`, `src/dsl/logic.ts`, and `src/dsl/ast.ts`.

---

#### 1. MODERATE: `calculateTokenWeightAsFraction` has no zero-weight case for hairpin tokens

The amendment's "Impact Analysis" table states:

> Hairpin has no duration — Zero-weight token; does not affect group duration distribution

This is correct in principle. However, the implementation path is underspecified. There are **three** call sites where `calculateTokenWeightAsFraction` is invoked over token collections that could now contain hairpin tokens:

- **`normalize.ts` line 311-313** — `totalWeight` computation for groups: `token.items.reduce((sum, item) => addFractions(sum, calculateTokenWeightAsFraction(item)), ...)`. If a group contains a hairpin token, `calculateTokenWeightAsFraction` receives it. The function (logic.ts lines 134-172) handles `kind === "group"`, `"combined"`, `"braced"`, then falls through to the basic weight formula which accesses `token.dots`, `token.stars`, `token.halves` — none of which exist on hairpin tokens. **Result: runtime crash or NaN weight, distorting `totalWeight` and all subsequent item duration calculations.**

- **`ast.ts` line 74-78** — measure-level rest-padding weight check: `tokens.reduce((sum, t) => addFractions(sum, calculateTokenWeightAsFraction(t)), ...)`. If a measure contains hairpin tokens at the measure level, the same fall-through crash occurs.

- **`logic.ts` line 149-153** — braced-block weight computation (same structural risk if hairpins appear in `{...}` before extraction).

The amendment's group normalization pseudocode (Round 6, lines 1716-1736) correctly uses `continue` to skip duration processing for hairpin tokens inside the per-item loop, but it does NOT address the `totalWeight` pre-computation (line 311-313), which runs BEFORE the per-item loop and iterates ALL items unconditionally.

**Resolution required:** The amendment or tasks file must explicitly call for adding `kind === "crescendo_start" | "decrescendo_start" | "hairpin_end"` cases to `calculateTokenWeightAsFraction` that return `{ numerator: 0, denominator: 1 }`. This is the cleanest fix: it propagates zero weight through all three call sites simultaneously, and is mathematically correct (hairpin tokens consume no rhythmic slots). Alternatively, the `totalWeight` computation must filter out hairpin tokens before reducing.

This was missed by both Round 5 and Round 6.

---

#### 2. MINOR: Pseudocode `absolutePos = groupStart + currentStart` is redundant in context of existing code

The amendment's normalization pseudocode computes absolute position as:

```
absolutePos = groupStart + currentStart
```

However, in the actual codebase (`normalize.ts` line 323), `currentStart` is already initialized to `start` (which IS the group's absolute measure position in musical time). The variable `currentStart` is ALREADY an absolute position — it is not a group-relative offset. So the correct expression is simply `absolutePos = currentStart`. The `groupStart +` prefix is misleading: it implies `currentStart` is a group-relative offset (0-based), which conflicts with how the existing code works.

This does not affect correctness (adding `groupStart` to a variable that already starts at `groupStart` would produce double the offset), but it could mislead an implementer who skims the pseudocode without checking the initialization of `currentStart`.

**Recommendation:** Clarify in the pseudocode that `currentStart` is already an absolute musical-time position (matching the existing convention in `normalize.ts`), and replace `absolutePos = groupStart + currentStart` with `absolutePos = currentStart`.

---

#### 3. MINOR: Cross-check #2 in Review Round 6 has an extraneous `!` token

Review Round 6 cross-check #2 (line 1708) uses the example:

```
SD | [2: < d d d] ! ! |
```

This has two `!` tokens after the group. The second `!` would encounter `activeStart = null` (the first `!` already cleared it) and produce a "! without preceding < or >" error. The analysis text that follows treats the example as if only one `!` exists. This is a review artifact — the design itself is correct for the single-`!` case. But it indicates the cross-check was not traced with full rigor.

---

#### 4. MINOR: Tasks file verification — consistency is correct but missing weight-function mention

The tasks file (`DRUMMARK_SPEC_tasks_crescendo_decrescendo.md`) correctly incorporates the amendment:
- Task 1 scope includes removing the `GroupToken`/`MeasureToken` split and expanding `GroupItem`. Acceptance criteria cover both positive parsing and hairpin-only group rejection.
- Task 4 scope includes the group-level extraction loop and integration with the `activeStart`/`activeType` state machine. The amendment review note adds boundary-spanning test cases correctly.

However, neither Task 1 nor Task 4 mentions the required update to `calculateTokenWeightAsFraction` in `logic.ts` (see finding #1 above). Task 4's scope should include: "Add `kind === "crescendo_start" | "decrescendo_start" | "hairpin_end"` case to `calculateTokenWeightAsFraction` returning zero weight."

---

#### Additional Verification (no issues found)

The following aspects of the amendment and simulated reviews were verified and found correct:

- **Modifier propagation exclusion (R5#1):** Correctly handled — `applyModifiersToToken` matches on `"basic"` and `"combined"` kinds only. Hairpin tokens (new kinds) are implicitly excluded. The spec note is accurate.
- **Hairpin-only group rejection (R5#3):** Correct — but note this is a semantic/post-parse validation, not a Lezer grammar-level check. The tasks file's acceptance criteria correctly says "rejects" without specifying parse vs. normalization time.
- **Boundary-spanning examples (R5#2):** The four patterns cover all out→in, in→out, and internal combinations. Correct.
- **GroupItem grammar expansion (R5#5):** The `GroupItem` expansion approach is the correct minimal grammar change. Correct.
- **Cross-measure carry-forward into/out of groups:** Traced both directions; the state machine integration works correctly.
- **Cross-track within groups:** Normalized HairpinIntents operate on absolute positions; cross-track rules apply identically regardless of group origin. Correct.
- **No floating-point or rational drift concern specific to this amendment:** The Fraction arithmetic uses numerator/denominator integers; denominators remain small for practical drum notation; existing codebase already handles group fraction math.
- **No interaction issue with the earlier 2026-05-04 paragraph-boundary amendment:** The paragraph carry-forward behavior (propagate across paragraphs) is orthogonal to group-internal hairpin handling; both compose correctly.

---

### Summary

The core design of the amendment is sound: rhythmic groups are indeed linear event streams, and hairpin tokens fit naturally within them using the same normalization state machine. The simulated Review Rounds 5 and 6 correctly identified the critical interaction with group modifier propagation (R5#1) and the edge case of hairpin-only groups (R5#3).

However, the review rounds missed one concrete implementation gap: **`calculateTokenWeightAsFraction` must be updated to return zero weight for hairpin tokens**. Without this, the `totalWeight` pre-computation in the group normalization loop will crash or produce incorrect weights when a group contains hairpin tokens. This is a moderate oversight — the fix is straightforward (add three `kind` cases returning `{ numerator: 0, denominator: 1 }`) but the specification does not call it out, and neither the proposal nor the tasks file documents it.

Additionally, the pseudocode expression `groupStart + currentStart` is a minor misrepresentation of how the existing code works (where `currentStart` already starts at the absolute position).

STATUS: CHANGES_REQUESTED

---

### Author Response (Round 7)

**Date:** 2026-05-06

#### Response to #1 — MODERATE: `calculateTokenWeightAsFraction` crash risk

Confirmed. Three call sites are affected:

- `normalize.ts` line 311-313 — `totalWeight` pre-computation iterates ALL group items. A hairpin token would fall through to the basic-weight formula and access nonexistent `.dots`/`.stars`/`.halves` fields.
- `ast.ts` line 74-78 — measure-level rest-padding check.
- `logic.ts` line 149-153 — braced-block weight for routing groups `{...}`.

The measure-level case (`| < d d d ! |`) also triggers this bug: the rest-padding loop iterates ALL measure tokens, including hairpin tokens.

**Fix:** Add explicit cases to `calculateTokenWeightAsFraction` in `logic.ts`:

```typescript
case "crescendo_start":
case "decrescendo_start":
case "hairpin_end":
  return { numerator: 0, denominator: 1 };
```

This is mathematically correct (zero weight = zero rhythmic consumption), propagates through all three call sites, and is forward-compatible with any future zero-weight tokens.

#### Response to #2 — MINOR: Pseudocode `groupStart + currentStart`

Correct. In the existing code (`normalize.ts` line 323), `currentStart` is initialized to `start` (the group's absolute measure position), not to 0. The correct expression is:

```
absolutePos = currentStart  // currentStart is already absolute in musical time
```

The pseudocode is updated to reflect this.

#### Response to #3 — MINOR: Cross-check #2 extraneous `!`

Corrected. The example is changed to `SD | [2: < d d d] ! d |` — single `!` after the group, followed by a note for visual clarity.

#### Response to #4 — MINOR: Tasks file missing weight-function update

Added to Task 4 scope in the tasks file.

#### Additional: User-provided boundary-spanning example

The case `| d d [2:d < dd] d d ! |` demonstrates hairpin starting inside a group and ending outside it:

```
Group [2: d < d d] at measure position 2, span=2
  d₁: pos 2+0, dur 2/3
  < : pos 2+2/3 → sets activeStart = 2+2/3, activeType = "crescendo"
  d₂: pos 2+2/3, dur 2/3
  d₃: pos 2+4/3, dur 2/3
Group ends at pos 4
  d:  pos 4
  d:  pos 5
  ! : pos 6 → pushes {type:"crescendo", start: 2+2/3, end: 6}
```

Hairpin span: 2+2/3 (inside group) → 6 (outside group). The state machine handles this correctly because `activeStart`/`activeType` set inside the group are shared with the measure-level loop. No special-case code needed. This example is added to the amendment's boundary-spanning examples.

---

### Review Round 8

**Date:** 2026-05-06

Final review of Author Response Round 7.

#### Verification of Fixes

**Fix #1 (`calculateTokenWeightAsFraction`):** The three `case` clauses returning `{ numerator: 0, denominator: 1 }` are added at the top of the `switch` statement in `calculateTokenWeightAsFraction`, before the `"group"` / `"combined"` / `"braced"` cases and the basic-weight fallthrough. This is the correct placement: zero-weight tokens short-circuit early, duration-bearing tokens continue to weight computation. All three call sites (`normalize.ts:311`, `ast.ts:74`, `logic.ts:149`) receive correct weight without modification. CORRECT.

Cross-verification: the measure-level case `| < d d d ! |` also works — the rest-padding loop at `ast.ts:74` sums weights including two zero-weight hairpin tokens and three note tokens, producing the correct total weight. CORRECT.

**Fix #2 (pseudocode):** `absolutePos = currentStart` with convention comment is accurate. No implementation impact — the variable name is already absolute in the real code. CORRECT.

**Fix #3 (extraneous `!`):** Cleaned up. CORRECT.

**Fix #4 (tasks file):** `calculateTokenWeightAsFraction` update added to Task 4 scope. Since this is a single-function change (add three `case` clauses), it is correctly scoped to Task 4 (normalization) rather than requiring a new task. CORRECT.

**User example `| d d [2:d < dd] d d ! |`:** Traced step-by-step. Positions are exact. Group `[2:d < dd]` tokenizes as span=2, items=[d, <, d, d] — totalWeight=3 (three duration-consuming items), each d gets 2/3. Hairpin from 2+2/3 to 6. Works without any special-case handling. CORRECT.

#### Final Assessment

All four issues from Review Round 7 are resolved. The `calculateTokenWeightAsFraction` fix is the only implementation change beyond the grammar and normalization changes already specified — it is minimal (three `case` clauses) and applies cleanly. The user-provided boundary-spanning example is added to the amendment's examples and verified correct.

No new issues found. The amendment is implementation-ready.

STATUS: APPROVED
