# VexFlow 5 & Vite MPA Learnings

## 1. VexFlow 5 SMuFL Integration (Source-Verified)

### Font Loading API
Contrary to earlier alpha versions or guesses, VexFlow 5 standardizes font management through the `VexFlow` static class:
- **Loading:** `await VexFlow.loadFonts(...fontNames)` must be called and awaited. It fetches `.woff2` files from `Font.HOST_URL` (defaulting to jsdelivr).
- **Activation:** `VexFlow.setFonts(...fontNames)` sets the active font stack in `MetricsDefaults`.
- **Verification:** `VexFlow.getFonts()` returns the current active family string.

### Notehead Syntax & Mapping (Minified Build Specific)
In the minified VexFlow 5 build used in this project:
- **SMuFL Mapping Location:** `VF.smufl.to_code_points` (NOT `VF.Glyphs`).
- **StaveNote Instance Field:** `note_heads` (NOT `noteHeads`).
- **Parenthesized Noteheads:** `VF.Parenthesis` is missing, and there is no single-glyph parenthesized notehead.
- **The "Concatenation Hack":** To achieve parenthesized ghost notes, concatenate the SMuFL characters for left/right parentheses and the notehead into a single string:
  ```javascript
  const glyphs = VF.smufl.to_code_points;
  note.note_heads[i].text = glyphs.accidentalParensLeft + glyphs.noteheadBlack + glyphs.accidentalParensRight;
  ```

## 2. Vite Multi-Page Application (MPA) & Subpaths

### Subpath Routing
If the app is served from a sub-directory (e.g., `/drum_notation/`):
- Set `base: "/drum_notation/"` in `vite.config.ts`.
- Use relative paths for internal HTML links (`href="docs.html"`).

### Multi-Page Configuration
- Set `appType: "mpa"` to stop Vite from forcing SPA fallback.
- Explicitly list all entry points in `build.rollupOptions.input`.

## 3. Debugging Strategy
- **Research First:** Always check `node_modules` source code for the "ground truth" of API implementation.
- **UI Error Catching:** On mobile/headless environments, render `try...catch` errors and internal metadata (like active font lists) directly into the DOM for immediate visibility.
- **Static Documentation Generation:** The `npm run build-docs` command uses a headless JSDOM environment to pre-render `.drum` examples into SVGs for the static documentation.

## 4. DrumMark Spec Review Learnings (2026-04-29)

- **Spec vs. implementation coverage:** A DSL spec can legitimately define language-level support ahead of parser/renderer/exporter coverage. "Not implemented yet" is not the same as "illegal syntax" unless an implementation profile says so explicitly.
- **Canonical duration model:** `divisions` defines the base input unit count per measure, while validation should still be described in exact rational duration terms. Slot language is fine as an equivalent explanation, but it should not replace the canonical fraction model.
- **Measure repeat shorthand:** `%` and `%%` work best as measure-level symbols with their own IR intent (`measureRepeat.slashes`), not as inline trailing operators mixed with normal content.
- **Inline repeat count:** `*N` is clearer and less error-prone when defined as total expanded measure count, not "repeat N more times."
- **Post-refactor residue check:** After token-system refactors, scan merged spec sections for stale statements that still describe the pre-refactor model, such as local crash sugar on `HH` after moving to global magic tokens.

## 5. Header Parser Learnings (2026-04-29)

- **Structural header duplication:** `tempo`, `time`, `divisions`, and `grouping` need the same duplicate-header protection as metadata headers; silently overwriting early header state makes parser behavior depend on source order in a way the spec does not justify.
- **Grouping/header consistency:** parser finalization must validate that explicit `grouping` sums to the `time` numerator even when both fields parse individually, because this is a section 3 header invariant rather than a later rhythmic-validation concern.
- **Irregular meter fallback:** when `time` has no inferred grouping (for example `5/8`), the parser should still return a placeholder grouping in the skeleton so downstream code stays typed, but it must emit a hard missing-header error tied to the `time` line.

## 6. Layout-Syntax Learnings (2026-04-29)

