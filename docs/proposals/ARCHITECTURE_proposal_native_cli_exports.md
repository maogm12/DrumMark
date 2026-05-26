## Addendum v1.0: Native Rust CLI Export Pipeline

### Summary

Add a first-class native Rust command line tool for DrumMark that reads `.drum` source and exports notation artifacts without requiring the TypeScript/Node CLI path. The tool supports at least `musicxml`, `svg`, and `pdf`, and may retain developer-oriented `ast` and `ir` formats for diagnosis.

### Goals

- Provide a native binary named `drummark` that can be built and run with Cargo.
- Support input from a file path or stdin.
- Support output to stdout for text formats and to a file for all formats.
- Support `--format musicxml|xml|svg|pdf|ir|ast`, with `xml` as an alias for `musicxml`.
- Reuse the existing Rust parser, normalizer, MusicXML exporter, render-score derivation, and `RenderScore -> LayoutScene` layout engine.
- Keep score engraving decisions inside `drummark-layout`; exporters only translate `LayoutScene` primitives into target formats.
- Surface parser and normalization diagnostics on stderr while still producing output when the current lossy pipeline can produce a score.

### Non-Goals

- Do not add new DrumMark language syntax.
- Do not change `RenderScore` or `LayoutScene` semantics unless a concrete exporter bug requires a separately reviewed contract change.
- Do not make the SVG or PDF exporters invent missing score elements outside the layout engine.
- Do not replace the existing TypeScript UI or browser rendering path in this proposal.
- Do not promise full MusicXML-to-PDF fidelity parity with external notation applications; PDF should reflect DrumMark's own `LayoutScene`.

### Workspace Shape

Create a new workspace crate:

```text
crates/drummark-cli/
  Cargo.toml
  src/main.rs
  src/args.rs
  src/export.rs
  src/svg.rs
  src/pdf.rs
  src/json.rs
```

The root `Cargo.toml` includes `crates/drummark-cli` as a workspace member. The CLI crate depends on:

- `drummark-core` for parser, normalization, render-score derivation, and MusicXML.
- `drummark-layout` for `LayoutScene` creation and layout options.
- A lightweight argument parser, preferably `clap`, for stable help text and error handling.
- A JSON serializer only if needed for stable native `ast` and `ir` output.
- A PDF/SVG conversion or PDF writing crate selected during implementation research. The selected crate must support embedding or referencing a SMuFL-capable font path, or the implementation must document a tested fallback.

The existing `[[bin]]` entry in `drummark-core` should either be removed after migration or become a compatibility shim only if downstream scripts still invoke it directly. The package-level script `npm run drummark:native` should point to the new CLI package.

### Command Contract

Primary usage:

```text
drummark [OPTIONS] [INPUT]
```

Options:

```text
-f, --format <FORMAT>   Output format: musicxml, xml, svg, pdf, ir, ast
-o, --output <PATH>     Output file path
--stdin                 Read source from stdin
--page-width <PT>       Page width in points
--page-height <PT>      Page height in points
--margin <PT>           Set all margins in points
--hide-voice2-rests     Omit visible secondary voice rests where supported
-h, --help              Show help
```

Input rules:

- If `INPUT` is present, read that file.
- If `--stdin` is present or `INPUT` is absent, read stdin.
- If both `INPUT` and `--stdin` are present, return a CLI usage error.

Output rules:

- `musicxml`, `xml`, `svg`, `ir`, and `ast` may write to stdout when `--output` is absent.
- `pdf` requires `--output` unless a tested stdout-safe binary output path is implemented.
- If `--output` is absent for `svg` or `musicxml`, stdout is the default. The old TypeScript convention of deriving an output path remains a TypeScript CLI behavior unless intentionally ported later.
- Successful file writes print a concise confirmation to stderr, not stdout, so stdout remains scriptable.

Exit codes:

- `0`: output was produced successfully.
- `1`: input, parser, normalization, layout, or export failure.
- `2`: CLI usage error.

### Internal Pipeline

Shared pipeline:

```text
source
  -> Parser::parse_lossy()
  -> normalize_document()
  -> derive_render_score()
  -> drummark_layout::build_layout_scene()
  -> exporter
```

Format-specific behavior:

- `musicxml`/`xml`: use `drummark_core::musicxml::build_music_xml(&score, hide_voice2_rests)` directly from the normalized score.
- `svg`: convert each `LayoutScene` page into SVG. The initial implementation may emit page 0 by default, matching the current TypeScript `renderSceneToSvg` CLI behavior, but must document this limitation in help text or tests. A future `--pages split|all|first` option can extend this.
- `pdf`: render all `LayoutScene` pages into one PDF document, preserving page dimensions. Glyph and text output must use a configured font strategy rather than replacing music glyphs with placeholders.
- `ir`: serialize the Rust normalized score or render score with a stable envelope.
- `ast`: serialize the Rust parser AST with a stable envelope equivalent in intent to the TypeScript CLI AST output.

