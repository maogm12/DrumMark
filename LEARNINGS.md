# Learnings

This file is the current architecture memory for DrumMark. Older chronological notes were archived to `docs/archived/LEARNINGS_legacy_2026-05-18.md` because the project changed technical direction several times and the old log had started to obscure the active path.

When an older note conflicts with this file, treat this file plus the active spec/proposal docs as authoritative.

## Current Architecture Baseline

### Product Rendering Path

- The default renderer is the platform-neutral Rust layout engine.
- VexFlow has been removed as a product renderer, fallback path, dependency, and active test oracle.
- Renderer work should target the Rust layout scene path and thin adapter contract.
- Historical VexFlow-specific notes are useful only as archived migration context, not as implementation guidance.

### Parser Ownership

- Rust/WASM parser output is the production parser path for the app, score worker, docs build, and CLI normalization.
- Lezer and regex/manual parser notes are historical. They may explain why a decision changed, but they are not the oracle for new behavior.
- When Rust/WASM parser behavior disagrees with old Lezer or regex behavior, use the spec and current Rust/WASM parser contract as the authority.
- Parser-facing TypeScript code should go through the explicit parser runtime registry and parser wrappers. It should not import browser-only generated WASM packages directly.

### Split WASM Runtime

- Browser startup initializes parser WASM only.
- Layout WASM must stay lazy and load only when layout rendering is invoked.
- Active generated package directories:
  - `src/wasm/parser-pkg-web/`
  - `src/wasm/layout-pkg-web/`
  - `src/wasm/parser-pkg-node/`
  - `src/wasm/layout-pkg-node/`
- Active wrappers:
  - `src/wasm/parser_wasm_browser.ts`
  - `src/wasm/layout_wasm_browser.ts`
  - `src/wasm/parser_wasm_node.ts`
  - `src/wasm/layout_wasm_node.ts`
- The old combined `src/wasm/pkg/` and `src/wasm/drummark_wasm.ts` path is not the active production contract.

### Layout Scene Contract

- Layout rendering is source-to-scene through layout WASM: `build_layout_scene(source, options)`.
- The TypeScript SVG adapter is intentionally thin. It renders `LayoutScene` primitives and composites; it should not reconstruct score semantics from source text.
- Unknown scene item kinds should fail loudly, not silently disappear.
- Stable layout-engine SVG assertions should use semantic output such as `data-role`, `data-measure-id`, page count, system count, and scene/composite structure.
- Old VexFlow DOM-class assertions such as `vf-notehead`, `vf-bar`, and `vf-staff` are stale for the layout engine.

### Source Coherence

- `setLayoutSource` and module-level layout source caches are obsolete.
- Render calls must carry the source attached to the accepted parsed-score revision.
- Active parsed score state should include `{ score, source, sourceRevision }`.
- Async parse results older than the current revision must not replace newer active score state.
- Rapid-edit rendering tests should verify that layout rendering receives the source from the same accepted revision as the score.

### Pagination

- `LayoutScene.pages` may contain multiple pages.
- App preview must use page-aware APIs such as `renderScorePagesToSvgs()` / `renderScenePagesToSvgs()`.
- Single-page helpers are acceptable for focused adapter tests, but app preview should not wrap only page 1 and call that complete pagination.
- `pageWidth` and `pageHeight` must both cross the JS/WASM boundary after the same staff-scale conversion.

### CLI Rendering

- CLI normalization initializes parser WASM through the Node parser wrapper.
- CLI SVG rendering initializes layout WASM through the Node layout wrapper.
- CLI rendering should fail closed on internal layout or adapter errors. It should not write friendly placeholder SVGs that hide runtime failures.
- Keep `npm run drummark -- <fixture> --format svg` in verification for renderer/bootstrap changes.

## Build And Verification

- `npm run wasm:build` is the authoritative local WASM rebuild command.
- `npm run build` runs the WASM build first, then TypeScript/docs/Vite and bundle reporting.
- Manual `wasm-pack` or one-off cargo/wasm-bindgen command notes in the archive are troubleshooting history, not the preferred workflow.
- `npm run verify:split-wasm` is the current full split-WASM verification gate. It covers:
  - split WASM build and size reporting
  - TypeScript/docs/Vite build
  - import-boundary enforcement
  - split wrapper tests
  - settings migration tests
  - score source-revision tests
  - SVG renderer/adapter regression tests
  - parser/layout semantic parity tests
  - CLI runtime tests
  - browser network audit
  - representative CLI SVG generation

## Static Import Boundaries

- Browser production code must not import Node wrappers or Node generated packages.
- Parser-facing production code must not import layout wrappers or layout generated packages.
- CLI runtime must not import browser wrappers or browser generated packages.
- Default layout/settings paths must not pull legacy renderer runtime imports.
- Integration/parity tests may cross these boundaries only when explicitly scoped as integration/parity tests.

## UI And Settings Copy