- **Comment transparency:** `#` comments are fully removed before parsing, including comment-only lines and line-end comments on headers or track lines. Comment-only lines must not create paragraph breaks or interfere with header scanning.
- **Whitespace equivalence is semantic, not textual:** tests for section 14 should compare parsed tokens and measure metadata, not raw `measure.content`, because the parser intentionally preserves user formatting in the source text while treating spaces and tabs as structurally insignificant separators.
- **Paragraph boundaries are blank-line driven:** section 14 paragraph splitting is triggered only by blank lines. Multiple blank lines collapse to one boundary, while comments adjacent to a blank separator remain transparent and do not alter the paragraph split.

## 7. Error-Surface Learnings (2026-04-29)

- **Unknown modifier handling should stay atomic:** when the parser sees `:<name>` after a valid glyph and `<name>` is not in `MODIFIERS`, it should emit one `Unknown modifier \`<name>\`` error at the modifier name column and consume the whole modifier token. Otherwise a single typo degrades into a noisy cascade of per-character `Unknown token` errors.
- **Section 15 count floors are parser invariants:** multi-measure rest shorthand must reject `--1--` at parse time with `Multi-measure rest count must be at least 2`; accepting it leaks a spec-invalid construct into later AST / export layers.
- **Column math is based on measure-content offsets:** parser token errors inside measures currently report from the token start within the measure payload, not the left barline. For example, `HH | [x x - - |` reports the unterminated `[` at column 7.

## 8. Atomic-Token Learnings (2026-04-29)

- **Resolution priority must be enforced in normalize, not just track discovery:** section 5.2 is violated if `resolveToken()` applies named-line context before checking static magic tokens. Tokens like `s`, `b`, `r`, `c`, `t1`, `spl`, `cb`, and their accented variants must resolve to their global physical tracks even when written inside another named track line.
- **`p` and `g` are the only local-fallback magic families in Appendix A:** `p/P` stay on the current named track but fall back to `HF` in anonymous lines; `g/G` stay on the current named track with `ghost`, but fall back to `SD` in anonymous lines. Treating them as generic static aliases breaks the spec's context-sensitive behavior.
- **`ST` changes the meaning of `R/L`:** bare `R` normally means ride accent, but in `ST` context or with `ST:` override it must normalize as sticking without implicit `accent`. Accent inference for uppercase token families therefore needs a sticking exception.

## 9. Resolution-Priority Learnings (2026-04-29)

- **Explicit override semantics depend on AST line retention, not only token resolution:** a named line like `HH | SD:d RC:p HF:g |` still has to survive paragraph assembly even if every token is overridden away from `HH`. If AST filling drops that explicit line because no event ultimately lands on its own track, normalize never gets a chance to apply section 5.2 priority rules.
- **Section 5.2 should be tested on mixed token families, not only plain `d`:** the sharp cases are overridden static tokens (`SD:r`), overridden local-fallback tokens (`RC:p`, `HF:g`), and combined hits where each `+` item resolves independently. Those cases catch priority regressions that broad Appendix A token coverage can miss.

## 10. Modifier-Syntax Learnings (2026-04-29)

- **Section 6.1 support is parser-pass-through plus normalize-shape stability:** for the current DSL, all supported modifiers in `MODIFIERS` are parsed uniformly as `:<name>` chains and preserved in event `modifiers`; only the derived `modifier` field applies extra meaning by selecting the first non-`accent` entry.
- **Section 6.2 needs explicit tests for summoned forms and `+` item independence:** `Track:d:<modifier>` uses the same token shape as plain `<token>:<modifier>`, just with `trackOverride`, and combined hits must preserve each item's own override/modifier chain instead of sharing state across the `+`.
- **Multi-track normalization tests should prefer explicit summon syntax over repeated named lines:** repeated lines for the same track in one paragraph exercise paragraph assembly and autofill behavior, which can hide or distort the narrower modifier semantics being tested.

## 11. Duration-Math Learnings (2026-04-29)