### Exporter Boundaries

The SVG exporter may translate only these `LayoutScene` primitives:

- `GlyphRun` -> SVG `<text>` using `smufl_codepoint`.
- `TextRun` -> SVG `<text>`.
- `LineSegment` -> SVG `<line>`.
- `Rect` -> SVG `<rect>`.
- `Polyline` -> SVG `<polyline>`.
- `Path` -> SVG `<path>`.

Composite fallback drawing is allowed only for composites that the current TypeScript SVG adapter already draws (`repeatSpan`, `volta`) and only as a direct translation of composite anchors. New composite drawing rules require a separate layout contract proposal if they add engraving behavior.

The PDF exporter may either:

- translate the same `LayoutScene` primitives directly into PDF drawing operations, or
- reuse the SVG exporter and convert SVG pages to PDF, provided the conversion path preserves text/glyph output and page dimensions in tests.

### Tests And Verification

Add Rust integration tests under `crates/drummark-cli/tests/` using small `.drum` fixtures. Required coverage:

- `--format musicxml` emits `<score-partwise` and drumset part metadata.
- `--format svg` emits `<svg`, staff lines, and notehead roles.
- `--format pdf --output score.pdf` creates a non-empty PDF whose header starts with `%PDF`.
- stdin input works for at least one text format.
- invalid flags return exit code `2`.
- malformed but recoverable source surfaces diagnostics on stderr and still produces lossy output when possible.

Run verification:

```text
cargo test -p drummark-cli
cargo test -p drummark-core
cargo test -p drummark-layout
npm run drummark:native -- docs/examples/overview.drum --format svg --output /tmp/overview.svg
npm run drummark:native -- docs/examples/overview.drum --format musicxml --output /tmp/overview.musicxml
npm run drummark:native -- docs/examples/overview.drum --format pdf --output /tmp/overview.pdf
```

### Documentation

Document the native CLI in the appropriate project docs after implementation:

- Build/run command.
- Supported formats.
- stdin/stdout behavior.
- PDF font behavior and any required font asset.
- Known limitations, especially multi-page SVG behavior if only first-page SVG is initially exposed.

### Risks

- Native AST/IR JSON may require adding serialization derives to a broad set of parser and normalized types. If that blast radius is too high, `ast` and `ir` should be marked developer-preview and implemented with explicit DTO conversion instead of blanket derives.
- PDF font handling is the highest-risk part. Implementation must prototype the selected PDF strategy before committing to broad exporter code.
- The existing feature name `layout-wasm` gates `render_score` in `drummark-core` even though a native CLI also needs it. Implementation should avoid expanding misleading naming unless it is addressed deliberately in the tasks file.

### Local Review Round 1

Reviewer context: the required sub-agent review could not complete because the spawned agent failed before writing to the file. This local review is a fallback critique and does not satisfy the repository's mandatory sub-agent approval requirement.

Findings:

- The proposal leaves the workspace binary collision under-specified. `drummark-core` already has a `[[bin]] name = "drummark"`; adding a second package with the same binary name may be fine for `cargo run -p drummark-cli`, but packaging/install behavior and script targets need an explicit migration rule.
- The feature story is too vague. `render_score` is behind `layout-wasm`, and `drummark-core` currently depends on `wasm-bindgen` in its default feature set. A native CLI should not accidentally inherit wasm-oriented feature names or unnecessary wasm exports just to reach render-score derivation.
- The SVG multi-page behavior is ambiguous. The proposal says "convert each page" but then allows page 0 only. The command contract should define a deterministic initial behavior, preferably one SVG document containing all pages or an explicit first-page limitation.
- The PDF font strategy remains a large open hole. "SMuFL-capable font path" is not enough; implementation needs to know whether Bravura is embedded, referenced, or converted to outlines, and tests should fail if glyphs degrade to tofu/placeholders.
- Diagnostics and exit codes are underspecified for lossy parse output. If parser or normalization errors are emitted but output is still produced, the proposal should define whether exit code stays `0` or becomes `1`.
- `ast` and `ir` are included in the CLI scope but are not part of the user's primary ask. Keeping them in the first implementation increases serialization blast radius; the proposal should explicitly treat them as optional/developer formats that must not block `musicxml`/`svg`/`pdf`.

STATUS: CHANGES_REQUESTED

### Author Response