- User-facing labels should use musical/product language, not implementation names.
- Prefer musical/product labels over renderer implementation names.
- Avoid labels such as `useLayoutEngine`, `WASM render`, `offsetY`, or source-code field names.
- Settings that cross into layout WASM must preserve explicit zero values. Missing option and option value `0` are different states.

## Current Layout-Specific Notes

- Paragraphs own system breaks: one paragraph maps to one system unless a future approved proposal changes that contract.
- Measure-owned scene items must stay attached to their owning measure/system during pagination. Visual-band inclusion is only for unowned system-level items such as staff lines and clefs.
- Structural composites such as voltas, repeat-related spans, measure-repeat signs, multi-rests, and hairpins should be represented semantically in the scene contract rather than reconstructed from paint primitives.
- Beams should be filled path bodies for slanted geometry, not thick stroked lines.
- Unbeamed flags should use SMuFL glyph roles.
- Ordinary rests should be glyph runs with duration-aware rest roles.
- Volta placement uses the top skyline. Hairpin placement uses the bottom skyline.
- Repeat counts are playback semantics; visible bracket houses are volta notation.

## Superseded Buckets In The Archive

- Lezer migration and regex-parser coexistence notes are historical.
- Single-package WASM notes involving `src/wasm/pkg` or `drummark_wasm.ts` are superseded by split packages.
- VexFlow-first renderer planning is superseded for product rendering, though still useful for legacy parity.
- Old notes describing app preview as single-page-only are superseded by page-aware preview rendering.
- Old notes recommending manual `wasm-pack` rebuilds are superseded by `npm run wasm:build`.

## Process Notes

- For technical obstacles, read source and official docs first.
- Verify parser, normalization, and rendering issues through `npm run drummark` in the relevant format:
  - `--format ast`
  - `--format ir`
  - `--format svg`
  - `--format xml`
- For significant DSL or architecture changes, use proposal files under `docs/proposals/`, sub-agent review, tasks files, explicit human stamp, implementation branch, pre-merge review, and archival.
- After this cleanup, append only concise, current-route learnings here. If a note is mainly historical context, place it in an archived document instead of bloating the active baseline.

## 2026-05-20 Tempo Layout Contract

- First-system tempo text is measure-owned layout content, not header-owned content.
- Header extraction for pagination should include only text-block children with no `measure_id`.
- System boxes must preserve measure-owned `TextBlock` composites such as tempo, otherwise semantic scene consumers lose the grouped tempo marker.

## 2026-05-20 Compact Repeat Boundary Parsing

- In Rust/WASM parser input, the compact shared repeat boundary `:|:` is lexed as `RepeatEnd` plus a trailing `Colon`, not as `RepeatEnd` plus `RepeatStart`, because the second half has no `|` character left for the `|:` token.
- The parser must interpret a standalone `Colon` as a repeat-start barline only when `parse_barline()` is already being asked for a measure boundary. Note suffix parsing such as `x:close` remains owned by `parse_suffix_chain()`.
- The legacy TypeScript parser has no lexer token for `:|:` either; handle it after consuming a repeat-end boundary by seeding the next left boundary as `repeat_start` and advancing past the extra colon, instead of adding `:` to the general boundary regex where it would collide with note modifiers.
- SMuFL provides a dedicated `repeatRightLeft` glyph at U+E042 for a right-and-left repeat sign. When rendering adjacent repeat-end/repeat-start boundaries, emit one semantic `repeat-end-start` glyph run with `GlyphRole::RepeatRightLeft` rather than separate `repeatRight` and next-measure `repeatLeft` glyphs.

## 2026-05-20 VexFlow Removal Planning

- At proposal-planning time, VexFlow remnants were legacy-only: `src/App.tsx` could lazy-import `./vexflow`, `build-docs.ts` imported `src/vexflow/index`, Vite optimized `vexflow/bravura`, `package.json` depended on `vexflow`, and some corpus/parity tests still imported VexFlow as an oracle.
- The approved active architecture remains `RenderScore -> LayoutScene -> thin platform adapter`; VexFlow removal should be deletion/route simplification plus oracle replacement, not a new renderer rewrite.
- Before deleting VexFlow-only tests, classify each test as obsolete, already covered by layout/adapter/CLI/corpus tests, or needing a new non-VexFlow regression.

## 2026-05-20 VexFlow Removal Implementation

- The active rendering ownership rule is `RenderScore -> LayoutScene -> thin platform adapter`.
- Legacy VexFlow removal is governed by `docs/proposals/ARCHITECTURE_proposal_remove_vexflow.md` and `docs/proposals/ARCHITECTURE_tasks_remove_vexflow.md`.
- During removal, do not use VexFlow output as an active oracle. Replace old parity coverage with layout scene snapshots, SVG semantic reports, adapter tests, CLI SVG tests, and corpus gates.

## 2026-05-20 Layout Event Spacing