- **Section 5.3 parsing is count-based, not sequence-preserving:** the parser currently records duration suffixes as aggregate `dots` and `halves` counts on each basic token. That is enough to preserve all spec-defined forms like `x...`, `x////`, `x../`, and `x.///`, but tests should assert the counts directly rather than assuming any richer suffix AST.
- **Section 5.4 formula already produces reduced exact fractions for deep suffix stacks:** representative cases such as `... -> 15/8`, `//// -> 1/16`, `../ -> 7/8`, and `./// -> 3/16` come out of `calculateTokenWeightAsFraction()` in lowest terms, so normalization can safely compose them into event starts and durations without any floating-point tolerance layer.
- **Exact-math regression tests are strongest when the measure uses mismatched denominators:** a bar like `x... x../ x./// x//// x` forces starts at `15/32`, `11/16`, `47/64`, and `3/4`. That catches both summation drift and any failure to simplify canonical IR fractions.

## 12. Combined-Hit Learnings (2026-04-29)

- **Section 7 whitespace around `+` is semantic sugar, not a token boundary:** the spec example `HH:d + SD:d` should parse the same as `HH:d+SD:d`. Combined-hit detection therefore has to skip inter-item spaces before checking for the next `+` or the next item payload.
- **The shared-start invariant belongs in normalize tests, not just parser shape tests:** parser coverage can prove that `+` groups multiple token payloads, but only normalization asserts the actual section 7 contract that every grouped item becomes its own event with the same `start` and `duration`.

## 13. Group-Semantics Learnings (2026-04-29)

- **Group span is a parser invariant, not an AST fallback:** explicit forms like `[0: d]` or `[2:]` should be rejected while parsing with direct `Group span must be at least 1` / `Empty group` errors. Letting zero-span or zero-item groups reach AST validation produces misleading downstream failures and risks divide-by-zero style math.
- **Not every multi-item group is a tuplet:** section 5.5 distinguishes plain subdivision and stretched dotted/simple durations from true tuplets. In normalized IR, stretched groups like `[3: d d]` and reduced `2:1` / `4:1` compressed ratios such as `[2: d d]` or `[2: d d d d]` should keep `tuplet: null`; only the remaining compressed ratios need `actual:normal` metadata.

## 14. Measure-Validation Learnings (2026-04-29)

- **Section 12 duration mismatches only surface after integer rest autofill has had its chance:** the AST currently auto-pads explicit measures when the remaining weight is a whole-number slot count, so the sharp validation cases are fractional shortfalls or overflows like `7/2` slots in a `divisions 4` bar. Tests that use a plain 1-slot gap will not exercise the hard-error path.
- **Grouping-boundary validation is token-span based at normalize time:** both basic tokens and whole `group` tokens are rejected when their start/end slot fractions straddle a declared grouping boundary. The current stable error surface is `Token \`<glyph|group>\` crosses grouping boundary at <slot> in track <track>`, reported at the measure's source line and column 1.

## 15. Repeat-Barline Learnings (2026-04-29)

- **Section 9.1 barline metadata must survive `parseTrackLine()` normalization:** `parseMeasureTail()` already recognizes `double` and `final`, but if `parseTrackLine()` does not copy `measure.barline` into the returned `ParsedMeasure`, downstream AST / normalize layers silently collapse `||` and `|.` into regular barlines.
- **`||` vs `|  |` is a measure-count distinction as much as a style distinction:** `||` should terminate one measure with `barline: "double"` and start the next measure immediately, while `|  |` should produce a separate empty generated measure between two regular bars. The most stable regression test is therefore `2 measures + double` versus `3 measures + generated middle bar`, not a raw text comparison.

## 16. Repeat-Rule And Volta Learnings (2026-04-29)

- **Repeat and volta declarations are global-bar metadata and cannot be read from the first track opportunistically:** in multi-track or cross-paragraph inputs, the declaring line may not be the first track in paragraph order, and earlier tracks may be auto-generated rests. Normalize therefore has to merge per-bar metadata across all track measures before deriving canonical `barline`, `volta`, `marker`, `jump`, `measureRepeat`, and `multiRest` fields.
- **Same-bar volta declarations must agree across tracks:** because `|1.` / `|1,2.` are global structure, two tracks writing different volta indices on the same global bar is a semantic conflict, not parallel metadata. AST validation should reject that case directly with a stable bar-indexed error instead of letting normalize or MusicXML export pick one arbitrarily.