- Font subsetting is now a hard gate, not a best-effort preference. Task 3 must select dependencies that support deterministic subset embedding for `public/fonts/bravura.otf` and for at least one accepted CJK font input. If the prototype cannot prove subsetting for both required font classes, implementation stops and the design must be amended again before Task 6.
- Explicit font overrides are strict. If `--font <PATH>` is provided and the path is unreadable, incompatible, lacks required glyph coverage, or cannot be subset-embedded, PDF export fails with exit code `1` and does not fall back to workspace Bravura. If `--cjk-font <PATH>` is provided for CJK text and is unreadable, incompatible, lacks required glyph coverage, or cannot be subset-embedded, PDF export fails with exit code `1` and does not fall back to platform candidates.
- Platform CJK candidates are used only when CJK text exists and `--cjk-font` is absent. The prototype must record the exact candidate paths and accepted formats in `LEARNINGS.md`. An unembeddable TTC candidate is treated as unavailable, not as a reason to render degraded output.
- Mixed-script `TextRun` values are split into contiguous font runs while preserving character order. Non-CJK runs use the Bravura subset; CJK runs use the CJK sans/Hei subset. The implementation must preserve the original `TextRun` baseline and advance each run in sequence according to measured text width from the selected font.
- CJK success tests are CI-safe: a success fixture runs when `DRUMMARK_TEST_CJK_FONT` points to a readable embeddable CJK font or when the prototype-documented platform candidate is available. If neither exists, the success test is skipped with a clear reason. The explicit missing CJK font failure test always runs by passing a deliberately invalid `--cjk-font` path with CJK source text.

### Author Response

- Binary migration will be narrowed: `crates/drummark-cli` owns the production native command, `npm run drummark:native` points to `cargo run -p drummark-cli --bin drummark --`, and the old `drummark-core` bin is removed or renamed in the same task once no checked-in script depends on it.
- Feature cleanup becomes an explicit requirement: expose render-score derivation through a native-appropriate feature such as `layout` or make it available from the `rlib` path without wasm naming. The CLI must not depend on `wasm-bindgen` APIs to render native output.
- Initial SVG behavior is now defined as single-document SVG containing all pages stacked vertically, unless the selected PDF/SVG strategy proves this impractical during Task 1. If it is impractical, the implementation must add an explicit `--pages first` behavior and document it before enabling `svg`.
- PDF must use the checked-in Bravura font assets under `public/fonts/` when available. The prototype must prove either font embedding or outline conversion and add a regression check that the output path does not contain placeholder fallback text for glyph runs.
- Lossy diagnostics are warnings when output is produced successfully. Exit code `0` means output was written; exit code `1` is reserved for failures that prevent output or explicit validation failures.
- `ast` and `ir` are developer formats. They may be implemented after the primary export formats and must not block delivery of `musicxml`, `svg`, and `pdf`.

### Review Round 2

Reviewer stance: constructively hostile architecture review of the Author Response against Local Review Round 1. The response closes several important gaps, especially lossy diagnostic exit behavior and the need to remove native dependence on wasm-facing APIs. It is not yet approval-ready because several fixes remain response-level intentions rather than a sufficiently deterministic command and implementation contract.

Findings:

- The SVG command contract is still unstable. The Author Response says initial behavior is all pages stacked vertically, then allows Task 1 to replace that with `--pages first` if impractical. That leaves implementation permission to change the public CLI shape after approval. The proposal should choose one approved initial contract now: either always emit a single multi-page SVG document, or explicitly add `--pages first|all` with default behavior and tests. Do not leave this as a prototype-time contract fork.
- PDF font strategy remains under-specified for approval. "Use checked-in Bravura when available" weakens the guarantee because the repo already has `public/fonts/`; the native CLI needs an explicit source path/resolution rule and an explicit failure/fallback rule. The proposal should state whether Bravura is embedded, subset, converted to outlines, or copied/referenced, and what happens if the font cannot be found in packaged/install contexts.
- The developer format contract conflicts with the command contract. The main contract lists `--format ir|ast` as supported, while the Author Response says they may come after primary formats and must not block delivery. That is reasonable product scoping, but the approved proposal must say whether the first implementation exposes these flags, hides them, or returns a clear "not implemented" error. Otherwise tests, help text, and release behavior can diverge.
- Binary migration is improved but still leaves one packaging edge unresolved: if `drummark-core` retains a compatibility bin, the proposal must define whether `cargo install --path .` or workspace package selection can expose two `drummark` binaries. "Removed or renamed or shim" is acceptable only if the final implementation task has a single success rule that prevents duplicate production binary ownership.
- Feature gating is directionally fixed but still too vague around default features. The proposal should explicitly require that `drummark-cli` builds on the native target without pulling wasm-only exports or requiring `wasm-bindgen` entrypoints. If the chosen solution is a new `layout` feature, say whether `layout-wasm` remains, aliases it, or is split.
- The PDF verification criterion "does not contain placeholder fallback text" is not enough by itself. A PDF can omit extractable text and still be valid if glyphs are outlines. The proposal should define the regression check in terms of the selected strategy: embedded/subset font has a detectable font resource and non-placeholder glyph drawing, while outline conversion has non-empty vector paths for glyph runs.

