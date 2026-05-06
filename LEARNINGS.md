# Learnings

## 2026-04-30

- Static docs examples should copy from the source DSL string, not from highlighted `<pre>` HTML. The stable pattern here is to emit the original example text as encoded `data-copy` at build time, then let the browser decode and copy that payload on button click.
- `navigator.clipboard.writeText()` is not sufficient for docs pages served over LAN `http` such as `http://192.168.x.x:5173`. Those contexts commonly fail clipboard writes on mobile browsers, so docs copy buttons need a `document.execCommand("copy")` fallback wired into the same click gesture.
- Navigation labels like `Fine`, `D.C.`, and `D.S.` must not be rendered with the music glyph font `Bravura`. That causes device-dependent fallback differences across desktop and mobile. Textual navigation should use `Academico`; only actual symbols like segno/coda should stay on `Bravura`, and mixed `To Coda` rendering should be emitted as separate text-plus-glyph elements.
- Navigation collision handling is safer when it stays inside VexFlow's modifier layout. For note-adjacent end markers, attaching them as `Annotation`s on the last anchor note lets `ModifierContext` reserve horizontal space and stack vertical text lines automatically; querying note bounding boxes before `Formatter` has assigned `TickContext` will crash with `NoTickContext`.
- If navigation text must not reflow notes, render it as post-format overlays instead of note modifiers. The practical split here is: right-edge `Fine` / `D.C.` / `D.S.` and left-edge `segno/coda` should share the same overlay `Annotation` baseline (`textLine`-driven), otherwise mixing `StaveText` on one side and `Annotation` on the other produces visible vertical misalignment.
- Volta boundaries in the parser are measure-boundary syntax, not regular measure content. The parser must recognize them before token parsing on anonymous tracks, or inputs like `:|2.` degrade into a valid repeat-end followed by an invalid content token `2`.
- Anonymous-track alternate endings need the same boundary grammar as named tracks. In practice this includes both compact forms like `|2.` and musician-style spaced forms like `| 3.`.
- A repeat end may immediately introduce the next volta with no intervening barline token. `:|2.` should close the previous repeated measure and seed the next measure's left boundary with volta indices `[2]`.
- `|.` should be treated as a pure volta terminator. Final barlines belong to score normalization on the actual last measure, not to the `|.` token itself.
- Cross-system volta rendering depends on normalized canonical metadata spanning the whole ending, not just the first measure that declared `|1.` or `|2.`. Once the active volta is propagated until `|.`, a new volta, or a repeat end, existing VexFlow `BEGIN/MID/END` rendering continues the bracket across systems correctly.

## 2026-04-30 Addendum: Chained Measure Repeat

- Change: chained measure-repeat shorthand is allowed. A measure-repeat bar may reference preceding bars even if one or more of those preceding bars are themselves measure-repeat bars.
- Semantics: `%` copies the immediately preceding canonical musical result. `%%` copies the previous two canonical musical results as heard/read after normalization, not merely the previous two source measures by syntax class.
- Example: `| A | % | %% |` is valid and yields canonical playback/notation equivalent to `| A | A | A |`.
- Non-change: `%` and `%%` still must occupy the entire measure, and `%%` still requires two preceding canonical measures to exist.
- Metadata rule: measure-repeat expands musical content only. Structural metadata such as the current barline, volta, marker, and jump remain attached to the current bar and are not inherited from the referenced bars.

## 2026-04-30 Addendum: Multi-Marker Navigation

- Navigation markers are no longer singleton metadata. Canonical score data needs an ordered `markers` array, not a single `marker` field, or inputs like `@coda ... @fine` cannot be represented without loss.
- Cross-track marker merge is set union, not conflict. The canonical ordering is fixed as `segno`, `coda`, `fine`, which keeps renderer snapshots and MusicXML emission deterministic even when source token order differs.
- Jumps remain singleton metadata. The valid matrix is now “any marker set plus at most one jump”, so parser and AST validation must stop rejecting marker-plus-marker while still rejecting jump-plus-jump.
- Marker propagation follows the same left-edge rule as volta starts: when `*N` expands one source measure into multiple logical bars, the full marker set belongs only on the first generated bar, while any jump belongs only on the last generated bar.
- Consumers must preserve the whole marker set. In practice this means MusicXML emits one direction per marker in canonical order, and VexFlow must render multiple start-side labels instead of silently dropping later markers.

