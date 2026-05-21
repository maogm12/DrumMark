# DRUMMARK_SPEC_proposal_dynamic_marks.md

## Addendum v1.6: Explicit Dynamic Marks

### Motivation

DrumMark supports crescendo and decrescendo hairpins with `<`, `>`, and `!`, but it has no way to write explicit dynamic text such as `p`, `mp`, `ff`, or `fff`.

Bare dynamic words cannot be used because `p` may be a playable note token. Dynamic marks therefore need an explicit marker that distinguishes expression text from rhythmic note glyphs while remaining short enough for frequent inline use.

### Syntax

A dynamic mark is written with `@` followed immediately by a supported dynamic level:

```drummark
@ppp @pp @p @mp @mf @f @ff @fff
```

Examples:

```drummark
SD | @p d - d - @mp d - d - |
SD | @p d d < d d @f |
SD | @ff d d > d d @mp |
```

Dynamic marks are zero-duration measure expressions. They are legal in ordinary measure content, inline routed blocks, and rhythmic groups `[ ... ]` / `[N: ... ]`.

### Supported Levels

The initial supported dynamic levels are:

| Syntax | Canonical value |
|--------|-----------------|
| `@ppp` | `ppp` |
| `@pp` | `pp` |
| `@p` | `p` |
| `@mp` | `mp` |
| `@mf` | `mf` |
| `@f` | `f` |
| `@ff` | `ff` |
| `@fff` | `fff` |

No other `@<letters>` dynamic spelling is accepted by this proposal. Unsupported expression forms such as `@sfz`, `@fp`, or `@cresc.` remain future work unless separately proposed.

### Disambiguation

The `@` prefix makes dynamic marks unambiguous with playable note tokens:

```drummark
SD | p @p p @ff |
```

In that example, bare `p` is parsed according to the ordinary note-token rules, while `@p` and `@ff` are dynamic marks.

Dynamic mark tokens join the existing closed `@...` directive family. The grammar still has no generic `@Identifier` category. Accepted `@...` forms are:

- routed block directives such as `@SD { ... }`
- navigation directives such as `@segno`, `@coda`, `@fine`, `@dc`, `@ds`, and `@to-coda`
- dynamic marks defined by this addendum

Any other `@...` form remains a parse error unless another approved addendum defines it.

### Timing Semantics

Dynamic marks consume no rhythmic duration and anchor at the current rhythmic position.

Rules:

- A dynamic at the beginning of a measure anchors to measure fraction `0/1`.
- A dynamic after one or more duration-consuming tokens anchors to the current accumulated rhythmic position.
- A dynamic at the end of a measure anchors to measure fraction `1/1`.
- Dynamic marks inside rhythmic groups participate in the same position scan as hairpin tokens. They consume no group-local duration.
- A group is invalid if, after filtering out zero-duration tokens such as hairpins and dynamics, it contains no duration-consuming item.

Examples:

```drummark
SD | @p d d @f d d |
```

With four equal slots, `@p` anchors at `0/1` and `@f` anchors at `1/2`.

```drummark
SD | [4: @p d d @f d d] |
```

The two dynamics are legal inside the group and do not change the group's rhythmic weight.

### Cross-Track Conflict Rules

Dynamics are score-level expression marks, not track-local note modifiers.

Within a logical measure position:

- Same dynamic declarations across multiple tracks collapse to one logical dynamic mark.
- Different dynamic declarations at the same position are a hard normalization error.
- A dynamic declaration may coexist with notes, rests, sticking tokens, hairpin starts, and hairpin ends at the same position.

Example:

```drummark
HH | @p x x x x |
SD | @p d - d - |
```

This normalizes to one `p` dynamic at measure start.

Invalid:

```drummark
HH | @p x x x x |
SD | @f d - d - |
```

The same measure position declares conflicting dynamic levels.

### Hairpin Relationship

Dynamic marks and hairpins are independent expression objects that may be used together:

```drummark
SD | @p d d < d d @f |
SD | @ff d d > d d @mp |
```

This addendum does not infer hairpins from dynamic changes, and it does not infer dynamic changes from hairpins. `@p ... @f` without `<` renders as two dynamic marks without a crescendo wedge.

### AST and Normalization

The parser adds a dynamic measure expression with canonical level:

```typescript
type MeasureExpr =
  | ...
  | { type: "dynamic"; level: DynamicLevel };

type DynamicLevel =
  | "ppp"
  | "pp"
  | "p"
  | "mp"
  | "mf"
  | "f"
  | "ff"
  | "fff";
```

Normalization collects dynamic marks into `NormalizedMeasure.dynamics`:

```typescript
type DynamicIntent = {
  level: DynamicLevel;
  at: Fraction;
};
```

`DynamicIntent.at` is measure-local musical time. It uses the same fraction convention as hairpin start and end positions.

### RenderScore Contract

`RenderScore` extends each render measure with explicit dynamic data:

```typescript
type RenderMeasure = {
  ...
  dynamics: DynamicMark[];
};

type DynamicMark = {
  level: DynamicLevel;
  at: Fraction;
};
```

Dynamic marks are part of the closed render contract. Layout must not recover dynamics by rescanning source text, reading parser-only AST nodes, or inspecting navigation labels.

### LayoutScene Contract

The layout engine owns dynamic placement and emits semantic scene items or composites for dynamic marks.

Recommended scene representation:

- role: `dynamic`
- text: canonical dynamic level (`p`, `mp`, `ff`, etc.)
- font: music text or engraving-appropriate italic text chosen by `drummark-layout`
- anchor: owning measure plus measure-local fraction

Adapters only paint the resolved text or glyph geometry. They must not perform dynamic collision resolution or vertical lane assignment.

### Lower-Staff Vertical Priority

All dynamic marks render below the staff.

For lower-staff elements, vertical priority from top to bottom is:

1. visible note modifiers and articulations that occupy the lower side, including accent-like marks when rendered below
2. hairpins
3. dynamic marks

This means dynamic marks are placed farther from the staff than hairpins. Hairpins are placed below lower-side articulations/modifiers, but above dynamic text.

When horizontal ranges overlap, the layout engine must preserve this relative order while adding enough vertical clearance to avoid collisions. The ordering is semantic; it is not adapter-side SVG nudging.

Example:

```drummark
SD | @p d:accent d < d d @f |
```

The lower-side stack at overlapping positions is:

```text
staff
modifier/articulation lane
hairpin lane
dynamic lane
```

### MusicXML Export

Dynamic marks export as MusicXML direction dynamics:

```xml
<direction placement="below">
  <direction-type>
    <dynamics>
      <p/>
    </dynamics>
  </direction-type>
</direction>
```

The element name inside `<dynamics>` is the canonical level. For example, `@ff` exports as `<ff/>`.

