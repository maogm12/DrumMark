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