## 2026-04-30 Addendum: Positional Navigation Anchors

- The multi-marker model was too loose for engraving semantics. Once navigation placement matters, canonical IR must model at most one `startNav` and at most one `endNav`, with tagged unions that encode which anchor kinds are legal for each token family.
- Position legality has to be evaluated after stripping navigation tokens but before parsing shorthand structure. `%`, `%%`, and `--N--` still count as remaining measure content for begin/end legality, while trailing `*N` behaves as an inline-repeat suffix and should not block end-side navigation.
- Pure navigation measures need an explicit fallback rule. Without it, inputs like `| @segno |` and `| @dc |` become ambiguous because there is no remaining content token to establish “beginning” or “end”; the correct default is start-side forms -> left edge, end-side forms -> right edge.
- Right-edge navigation forcing must be resolved against barlines during normalization, not in the parser. `fine` upgrades the canonical barline to `final`; `dc/ds` families upgrade to `double` unless a `double` or `final` barline is already explicit; repeat-ending bars instead hard-fail for these end-side forms.
- Event-relative anchors are safest when stored as rhythmic positions, not concrete note ids. That keeps `segno`/`to-coda` stable across combined hits, grouped tokens, and cross-track normalization.
- VexFlow `Repetition` is only partially useful for navigation engraving. `SEGNO_LEFT` is symbol-only, but `CODA_LEFT` and `TO_CODA` inject hardcoded text, and all `Repetition` text is top-of-staff only. For position-sensitive navigation, note-anchored `Annotation` modifiers are more reliable.
- Pure navigation measures still need render anchors. If the renderer only records anchor points for sounded events, start/end navigation on rest-only bars disappears; rest entries must seed the same rhythmic anchor map.
- For the current engraving rules, `fine` and the `dc/ds` family belong below the staff, while `to-coda` stays above and should be emitted as separate text-plus-glyph annotations so the coda symbol survives SVG export.

## 2026-04-30 Addendum: Grouping Boundary Units & VexFlow Header Ownership

- Grouping-boundary validation in normalize must use the same unit system as AST validation: grouping values are beat counts, while token offsets and weights are slot counts. Converting the boundary with `cumulativeGrouping * divisions / beats` avoids both false positives and false negatives.
- A legal dotted value near the middle of a `2+2` bar is a good regression probe. In `4/4` with `divisions 16`, `| - x. x. - ... |` must not be flagged as crossing the grouping boundary, even though naive beat-vs-slot comparison says it does.
- Navigation text placement in VexFlow is sensitive to `StaveText` font size and `shiftY`. For this renderer, the stable snapshot for left-edge `segno/coda` and right-edge `Fine` / `D.C.` / `D.S.` came from using native `StaveText` at `20pt` without the extra manual upward shift.
- Title, subtitle, and composer should be emitted through VexFlow objects, not `context.fillText()`. A zero-line header stave with `StaveText` modifiers satisfies the repository rule that score headers remain inside the VexFlow rendering path.
- Headless/JSDOM runs do not expose the browser `FontFace` API. VexFlow font loading should therefore no-op in that environment instead of logging an expected failure on every render test.

## 2026-04-30 Addendum: Implicit Repeat-End for Intermediate Voltas

- Engraving semantics and repeat semantics have to stay aligned for alternate endings. If a measure is inside a volta and its right boundary immediately opens a different next volta, that current measure should normalize as a `repeat-end` even when the source omitted an explicit `:|`.
- The inference applies only to intermediate endings. The last volta keeps whatever closing barline the user wrote (`|`, `||`, `|.`, `||.`), and the usual end-of-score final-barline normalization still happens later if nothing explicit was written.
- Multi-ending repeat validation cannot model voltas as a single open/close pair. A repeat start may fan out into multiple repeat spans with the same `startBar`, one for each intermediate ending (`1.`, `2.`, etc.), while the final ending exits the repeated section without another backward repeat.

## 2026-04-30 Addendum: VexFlow Stem Length Control