- `measure_geometry()` owns note X placement inside `drummark-layout`; SVG adapters should not shift notes away from barlines.
- Event placement should use both event start slots and event end slots as spacing-cell boundaries. Centering only between adjacent starts incorrectly moves a lone short downbeat toward the middle of the measure.
- The first event in a measure should sit in the center of its rhythmic cell, not on the cell's left boundary. This creates clearance after left barlines/repeat starts while keeping the final event from leaving a full trailing beat of empty space.

## 2026-05-20 wasm-pack wasm-opt Feature Flags

- `wasm-pack` reads `[package.metadata.wasm-pack.profile.release].wasm-opt` from the crate `Cargo.toml`; specifying the array overrides the feature flags passed to `wasm-opt`.
- Recent Rust/LLVM wasm output can include `i32.trunc_sat_f32_s`, which requires Binaryen validation with `--enable-nontrapping-float-to-int`.
- If `wasm-opt` is configured with only `--enable-bulk-memory`, GitHub Actions can fail during `wasm-pack build --target web crates/drummark-core` with `unexpected false: all used features should be allowed`.
- The custom split-WASM build script invokes a standalone `wasm-bindgen` binary. Installing `wasm-pack` is not sufficient for CI; install `wasm-bindgen-cli` matching the locked `wasm-bindgen` crate version before `npm run build`.

## 2026-05-20 Dynamic Marking Design Notes

- DrumMark already specifies zero-duration hairpin tokens `<` and `>` as measure expressions, with normalization collecting `HairpinIntent` spans.
- Explicit dynamic text such as `p`, `mp`, `pp`, `ff` should be modeled as zero-duration expression marks anchored to musical time, not as note articulation modifiers.
- Dynamic marks should share the bottom-skyline layout lane with hairpins so `p < f` can express a crescendo from one explicit dynamic level to another.
- Bare dynamic names are not viable syntax because `p` may be a playable note token. Dynamic syntax needs an explicit marker such as a directive or sigil to disambiguate expression text from note glyphs.

## 2026-05-20 Dynamic Position Scanning

- Dynamic marks are zero-duration tokens like hairpin starts/ends, but their scanner needs exact measure-local output rather than hairpin open/close state.
- Adjacent routed blocks must be treated as simultaneous branches for dynamic anchors. The surrounding cursor advances by the maximum routed-block weight, not by summing each routed block sequentially.
- Nested group dynamic positions can be resolved by recursively scaling child-local positions into the parent rendered duration until measure-local time is reached.

## 2026-05-20 MusicXML Dynamic Directions

- The active MusicXML exporter is `src/dsl/musicxml.ts`; CLI XML export flows through the TypeScript normalized score rather than a separate Rust XML writer.
- Existing hairpin wedges are emitted as score-level `<direction>` elements with MusicXML `<offset>` values, so explicit dynamics should follow that direction-offset style instead of adding forward/backup cursor events.
- `collectDivisions()` must include dynamic anchor denominators, otherwise dynamic offsets from nested groups or tuplets can become fractional even when notes alone do not require those divisions.

## 2026-05-21 Layout Structural Edge Padding

- Measure content padding must be derived from the visible structural edge, not only from a flat left/right constant.
- Non-initial start-repeat barlines need their own reserved width plus trailing content gap; otherwise dense first events can collide visually with the repeat glyph.
- Right repeat-end barlines need symmetrical reserved width before the glyph. Final and double barlines need a smaller extra gap beyond regular barlines.
- System-start clef/time-signature preambles should add a small trailing content gap on top of their reserved symbol widths.

## 2026-05-21 Same-Voice Chord Notehead Displacement

- Same-slot hits in the same voice are laid out in `crates/drummark-layout/src/lib.rs` by `render_hit_cluster()`, so chord collision handling belongs in layout, not in the SVG adapter.
- Adjacent noteheads within one same-voice chord should keep a shared stem but stagger horizontally to avoid overlap; for the current contract, the higher staff position shifts to the right column and the lower stays on the left column.
- The displacement rule should trigger only for immediately adjacent staff positions (a line-space or space-line second), leaving wider intervals vertically aligned on the shared stem.

## 2026-05-21 Layout Fractional Rhythm Resolution

- `drummark-layout` must not quantize event starts to `header.divisions` when grouping same-time hits, assigning beam runs, or computing intra-group spacing. In meters like `6/8` with `note 1/8`, that quantization collapses distinct 16th-note starts (`1/2` and `9/16`) into one fake slot.
- Group-local spacing should use exact start/end `Fraction` boundaries from the rendered events, then weight only the segments inside each declared grouping span. This preserves rhythmic subdivision without distorting neighboring eighth-note positions.

## 2026-05-21 Active Voice Detection For Implicit Rests

- `derive_render_score()` must infer active voices from actual non-sticking events in the score, not from the normalized track registry alone. Anonymous measures like `| b |` can otherwise mark voice 1 as active even though only voice 2 appears.
- When active voices are inferred from track registry instead of events, the renderer can invent a phantom voice-1 whole rest and simultaneously miss the intended trailing voice-2 rests. This also breaks the `hideVoice2Rests` toggle because the visible rest is attached to the wrong voice.