Required changes before approval:

- Append a small `Author Response` that pins the SVG page behavior and `ast`/`ir` exposure for the first implementation.
- Make the Bravura strategy and missing-font behavior deterministic enough that implementation cannot silently degrade notation glyphs.
- Convert the binary and feature-gating language from alternatives into acceptance-level constraints.

STATUS: CHANGES_REQUESTED

### Author Response

- SVG page behavior is pinned for the first implementation: `--format svg` supports `--pages all|first`, with `all` as the default. `all` emits one SVG document containing every `LayoutScene` page as translated page groups stacked vertically with a fixed page gap; the SVG width is the maximum page width and the SVG height is the sum of page heights plus gaps. `first` emits only page 0. Tests must cover the default and `--pages first`.
- First implementation format support is narrowed to `musicxml`, `xml`, `svg`, and `pdf`. `ast` and `ir` are removed from first-release help text and tests. Native `ast`/`ir` may be added later through a separate task or proposal update after primary exports are working.
- PDF font behavior is pinned: native PDF output must embed the checked-in Bravura font, resolved from an explicit `--font <PATH>` when supplied or from the repository asset path `public/fonts/Bravura.otf` when running from the workspace. If no readable Bravura font is found, PDF export fails with exit code `1`; it must not silently substitute another font or emit placeholder glyph text. If implementation research proves that the checked-in filename differs, the chosen path must be documented in `LEARNINGS.md` before PDF export is completed.
- PDF verification is strategy-specific: because the first implementation uses embedded Bravura rather than outline conversion, tests must verify a `%PDF` header, non-empty page content, and a detectable Bravura font resource or font name in the PDF bytes. Placeholder text checks are supplementary, not the primary proof.
- Binary ownership is pinned: after migration, only `crates/drummark-cli` may expose a binary named `drummark`. The old `drummark-core` binary must be removed or renamed to a non-production debug name; no workspace package may retain a second production `drummark` bin.
- Feature gating is pinned: `drummark-core` should expose render-score derivation behind a native-appropriate `layout` feature. `layout-wasm` may remain for WASM exports but should depend on `layout` rather than being the only route to `render_score`. `drummark-cli` must depend on native library APIs and must not call `wasm_bindgen` entrypoints.

### Review Round 3

Reviewer stance: constructively hostile approval review limited to the Review Round 2 blockers and the latest appended Author Response.

Findings:

- SVG page behavior is now pinned tightly enough for implementation. The first release supports `--pages all|first`, defaults to `all`, defines stacked page geometry, and requires tests for both default behavior and `--pages first`. This removes the previous prototype-time public-contract fork.
- PDF font behavior is deterministic enough to implement and test. The response requires embedded Bravura, defines `--font <PATH>` precedence over the workspace asset path, requires exit code `1` when no readable Bravura is available, and forbids silent substitution or placeholder glyph output. The remaining packaging nuance is an implementation/docs concern, not an architecture blocker, because failure behavior is explicit.
- The first implementation no longer ambiguously advertises `ast` or `ir`. Removing them from first-release help text and tests avoids the prior conflict between the command contract and optional developer serialization scope.
- Binary ownership and feature gating have been converted from alternatives into acceptance-level constraints. Only `drummark-cli` may expose the production `drummark` binary, `layout` becomes the native render-score feature, `layout-wasm` may build on it, and the CLI must avoid `wasm_bindgen` entrypoints.
- The proposal now avoids SVG-mediated PDF ambiguity by selecting embedded-Bravura PDF output as the first implementation strategy. SVG and PDF may share primitive helpers, but PDF is not contractually dependent on the full SVG exporter.

No Round 2 blocker remains open in the proposal text. During implementation, reviewers should still verify that "detectable Bravura font resource/name" is a meaningful check for the selected PDF crate and not a brittle byte-string coincidence, but that is test-design rigor rather than a reason to reopen the design.

STATUS: APPROVED

### Consolidated Changes

The approved native CLI design adds a Rust-owned `drummark` command in a new `crates/drummark-cli` workspace crate. The CLI reads DrumMark source from a file or stdin and supports first-release formats `musicxml`, `svg`, `pdf`, `ast`, `ir`, and `scene`. The `xml` alias is intentionally not supported. `ast`, `ir`, and `scene` are developer/debug JSON outputs with unstable schemas.