The export position follows the same rhythmic offset as the normalized `DynamicIntent.at`.

### Non-Goals

This addendum does not define:

- playback velocity mapping for dynamic levels
- dynamic interpolation across hairpins
- additional dynamic/expression text such as `sfz`, `fp`, `cresc.`, or `dim.`
- per-track independent dynamics at the same rhythmic position
- user-facing settings for dynamic vertical offset

### Examples

Input:

```drummark
title Dynamic Test
time 4/4
divisions 8

HH | @p x x x x @mf x x x x |
SD | - - d - - - d - |

HH | @ff x x > x x @mp x x x x |
SD | d:accent - d - d - d - |
```

Canonical normalized excerpt:

```json
{
  "measures": [
    {
      "index": 0,
      "dynamics": [
        { "level": "p", "at": { "num": 0, "den": 1 } },
        { "level": "mf", "at": { "num": 1, "den": 2 } }
      ]
    },
    {
      "index": 1,
      "dynamics": [
        { "level": "ff", "at": { "num": 0, "den": 1 } },
        { "level": "mp", "at": { "num": 1, "den": 2 } }
      ],
      "hairpins": [
        {
          "type": "decrescendo",
          "start": { "num": 1, "den": 4 },
          "end": { "num": 1, "den": 2 }
        }
      ]
    }
  ]
}

```

### Acceptance Criteria