## 2026-05-21 Rest Slot Center Alignment

- In `crates/drummark-layout/src/lib.rs`, rest X placement inside `render_slot_group()` needs the same visual-center basis as noteheads: SMuFL bbox center, not glyph advance width or a mixed width/bbox approximation.
- For mixed rest+hit slots, the rest should inherit the slot's actual rendered hit center when one exists. Using the resting voice's default notehead metric (`HH` x-head vs `BD` black head) creates a visible horizontal offset even though both symbols belong to the same rhythmic slot.
- The voice-local fallback center is still needed for pure-rest slots and whole-measure rests, but alternating two-voice patterns like `| x-x-x- | / | -b-b-b |` should sort to matching note/rest centers at every slot.

## 2026-05-22 Rest Layout Planning

- Rest event generation is already reasonably musical in `crates/drummark-core/src/render_score.rs`: measure gaps are split at grouping boundaries and then decomposed into primitive rest durations before reaching layout.
- The remaining weakness is in `crates/drummark-layout/src/lib.rs`: `render_slot_group()` currently resolves rest X intelligently but still hardcodes rest Y to `staff_top + 20.0` for voice 1 and `staff_top + 30.0` for voice 2.
- Because rest placement happens before any collision-aware lane selection, same-slot combinations like rest+notehead, rest+stem, rest+beam, and rest+accent can overlap even though the rhythmic slot center is correct.
- A robust fix belongs in layout, not the SVG adapter: build slot-local obstacle geometry, choose from canonical rest lanes per voice, and preserve whole-measure rest alignment as a separate rule.

## 2026-05-22 Rest Layout Implementation

- The practical insertion point for smart rest placement is `crates/drummark-layout/src/lib.rs::render_slot_group()`, but reliable obstacle solving requires richer geometry from `render_hit_cluster()` than the old note-placement-only return value.
- A workable phase-1 design is to keep final beam drawing in `render_beam_groups()` while giving rest solving a conservative local beam envelope derived from stem direction, beam level, and the same beam-thickness/secondary-gap constants used by the beam renderer.
- Rest lane coordinates are easiest to make duration-agnostic if they are defined against each rest glyph's bbox center; the emitted glyph origin can then be reconstructed from canonical SMuFL bbox metrics.
- Deterministic same-slot multi-rest behavior can be defined entirely from layout-visible fields (`voice`, `duration`, `staff_y_for_track(track)`, `track`, then existing slot-slice order) without introducing new upstream metadata.

## 2026-05-22 Parser Measure Recovery For Preview Stability

- The strict Rust entrypoint `Parser::parse()` is still useful for CLI/tests, but the WASM-facing preview path should use a lossy parse result so the editor can keep rendering valid later measures while surfacing parser errors.
- Measure-level recovery must preserve measure count. Dropping a bad measure entirely causes paragraph-level track-count mismatches in `src/dsl/ast.ts`, which then discards the whole paragraph. Returning an empty placeholder measure avoids that cascade and lets normalization fill the slot with rests.
- Recovery should stop at the next barline or newline without consuming it. If unterminated groups or braces eat the separator token during error handling, the next measure loses its opening boundary and the rest of the line becomes unrecoverable.
- Layout still needs a hard-failure guard for fully unrenderable input: a scene that has `issues` but no measures on any page should still throw, otherwise malformed headers degrade into a blank preview instead of an actionable error.

## 2026-05-23 Rust Normalizer WASM Cutover

- `crates/drummark-core` already had `build_normalized_score(source)` but it was not exported from the parser WASM packages; `scripts/build_wasm.mjs` explicitly required only `parse` for parser packages and forbade normalized/layout exports from layout packages.
- Keeping `src/dsl/normalize.ts` as a TypeScript implementation after Rust normalizer migration lets TS-only semantics drift from the layout path. A safer bridge is a thin adapter that calls the parser WASM runtime's `build_normalized_score`, then adapts small JS shape differences for existing UI/MusicXML consumers.
- Dotted rhythm rendering should not encode `"dot"` as a performance modifier. Rust `NormalizedEvent` and layout `RenderEvent` now carry a separate `dot_count`, leaving `modifiers` for articulations and notehead semantics.
- Rust normalized output omits empty optional arrays by default, so JS adapters that feed legacy consumers need to normalize fields such as `event.modifiers` to `[]` while preserving intentionally absent measure fields like `hairpins`.

## 2026-05-23 Rust MusicXML Export Cutover