The native CLI must use Rust-owned parser, normalizer, MusicXML, render-score, and layout APIs. `drummark-core` exposes render-score derivation through a native `layout` feature, with `layout-wasm` depending on that feature instead of being the only route to render-score access. The CLI must not call `wasm_bindgen` entrypoints. Only `crates/drummark-cli` may expose a production binary named `drummark`.

SVG and PDF exports always include the complete score. SVG emits one stacked SVG document containing every `LayoutScene` page. PDF emits every `LayoutScene` page as a separate PDF page while preserving page dimensions. No first-release `--pages` option is exposed.

PDF output uses deterministic font subsetting. Bravura is resolved from explicit `--font <PATH>` or from `public/fonts/bravura.otf`; explicit invalid font paths fail without fallback. Notation `GlyphRun` output uses Bravura and fails if required notation glyphs are missing. `TextRun` output is split by Bravura glyph coverage: covered runs use Bravura, uncovered runs use a fallback Hei/CJK sans font from explicit `--fallback-font <PATH>` or documented platform candidates only when needed. Invalid explicit fallback paths fail without platform fallback. If any required text glyph lacks a subset-embeddable covering font, PDF export fails rather than emitting tofu or viewer-dependent substitution.

The implementation plan includes a pre-implementation consolidation task, CLI crate setup, native core feature/bin cleanup, font/PDF/SVG strategy prototype, shared parse/export pipeline, native SVG/PDF exporters, developer JSON outputs, integration tests, documentation, pre-merge review, and post-merge archival.

### Author Response

User-requested amendment after Round 8 approval: add raw layout scene debug output and change PDF text font routing from script-based routing to glyph-coverage-based routing.

- First-release `--format` values are `musicxml`, `svg`, `pdf`, `ast`, `ir`, and `scene`.
- `scene` emits the raw `LayoutScene` JSON produced by `drummark-layout` after `RenderScore -> LayoutScene`. It is a developer/debug format with an unstable schema, like `ast` and `ir`.
- `scene` may write to stdout by default and supports `--output`.
- PDF `GlyphRun` notation output still uses Bravura and must fail if required notation glyphs are missing.
- PDF `TextRun` output now routes by actual glyph coverage, not by script. For each text run, consecutive characters covered by Bravura use the Bravura subset. Consecutive characters not covered by Bravura use a fallback Hei/CJK sans subset.
- Replace the narrow `--cjk-font <PATH>` flag with `--fallback-font <PATH>` for the text fallback font. The fallback font is used for any text glyph missing from Bravura, not only CJK.
- Explicit `--fallback-font <PATH>` is strict: if supplied and unreadable, incompatible, missing required fallback glyphs, or not subset-embeddable, PDF export fails with exit code `1` and does not fall back to platform candidates.
- If `--fallback-font` is absent, platform fallback candidates may be used only when text contains glyphs not covered by Bravura. Candidate paths and accepted formats must be documented by the prototype. An unembeddable candidate is treated as unavailable.
- If any text glyph is missing from Bravura and no readable, glyph-covering, subset-embeddable fallback font is available, PDF export fails with exit code `1`; it must not render tofu or silently substitute a PDF viewer font.

### Author Response

User-requested amendment after Round 7 approval: remove the `xml` alias from the first-release CLI. The command should expose only the explicit `musicxml` format name for MusicXML output.

- First-release `--format` values are `musicxml`, `svg`, `pdf`, `ast`, and `ir`.
- `xml` is not accepted as an alias in the native Rust CLI first release.
- Help text and docs should use only `musicxml`.
- Tests should verify `--format musicxml` works. They do not need to preserve TS CLI `xml` compatibility.

### Author Response

User-requested amendment after Round 6 approval: include developer-oriented `ast` and `ir` formats in the first-release CLI because the tool is currently for the project author's own use.

- First-release `--format` values are `musicxml`, `xml`, `svg`, `pdf`, `ast`, and `ir`.
- `xml` remains an alias for `musicxml`.
- `ast` emits a parser AST JSON envelope intended for debugging parser behavior.
- `ir` emits a normalized/render-ready JSON envelope intended for debugging normalization and layout inputs.
- `ast` and `ir` are explicitly developer formats. Their JSON schemas are unstable and may change with parser, normalizer, or render-score internals. Help text and docs must say they are not stable external interchange formats.
- `ast` and `ir` may write to stdout by default and support `--output` like the text formats.
- Primary export guarantees still center on `musicxml`, `svg`, and `pdf`; adding `ast`/`ir` must not weaken the PDF font-subsetting requirements or complete-score SVG/PDF behavior.