## 17. Measure-Repeat Learnings (2026-04-29)

- **Section 9.4 standalone-only is a parser rule, not a generic tokenization accident:** when a measure contains `%` alongside ordinary note content, the parser should raise a dedicated `Measure repeat shorthand must occupy the entire measure` error instead of degrading into `Unknown token \`%\``. That keeps the failure aligned with the spec rule the user actually violated.
- **Measure-repeat intent is global-bar metadata like voltas and markers:** once a `%` or `%%` measure is valid, normalized output should preserve `measureRepeat.slashes` even when the shorthand is declared on a non-leading track, as long as the bar has enough preceding non-repeat source measures to satisfy the anti-chaining and lookback rules.

## 18. Navigation-Metadata Learnings (2026-04-29)

- **Section 9.5 has two distinct conflict layers:** cross-track disagreements belong in AST validation as bar-global conflicts (`Conflicting markers/jumps at bar N`), but duplicate navigation tokens inside one physical measure must be rejected earlier in the parser before the second token is silently overwritten.
- **Marker and jump are independent singleton channels:** one measure may legally carry one marker and one jump together, and both should survive normalization even when declared on a non-leading track or in a later paragraph. The invalid cases are only marker-vs-marker and jump-vs-jump multiplicity within the same global bar.

## 19. Multi-Measure-Rest Learnings (2026-04-29)

- **Current enforced minimum count is `2`, not the base spec's `>= 1`:** parser behavior is already hardened by the suite to reject `--1--` with `Multi-measure rest count must be at least 2`. New section 10 tests should align with that enforced rule until the spec and implementation are deliberately reconciled.
- **The parser's multi-rest surface is dash-balanced, not width-sensitive:** any whole-measure payload matching `^-+\\s*<digits>\\s*-+$` becomes multi-rest intent, so compact `--8--`, spaced `- 4 -`, and minimal `-2-` are all accepted, while non-numeric forms like `--x--` fall back to ordinary token parsing rather than producing `multiRestCount`.
- **Canonical IR intent is measure metadata, not generated filler:** once parsed, a multi-rest measure should keep `tokens: []`, skip AST rest autofill, and survive normalize as `multiRest` / `multiRestCount` metadata with no emitted note events, even when the declaration comes from a non-leading track.

## 20. Inline-Repeat Learnings (2026-04-29)

- **Section 11 metadata is directional across the expanded run:** after `*N` expansion, left-edge structure such as `volta` and `marker` belongs on the first generated measure, while right-edge structure such as `jump`, `repeat-end`, and `final/double` barlines belongs on the last generated measure. `*1` is the degenerate case where both sides stay on the same single bar.
- **Invalid inline-repeat counts should be recognized before tokenization:** `*0` and `*-1` are both section 11 count violations and should produce the dedicated `Repeat count must be at least 1` parser error. If the matcher only accepts unsigned digits, negative forms fall through and degrade into misleading `Unknown token \`*\`` / digit errors.

## 21. Track-Registry Learnings (2026-04-29)

- **The canonical track registry is broader than the legacy happy path:** section 4 coverage should assert all 19 currently supported track IDs (`HH HF SD BD T1 T2 T3 RC C ST BD2 T4 RC2 C2 SPL CHN CB WB CL`), not only the later-added multi-character names. That catches accidental regressions in the base single-letter families too.
- **AST registration is intentionally separate from anonymous content routing:** anonymous lines stay as `ANONYMOUS` paragraph entries, while tracks discovered through anonymous fallback, routing scopes, or summon prefixes are registered as named tracks and auto-filled with generated full-measure rests in every paragraph where they are not explicit lines.
- **Normalized track order is inherited from AST global registration order:** because each paragraph is back-filled with the full global named-track set, the first paragraph effectively fixes the final `score.tracks` order. Mixed registration channels therefore need regression tests at the normalized layer to ensure line headers, braced scopes, and `Track:` summons all preserve one shared first-seen ordering.

## 22. Modifier-Legality Learnings (2026-04-29)

