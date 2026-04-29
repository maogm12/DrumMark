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