### Author Response

User-requested amendment after Round 5 approval: remove the `--pages` option from the first-release CLI. A command line export should produce the complete score by default; page slicing is a debug/developer concern and should not be part of the primary export contract.

- `--format svg` always emits every `LayoutScene` page in one SVG document. Pages are stacked vertically with a fixed page gap. The SVG width is the maximum page width and the SVG height is the sum of page heights plus page gaps.
- `--format pdf` always emits every `LayoutScene` page as separate PDF pages preserving each page's dimensions.
- The first-release CLI does not expose `--pages all|first`. If a future debug workflow needs single-page SVG output, it should be added as a separate developer-oriented option after review.
- Tests and docs should remove `--pages first` coverage and instead verify that multi-page SVG/PDF exports include all pages.

### Author Response

User-requested amendment after Round 3 approval: PDF font handling should use font subsetting and route text by script. This changes the approved PDF font strategy and therefore requires another review round before user stamp.

- PDF export should subset fonts rather than embed full font files when the selected PDF crate supports subsetting for the relevant font format.
- `GlyphRun` music notation output uses the Bravura subset. The workspace Bravura path is `public/fonts/bravura.otf`; `--font <PATH>` remains the override for notation/Bravura output.
- Non-CJK `TextRun` output uses Bravura by default for the first implementation, matching the requested "English and notation symbols use Bravura" rule. The exporter must verify that the chosen Bravura font covers the required text glyphs; if it does not, PDF export fails with a clear error rather than silently substituting another font.
- CJK characters in `TextRun` output use a CJK sans/Hei font subset. Add `--cjk-font <PATH>` for an explicit embeddable CJK font. When `--cjk-font` is absent, the CLI may try documented platform candidates such as `/System/Library/Fonts/STHeiti Medium.ttc` on macOS, but only if the selected PDF crate can embed/subset that font format.
- If the score contains CJK text and no readable, embeddable CJK font is available, PDF export fails with exit code `1`. SVG output remains unaffected because SVG can reference font families.
- PDF tests should include a CJK title fixture when a CJK font is available. The test must verify successful PDF generation with `--cjk-font` or a documented platform candidate, and a missing-font failure path for CJK text.

### Review Round 4

Reviewer stance: constructively hostile review limited to the v1.3 post-approval font amendment.

Findings:

- The Bravura path correction is good. The amendment now names the actual checked-in lowercase workspace asset, `public/fonts/bravura.otf`, rather than the earlier capitalized path. That is implementation-ready and should be carried into docs and tests.
- Font precedence is mostly clear but needs one explicit failure rule: if `--font` is supplied and unreadable, incompatible, missing required glyphs, or not subset-embeddable, PDF export must fail and must not fall back to `public/fonts/bravura.otf`. Likewise, if `--cjk-font` is supplied for CJK text and is unreadable, incompatible, missing required glyphs, or not subset-embeddable, PDF export must fail and must not silently continue to platform candidates. Platform CJK candidates should be considered only when `--cjk-font` is absent.
- The subsetting requirement is not deterministic enough yet. "Should subset fonts rather than embed full font files when the selected PDF crate supports subsetting" leaves an implementation escape hatch that can still ship full-font embedding. Because the user-requested strategy is subsetting, the approved contract should require selecting a PDF/font stack that supports deterministic subsetting for Bravura OTF and for the accepted CJK font format, or failing the prototype and changing the design before implementation proceeds.
- Mixed-script `TextRun` handling is underspecified. The amendment says CJK characters use Hei/CJK sans and non-CJK text uses Bravura, but it does not say whether a single `TextRun` containing both English and CJK is split into font runs preserving order and positioning. Without that rule, an implementation could route the whole run to one font and violate either the English-Bravura or CJK-Hei requirement.
- CJK behavior correctly rejects silent substitution in principle, but platform-candidate discovery is still a risk. The proposal should require candidate font paths and accepted formats to be documented by the prototype, and should define that an unembeddable TTC candidate is treated as unavailable rather than attempted with degraded output.
- The test requirement is not CI-safe yet. "When a CJK font is available" needs a skip/failure contract: either include/use a known test CJK font asset, require an environment variable such as `DRUMMARK_TEST_CJK_FONT`, or mark the success test skipped when no documented embeddable CJK font is available while still always testing the explicit missing-font failure path. As written, the success test can become host-dependent.

Required changes before approval:

- Replace conditional subsetting language with a hard prototype gate: no production PDF exporter until selected dependencies can subset the required Bravura and CJK fonts, or the design is amended again.
- State explicit override failure behavior for `--font` and `--cjk-font`, including no fallback after an invalid explicit path.
- Define mixed-script `TextRun` splitting/routing semantics.
- Add a deterministic CJK test-font contract or an explicit skip contract for environments without an embeddable CJK font.