- `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, and `@fff` parse as zero-duration dynamic measure expressions.
- Bare `p` remains governed by ordinary note-token parsing.
- Unknown `@...` forms remain parse errors unless already supported by routed block or navigation syntax.
- Dynamic marks normalize to measure-local fractions without changing rhythmic duration.
- Same-position same-level declarations across tracks collapse to one dynamic mark.
- Same-position different-level declarations across tracks produce a hard error.
- `RenderScore` carries dynamic marks explicitly.
- `drummark-layout` places dynamic marks below the staff with lower-side priority: modifiers/articulations, then hairpins, then dynamics.
- SVG adapters render the resolved scene geometry without adapter-side dynamic placement logic.
- MusicXML export emits `<direction placement="below"><direction-type><dynamics>...</dynamics></direction-type></direction>`.

### Review Round 1

The proposal is directionally useful, but it is not yet implementable without guessing in several places. The current text would let different implementers produce incompatible parsers, IR, layout, and MusicXML output.

1. Lexer/token ordering is underspecified for the new `@` family. The existing lexer has explicit `@...` tokens for navigation and routed track prefixes, with route tokens such as `@C`, `@SD`, and `@BD2`. The proposal says dynamics "join the existing closed `@...` directive family", but it does not specify longest-match and conflict behavior for dynamic prefixes. This matters for `@p`, `@pp`, `@ppp`, `@f`, `@ff`, and `@fff`: the lexer must not tokenize `@fff` as `@f` plus junk, and unknown forms such as `@ffff` must not silently become `@fff` plus a stray `f`. The proposal needs a precise lexical rule: dynamic tokens are recognized only when the entire `@` word matches the supported set, and longer dynamic tokens win over shorter ones. It also needs tests for adjacent characters and whitespace, e.g. `@ffx`, `@fff`, `@f @ff`, and `@C` still routing to a track.

2. The proposal conflicts with the current spec wording for navigation names. It lists navigation directives such as `@dc` and `@ds`, which matches the later navigation addenda, but the base navigation table still contains older names like `@da-capo` and `@dal-segno`. This proposal should explicitly say it depends on the later navigation addendum that replaces those names, rather than restating a partial directive family. Otherwise the dynamic addendum appears to redefine the closed `@...` set and may accidentally re-open or re-close older forms.

3. Parser placement inside routed blocks is ambiguous. The syntax section says dynamics are legal in ordinary measure content, inline routed blocks, and rhythmic groups. Since dynamics are score-level expression marks, `@SD { @p d d }` must normalize the `@p` at the routed block's measure-local position, not as track-local state tied to `SD`. The current routed-block machinery also uses `@TRACK { ... }`; the proposal needs examples and rules for `| @SD { @p d d } @BD { @p b b } |` and `| @SD { @p d d } @BD { @f b b } |`. Without that, cross-track collapse/error semantics are underspecified for routed content.

4. Position scanning inside groups is not rigorous enough. "Same position scan as hairpin tokens" is a useful hint, but the existing normalization computes token weights and separately scans hairpin tokens. The proposal must define the input/output contract for scanning dynamics through nested groups, combined hits, inline braced blocks, and routed braced blocks. In particular, say whether a dynamic inside `[4: ...]` anchors to the scaled group-local fraction or to an unscaled raw token count, and whether a dynamic inside a combined hit like `{ @p d + b }` is legal. If combined-hit dynamics are illegal, say so; if legal, define the anchor.

5. The end-of-measure anchor rule needs a collision rule with navigation and barlines. `@fine`, `@dc`, `@ds`, and similar end-side navigation are also position-sensitive and may sit at the end of the measure. The proposal allows `@f` at end and says it anchors at `1/1`, but does not define whether `SD | d d d d @f @fine |` is legal, whether order matters, or how layout stacks end-side navigation text above the staff with a below-staff dynamic at the same logical edge. Add explicit examples for dynamics adjacent to `@segno`, `@coda`, `@to-coda`, and end-side jumps.

6. Cross-track conflict rules are too narrow. They define same-position same-level collapse and different-level hard errors, but not duplicate same-track dynamics at the same position, same-level declarations emitted from a line plus an inline routed block, or conflicts across repeated/expanded measures. The proposal should state whether duplicates within one logical measure are deduplicated or rejected, and should clarify that comparison is by logical measure index and measure-local fraction before repeat playback expansion.

7. The IR/schema changes are incomplete and mix TypeScript-shaped pseudocode with a Rust-owned pipeline. Existing AST and normalized/render score structures are Rust-first, then exposed to TS/WASM. The proposal must name the Rust structs/enums to add or extend, the serialized JSON field names, and the TS boundary updates. A `NormalizedMeasure.dynamics` field also needs ordering guarantees: sort by `at`, then stable level, or preserve source order after conflict collapse. Layout and tests will otherwise depend on accidental vector order.

8. RenderScore versioning is missing. Adding `RenderMeasure.dynamics` changes the closed render contract. The proposal should require a `RENDER_SCORE_VERSION` bump and define backward compatibility expectations for consumers/tests that load older snapshots without `dynamics`.

9. Layout priority is stated as an ordering, not an algorithm. The proposal says modifiers/articulations, then hairpins, then dynamic marks, but lower-side articulations are not currently a generic lane system, and accents may render above or below depending on stem direction. The text must define the concrete collision contract: dynamic bounding boxes clear hairpin top/bottom line bounds by N points, hairpins clear lower-side modifiers by N points, and the skyline used for hairpins must include noteheads/stems/modifiers before dynamics are placed. Also define whether dynamics affect subsequent lower skyline elements or are just final decorations.

10. The dynamic font/glyph decision is under-specified. "music text or engraving-appropriate italic text" leaves adapters and layout free to diverge. Music dynamics are not ordinary italic letters in high-quality engraving; if Bravura/SMuFL glyphs are intended, name the glyph strategy or codepoints/roles. If text runs are intended, specify font family, style, and accessibility label. The scene contract should use a concrete primitive expectation, not a recommendation.

11. MusicXML export needs offset and backup/forward semantics. The proposal says the export position follows `DynamicIntent.at`, but MusicXML directions are emitted in sequence relative to current time. It must say whether the exporter inserts `<backup>`/`<forward>` to reach the fraction, whether the direction appears before notes at the same offset, and whether a measure-end `@f` is exported after all notes or at offset equal to measure duration. It should also specify staff/voice behavior for a score-level dynamic in a drum part and include expected XML for a mid-measure dynamic.

12. Acceptance criteria omit negative and conflict cases that are central to this feature. Add explicit criteria/tests for unknown dynamic-like forms (`@sfz`, `@fp`, `@ffff`, `@m`, `@pf`), route preservation (`@SD`, `@C`, `@BD2`), navigation preservation (`@fine`, `@dc-al-coda`), group legality with only zero-duration items, duplicate same-level collapse, duplicate same-track behavior, and conflicting routed-block declarations.

13. Taskability is not yet reviewable. This proposal needs a companion tasks file, and the eventual tasks must not bundle lexer/parser/normalizer/layout/export into one large "add dynamics" task. The independently testable split should include at least: lexical/parser recognition with negative tests; AST-to-normalized scanning and conflict collapse using hand-built measure tokens; RenderScore/TS/WASM schema propagation and versioning; layout scene emission with mocked RenderMeasures; MusicXML offset/export behavior; and final spec consolidation. The proposal itself should be tightened enough that those task contracts have no hidden dependencies.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. Round 2 found remaining boundary and ownership ambiguities. The v1.8 revision below is intended to supersede v1.7 where they differ.

Key decisions:

- Dynamic token recognition uses an explicit directive delimiter set and an invalid-`@` catch rule.
- Adjacent routed blocks are simultaneous at the same outer position; they do not advance the surrounding rhythmic cursor independently.
- Dynamic scanning is recursive through groups and routed blocks; nested groups are supported rather than banned.
- `drummark-layout` owns its own public `DynamicLevel` / `DynamicMark` render contract, serialized as lowercase canonical strings.
- Dynamics are horizontally centered on their anchor X with deterministic padded text bounds.
- Dynamics never push hairpins in the same layout pass; the lower-side pass order is modifiers/articulations, then hairpins, then dynamics.
- MusicXML dynamics use `<offset>` directions, matching hairpin/export direction style, rather than introducing a cursor-forward/back interleaving model.

## Addendum v1.8: Explicit Dynamic Marks

### Syntax

Dynamic marks use the short `@<level>` spelling:

```drummark
@ppp @pp @p @mp @mf @f @ff @fff
```

Examples:

```drummark
SD | @p d - d - @mp d - d - |
SD | @p d d < d d @f |
SD | @ff d d > d d @mp |
```

Bare `p` remains an ordinary playable token according to existing note-token rules.

### Directive Token Boundaries

The lexer/parser must treat dynamic marks as exact `@...` directives with an explicit delimiter boundary.

A dynamic directive is accepted only when the supported spelling is followed by one of:

- end of input
- horizontal or vertical whitespace
- comment start
- a measure or grouping delimiter: `|`, `:|`, `|:`, `||`, `|]`, `[`, `]`, `{`, `}`, `(`
- a rhythmic separator/operator already legal in the containing grammar, such as `+`, when the parser is about to reject the construct semantically if dynamics are not legal there

The implementation must also reject unsupported `@` words before accepting shorter dynamic prefixes. Conforming behavior:

| Input | Result |
|-------|--------|
| `@f` | dynamic `f` |
| `@f }` | dynamic `f`, then `}` |
| `@f}` | dynamic `f`, then `}` |
| `@f|` | dynamic `f`, then barline |
| `@ffx` | parse error for unsupported `@...` form |
| `@ffff` | parse error for unsupported `@...` form |
| `@f:accent` | parse error; dynamics do not accept note suffix modifiers |

This may be implemented with an invalid-`@` catch token, parser-side source-span validation, or another deterministic scanner strategy. The observable behavior above is normative.

### Closed `@...` Family

Accepted `@...` forms are:

- current routed block directives, e.g. `@SD { ... }`
- current navigation directives, e.g. `@segno`, `@coda`, `@fine`, `@dc`, `@ds`, `@dc-al-coda`, `@to-coda`
- dynamic marks defined by this addendum

This proposal depends on the later navigation addendum that replaces removed long spellings such as `@da-capo` and `@dal-segno`. It does not restore those removed forms.

There is no generic `@Identifier`.

### Timing Semantics

Dynamic marks are zero-duration measure expressions anchored to exact measure-local musical fractions.

- At measure start, a dynamic anchors to `0/1`.
- After duration-consuming content, it anchors to the current accumulated position.
- After all duration-consuming content, it anchors to `1/1`.
- It may share a position with notes, rests, sticking, hairpins, barline-edge navigation, and navigation marks.

### Routed Blocks Are Simultaneous

Adjacent routed blocks at the same surrounding position are simultaneous expression branches, not sequential cursor advances.

For normalization, the surrounding stream cursor advances by the maximum rendered duration of the routed block cluster at that outer position. Dynamic marks inside each routed block anchor relative to the same outer start position plus that block's internal scaled position.

Example:

```drummark
| @SD { @p d d } @BD { @p b b } |
```

Both `@p` marks anchor at the same measure-local fraction and deduplicate.

Invalid:

```drummark
| @SD { @p d d } @BD { @f b b } |
```

The two routed blocks declare conflicting dynamics at the same logical position.

If a routed block appears after ordinary duration-consuming content, its outer start is the current surrounding cursor:

```drummark
| d d @SD { @mp d d } @BD { b b } |
```

Here `@mp` anchors after the first two ordinary tokens, not at measure start.

### Groups and Recursive Scaling

Dynamic marks are scanned recursively through rhythmic groups and routed blocks.

For any nested container, the dynamic's absolute measure-local anchor is:

```text
container_absolute_start
+ scaled_position_inside_container(dynamic_local_position)
```

Nested groups compose this formula recursively. A dynamic inside a nested group first resolves to the child group's rendered span, then that child result is scaled into the parent group, continuing outward until measure-local time is reached.

Example:

```drummark
SD | [4: d [2: @p d d] d] |
```

`@p` anchors at the nested group's rendered start after both the child and parent group scaling are applied.

Dynamic marks are not legal inside combined-hit operands:

```drummark
SD | d+@p |
```

This is invalid because combined-hit operands are note/rest glyph expressions, not score-level expression containers.

A group is invalid if, after filtering out zero-duration tokens such as hairpins and dynamics, it contains no duration-consuming item.

### Duplicate and Conflict Rules

Dynamic comparison is by logical measure index and exact measure-local fraction before repeat playback expansion.

At one logical position:

- same-level declarations deduplicate to one dynamic mark
- different-level declarations are a hard normalization error
- deduplication is global across track lines, routed blocks, rhythmic groups, and repeated same-track declarations

Normalized dynamic arrays are sorted by `at` ascending. Duplicate same-level declarations retain the first source location for diagnostics and source mapping.

### Rust, TypeScript, and Layout Types

The Rust parser/core model adds:

```rust
pub enum MeasureExpr {
    // existing variants...
    Dynamic(DynamicLevel),
}