- VexFlow exposes per-note stem shortening through `StemmableNote#setStemLength(height)`. This is a direct absolute stem height override, not a delta.
- Beamed groups still honor that override as their starting geometry, but `Beam.applyStemExtensions()` will extend stems as needed to meet the shared beam line. So shortening works globally, but beamed notes remain constrained by beam alignment rather than a fixed identical visual height.
- If stem length is user-tunable in the editor, it should be part of the shared `VexflowRenderOptions` pipeline rather than a renderer constant, otherwise preview, PDF export, CLI output, and tests drift out of sync.

## 2026-04-30 Addendum: Editor Stem-Length Wiring

- The editor already persisted a `stemLength` render setting and exposed a slider, but the actual note-building path still has to receive that value explicitly. In this renderer the critical handoff is `renderMeasureVoices(...) -> createVexNotes(...) -> StaveNote#setStemLength(...)`.
- A UI-level option is not enough as verification. The stable regression check is to compare the exported SVG stem path for the same score under two `stemLength` values and assert the stem endpoint moves.
- In VexFlow, `StemmableNote#setStemLength()` only records `stemExtensionOverride`; it does not push that value into the already-built `Stem`. If code also calls `setStemDirection()`, the safe order is `setStemLength()` first, then `setStemDirection()`, because `setStemDirection()` is what applies `getStemExtension()` onto the live stem object.

## Legacy Docs Learnings (Merged From `docs/LEARNINGS.md`)

### 1. VexFlow 5 & Vite MPA

- VexFlow 5 font loading should use `await VexFlow.loadFonts(...fontNames)`, and active fonts are controlled by `VexFlow.setFonts(...fontNames)`.
- In the minified VexFlow 5 build used here, SMuFL mappings live at `VF.smufl.to_code_points`, and `StaveNote` notehead instances are stored on `note.note_heads`.
- Vite subpath deploys need `base` configured and should prefer relative internal HTML links for multi-page docs.
- Static docs generation in this repo runs through `npm run build-docs` in a headless JSDOM environment that pre-renders `.drum` examples into SVG.

### 2. DrumMark Spec And DSL Validation

- Header duplication, grouping consistency, and irregular-meter fallback all need parser-level protection so later stages do not inherit ambiguous header state.
- Anonymous routing, summon prefixes, global token resolution priority, and `ST` sticking semantics all have implementation-critical edge cases that should be tested at normalize time, not just parser shape time.
- Measure-level constructs such as `%`, `%%`, `|1.`, `|2.`, `@segno`, `@dc`, `--N--`, and `*N` are global structural metadata and should not be treated like ordinary inline content once parsed.
- Validation is strongest when it uses rational timing math rather than slot heuristics alone, especially for dotted values, group stretching/compression, and grouping-boundary crossing.

### 3. MusicXML And Renderer Backend

- MusicXML rests should include explicit display positions to avoid voice collisions, matching the renderer convention of placing voice 1 rests around `B/4` and voice 2 rests around `F/4`.
- Measure repeats and multi-measure rests are appearance metadata layered on top of canonical musical structure, not shortcuts for malformed physical-measure duplication.
- VexFlow needs explicit `Dot` modifiers for dotted notes and rests, and dotted durations must also be encoded in the note duration itself so ticks and spacing stay correct.
- Multi-measure rests should be rendered with VexFlow's native `MultiMeasureRest`, not simulated with text plus a whole rest.

### 4. Static Docs Runtime

- Static docs pages should avoid eagerly loading the full DSL/render stack because examples are already pre-rendered at build time.
- Browser-native scrolling and lightweight runtime JS are more robust than nested scroll containers and heavy custom restoration logic for the docs page.
- Copy buttons should be resilient at runtime even if build-time HTML injection changes, and button binding should be idempotent.
- Width constraints should be applied to the reading column rather than the outer docs shell, so the sidebar and chrome can remain full-width.

## 2026-05-01 Addendum: VexFlow 5 StaveTempo Positioning

- VexFlow 5 `StaveTempo` modifiers, when added with `Modifier.Position.ABOVE`, appear to calculate their horizontal position based on the internal "Note Start" offset but fail to add the parent `Stave.x` coordinate.
- Result: When page margins (padding) change, the stave and notes shift correctly, but the tempo marking remains stuck at a fixed absolute position on the canvas.
- Fix: Manually add the stave's current `x` to the tempo's `x-offset` parameter. In this renderer, `new StaveTempo({ ... }, x - 45, y)` ensures the BPM marking follows the staff perfectly while staying left-aligned above the clef.
- Testing: Verifying this requires isolated render passes (e.g., fresh `JSDOM` instances in tests) because VexFlow's internal font measurement and modifier contexts can have "sticky" global state in Node environments that masks coordinate drift.