STATUS: CHANGES_REQUESTED

### Review Round 5

Reviewer stance: constructively hostile review limited to whether the latest Author Response closes the Round 4 font-routing blockers.

Findings:

- The subsetting requirement is now a hard gate. The response requires Task 3 to select dependencies that support deterministic subset embedding for `public/fonts/bravura.otf` and at least one accepted CJK font input, and it requires the design to stop and be amended again before Task 6 if the prototype cannot prove both.
- Explicit font override precedence is strict enough. Invalid, unreadable, incompatible, uncovered, or non-subset-embeddable `--font` fails with exit code `1` and cannot fall back to workspace Bravura; the same class of invalid `--cjk-font` fails with exit code `1` and cannot fall back to platform candidates.
- Platform CJK discovery is constrained to the safe case. Candidates are used only when CJK text exists and `--cjk-font` is absent, the prototype must record exact candidate paths and accepted formats in `LEARNINGS.md`, and unembeddable TTC candidates are treated as unavailable rather than degraded output.
- Mixed-script routing is now concrete enough for implementation. `TextRun` values are split into contiguous CJK and non-CJK runs, preserve character order and the original baseline, and advance each run sequentially using measured width from the selected font.
- CJK tests have a deterministic host contract. Success coverage runs with `DRUMMARK_TEST_CJK_FONT` or a documented platform candidate, skips with a clear reason if neither exists, and the invalid explicit `--cjk-font` failure path always runs.

No Round 4 proposal blocker remains open. The remaining responsibility is implementation discipline: the prototype and tests must prove actual subset embedding for the selected PDF/font stack rather than treating nominal crate support as sufficient.

STATUS: APPROVED

### Review Round 6

Reviewer stance: constructively hostile review limited to the v1.5 complete-score export amendment and its coherence with the already-approved font-routing contract.

Findings:

- The v1.5 SVG contract is coherent and implementation-ready. It removes page selection from the first-release CLI and requires `--format svg` to emit every `LayoutScene` page in one stacked SVG document, with width equal to the maximum page width and height equal to the sum of page heights plus fixed inter-page gaps.
- The v1.5 PDF contract is coherent and complementary to the font-routing amendments. It requires `--format pdf` to emit every `LayoutScene` page as a separate PDF page while preserving each page's dimensions; this does not conflict with Bravura/CJK subsetting, glyph coverage validation, or mixed-script `TextRun` routing.
- Removing `--pages all|first` from the first release is internally consistent with the user's product goal: primary CLI exports produce the complete score by default, and single-page slicing is reserved for a future developer/debug option that would need separate review.
- The amendment cleanly supersedes the older Round 3 `--pages all|first` approval. Implementation should treat any earlier proposal text requiring `--pages first` help text or tests as obsolete for the first-release contract.
- Multi-page tests are feasible at the proposal level because both SVG and PDF assertions can be made against layout page cardinality: SVG can verify multiple page groups/stacked page extents in one document, and PDF can verify page count and page dimensions from the generated PDF structure.

No v1.5 proposal blocker remains open. The complete-score export amendment is precise enough to implement without adding hidden CLI behavior or leaving stale `--pages` documentation requirements in the latest contract.

STATUS: APPROVED

### Review Round 7

Reviewer stance: constructively hostile review limited to the v1.6 amendment that restores first-release `ast` and `ir` developer formats after the Round 6 approval.

Findings:

- The v1.6 amendment clearly frames `ast` and `ir` as developer/debug outputs rather than stable interchange formats. It says `ast` emits a parser AST JSON envelope for debugging parser behavior, `ir` emits normalized/render-ready JSON for debugging normalization and layout inputs, and both schemas are unstable.
- Help and documentation expectations are bounded correctly. The amendment requires help text and docs to say these JSON schemas are not stable external interchange formats, so implementation should avoid language such as "public schema", "interchange", "compatible", or "versioned" for `ast`/`ir`.
- Adding `ast` and `ir` does not weaken the primary export contract. The amendment explicitly preserves primary guarantees for `musicxml`, `svg`, and `pdf`, and it does not alter complete-score behavior for SVG/PDF or the existing PDF font-subsetting, glyph-coverage, CJK routing, and failure requirements.
- `xml` alias behavior remains clear. The first-release format list includes both `musicxml` and `xml`, and v1.6 restates that `xml` remains an alias for `musicxml`; no separate XML dialect or second exporter is implied.
- The stdout/output behavior is coherent for developer JSON formats. Allowing `ast` and `ir` to write to stdout by default and to support `--output` matches their text-oriented debugging role and does not conflict with binary PDF output or file-oriented SVG/MusicXML exports.
- The amendment cleanly supersedes the earlier Round 3 narrowing that removed `ast` and `ir` from first-release help/tests. Implementation should treat that older exclusion as obsolete only for these two developer formats, while preserving the older reason for caution by keeping schema assertions intentionally shallow.