pub enum DynamicLevel {
    Ppp,
    Pp,
    P,
    Mp,
    Mf,
    F,
    Ff,
    Fff,
}

pub struct DynamicIntent {
    pub level: DynamicLevel,
    pub at: Fraction,
}
```

`NormalizedMeasure` gains:

```rust
pub dynamics: Vec<DynamicIntent>
```

The TypeScript boundary mirrors the canonical serialized form:

```typescript
export type DynamicLevel = "ppp" | "pp" | "p" | "mp" | "mf" | "f" | "ff" | "fff";

export type DynamicIntent = {
  level: DynamicLevel;
  at: Fraction;
};
```

`drummark-layout` owns its own public render-facing types rather than importing parser AST types:

```rust
pub enum DynamicLevel {
    Ppp,
    Pp,
    P,
    Mp,
    Mf,
    F,
    Ff,
    Fff,
}

pub struct DynamicMark {
    pub level: DynamicLevel,
    pub at: Fraction,
}
```

Core maps normalized dynamic levels into layout dynamic levels when constructing `RenderScore`.

Serialized JSON and WASM object shapes use lowercase canonical strings:

```json
{ "level": "ff", "at": { "numerator": 1, "denominator": 2 } }
```

`NormalizedMeasure.dynamics` and `RenderMeasure.dynamics` are always present arrays. Measures without dynamics emit `dynamics: []`.

Adding render-measure dynamics requires a `RENDER_SCORE_VERSION` bump. Fixture consumers must update fixtures or migrate missing `dynamics` fields to empty arrays at fixture-load boundaries.

### Layout Placement

Dynamics render below the staff as semantic `dynamic` scene items. Initial rendering uses `ScenePrimitive::TextRun` with italic dynamic text; a later approved proposal may replace this with dedicated SMuFL dynamic glyph roles.

Horizontal placement:

- the dynamic text box is centered on the resolved anchor X for its measure-local fraction
- at measure start/end, the centered box may be shifted inward only enough to avoid crossing the measure's visible left/right boundary plus `DYNAMIC_EDGE_PADDING_PT`
- the shifted visual X does not change the musical anchor stored in metadata

Bounds reservation:

- layout uses canonical text metrics owned by `drummark-layout`
- the reserved horizontal interval is the measured text bounds plus `DYNAMIC_TEXT_PADDING_X_PT` on both sides
- the reserved vertical interval is the measured text bounds plus `DYNAMIC_TEXT_PADDING_Y_PT` on both sides

Lower-staff vertical priority from top to bottom is:

1. lower-side note modifiers/articulations
2. hairpins
3. dynamics

The layout pass order is fixed:

1. seed lower skyline with noteheads, stems, beams, rests, and lower-side modifiers/articulations
2. place hairpins against that skyline and reserve hairpin bounds
3. place dynamics against the skyline after hairpins and reserve dynamic text bounds

Dynamics do not push hairpins in the same layout pass. Dynamic skyline reservation only affects later dynamic marks or future lower-side expression classes that run after dynamics. This preserves the requested priority that hairpins remain above dynamics.

The minimum lane clearance is `LOWER_EXPRESSION_GAP_PT`, initially 4pt unless the layout metrics module defines another canonical value.

### MusicXML Export

Dynamic marks export as below-staff MusicXML direction dynamics:

```xml
<direction placement="below">
  <direction-type>
    <dynamics>
      <f/>
    </dynamics>
  </direction-type>
  <offset>...</offset>
</direction>
```

The exporter uses `<offset>` relative to the measure start, matching the direction-offset strategy used for hairpins and other directions. It does not introduce a new forward/backup cursor model for dynamics.

Rules:

- offset value is computed from `DynamicIntent.at` using the measure's MusicXML divisions
- a start-of-measure dynamic may omit `<offset>` or emit zero offset consistently with existing direction export style
- a mid-measure dynamic emits a positive `<offset>`
- an end-of-measure dynamic emits an offset equal to the measure duration and remains attached to the current measure
- score-level dynamics are emitted once per percussion part, not once per track or voice
- because offset directions are independent of voice cursor order, the same rule works for one-voice and two-voice drum measures

Mid-measure example shape:

```xml
<direction placement="below">
  <direction-type>
    <dynamics>
      <f/>
    </dynamics>
  </direction-type>
  <offset>...</offset>
</direction>
```

The exporter may place the direction element before note elements in the measure as long as its `<offset>` encodes the correct measure-local time.

### Non-Goals

This addendum does not define:

- playback velocity mapping
- dynamic interpolation across hairpins
- additional levels or effects such as `@sfz`, `@fp`, `@cresc.`, or `@dim.`
- independent per-track dynamics at the same position
- user settings for dynamic vertical offset
- SMuFL dynamic glyph roles

### Acceptance Criteria

- Supported spellings parse: `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, `@fff`.
- Bare `p` remains a note token according to existing note-token rules.
- Whole-token directive behavior is enforced: `@fff` parses, `@ffff` and `@ffx` fail, `@f}` and `@f|` parse as dynamic plus delimiter, and `@f:accent` fails.
- Unknown dynamic-like forms fail: `@sfz`, `@fp`, `@m`, `@pf`.
- Existing routed tokens still parse as routes: `@SD`, `@C`, `@BD2`.
- Existing navigation tokens still parse as navigation: `@fine`, `@dc`, `@dc-al-coda`.
- Adjacent routed blocks are simultaneous for dynamic conflict/collapse; conflicting levels at the same routed-block outer position fail.
- Dynamics after ordinary duration-consuming tokens inside routed blocks anchor at the routed block's outer start plus internal scaled position.
- Dynamic marks inside nested groups anchor after recursive scaling.
- Groups containing only zero-duration hairpins/dynamics are invalid.
- Dynamic marks inside combined-hit operands are invalid.
- Same-position same-level declarations deduplicate globally within the logical measure.
- Same-position different-level declarations fail before repeat playback expansion.
- Rust core, TypeScript boundary, WASM objects, and `drummark-layout` render types expose explicit dynamic arrays using lowercase canonical serialized levels.
- `RENDER_SCORE_VERSION` is bumped or render fixtures are migrated at load boundaries.
- Layout centers dynamic text on anchor X, shifts inward only at measure edges, reserves padded canonical text bounds, and places lower lanes in the order modifiers/articulations, hairpins, dynamics.
- Dynamics do not push hairpins in the same layout pass.
- MusicXML dynamics export once per part with `<direction placement="below"><direction-type><dynamics>...</dynamics></direction-type><offset>...</offset></direction>` at the normalized measure-local time, including two-voice measures.