- The parser WASM package can carry output-format exports in addition to `parse` and `build_normalized_score`; `scripts/build_wasm.mjs` must list `build_music_xml` as required for parser packages and forbidden for layout packages to keep package boundaries explicit.
- A source-based MusicXML WASM contract avoids keeping TypeScript `NormalizedScore` helper semantics alive. The wrapper shape is `{ xml, errors }`, where `errors` comes from the Rust parser diagnostics and CLI XML warnings can use it without running a separate TypeScript normalization path.
- The old TypeScript MusicXML exporter depended on pre-explicit-rest assumptions and on adapter-shaped fields such as `hairpin.type`. The Rust exporter should read Rust `NormalizedScore` directly, including explicit rest events and `HairpinKind`, instead of preserving those compatibility artifacts.

## 2026-05-23 Legacy TypeScript DSL Removal

- After `src/wasm/skeleton.ts` is removed, parser-facing import-boundary tests should use `src/wasm/parser_runtime.ts` as the protected parser-side boundary because it is the remaining TypeScript glue that must not import layout WASM.
- `NormalizedScore` should not carry parser-only compatibility data such as `score.ast`; UI status, export names, and CLI IR formatting can read the Rust normalized fields directly (`header`, `measures`, `repeatSpans`).
- The native parser AST WASM contract intentionally exposes a loose JSON envelope (`version`, `headers`, `paragraphs`, `errors`) rather than old TypeScript skeleton types. Tests should assert stable envelope fields and representative native parser tokens without recreating the deleted `DocumentSkeleton` shape.

## 2026-05-23 MusicXML Review Fixes

- A source-based MusicXML export still needs to surface normalization diagnostics, not only parser diagnostics. In this codebase `normalize_document()` stores both parser-derived and validation-derived messages in `score.errors`, so the WASM XML wrapper should serialize that combined list for CLI warnings.
- Removing the score-based TypeScript MusicXML overload is safer than leaving a compatibility overload that always throws. Old callers should fail typechecking instead of compiling into a runtime error.
- `hideVoice2Rests` remains an export contract even after moving MusicXML to Rust. The Rust exporter should turn hidden secondary voice rests into MusicXML `<forward>` duration advances so voice timing is preserved without visible rest notes.

## 2026-05-23 Tuplet Visual Duration Rendering

- Rust normalization's `NormalizedEvent.duration` is the actual performed duration after group compression, so a starred note inside `[span: ...]` can have an actual tuplet duration such as `1/12` while its notated value remains `1/4`.
- Layout must use a separate visual duration for note shape, stems, flags, and beam eligibility. Inferring visual value from actual tuplet duration alone loses token-local modifiers like `*`.
- Tuplet brackets belong in `drummark-layout` because they are score layout elements derived from `RenderScore -> LayoutScene`; SVG adapters should only translate the emitted `tuplet-*` scene items.

## 2026-05-24 Optional Measure Edges And Terminal Barlines

- The Rust parser already treats a non-barline token at measure start as an implicit regular left barline, which supports preview-friendly input like `HH x - x - | x x x x` without requiring a leading `|` or trailing `|`.
- Paragraph track alignment belongs in `normalize_document()`: shorter lines should simply contribute no section for missing measure slots. Reusing the last authored `ExpandedSection` duplicates note, dynamic, repeat, and navigation metadata into measures the user did not write.
- Layout chooses a measure's right-side barline from `closing_barline.or(barline)`. If `@fine` forces `barline = final` but an explicit trailing `||` leaves `closing_barline = double`, the rendered scene still draws a double barline. Fine and the score-final pass must set the right-edge `closing_barline` to `final` when the right edge should visually terminate.

## 2026-05-24 Parallel Tuplet Bracket Deduplication

- Tuplet metadata is attached per `RenderEvent`, so parallel tracks with the same voice and same tuplet rhythm produce duplicate event-level `(actual, normal)` tuples at identical start/end fractions.
- `drummark-layout::render_tuplet_groups()` is responsible for converting those event tuples into visible bracket runs. It should deduplicate identical `(voice, count, span, start, end)` entries before scanning contiguous runs; otherwise simultaneous same-voice tuplets can split the run scanner and emit duplicate brackets.
- The deduplication belongs in layout, not the SVG adapter, because tuplet bracket grouping is score engraving derived from `RenderScore -> LayoutScene`.

## 2026-05-24 Flam Grace Note Rendering

- Parser and normalization already preserve `flam`/`drag` in `RenderEvent.modifiers`; missing flam output was a layout rendering gap, not an AST or IR issue.
- `crates/drummark-layout/src/lib.rs::render_hit_cluster()` is the right insertion point for grace notes because it has the resolved main notehead position, glyph role, stem direction, and scene sink needed to emit platform-neutral `LayoutScene` items.
- Grace-note drawing should stay in `drummark-layout` as ordinary scene items (`grace-notehead`, `grace-stem`, `grace-slash`). SVG adapters should only translate those items and must not synthesize engraving behavior for modifiers.

## 2026-05-24 Flam Grace Flag Duration Rule