- **Appendix B legality has to be enforced after full token resolution:** checking raw syntax is not enough because legality depends on the final physical target track after applying explicit `Track:` override, static magic-token routing, anonymous fallback, and `ST` sticking exceptions.
- **Normalize is the narrowest correct enforcement point for modifier legality:** by the time `normalizeScoreAst()` walks measure tokens, every validation path can reuse `resolveToken()` and recurse through `combined`, `group`, and `braced` tokens without duplicating parser or AST routing logic.
- **Representative coverage should mix positive and negative cases across routing paths:** named-track context catches family-level bans, while summon overrides, static magic tokens like `r:open`, and per-item `+` combined hits prove the validator is using resolved tracks rather than the surrounding line or shared-token context.

## 23. Sticking-Semantics Learnings (2026-04-29)

- **Section 8.2 attachment is per note, not per rhythmic slot:** when several notes share one `start` position, the same `ST` annotation must be emitted on every exported note at that position, including same-voice chords and cross-voice simultaneities. A "render once per slot" strategy violates the spec.
- **Joining multiple `ST` glyphs is a start-position aggregation rule:** if several sticking events normalize to the same `start`, MusicXML should emit one combined fingering string such as `R L` on each simultaneous note rather than splitting the glyphs across different notes.
- **Ignore-if-no-note is naturally enforced at export time:** keeping `ST` events in normalized IR is fine, but MusicXML should only materialize fingering text while rendering actual note entries. Unmatched sticking starts should therefore disappear from the export without needing a separate normalization pass.

## 24. Editor Highlighting Learnings (2026-04-29)

- **The CodeMirror stream highlighter is a separate parser surface:** `src/dslLanguage.ts` does not inherit the real DSL parser's coverage automatically, so spec additions like anonymous lines, `Track:` summons, `Track { ... }` routing scopes, `%`/`%%`, and navigation markers must be added explicitly or they silently fall back to generic identifiers.
- **`%%` is measure-repeat syntax in DrumMark, not a comment prefix:** carrying over `%%` as a comment token from an older grammar directly conflicts with spec section 9.4 and breaks editor feedback on repeat shorthand.
- **Single-token summons and block scopes need state, not regex-only matching:** `ST:R` and `RC{d:bell}` only highlight correctly if the stream parser remembers a pending explicit track or routed scope across subsequent `:` / `{` tokens instead of classifying each token in isolation.

## 25. VexFlow 5 Dot Rendering (2026-04-29)

- **Dots require explicit addition:** In VexFlow 5, even if a duration code includes 'd' (e.g., `"qd"`), the dot will not be rendered visually unless a `Dot` modifier is explicitly added and attached to the note using `Dot.buildAndAttach([note], { all: true })`.
- **Rests also need dots:** The same rule applies to rests. A dotted rest (like a 3/8 dotted quarter rest) must have an attached `Dot` modifier, or it will be visually indistinguishable from a regular rest, leading to visual timing gaps.
- **Duration calculations for dots:** Fractions with numerators of 3 (1.5x base) or 7 (1.75x base) should be mapped to 1 or 2 dots respectively.

## 26. MusicXML Rest Positioning (2026-04-29)

- **Rests need vertical steps:** To prevent rests from colliding with notes in other voices (or overlapping in the same voice), MusicXML `<rest>` elements should include `<display-step>` and `<display-octave>`.
- **Consistency with Renderer:** Following the VexFlow renderer's convention, Voice 1 rests are usually positioned at `B/4` and Voice 2 rests at `F/4` for drum notation.

## 27. DrumMark CLI & Diagnostics (2026-04-29)

- **Isolate the Pipeline:** When a bug is reported, use the `drummark` CLI to dump the Intermediate Representation (IR), MusicXML, and SVG separately. This allows you to immediately determine if the bug is in the **Parser/Normalization** phase (incorrect IR), the **Exporter** (incorrect XML), or the **Renderer** (incorrect SVG/VexFlow logic).
- **Reproduction Scripts:** Creating a minimal `.drum` file and running it through `npm run drummark` is faster and more reliable for verification than manual testing in the full web application.