## 2026-05-01 Addendum: VexFlow Navigation Layout Split

- VexFlow is good at local modifier stacking, not system-level collision avoidance. If navigation is anchored to a note, attaching it as an `Annotation`-like modifier lets `ModifierContext` stack it with accents, sticking, and other note-local marks automatically.
- `left-edge` / `right-edge` navigation and `volta` brackets should not rely on fixed `shiftY` heuristics. A more stable renderer flow is: format and draw notes first, then inspect note and modifier geometry, build a system-level top skyline, and place edge/span overlays against that skyline.
- Pure note geometry is not enough once sticking or text annotations are in play. After `voice.draw(...)`, VexFlow modifiers have resolved positions, so skyline construction can safely sample note top, stem top, and the rendered `x/y` of above-staff modifiers without forcing a second SVG render pass.
- Mixed-font navigation such as `To Coda` is easier to keep stable by treating it as one logical layout unit. A custom annotation/overlay that draws text and glyph segments together avoids the spacing drift that happens when `To` and the coda symbol are emitted as independent modifiers competing for text lines.

## 2026-05-02 Addendum: UI Zoom & Safe Scrollable Centering

- Percentage-based width (e.g., `width: 130%`) is an unstable zoom mechanism when the container width is user-resizable via a divider. If the preview pane is narrowed, the score shrinks even if the zoom percentage remains the same.
- Stable Zoom Pattern: Use an absolute base width (e.g., `800px`) scaled by a raw decimal multiplier (`--page-scale`). This ensures "100% zoom" always looks the same regardless of the window size or resizer position.
- The "Centered but Unscrollable Left" Bug: Using `justify-content: center` or `margin: auto` on Flexbox/Grid containers for centering causes data loss during overflow. If the content exceeds the window, the browser centers it relative to the scrollable area, which "pushes" the left/top edges into negative coordinate space where they cannot be reached by scrollbars.
- "Safe Centering" with CSS Grid: The most robust modern fix is using `display: grid` on the scroll container and `margin: auto` on the content frame. Grid handles `margin: auto` more safely than Flexbox: it centers when the content is small, but respects the (0,0) origin when the content overflows, ensuring full scrollability to all edges.
- Inline-Block Centering Caveat: `text-align: center` on a container with `inline-block` children can cause a "jump to bottom" bug if the content width exceeds 100%. The browser treats the overflowing box as a "word" that is too long for the current line and wraps it to the next line, causing it to appear below the container's top edge.

## 2026-05-02 Addendum: Auto-Fit Width on Resize

- To implement "Fit to Window" behavior for an absolute-width score, use a `ResizeObserver` on the container.
- Formula: `newScale = (containerWidth - padding) / baseWidth`.
- By using `setFitWidth(true)` as a persistent mode, we can keep the score fitting perfectly even when the user drags the editor/preview divider.
- Manual zoom actions (like Ctrl+Wheel or clicking +/-) should automatically disable the `fitWidth` mode to respect the user's manual override.

## 2026-05-02 Addendum: Mobile Pinch-to-Zoom

- To implement custom pinch-to-zoom on mobile, intercept `touchstart` and `touchmove` events.
- Calculate the Euclidean distance between two touch points: `Math.sqrt(dx*dx + dy*dy)`.
- Scale the initial `pageScale` by the ratio of the current distance to the starting distance.
- Use `event.preventDefault()` on `touchmove` when two fingers are detected to suppress the browser's native viewport zoom, allowing the custom notation scaling to take over.

## 2026-05-02 Addendum: Virtual Zoom for Performance

- Heavy renderers like VexFlow cannot re-render at 60fps during a zoom gesture.
- Solution: "Virtual Zoom". Use a fast CSS `transform: scale()` on a wrapper during the gesture for immediate feedback.
- Only "commit" the scale to the renderer's state on `touchend`.
- This separates Visual Zoom (GPU-driven, 60fps) from Layout Zoom (CPU-driven, high quality), providing a buttery smooth experience on mobile.