No v1.6 proposal blocker remains open. The restored `ast` and `ir` formats are implementation-ready as unstable developer outputs, provided help, docs, and tests do not accidentally promote them into stable public interchange contracts.

STATUS: APPROVED

### Review Round 8

Reviewer stance: constructively hostile review limited to the v1.7 amendment that removes the `xml` alias after the Round 7 approval.

Findings:

- The v1.7 amendment clearly supersedes the v1.6 `xml` alias language. The first-release format set is now exactly `musicxml`, `svg`, `pdf`, `ast`, and `ir`; `xml` is not a compatibility alias or secondary spelling for MusicXML in the native Rust CLI.
- The invalid-format behavior is sufficiently clear when read with the companion task amendment: `xml` should flow through the same invalid-format path as any unsupported format rather than reaching the MusicXML exporter. This avoids preserving old TS CLI compatibility by accident.
- Help text and docs are correctly constrained to the explicit `musicxml` spelling. The amendment does not leave room for examples, aliases, migration notes, or tests that continue advertising `xml` as supported first-release behavior.
- The amendment does not disturb the complete-score export contract. SVG remains an all-pages stacked single SVG document, and PDF remains all `LayoutScene` pages as separate PDF pages with preserved page dimensions.
- The amendment does not weaken the approved PDF font requirements. Bravura/CJK subset embedding, strict explicit-font failure behavior, mixed-script routing, and CJK test skip semantics remain unchanged.
- The restored `ast` and `ir` developer scope remains coherent. They stay first-release debug formats with unstable JSON schemas, and removing `xml` does not promote them into stable interchange outputs or make them prerequisites for SVG/PDF export.

No v1.7 proposal blocker remains open. Implementation should treat any earlier `xml` alias statements in Round 7/v1.6 as obsolete and use `musicxml` as the only accepted MusicXML format name.

STATUS: APPROVED

### Review Round 9

Reviewer stance: constructively hostile review limited to the v1.8 amendment after Round 8 approval, specifically the new raw scene debug output and the Bravura coverage-based PDF text font routing.

Findings:

- The `scene` format is defined clearly enough for implementation. It emits the raw `LayoutScene` JSON produced by `drummark-layout` after `RenderScore -> LayoutScene`, is explicitly developer/debug output, and has an unstable schema like `ast` and `ir`. That avoids accidentally promoting layout internals into a public interchange contract.
- The first-release format set is coherent after the amendment: `musicxml`, `svg`, `pdf`, `ast`, `ir`, and `scene`. The v1.8 list includes `scene` while preserving the Round 8 removal of `xml`; implementation should still reject `xml` as unsupported rather than treating it as a MusicXML alias.
- Replacing `--cjk-font` with `--fallback-font` is the correct abstraction for the revised routing rule. The fallback font is now tied to glyphs missing from Bravura rather than to CJK script classification, so the older CJK-only wording is superseded by the broader fallback-font behavior.
- Coverage-based `TextRun` splitting is concrete enough to implement. The amendment requires contiguous runs based on actual Bravura glyph coverage, routes covered characters to the Bravura subset, routes uncovered characters to the fallback Hei/CJK sans subset, and preserves character order, baseline, and measured sequential advance.
- Explicit font failures remain strict. Invalid explicit `--font` still fails notation/Bravura output without falling back to workspace Bravura, and invalid explicit `--fallback-font` fails without trying platform candidates. The proposal also correctly fails when uncovered text glyphs have no readable, glyph-covering, subset-embeddable fallback font.
- Platform fallback candidates are safely constrained. They may be used only when `--fallback-font` is absent and text actually contains glyphs not covered by Bravura; candidate paths and accepted formats must be documented by the prototype, and unembeddable candidates are treated as unavailable rather than degraded output.
- The v1.8 amendment does not weaken the approved PDF subsetting or complete-score export requirements. `GlyphRun` notation output still uses Bravura with required glyph coverage, text output still requires subset-embeddable fonts, SVG/PDF still export complete scores, and `scene` remains an additional debug output rather than a dependency that narrows primary exports.

No v1.8 proposal blocker remains open. Implementation should treat earlier script-based CJK routing and `--cjk-font` language as obsolete wherever it conflicts with the latest coverage-based fallback-font contract.

STATUS: APPROVED