### Author Response

Accepted. The v1.6 proposal established the intended user syntax and visual order, but left too many implementation contracts implicit. The revision below keeps the user-facing syntax `@p`, `@mp`, `@ff`, etc., and tightens the lexical, normalization, render, layout, and export contracts.

The revised design makes these changes:

- Dynamic tokenization uses exact whole-token matching with longest dynamic spellings ordered before shorter spellings.
- Unknown dynamic-like forms are parse errors, not partial dynamic tokens.
- Routed-block and grouped dynamics are explicitly score-level marks anchored to the routed/group-local musical position after duration scaling.
- Duplicate same-position same-level dynamics deduplicate regardless of whether they came from a track line, routed block, or group. Different same-position levels are hard errors.
- The contract is Rust-first: parser AST, normalization, RenderScore, layout, TS/WASM boundary, and JSON field names are all named.
- `RenderScore` versioning and snapshot compatibility are required.
- The lower-side layout priority is converted into a concrete lane and clearance contract.
- MusicXML offset behavior is specified in terms of forward/backup positioning and measure-local offsets.

## Addendum v1.7: Explicit Dynamic Marks

### Motivation

DrumMark supports crescendo and decrescendo hairpins with `<`, `>`, and `!`, but it has no explicit dynamic text syntax for `p`, `mp`, `ff`, and related markings.

Bare dynamic words cannot be used because `p` may be a playable note token. Dynamic marks therefore use the existing `@` directive prefix while keeping the notation short enough for frequent inline use.

### Syntax

A dynamic mark is written as `@` followed immediately by one supported dynamic level:

```drummark
@ppp @pp @p @mp @mf @f @ff @fff
```

Examples:

```drummark
SD | @p d - d - @mp d - d - |
SD | @p d d < d d @f |
SD | @ff d d > d d @mp |
```

Dynamic marks are zero-duration measure expressions. They are legal in ordinary measure content, inline routed blocks, and rhythmic groups `[ ... ]` / `[N: ... ]`.

### Supported Levels

The supported dynamic levels are exactly:

| Syntax | Canonical value |
|--------|-----------------|
| `@ppp` | `ppp` |
| `@pp` | `pp` |
| `@p` | `p` |
| `@mp` | `mp` |
| `@mf` | `mf` |
| `@f` | `f` |
| `@ff` | `ff` |
| `@fff` | `fff` |

Unsupported expression forms such as `@sfz`, `@fp`, `@ffff`, `@m`, and `@pf` are parse errors unless another approved addendum defines them.

### Lexical Rule and `@...` Directive Family

The lexer recognizes dynamic marks as exact whole-token forms. Dynamic token alternatives must be ordered longest-first where the lexer requires explicit ordering:

```text
@ppp before @pp before @p
@fff before @ff before @f
```

The lexer must not split an unsupported longer word into a supported dynamic plus trailing text. For example:

- `@fff` is one dynamic token.
- `@ffx` is not `@ff` plus `x`; it is an invalid `@...` form.
- `@ffff` is not `@fff` plus `f`; it is an invalid `@...` form.

Dynamic marks join the closed `@...` directive family defined by the latest navigation and routed-block addenda. This proposal does not reopen older removed navigation spellings such as `@da-capo` or `@dal-segno`; it depends on the later navigation addendum that uses `@dc` and `@ds`.

Accepted `@...` classes after this addendum are:

- routed block directives such as `@SD { ... }`
- current navigation directives such as `@segno`, `@coda`, `@fine`, `@dc`, `@ds`, `@dc-al-fine`, `@dc-al-coda`, `@ds-al-fine`, `@ds-al-coda`, and `@to-coda`
- dynamic marks defined by this addendum

There is still no generic `@Identifier` category.

### Disambiguation From Notes

The `@` prefix makes dynamic marks unambiguous with playable note tokens:

```drummark
SD | p @p p @ff |
```

Bare `p` is parsed by ordinary note-token rules. `@p` and `@ff` are dynamic marks.

### Timing Semantics

Dynamic marks consume no rhythmic duration and anchor at the current measure-local musical position.

Rules:

- A dynamic at the beginning of a measure anchors to measure fraction `0/1`.
- A dynamic after one or more duration-consuming tokens anchors to the current accumulated rhythmic position.
- A dynamic after all duration-consuming tokens in a measure anchors to measure fraction `1/1`.
- A dynamic may appear at the same position as a note, rest, sticking token, hairpin start, hairpin end, or navigation directive.
- Source order at the same rhythmic position does not change the dynamic's musical anchor.

Example:

```drummark
SD | @p d d @f d d |
```

With four equal slots, `@p` anchors at `0/1` and `@f` anchors at `1/2`.

### Groups and Position Scaling

Dynamic marks inside rhythmic groups are legal and consume no group-local duration.

The dynamic anchor is the scaled group-local position:

```text
measure_position = group_start + (group_local_position / group_duration_consuming_weight) * group_rendered_duration
```

The implementation may compute this with the same exact fraction machinery used for group event placement. It must not use unscaled raw token counts as final anchors.

Example:

```drummark
SD | [4: @p d d @f d d] |
```

`@p` anchors to the group's start. `@f` anchors halfway through the rendered group span.

A group is invalid if, after filtering out zero-duration tokens such as hairpins and dynamics, it contains no duration-consuming item.

Dynamic marks are not legal inside combined-hit operands. The following is invalid because combined-hit operands must remain note/rest glyph expressions, not score-level expressions:

```drummark
SD | d+@p |
```

### Routed Blocks

Dynamic marks inside routed blocks remain score-level expression marks, not track-local state.

Example:

```drummark
| @SD { @p d d } @BD { @p b b } |
```

Both `@p` declarations normalize to one score-level `p` at the same measure-local position.

Invalid:

```drummark
| @SD { @p d d } @BD { @f b b } |
```

The same logical measure position declares conflicting dynamic levels.

