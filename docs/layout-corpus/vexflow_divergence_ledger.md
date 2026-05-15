# Layout Corpus Divergence Ledger

## Scope

- Supported corpus: `src/dsl/example_corpus.ts`
- Machine report: `docs/layout-corpus/corpus_gate_report.json`
- Representative scene snapshots: `docs/layout-corpus/scene-snapshots/*.layout-scene.json`
- Gate owner: `src/renderer/corpusGate.test.ts`

This ledger documents the intentional differences that remain when the supported corpus is rendered through the new layout stack and the legacy VexFlow stack. The comparison is a migration oracle only. It is not the production ownership boundary.

## Oracle Contract

- The layout side is compared through its role-tagged SVG output.
- The VexFlow side is compared through its serialized SVG primitives.
- The checked-in oracle report records the exact diff set for every corpus file.
- Any change to that diff set is reviewable drift and fails the corpus gate until the report and this ledger are updated together.

## Global Approved Divergences

These occur across nearly the entire corpus and are intentionally approved:

1. Primitive ownership differs.
   Layout emits semantic `<line>`, `<rect>`, `<polyline>`, and role-tagged `<text>` items directly from `LayoutScene`. VexFlow serializes much of the same visual result through its own `<path>` / `<rect>` mix and does not preserve the same role tags. Because of that, `lineCount`, `rectCount`, `polylineCount`, and related role counts are not expected to match.

2. Text grouping differs.
   Layout serializes title, tempo, navigation, repeat counts, volta labels, and other structural text as separate scene items with canonical metrics. VexFlow groups some of these differently and exposes them through a different SVG text structure. `textCount` drift is therefore expected unless a specific file is called out below as needing closer review.

3. Semantic text tokenization differs.
   The oracle records a normalized `semanticTextTokens` string so corpus drift can still catch label-content changes. Some global drift remains approved because layout serializes tempo clusters and structural labels more explicitly than VexFlow, but the token stream is still checked-in and reviewable.

4. Staff-entry role visibility differs.
   Layout exposes noteheads, stems, rests, and structural bars as first-class scene roles. VexFlow output does not provide the same role identity in serialized SVG, so role-keyed counts such as `openingBarlines`, `genericBarlines`, `noteheads`, `stems`, `rests`, `finalBarlineThin`, and `finalBarlineThick` are approved global divergences.

## Feature-Specific Approved Divergences

These files exercise structural features whose role-tagged ownership exists only on the layout side:

1. Repeat and alternate-ending spans:
   `docs/examples/repeats.drum`
   `examples/你要跳舞吗.drum`
   `examples/李白-李荣浩.drum`
   Approved drift keys: `repeatSpanLines`, `voltaLines`, `doubleBarlineLeft`, `doubleBarlineRight`, `genericBarlines`

2. Navigation markers:
   `docs/examples/full-example.drum`
   `docs/examples/repeats.drum`
   Approved drift keys: `navStarts`, `navEnds`

3. Hairpins:
   `docs/examples/hairpins.drum`
   `examples/李白-李荣浩.drum`
   Approved drift keys: `hairpinTop`, `hairpinBottom`

4. Sticking and accent attachments:
   `docs/examples/full-example.drum`
   `docs/examples/modifiers.drum`
   `docs/examples/sticking.drum`
   `docs/examples/tracks.drum`
   Approved drift keys: `sticking`, `accents`

5. Measure-repeat and multi-rest semantics:
   `docs/examples/repeats.drum`
   `docs/examples/multi-rest.drum`
   Approved drift keys: `measureRepeats`, `multiRestBars`, `multiRestCounts`

## Unsupported Oracle Expectations

- The VexFlow oracle is not used to approve or reject exact page/system breaking.
- The oracle is not used to approve or reject exact font family equality.
- The oracle is not used to reconstruct semantic span ownership from raw VexFlow SVG.

Those concerns are owned instead by `LayoutScene` scene summaries and checked-in layout goldens.