- The grace-note flag duration rule applies to `flam`, not `drag`: flam defaults to an eighth-note grace flag, but if the modified note's visual duration is a 16th or 32nd note, the flam grace flag uses the matching 16th or 32nd SMuFL flag.
- The decision belongs in `drummark-layout` next to grace-note emission because it depends on `RenderEvent.visual_duration`, `dot_count`, and stem direction after note placement. The adapter should only render the emitted `grace-flag` glyph.

## 2026-05-24 Layout Library Refactor Recon

- `crates/drummark-layout/src/lib.rs` is a 14k-line mixed-responsibility module: public render/scene contracts, canonical metrics, pagination, scene emission, measure geometry, note/rest/stem/beam engraving, structural spans, bounds/stacking, JS serialization, and tests all share one compilation unit.
- The safest first refactor candidates are pure or near-pure helpers with clear input/output contracts: fraction arithmetic, glyph/text metric lookup and role naming, scene bounds/path translation, pagination box placement, measure geometry, and beam math.
- There is a parallel prototype API in the middle of `lib.rs` (`LayoutElement`, `System`, `build_systems`, `place_notes`, `place_barlines`, `stack_edge_elements`) that is public but not part of the main `build_layout_scene` path. Before moving code, decide whether this API is kept as a supported planning layer or quarantined as legacy/prototype code.
- `cargo test -p drummark-layout` passes, but the library currently emits dead-code warnings for `rects_intersect` and `rect_obstacle_from_bounds`. `cargo clippy -p drummark-layout -- -W clippy::all` also reports `too_many_arguments` on `render_grace_notes_for_hit` and `build_stem_render_plan`, plus needless borrows of `sink.items` in navigation skyline calls.

## 2026-05-24 Ledger Line Centering

- Notehead center calculations in `drummark-layout` use `glyph_bbox_center_x_offset`, which includes the SVG `pt -> user unit` conversion through `SVG_POINT_TO_USER_UNIT`.
- Ledger line widths must use `rendered_glyph_width(...)` rather than `width_ss * font_size / 4.0`; otherwise the line is too short and its center shifts left of the rendered notehead center.
- For `| c |`, the C crash resolves to an X notehead. With a 30pt notehead, the centered top ledger line should span the rendered notehead width plus equal overhang on both sides.

## 2026-05-24 Corpus Golden Refresh Workflow

- Parser corpus summaries are regenerated with `npx tsx scripts/update_example_corpus_report.ts`; the script rewrites `docs/parser-cutover/example_corpus_report.json` from the current `buildNormalizedScore()` WASM-backed adapter.
- Layout corpus reports and representative `LayoutScene` snapshots are regenerated with `npx tsx scripts/update_corpus_golden.ts`; this updates `docs/layout-corpus/corpus_gate_report.json` plus the checked-in scene snapshots used by `src/renderer/corpusGate.test.ts`.
- After layout modularization, the stable corpus deltas are mostly fewer visible rest glyphs and more explicit beam/tuplet scene roles. `docs/examples/full-example.drum` also reflects the current normalizer behavior for `BD | ... *4 |`, where expanded repeat measures contain the repeated BD line rather than duplicating omitted sibling track lines.

## 2026-05-25 Native CLI Export Recon

- `crates/drummark-core` already exposes a native `drummark` bin, but `src/main.rs` is a narrow parser demo that prints a hand-written header/count JSON shape and only accepts `json`/`ast`; it does not use the Rust MusicXML exporter or layout engine.
- The TypeScript CLI path (`src/cli_runtime.ts`) supports `ast`, `ir`, `xml`, and `svg`; XML is already backed by Rust `build_music_xml`, while SVG still goes through Node WASM layout plus the TypeScript SVG adapter.
- `drummark-layout` owns the platform-neutral `LayoutScene` contract with primitives for glyph runs, text runs, lines, rects, polylines, and paths, so a native CLI exporter should translate those scene items directly and avoid adding engraving decisions outside layout.

## 2026-05-25 Multi-Voice Slot Center Alignment

- `render_slot_group()` in `crates/drummark-layout/src/engraving/notes.rs` previously applied a per-voice horizontal offset (`voice_shift`: voice 1 → −4 px, voice 2 → +4 px) whenever a slot contained hits in more than one voice. That split same-beat noteheads onto different rhythmic columns even though they share one `event_x`.
- Opposing voices at the same slot should share one horizontal center (stem direction handles vertical separation). The `voice_shift` path was removed from both hit clusters and rest fallback centering.
- Regression coverage lives in `test_two_voice_collision_case_preserves_attachment_anchors`, which now asserts visual center alignment instead of minimum horizontal separation.

## 2026-05-25 WASM Feature Target Isolation

- `scripts/build_wasm.mjs` previously reused one shared artifact path (`target/wasm32-unknown-unknown/release/drummark_core.wasm`) for both `parser-wasm` and `layout-wasm` builds. Cargo could leave a stale combined/default-feature binary in place, so `wasm-bindgen` sometimes generated parser package JS with only `build_layout_scene`.
- Each WASM package now builds into its own `--target-dir` (`target/wasm-parser-wasm`, `target/wasm-layout-wasm`), preventing cross-feature artifact reuse. After changing layout or parser Rust code, run `npm run wasm:build` before using the browser dev server.