Routed-block position accumulation uses the routed block's position within the surrounding measure expression stream. A dynamic inside a routed block anchors to the exact measure-local fraction where that dynamic appears after routed-block duration scaling, matching the placement of notes emitted by that block.

### Navigation and Edge Coexistence

Dynamic marks may coexist with navigation marks and jumps at the same rhythmic position because they occupy below-staff expression space while navigation occupies above-staff or edge navigation space.

Examples:

```drummark
HH | @segno @p x x x x |
HH | x x @to-coda @mf x x |
HH | x x x x @f @fine |
HH | x x x x @ff @dc |
```

Order does not affect the anchor when both directives are at the same rhythmic position. The layout engine must keep navigation placement independent from dynamic placement; adapters must not resolve this collision.

Existing navigation placement legality still applies. For example, if a navigation directive is illegal at a given position, adding a dynamic at that position does not make it legal.

### Duplicate and Conflict Rules

Dynamic comparison is by logical measure index and exact measure-local fraction before repeat playback expansion.

Within one logical measure position:

- Same-level dynamic declarations deduplicate to one dynamic mark, even if they appear multiple times in the same track, across multiple tracks, or through routed blocks.
- Different-level dynamic declarations are a hard normalization error.
- Deduplication preserves the first source location for diagnostics and stable ordering.

Inline repeat expansion and measure-repeat shorthand do not create new conflict semantics. The logical measure generated by normalization owns its own deduplicated dynamic list after expansion/shorthand resolution.

### Rust AST and Normalization

The Rust parser adds a dynamic measure expression:

```rust
pub enum MeasureExpr {
    // existing variants...
    Dynamic(DynamicLevel),
}

pub enum DynamicLevel {
    Ppp,
    Pp,
    P,
    Mp,
    Mf,
    F,
    Ff,
    Fff,
}
```

Normalization adds dynamic intents to each normalized measure:

```rust
pub struct DynamicIntent {
    pub level: DynamicLevel,
    pub at: Fraction,
}

pub struct NormalizedMeasure {
    // existing fields...
    pub dynamics: Vec<DynamicIntent>,
}
```

`NormalizedMeasure.dynamics` is sorted by `at` ascending after deduplication. If two same-level declarations share the same `at`, only the first source location is retained for diagnostics; no duplicate entry is emitted.

### TypeScript and WASM Boundary

The TypeScript DSL boundary mirrors the Rust model:

```typescript
export type DynamicLevel = "ppp" | "pp" | "p" | "mp" | "mf" | "f" | "ff" | "fff";

export type DynamicIntent = {
  level: DynamicLevel;
  at: Fraction;
};

export type NormalizedMeasure = {
  // existing fields...
  dynamics: DynamicIntent[];
};
```

Serialized JSON field names are:

- `dynamics`
- `level`
- `at`

WASM object construction must emit `dynamics: []` for measures without dynamic marks, not omit the field.

### RenderScore Contract and Versioning

`RenderScore` extends each render measure with explicit dynamic data:

```rust
pub struct RenderMeasure {
    // existing fields...
    pub dynamics: Vec<DynamicMark>,
}

pub struct DynamicMark {
    pub level: DynamicLevel,
    pub at: Fraction,
}
```

The serialized render shape uses the same JSON field names as normalization:

- `dynamics`
- `level`
- `at`

Adding `RenderMeasure.dynamics` requires a `RENDER_SCORE_VERSION` bump. Snapshot loaders and tests that read older render fixtures may either migrate missing `dynamics` to an empty array at fixture-load time or update the fixtures. Runtime render paths should receive the versioned current shape with explicit `dynamics`.

Dynamic marks are part of the closed render contract. Layout must not recover dynamics by rescanning source text, reading parser-only AST nodes, or inspecting navigation labels.

### LayoutScene Contract

The layout engine owns dynamic placement and emits semantic scene items for dynamic marks.

Dynamic marks render as `ScenePrimitive::TextRun` unless a later approved metrics proposal introduces dedicated SMuFL glyph roles for dynamics. The text contract is:

- role: `dynamic`
- text: canonical dynamic level (`p`, `mp`, `ff`, etc.)
- font family: the layout engine's configured music/text engraving font for dynamics
- font style: italic
- anchor: owning measure plus measure-local fraction
- accessible label: `dynamic <level>`

Adapters only paint resolved text geometry. They must not perform dynamic measurement, collision resolution, or vertical lane assignment.

### Lower-Staff Vertical Priority and Collision Contract

All dynamic marks render below the staff.

For lower-staff elements, vertical priority from top to bottom is:

1. lower-side visible note modifiers and articulations, including accent-like marks when rendered below
2. hairpins
3. dynamic marks

The layout engine must implement this as a lower-side lane contract:

- noteheads, stems, beams, rests, and lower-side modifiers/articulations seed the lower skyline
- hairpins sample that skyline and reserve their full path bounds into the skyline
- dynamics sample the skyline after hairpins and reserve their text bounds into the skyline

Minimum clearance between adjacent lower-side lanes is `LOWER_EXPRESSION_GAP_PT`, initially 4pt unless a layout metrics module defines a different canonical value.

Dynamic marks therefore sit farther from the staff than overlapping hairpins. Hairpins sit farther from the staff than overlapping lower-side modifiers/articulations. Dynamics affect subsequent lower skyline elements in source/layout order and are not final decorations exempt from collision accounting.

Example:

```drummark
SD | @p d:accent d < d d @f |
```

The lower-side stack at overlapping positions is:

```text
staff
lower-side modifier/articulation lane
hairpin lane
dynamic lane
```

If an accent is rendered above the staff by the current notehead/stem policy, it is not part of this lower-side stack. If an accent or other modifier is rendered below, it occupies the modifier/articulation lane above hairpins.

### MusicXML Export

Dynamic marks export as MusicXML direction dynamics with `placement="below"`:

```xml
<direction placement="below">
  <direction-type>
    <dynamics>
      <p/>
    </dynamics>
  </direction-type>
</direction>
```

The element name inside `<dynamics>` is the canonical level. For example, `@ff` exports as `<ff/>`.

The exporter emits a dynamic direction at `DynamicIntent.at` in measure-local time. If the current MusicXML cursor is not at the target offset, the exporter uses the same forward/backup mechanism used for other mid-measure directions to reach the target time, emits the direction before any notes that begin at the same offset, then restores or advances cursor state as needed for subsequent note emission.

At measure fraction `1/1`, the direction is emitted after all duration-consuming notes/rests in the measure. It remains a measure-end direction rather than being moved to the next measure.

Because DrumMark drum scores export as one percussion part, score-level dynamics attach to that part without per-track staff duplication.

Mid-measure example:

```drummark
SD | d d @f d d |
```

Expected MusicXML shape, omitting unrelated note details:

