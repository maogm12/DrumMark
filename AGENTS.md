# AGENTS.md

## Engineering Integrity

- **Research First:** When encountering technical obstacles or unfamiliar APIs, prioritize reading source code and official documentation to understand implementation details and usage patterns.
- **Avoid "Shotgun" Debugging:** Do not make speculative changes (guess-and-check) followed by requests for user verification.
- **Prototype Verification:** Before applying complex fixes or features, implement small-scale prototypes or reproduction scripts to verify assumptions autonomously.
- **Technical Rigor:** Ensure every change is idiomatically correct and does not introduce regressions or syntax errors (like omission placeholders) into the codebase.
- **Knowledge Retention:** After researching source code or documentation to solve a problem, document the findings (API details, internal logic, discovered constraints) in `LEARNINGS.md`. **All updates to `LEARNINGS.md` MUST follow the Append-Only Protocol** to prevent accidental data loss and maintain a chronological record of technical discoveries.
- **Design First**: For significant DSL, architecture, or spec/contract changes, follow **[Change Workflow](#change-workflow)** before implementation: create `docs/changes/active/<change-id>/plan.md`, complete plan review, record a human stamp in `history.md` when required, then implement.
- **Plan-Scoped Review**: Do not request formal plan review after every task or commit during implementation. Complete one concentrated implementation review when the planned work is done, then merge back to `main`.

## Project Map & Fast Orientation

Use this map before broad repository searches. Prefer targeted reads over whole-tree `rg` scans; this repo has generated WASM packages, fixtures, archived proposals, and large SVG/golden outputs that can waste context quickly.

```text
src/
  App.tsx, main.tsx              Preact app shell and preview wiring
  components/                    UI controls, settings panel
  dsl/                           TypeScript parser/normalizer/types and DSL tests
  renderer/                      Thin SVG/LayoutScene adapters and renderer tests
  wasm/                          Generated parser/layout WASM JS wrappers and packages
crates/
  drummark-core/                 Rust parser, normalizer, RenderScore creation, CLI-native path
  drummark-layout/               Rust layout engine: RenderScore -> LayoutScene
docs/
  DRUMMARK_SPEC.md               Append-only language spec
  RENDER_LAYOUT_CONTRACT.md      Rendering/layout contract
  changes/active/                Per-change plan.md + history.md (new work)
  changes/archive/               Completed change folders
  adr/                           Architecture Decision Records
  spikes/                        Spike / feasibility notes
  examples/                      Example .drum inputs and generated SVG outputs
  proposals/                     Legacy proposal/task ledgers (read-only for new work)
  archived/                      Legacy archived proposals and specs
  layout-corpus/                 Layout corpus reports and scene snapshots
scripts/                         Build/audit/report scripts
public/fonts/                    Bravura font assets and metadata
```

### Where To Look First

- **Parser or AST issue**: start with `crates/drummark-core/src/parser.rs`, `crates/drummark-core/src/lexer.rs`, then `src/dsl/ast.ts` and `src/dsl/types.ts` only if the browser/TS boundary is involved.
- **Normalization or IR issue**: start with `crates/drummark-core/src/normalize.rs`, `crates/drummark-core/src/render_score.rs`, and verify with `npm run drummark -- <input> --format ir`.
- **Layout/engraving issue**: start with `crates/drummark-layout/src/lib.rs`. The main contract is `RenderScore -> LayoutScene`; do not patch geometry in `src/renderer` unless the bug is purely SVG translation.
- **SVG adapter issue**: start with `src/renderer/svgSceneAdapter.test.ts`, `src/renderer/svgRenderer.ts`, and `src/renderer/svgRendererNode.ts`.
- **Settings/UI issue**: start with `src/components/SettingsPanel.tsx`, `src/components/NumericSettingControl.tsx`, `src/hooks/useAppSettings.ts`, `src/styles.css`, and `src/i18n/*`.
- **WASM boundary issue**: start with `src/wasm/parser_wasm_*`, `src/wasm/layout_wasm_*`, `scripts/build_wasm.mjs`, then rebuild with `npm run wasm:build`.
- **Docs/spec change**: start with the active change under `docs/changes/active/<change-id>/`, then `docs/DRUMMARK_SPEC.md` and `docs/RENDER_LAYOUT_CONTRACT.md`. Read `docs/proposals/` only for legacy context.

### Search Discipline

- Avoid broad patterns like `rg "note|measure|x"` across the whole repo. Scope first, e.g. `rg "measure_geometry|x_for_fraction" crates/drummark-layout/src/lib.rs`.
- Exclude generated/heavy areas unless needed: `src/wasm/*/drummark_core_bg.wasm`, `docs/archived/`, generated `docs/examples/*.svg`, and layout snapshots.
- For rendering bugs, use the CLI pipeline first, then inspect code: `--format ast`, `--format ir`, then `--format svg` or `--format xml`.

## Change Workflow

The authoritative change workflow for this repository is:

```text
.agents/skills/change-workflow/SKILL.md
```

Before Normal, Large, or Spec / Contract work, read that skill and:

```text
.agents/skills/change-workflow/references/project-rules.md
```

Use the templates under `.agents/skills/change-workflow/references/` for `plan.md`, `history.md`, bugs, and ADRs.

If the required workflow directories (`docs/changes/active/`, `docs/changes/archive/`, `docs/adr/`, `docs/spikes/`) are missing, create them before using the change workflow.

### Routing Summary

- **Tiny Change**: fix directly; no change folder. Check project-rules exclusion criteria first.
- **Normal / Large Change**: create `docs/changes/active/<change-id>/plan.md` and `history.md`.
- **Spec / Contract Change**: same folder layout, plus `## Spec Delta`, affected-spec update task, human stamp in `history.md`, and the spec merge protocol in `project-rules.md`.
- **Spikes**: `docs/spikes/`
- **ADRs**: `docs/adr/` for long-term architecture decisions only.
- **Overlap**: Spec / Contract > Large > Normal > Tiny. When a change matches multiple types, follow the higher-priority workflow.

Change id format:

```text
YYYY-MM-DD-short-kebab-title
```

### Artifact Rules

- `plan.md` is the current plan. The agent may rewrite it after review.
- `history.md` is append-only. Record plan reviews, `### Approved Plan` (or `### Plan Review Skipped` when review is skipped), human stamps, `## Consolidated Changes`, and implementation reviews there.
- Do not append review transcripts or stale task versions to `plan.md`.
- Do not create new files under `docs/proposals/`.
- `docs/proposals/` and `docs/archived/` are legacy artifacts. Read them for context only.
- `docs/PLAN.md` and `docs/TASKS.md`, if present, are roadmap documents, not per-change plans.

### Required Gates

- **Plan review MUST happen before asking the user for implementation go-ahead.** Do not present a plan and immediately ask "要开始实现吗?" — first complete the review cycle (subagent review → revise → approve), then present the approved plan.
- Plan review must end with `STATUS: APPROVED` before implementation, unless the plan review is skipped for a low-risk Normal Change (Light Normal or recorded skip reason). When skipped, record `### Plan Review Skipped` in `history.md` instead of `### Approved Plan`.
- After plan approval, append `### Approved Plan` to `history.md`. After an intentional skip, append `### Plan Review Skipped`.
- Spec / Contract Changes and other stamped work require `Status: APPROVED_FOR_IMPLEMENTATION` recorded in `history.md` before coding starts. Do not rely on chat history alone.
- During implementation, update task status in `plan.md`, run relevant checks, and request one implementation review when planned work is complete.
- **Commit per task (mandatory).** After each task completes (status → done, acceptance checks pass), commit **before** starting the next task: `[Task N] brief description`. Stage only that task’s scope; run `git status` to confirm the tree is clean of that task’s files. Do not batch tasks into one end-of-change commit unless the user explicitly requests a retroactive split. See `.agents/skills/change-workflow/SKILL.md` → Implementation Rules.
- Merge only after implementation review reaches `STATUS: APPROVED`.
- Prefer squash merge unless the user requests otherwise.
- After merge, move the change folder to `docs/changes/archive/<year>/<change-id>/`.

### Pre-Implementation Gate

**Before writing any code for a Normal / Large / Spec Change, the agent MUST confirm every item on this list. Do not edit, create, or modify source files until all applicable items are checked.**

- [ ] `plan.md` exists at `docs/changes/active/<change-id>/plan.md`
- [ ] `history.md` exists at `docs/changes/active/<change-id>/history.md`
- [ ] Plan review completed AND `STATUS: APPROVED` recorded in `history.md` — OR — `### Plan Review Skipped` recorded in `history.md` with a valid skip reason
- [ ] `### Approved Plan` (or `### Plan Review Skipped`) appended to `history.md`
- [ ] If Spec / Contract or stamped: `Status: APPROVED_FOR_IMPLEMENTATION` recorded in `history.md`
- [ ] If Spec / Contract: `## Spec Delta` present in `plan.md` and affected specs listed
- [ ] A dedicated git branch exists for this change (create with `git checkout -b <change-id>` if not already on one)
- [ ] Relevant GitHub Issues linked in `plan.md` under `## Linked Items` (if applicable)
- [ ] All open plan conditions (margin defaults, design decisions flagged in plan) are resolved before coding

**If any item is unchecked, stop and resolve it. Do not proceed to implementation.**


### Spec and Contract Files

Active specs and contracts such as `DRUMMARK_SPEC.md` and `RENDER_LAYOUT_CONTRACT.md` remain append-only unless the user explicitly approves a rewrite.

For Spec / Contract Changes:

1. Draft the change in `plan.md` under `## Spec Delta`.
2. Record `## Consolidated Changes` in `history.md` before updating the spec.
3. Append the final addendum to the affected spec or contract before merge.
4. Do not copy review notes or rejected alternatives into spec text.

Full rules live in `project-rules.md`.

### In-Flight Legacy Work

If work already exists under `docs/proposals/`, either finish it under that legacy path or migrate it into `docs/changes/active/<change-id>/` with links in `plan.md` under `## Linked Items`. Do not start duplicate plans for the same work in both systems.

## Rendering Rules

- **Total Delegation:** All score layout decisions (staves, notes, headers, titles, tempo, spacing, collisions, and spans) must be handled through the `RenderScore -> LayoutScene` contract owned by `drummark-layout`.
- **Thin Adapter Only:** Platform adapters may translate resolved scene geometry into drawing commands, glyphs, paths, text, and accessibility/event metadata. Do not add adapter-side engraving logic to simulate or "patch" missing score elements.
- **Graceful Failure:** If the layout engine or adapter cannot render a specific input, fall back only to empty preview states or clear error messages instead of trying to manually draw placeholders.

## Debugging Tools

- **Initial Diagnosis**: When encountering parser, normalization, or rendering bugs, ALWAYS use `npm run drummark` to isolate the problem.
    - Treat the CLI pipeline as `input -> ast -> ir -> xml/svg`.
    - Use `--format ast` to inspect parser / AST shaping problems before normalization.
    - Use `--format ir` to verify if the issue is in the parser/normalization phase.
    - Use `--format svg` or `--format xml` to verify if the issue is in the rendering/export phase.
    - Typical usage:
      - `npm run drummark -- <input-file> --format ast`
      - `npm run drummark -- <input-file> --format ir`
      - `npm run drummark -- <input-file> --format svg`
      - `npm run drummark -- <input-file> --format xml`
- **Verification**: After applying a fix, use the tool to verify the output in the relevant format.

## Content Design (Labels & Copy)

- **Translate variable names to human English.** If a label contains a term that only makes sense by reading the source code (`offsetY`, `compression`, `spacing`), it is implementation leakage. Every label must answer "what does this control do to my score?" in the user's own vocabulary.
- **Avoid redundant section headers.** If a section title already communicates the domain ("Page Layout"), a subgroup label repeating the same concept ("Margins") adds noise without information.
- **Use concrete direction words, not coordinate axes.** `X` and `Y` are implementation detail. Prefer "Horizontal" / "Vertical" or "Left/Right" / "Up/Down" for user-facing labels. (Debug-only labels are exempt.)
- **Avoid orphan prepositions.** A label like "Volta Distance" leaves the user asking "distance from what?". Add the missing object ("Volta Offset") or rephrase entirely.
- **Shorten verb phrases to nouns where context is clear.** "Distance from Title Area to Staff" is verbose; "Title Gap" says the same thing in half the characters. In a 280px sidebar, label length is a layout constraint, not just a style preference.
- **Use the user's musical vocabulary, not the renderer's.** "Lower-voice rests" is implementation terminology. The user understands "secondary voice rests."
- **Group labels should name the domain, not the section.** A debug subsection called "Coordinate Offsets" is cold and redundant (the parent already says "Debug"). Use domain terms the user recognizes, or omit the subgroup label entirely.

## UI Design (Settings Panel)

- **Segmentation beats separators.** Never put `border-top` on every setting row — the resulting "striped" look is visual noise. Proximity alone communicates group membership. Reserve visible dividers for group boundaries, drawn on the group label element.
- **Segmented stepper controls.** Three separated boxes (`[-] [input] [+]`) read as unrelated controls. Fuse them with `gap: 0`, shared borders, and connected border-radius (square middle, rounded ends). This matches iOS/macOS stepper conventions.
- **Directional button cues.** Identical `+` and `-` buttons are scannable but not glanceable. Use directional hover tints: red-tone background for decrement, primary-blue background for increment.
- **Debug visual enclosure.** A debug section in the same visual hierarchy as production controls invites accidental tweaks. Enclose it with: distinct background tint (`--bg-warning-soft`), dashed top separator, left accent bar, and rounded corners.
- **Focus visibility is non-negotiable.** `outline: none` without a replacement indicator breaks keyboard navigation. Use `:focus-visible` with a `box-shadow` ring in the primary accent color and `z-index: 1` to prevent clipping by adjacent segmented-control borders.
- **Long labels need a contract.** On a constrained sidebar, labels must use `flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis`, not `flex-shrink: 0; white-space: nowrap`.

## UI Design (Mobile ≤768px)

- Mobile adaptations are additive overrides in a `@media` block, not a separate stylesheet.
- Only change dimensions (min-height, width, font-size, gap) — never re-declare border, background, or structural properties.
- Touch targets must meet 44×44pt minimum.
- Row height scales from 44px (desktop) to 52px (mobile).
- Apply the same focus-ring, hover-tint, and segmented-control structure across all breakpoints.

## CSS Architecture (Theme Compatibility)

- Directional tints must define a `:root[data-theme="dark"]` variant. Light-mode hardcoded colors (e.g., `#eff6ff`) have no meaning in dark mode — use translucent accent values (`rgba(59, 130, 246, 0.15)`) instead.
- The system-dark `@media (prefers-color-scheme: dark)` block must mirror explicit dark-theme variants using the established `:root:not([data-theme="light"]):not([data-theme="dark"])` selector pattern.

## Internationalization (i18n)

### Architecture
- All user-facing UI strings live in `src/i18n/en.json` (source of truth) and `src/i18n/zh.json` (Chinese translations).
- Keys are typed via `src/i18n/keys.ts` — `I18nKey` is a union of all valid key names, preventing typos at compile time.
- Runtime: `src/i18n/context.tsx` exports `<I18nProvider>` (wraps app root in `main.tsx`) and `useT()` hook. `t(key, params?)` replaces `{{param}}` placeholders.

### Adding a New Key
1. Add the key to `I18N_KEYS` array in `src/i18n/keys.ts`
2. Add the English value to `src/i18n/en.json`
3. Add the Chinese value (or `""` stub) to `src/i18n/zh.json`
4. Use `const { t } = useT()` in the component, then `t("key.name")` in JSX

### Adding a Language
1. Add the locale code to the `Locale` type in `src/i18n/context.tsx`
2. Create `src/i18n/<locale>.json` with all keys from `en.json`
3. Add to the `bundles` map in `context.tsx`
4. Add locale detection logic in `resolveLocale()`

### Pluralization
- No pluralization engine. Use `_one` / `_other` suffix convention (e.g., `status.errors_one`, `status.errors_other`).
- Caller is responsible for selecting the correct key based on count.
- Chinese has no plural morphology — map both `*_one` and `*_other` to the same template.

### Scope
- **Translated**: UI chrome (tabs, buttons, tooltips, aria-labels), status bar, settings labels, preview states, alerts.
- **Not translated**: Debug section labels, music notation terms (D.C., Fine, Coda — standard Italian), CLI output, parser error messages, docs page.