## 2026-05-25 Whole And Half Rest Line Attachment

- Collision-aware rest lanes reuse one bbox-center lane list whose default anchor (`2.0` ss) fits quarter/eighth rests but not whole/half rests. Whole and half glyphs have different vertical bbox geometry, so centering them on the middle lane leaves their bottom edges off the standard staff lines.
- `preferred_rest_lane_ss()` now derives the first candidate lane from engraving attachment: whole rests hang from the second staff line (`ss=1.0`), half rests sit on the middle line (`ss=2.0`), using each glyph's bottom edge relative to its bbox center.

## 2026-05-25 Whole And Half Rest Attachment Correction

- `GlyphRun.y_pt` is a SMuFL baseline-style placement coordinate in layout geometry, not a bbox center. Bounds are computed as `top = y_pt - bbox_ne_y_ss * font_size/4` and `bottom = y_pt - bbox_sw_y_ss * font_size/4`.
- Whole rest attachment should solve from the glyph top edge (`baseline = target_line + bbox_ne_y_ss * font_size/4`) because the rest hangs below the staff line. Half rest attachment should solve from the glyph bottom edge (`baseline = target_line + bbox_sw_y_ss * font_size/4`) because the rest sits on the staff line.
- Regression tests for rest line attachment must include the rendered font size when converting glyph bbox coordinates back to staff spaces; comparing raw SMuFL staff-space bbox values directly to screen-space positions can mask vertical placement errors.

## 2026-05-25 Native CLI Font Asset Recon

- The checked-in Bravura asset path is `public/fonts/bravura.otf` with a lowercase filename, plus `public/fonts/bravura.woff2` and `public/fonts/bravura_metadata.json`.
- No CJK/Hei font is checked into `public/fonts`. On this macOS environment, a plausible system CJK sans/Hei candidate exists at `/System/Library/Fonts/STHeiti Medium.ttc`, but native PDF export should still support an explicit `--cjk-font <PATH>` because CI and packaged installs may not have that platform font.

## 2026-05-25 Ride Bell Noteheads

- `r:bell` resolves through core as track `RC`, glyph `x`, modifier `bell`; the diamond visual shape is therefore a layout/export modifier rule, not a retained raw glyph rule.
- `drummark-layout::notehead_glyph()` maps the `bell` modifier to SMuFL `NoteheadDiamond` (`U+E0B2`) before applying the default cymbal X notehead fallback.
- MusicXML notehead export should mirror the same semantic rule for both ride tracks that validation allows (`RC` and `RC2`) by emitting `<notehead>diamond</notehead>` when the normalized event has modifier `bell`.

## 2026-05-25 SMuFL Notehead Reference

- The official SMuFL Noteheads table is cached locally at `docs/reference/smufl-noteheads.json`; check it before changing notehead codepoints.
- `U+E0B2` is `noteheadCircleXHalf`, not a diamond notehead. Ride bell diamond noteheads should use `U+E0DB noteheadDiamondBlack`.

## 2026-05-25 Rim And Ghost Noteheads

- `rim` should use SMuFL `U+E0D0 noteheadSlashedBlack2`, not `U+E0CE`; `U+E0CE` is `noteheadParenthesis`.
- `ghost` should render as Bravura `noteheadBlackParens`, whose recommended SMuFL ligature is `uniE0F5_uniE0A4_uniE0F6` and whose Bravura optional glyph codepoint is `U+F5D1`.

## 2026-05-25 Drag Grace Notes

- `drag` should render before the main note as two 16th grace notes with 16th flags and no slash. `flam` remains one grace note with the slash marker.
- MusicXML export mirrors the same distinction: `drag` emits two `<grace/>` 16th notes, while `flam` uses `<grace slash="yes"/>`.

## 2026-05-25 Ghost Notehead Ligature Correction

- `U+F5D1` must not be used as the rendered ghost notehead codepoint; in the active Bravura font it resolves as a time-signature glyph, not `noteheadBlackParens`.
- Render ghost noteheads with the SMuFL/Bravura ligature text `uniE0F5_uniE0A4_uniE0F6` while retaining black-notehead anchors and parenthesized-notehead bounds for layout.

## 2026-05-25 Drag Grace Note Beams

- `drag` grace notes should be rendered as two 16th grace noteheads connected by a small double beam, not as two independently flagged grace notes. The layout emits `grace-beam` and `grace-beam-secondary` path items for the pair.

## 2026-05-25 Native CLI PDF Font Subsetting