```xml
<note>...</note>
<note>...</note>
<direction placement="below">
  <direction-type>
    <dynamics>
      <f/>
    </dynamics>
  </direction-type>
</direction>
<note>...</note>
<note>...</note>
```

### Non-Goals

This addendum does not define:

- playback velocity mapping for dynamic levels
- dynamic interpolation across hairpins
- additional dynamic/expression text such as `sfz`, `fp`, `cresc.`, or `dim.`
- per-track independent dynamics at the same rhythmic position
- user-facing settings for dynamic vertical offset
- SMuFL dynamic glyph roles or dynamic-specific glyph metrics

### Acceptance Criteria

- `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, and `@fff` parse as zero-duration dynamic measure expressions.
- Dynamic lexing is whole-token and longest-first: `@fff` parses as one dynamic, while `@ffff` and `@ffx` are parse errors.
- Bare `p` remains governed by ordinary note-token parsing.
- Unknown dynamic-like forms such as `@sfz`, `@fp`, `@m`, and `@pf` are parse errors.
- Existing routed block tokens such as `@SD`, `@C`, and `@BD2` continue to route tracks.
- Existing navigation tokens such as `@fine`, `@dc`, and `@dc-al-coda` continue to parse as navigation.
- Dynamic marks inside routed blocks normalize as score-level dynamic marks.
- Dynamic marks inside groups anchor to scaled group-local positions.
- Groups containing only zero-duration dynamics/hairpins are invalid.
- Dynamic marks inside combined-hit operands are invalid.
- Same-position same-level declarations deduplicate across tracks, routed blocks, and repeated same-track declarations.
- Same-position different-level declarations produce a hard normalization error.
- Duplicate/conflict comparison is by logical measure index and exact measure-local fraction before repeat playback expansion.
- `NormalizedMeasure.dynamics` and `RenderMeasure.dynamics` are explicit arrays sorted by measure-local fraction.
- The render-score version is bumped for the new field, with fixture migration or fixture updates.
- `drummark-layout` places dynamic marks below the staff with lower-side priority: modifiers/articulations, then hairpins, then dynamics.
- Dynamic text bounds reserve lower skyline space and clear hairpin bounds by at least `LOWER_EXPRESSION_GAP_PT`.
- SVG adapters render the resolved scene geometry without adapter-side dynamic placement logic.
- MusicXML export emits below-staff `<dynamics>` directions at the normalized measure-local offset, including mid-measure and measure-end positions.

### Review Round 2

v1.7 fixes most of the Round 1 omissions: it adds exact dynamic spelling, route preservation, group scaling, same-position conflict behavior, Rust-first schema names, render-version requirements, lower-side skyline ordering, and MusicXML offset intent. It is much closer to implementable. I still see several places where the text would let an implementation pass the written acceptance criteria while producing brittle or incompatible behavior.

1. The exact-match lexer rule still needs a concrete token-boundary definition. The text says `@ffx` and `@ffff` are invalid whole `@...` forms, but it does not define what terminates an `@` directive. That matters for punctuation and braces, not just letters: `@f}`, `@f|`, `@f]`, `@f,`, and `@f:accent` should be classified intentionally. With Logos-style fixed tokens, `@ffx` will otherwise tend to become `@ff` followed by `x` unless the implementation adds an invalid-`@` catch rule or parser-side span validation. The proposal should specify that an accepted dynamic token must be followed by a delimiter/end of input, and it should name the delimiter class or explicitly require an invalid `@` directive scanner before shorter tokens are accepted.

2. The routed-block timing rule still has an implementation gap around duration arbitration. "Routed-block position accumulation uses the routed block's position within the surrounding measure expression stream" is correct for the outer anchor, but it does not say whether the surrounding stream advances by the routed block's rendered duration, by the maximum duration of all routed blocks at that outer position, or by each block independently. The examples show adjacent `@SD { ... } @BD { ... }` blocks that both start at zero, which implies routed blocks are simultaneous voices rather than sequential duration consumers, but the proposal never states that. Without this, `| @SD { @p d d } @BD { @f b b } |` could be interpreted as a conflict at zero by one implementer and as two sequential dynamics by another.

3. Group scaling is improved but underspecified for nested groups and inline/routed braced content inside groups. The formula names `group_duration_consuming_weight` and `group_rendered_duration`, but it does not define whether zero-duration tokens inside nested groups are scanned before or after recursively scaling the child group. The acceptance criteria only cover "inside groups" generally; they should include at least one nested or braced-in-group case, or the proposal should explicitly ban the unresolved shape. Otherwise the normalizer can accidentally implement one-level group dynamics only while claiming conformance.

4. The Rust/RenderScore type contract still crosses crate boundaries unclearly. `DynamicLevel` is defined under "Rust AST and Normalization", then `RenderMeasure` in the layout-owned render contract uses `DynamicLevel` without saying whether `drummark_layout` defines its own serializable `DynamicLevel`, imports a shared type, or receives a string-backed render enum. Because `RenderScore` lives in `drummark-layout`, the addendum must name the layout crate's public type shape as well, not just the parser enum. This is especially important for WASM JSON, where enum serialization must be the canonical lowercase strings, not Rust variant names.

5. The layout lane algorithm has an ordering contract but still lacks horizontal extent and anchor details for point dynamics. A dynamic is anchored at a fraction, but the proposal does not state whether text is centered on that x, left-aligned at that x, or shifted to avoid barlines/measure edges. It also does not define the skyline reservation range for a text mark: exact measured text bounds, padded bounds, or some canonical width. The new `LOWER_EXPRESSION_GAP_PT` clearance is useful, but without x-alignment and bounds policy, two engines can reserve different horizontal intervals and produce different collisions with hairpins and end barlines while both satisfying "below staff".

6. "Dynamics affect subsequent lower skyline elements in source/layout order" conflicts with the earlier priority pipeline. The same section says hairpins sample the skyline first and dynamics sample after hairpins, which means a dynamic cannot affect hairpin placement if priority is deterministic. If this sentence only means subsequent dynamic marks or other later non-hairpin expression objects, say that. If it means later hairpins can be pushed by earlier dynamics, then the priority order is no longer strictly modifiers/articulations, hairpins, dynamics. This needs one unambiguous rule before implementation.

7. MusicXML cursor behavior is still too hand-wavy for the current exporter architecture. The text says "uses the same forward/backup mechanism used for other mid-measure directions", but the existing TypeScript MusicXML path emits hairpins as direction elements with `<offset>` before note content, not by interleaving cursor movement with notes. If the proposal intends to change dynamic export to an interleaved cursor model, it must describe how this interacts with the two-voice export and the full-measure `<backup>` between voices. If it intends to use `<offset>` like hairpins, it should say so and remove the forward/backup requirement. As written, implementers can satisfy the example XML while still placing all mid-measure dynamics before notes with offsets, or they can insert forwards/backups and risk corrupting voice cursor state.

8. The MusicXML same-offset rule needs a multi-voice tie-breaker. "Emit before any notes that begin at the same offset" is simple in a single cursor stream, but DrumMark exports one percussion part with up/down voices and may emit voice 1, backup, then voice 2. A score-level dynamic at an offset shared by both voices needs a single placement rule: before the first voice-1 note at that offset, before both voices after a backup, or as a direction with offset independent of voice emission. This is not an edge case; score-level dynamics commonly sit at beat boundaries used by both voices.

9. The acceptance criteria still miss the cases that would catch the remaining ambiguities. Add explicit criteria for directive delimiter behavior (`@f}`, `@f|`, `@ffx`, `@ffff`), simultaneous routed blocks versus sequential routed blocks, nested group scaling or a stated ban, layout x-alignment/bounds reservation, and the chosen MusicXML cursor/offset strategy with two voices. The current list is broad, but it does not force the implementation to resolve these hardest choices.

STATUS: CHANGES_REQUESTED

### Review Round 3

Addendum v1.8 resolves the implementation-blocking ambiguities from Round 2. The proposal is now specific enough to implement without guessing across lexer, normalization, render contract, layout, and MusicXML export.

1. Delimiter rules are now testable. The explicit accepted delimiter examples for `@f}`, `@f|`, and rejected forms `@ffx`, `@ffff`, and `@f:accent` close the previous longest-prefix trap. Requiring an unsupported-`@` rejection path before shorter dynamic prefixes is the key normative requirement, and the proposal states it clearly. One minor edge remains: the delimiter bullet includes `(` but not `)`. That is not a blocker if `)` is not a legal measure/group delimiter today, but if the grammar has any parenthesized measure expression contexts, the implementation should either reject `@f)` intentionally or add it in a later cleanup. The current observable table is still sufficient for this feature.

2. Simultaneous routed blocks are now unambiguous. The surrounding cursor advances by the maximum rendered duration of the routed-block cluster, and dynamics inside each block anchor from the same outer start plus internal scaled position. That directly resolves the former sequential-versus-parallel ambiguity and gives normalization a clear conflict/deduplication key.

3. Nested group scaling is implementable. The recursive formula makes child groups resolve into their rendered span before being scaled into the parent, and the nested example forces more than a one-level implementation. The combined-hit exclusion is also correctly placed because it prevents score-level expression objects from leaking into glyph operands.

4. Crate boundary ownership is now acceptable. Core owns parser/normalization types, `drummark-layout` owns render-facing `DynamicLevel` and `DynamicMark`, and core maps between them during `RenderScore` construction. The lowercase canonical JSON requirement avoids accidental serialization of Rust variant names across the WASM/fixture boundary.

5. Layout x, bounds, and lane order are specified well enough for deterministic behavior. Center-on-anchor, inward edge shifting only at measure boundaries, padded canonical text bounds, and the fixed pass order of modifiers/articulations, hairpins, then dynamics provide a concrete algorithm. The clarification that dynamics do not push hairpins in the same pass removes the previous contradiction between source order and priority order.

6. MusicXML export is now consistent with the existing direction-offset strategy. Using `<offset>` instead of a new forward/backup cursor model avoids corrupting multi-voice cursor state, and the "once per percussion part" rule covers the two-voice case. Allowing start-of-measure offset omission only if consistent with existing direction style is acceptable because the normalized musical position is still encoded deterministically by convention.

The acceptance criteria now cover the previously dangerous cases: directive boundary behavior, routed-block simultaneity, nested group scaling, crate/WASM serialization shape, layout bounds and lane ordering, and two-voice MusicXML direction placement. I do not see remaining contradictions that would block implementation.

STATUS: APPROVED

### Consolidated Changes

The approved explicit dynamic marks design introduces short score-level dynamic directives using `@<level>`:

```drummark
@ppp @pp @p @mp @mf @f @ff @fff
```

Bare `p` remains an ordinary playable token according to existing note-token rules. Dynamic directives are exact whole-token `@...` forms with delimiter-aware recognition: supported forms such as `@f`, `@ff`, and `@fff` parse only when followed by a valid directive delimiter or end of input; unsupported longer or modifier-like forms such as `@ffff`, `@ffx`, `@sfz`, `@fp`, `@m`, `@pf`, and `@f:accent` are parse errors. Existing routed block directives (`@SD { ... }`, `@C { ... }`, etc.) and current navigation directives (`@fine`, `@dc`, `@dc-al-coda`, etc.) remain in the closed `@...` family.

Dynamic marks are zero-duration measure expressions anchored to exact measure-local musical fractions. They may appear in ordinary measure content, routed blocks, and rhythmic groups. Adjacent routed blocks at the same surrounding position are simultaneous branches; dynamics inside them anchor from the shared outer start plus each block's internal scaled position, and the surrounding cursor advances by the cluster's maximum rendered duration. Dynamic marks inside nested groups resolve through recursive container scaling. Dynamic marks are invalid inside combined-hit operands, and groups containing only zero-duration hairpins/dynamics remain invalid.

Dynamics are score-level expression marks, not track-local note modifiers. Same-position same-level declarations deduplicate globally within a logical measure across tracks, repeated same-track declarations, routed blocks, and groups. Same-position different-level declarations are hard normalization errors. Comparison uses logical measure index plus exact measure-local fraction before repeat playback expansion.

The Rust parser/core model adds `MeasureExpr::Dynamic(DynamicLevel)` and `DynamicIntent { level, at }`; `NormalizedMeasure` gains an always-present `dynamics` array. TypeScript/WASM serialized forms use lowercase canonical levels and explicit `dynamics` arrays. `drummark-layout` owns its own render-facing `DynamicLevel` and `DynamicMark` types, and core maps normalized dynamics into the `RenderScore` contract. The render-score version must be bumped for this new field.

Layout renders dynamic marks below the staff as semantic `dynamic` `TextRun` scene items with italic dynamic text, an accessible label `dynamic <level>`, metadata preserving owning measure plus measure-local fraction, and bounds based on canonical layout-owned text metrics. Horizontal placement centers text on the anchor X, with minimum inward edge shifting at visible measure boundaries. Lower-side vertical priority is fixed from top to bottom: lower-side modifiers/articulations, hairpins, then dynamics. Dynamics sample the skyline after hairpins and do not push hairpins in the same layout pass.

MusicXML export emits one below-staff dynamic direction per score-level dynamic per percussion part. Mid-measure and end-measure dynamics use `<offset>` relative to measure start; start-of-measure dynamics may omit `<offset>` or emit zero consistently with the existing direction export style. The exporter uses direction offsets rather than introducing a new forward/backup cursor strategy for dynamics.