## 2026-05-02 Addendum: CI/CD & SVG Testing Robustness

- SVG markup generated by rendering libraries (like VexFlow) can vary slightly in formatting (e.g., self-closing tags `<path />` vs `</path>`) depending on the environment (JSDOM vs Browser).
- Regex-based SVG probes should be flexible: use `[^>]*` for attributes and allow for optional or self-closing tags to avoid CI failures.
- When changing global layout defaults (like `staffScale` or `pagePadding`), existing tests that rely on absolute SVG coordinates (e.g., `y="190.5"`) will likely break. Prefer coordinate-agnostic assertions (e.g., checking relative positions or counts of elements) to make tests more resilient to design refinements.
- GitHub Actions should always run the full test suite (`npm test`) before building to catch regressions early.

## 2026-05-05 Addendum: Lezer Comment Handling & Parser Consolidation

### Root Cause

The Lezer grammar (`drum_mark.grammar`) had no `Comment` token. Lines starting with `#` (e.g., `# SD | x x x x | - r - r |`) were parsed as real TrackLine nodes by the Lezer parser, creating multi-line paragraphs with mismatched measure counts. This triggered the validation error "All track lines in a paragraph must have the same measure count" in `ast.ts:425-432`.

The regex parser (`parser.ts`) already handled comments correctly via `preprocessSource` → `splitComment`, but the Lezer skeleton builder (`lezer_skeleton.ts`) bypassed that preprocessing entirely.

### Debugging Methodology (Retro)

- **Do not trust the user's minimal reproducer.** The input `| x x+s x x |` alone parsed correctly. The actual trigger was the `# SD | x x x x | - r - r |` comment line that the user did not include in their report.
- **When two parsers coexist, trace the active parser path.** The CLI used regex parser (no bug), but the Web Worker path went through `buildScoreAst(skeleton)` with a Lezer-produced skeleton (bug). This path divergence is why the error only appeared in the web UI, not the CLI.
- **When a Lezer parser treats unexpected input as valid syntax, check the grammar.** The `#` character had no definition in `drum_mark.grammar`, so Lezer's error recovery treated it as skippable noise and parsed the remainder (`SD | ... |`) as a valid TrackLine.

### Fix

Added a `Comment` token to the Lezer grammar following the standard Lezer pattern:

```
@skip { space | Comment }

@tokens {
  Comment { "#" ![\n]* }
  ...
}
```

The `![\n]*` is a token-layer negation character set matching any character except newline, zero or more times. This is the Lezer-recommended approach for line comments (analogous to `// ![\n]*` in the docs).

Regenerated the parser with `npx lezer-generator src/dsl/drum_mark.grammar -o src/dsl/drum_mark.parser.js`.

### Lezer Migration Complete (2026-05-06)

The Lezer parser is now the sole parser in all production code paths. The regex parser remains in the codebase for parity tests and benchmarks only.

All gaps were fixed in `lezer_skeleton.ts`:

| Gap | Fix |
|-----|-----|
| Leading `\n` prevents header parsing | `source.trim()` before parsing |
| `\|.` barline treated as final | Changed to `single` with `voltaTerminator` |
| `\|: :\|` empty measure not created | Allow push even with empty content |
| `\|  \|` ghost measure not created | Same — push empty measures |
| No implicit repeat-end for intermediate voltas | Added `sameVoltaIndices` + inference logic |
| No `\|:xN` repeat count | Extract `xN` from MeasureContent after `:\|` |
| `note 1/N` in body not parsed | Scan source gaps between track lines for overrides |
| Non-power-of-2 note values not rejected | Added validation in NoteHeader parsing |
| Braced block nested GroupExpr duplicated | Filter nested MeasureTokens in inner braced MC |
| Combined hit `+` in group items → rest | Handle `+` as combined-hit separator in `parseGroupItems` |

Production file changes:
- `ast.ts`: switched `parseDocumentSkeleton` → `parseDocumentSkeletonFromLezer`
- `scoreWorker.ts`: simplified to use `buildNormalizedScore` directly (no fallback needed)
- `index.ts`: removed `export * from "./parser"`
- `drum_mark.grammar`: added `Comment` token

The regex parser (`parser.ts`) now has zero production references. All 345 tests pass with Lezer as the only parser.