- `printpdf 0.9.1` exposes `PdfSaveOptions { subset_fonts: true }`, but its serialization path currently disables the actual subsetting branch with `if false && do_subset`; using that option alone embeds full font programs.
- `allsorts`/`printpdf::subset_font` and `fontcull` reduced PDF cmap/width metadata in prototype checks, but did not sufficiently reduce Bravura CFF OTF font data. HarfBuzz subsetting via `hb-subset` with the bundled feature produced real Bravura CFF and Arial Unicode fallback subsets for PDF embedding.
- The native PDF path must subset fonts before registering them with `printpdf`; the PDF writer then embeds those already-subset font bytes. On this machine, `docs/examples/overview.drum` produced a 40 KB PDF with Bravura and fallback subsets, versus 54 MB when full platform CJK fonts were embedded.
- Default Bravura resolution is `public/fonts/bravura.otf`. Fallback text fonts are only loaded when Bravura lacks a `TextRun` character. The documented fallback candidates are `DRUMMARK_TEST_FALLBACK_FONT`, `/Library/Fonts/Arial Unicode.ttf`, `/System/Library/Fonts/Supplemental/Arial Unicode.ttf`, and `/System/Library/Fonts/STHeiti Medium.ttc`; explicit `--font` and `--fallback-font` paths remain strict hard failures if invalid.

## 2026-05-27 Dual-Voice Rest Zone Placement

- Rest lane selection in `crates/drummark-layout/src/engraving/notes.rs` now distinguishes single-voice vs dual-voice measures via `measure_uses_dual_voice_rest_zones()`. Single-voice (or `hideVoice2Rests`) uses traditional center-staff defaults: short rests at `ss=2.0`, whole at `ss=1.0`, half at `ss=2.0`. Dual-voice uses fixed voice zones: voice 1 upper (`ss=1.5` short, `ss=1.0`/`1.5` whole/half), voice 2 lower (`ss=3.0` for all rest classes).
- Collision fallback is directional: voice 1 searches only upward (`REST_LANES_VOICE_1_UP_SS`), voice 2 only downward (`REST_LANES_VOICE_2_DOWN_SS`). Full-collision tie-break prefers the lane closest to the voice default, not the lane with lowest overlap that may drift toward the staff center.
- `derive_implicit_rest_events()` in `crates/drummark-core/src/render_score.rs` merges deferred whole-measure rests when both active voices are entirely silent in the same measure, emitting a single voice-1 whole rest instead of two stacked whole rests.

## 2026-05-29 Stem Length In Staff Spaces

- `LayoutOptions.stem_len_offset_ss` adjusts length around `DEFAULT_STEM_LEN_SS` (4). Effective length is `stem_length_pt(opts) = staff_space_pt * (4 + offset)`. WASM/TS pass `stemLenOffsetSs`; legacy `stemLenPt` is converted to offset on ingest.
- App setting `stemLength` is the same offset in staff-space units (default 0, range −2…+4). Persisted pt values above 8 are migrated with `value / staffSpacePt - 4`.

## 2026-05-29 Stem Length WASM Option Deprecation

- Layout WASM options no longer read `stemLenPt` or `stemLenSs`; only `stemLenOffsetSs` (staff-space units added to the default 4 ss span). Saved app settings outside −2…+4 reset to offset 0 instead of converting old pt values.

## 2026-05-29 Barline Vertical Span And Continuation Repeat Start

- Staff lines sit at `sy + staff_space_pt * (1..5)`; barline rects must use `staff_barline_height_pt(top, bottom) = bottom - top` (no `+ 1`), with `top = sy + staff_space` and `bottom = sy + staff_space * 5`, or the fill extends 1pt below the bottom staff line.
- First-measure `|: ` on a non-first system must not use `FIRST_MEASURE_START_REPEAT_PREAMBLE_PULL_PT`; place the glyph at `compact_measure_preamble_end_x + SYSTEM_PREAMBLE_SIDE_GAP_PT` so it clears the repeated clef. `measure_left_pad` for that case must derive from the same repeat X, not `system_start_reserved + start_repeat_reserved - pull`.

## 2026-05-29 Staff Space And Rest Lane Scaling

- Staff lines are drawn at `sy + staff_space_pt * (1..5)`; `staff_bounding_height_pt = staff_space_pt * 5` drives `sys_y` advance together with `system_spacing_pt`. Pagination then re-stacks systems using each box `visual_height`, so below-staff hairpins/dynamics do not require inflating `sys_y` beyond the strict staff bbox.
- `resolve_rest_placement()` must multiply rest lane indices (`lane_ss`) by `staff_space_pt`, not a hardcoded `10.0` pt step. When default `staff_space_pt` moved from `7.5`/`10` assumptions to `5.0`, rests landed between staff lines while noteheads stayed on-scale, which looked like broken staff spacing.
- `system_box_from_page_system()` assigns `staff-line`, `percussion-clef`, and `time-signature-digit` items by overlap with `[staff_top, staff_bottom]` instead of only the Y midpoint band between systems, so tighter pre-pagination `sys_y` strides do not attach one system's lines to another system's layout box.
