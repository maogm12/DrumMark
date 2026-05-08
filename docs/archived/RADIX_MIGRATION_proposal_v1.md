# Radix UI Component Migration Proposal

## Addendum v2.0: Radix UI Headless Component Integration

### Direction Change

The original Mantine-based proposal (v1.0-v1.1) is superseded. After codebase inspection, the Mantine approach was found to bring disproportionate overhead: a 7.6 MB npm package, PostCSS build pipeline, theme synchronization bridge, and AppShell layout replacement — for a project whose current hand-rolled CSS (1304 lines) is clean, functional, and tightly integrated with VexFlow rendering, Bravura fonts, XML tree styling, and print surfaces.

This v2.0 proposal replaces Mantine with **Radix UI** headless primitives. Radix provides only interaction logic and accessibility (keyboard nav, ARIA properties, focus management). All visual styling stays in the project's existing `styles.css`.

### Goal

Replace the most labor-intensive hand-rolled interaction code with battle-tested, accessible primitives, while preserving the project's existing layout, theme system, and CSS. The targeted areas are:

1. **Settings panel numeric controls** — currently 133 lines of pointer-event drag logic, wheel handling, and stepper state in `NumericSettingControl`
2. **Settings toggle switch** — custom `.toggle-switch` / `.toggle-slider` CSS with no ARIA support
3. **Settings panel grouping** — flat `<div>` sections with no collapse/expand
4. **Tab switching** — custom `<button>` group for Editor/Page/XML switching
5. **Zoom popover** — custom outside-click dismiss logic

### 1. Dependencies

```
@radix-ui/react-slider       (~14 KB gzipped)
@radix-ui/react-switch       (~4 KB gzipped)
@radix-ui/react-accordion    (~9 KB gzipped)
@radix-ui/react-tabs         (~6 KB gzipped)
@radix-ui/react-popover      (~10 KB gzipped)
```

**Total estimated bundle impact**: ~30-60 KB gzipped (shared Radix primitives deduped, no CSS payload).

All five packages have `"react": "^18.0.0 || ^19.0.0"` peer dependencies — fully compatible with the project's React ^19.2.0. No PostCSS, no theme provider, no CSS imports required.

### 2. What Stays Untouched

| Surface | Rationale |
|---------|-----------|
| **Layout** (`.app-shell`, `.workspace`, `.pane`) | Current flex-based layout works correctly across desktop/mobile breakpoints. No need to replace. |
| **Resizer** (`mousemove` + `editorWidth` + `localStorage`) | Handles resizable panes correctly. Radix has no layout primitive that improves this. |
| **Theme system** (`data-theme`, `resolveDocumentTheme`, CSS variables) | Radix is headless — no theme engine to conflict with. |
| **VexFlow rendering** (`.staff-preview-shell-dark`, `filter: invert(1)`) | Completely unaffected. |
| **CodeMirror editor** (`DslEditor`, `src/drummark.ts`) | Completely unaffected. |
| **MusicXML tree** (`.xml-preview`, `.xml-*` classes) | Completely unaffected. |
| **Docs generation** (`build-docs.ts`, `docs.template.html`, `docs.css`) | No change — Radix has no CSS to extract. |
| **Worker, state, export, print** | Completely unaffected. |

### 3. Component Replacements

#### 3a. Slider + NumberInput → `@radix-ui/react-slider`

Replaces `NumericSettingControl` (133 lines in `src/components/NumericSettingControl.tsx`).

Radix provides:
- `<Slider.Root>` with `min`, `max`, `step`, `value`, `onValueChange`
- `<Slider.Track>`, `<Slider.Range>`, `<Slider.Thumb>` — styled via CSS classes
- Keyboard arrows adjust value by step; Home/End jump to min/max
- Pointer capture and drag handled by Radix (no manual `addEventListener`)
- Built-in `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`

The companion `<input type="number">` for precise entry stays as a plain `<input>` paired with the slider value — no need for a separate NumberInput package.

CSS: Existing `.setting-range`, `.setting-stepper`, `.setting-stepper-input` classes get additional Radix state selectors (`[data-disabled]`, `[data-orientation]`).

#### 3b. Toggle Switch → `@radix-ui/react-switch`

Replaces custom `.toggle-switch` / `.toggle-slider` CSS (40 lines) + `<input type="checkbox">`.

Radix provides:
- `<Switch.Root>` with `checked`, `onCheckedChange`, `disabled`
- `<Switch.Thumb>` — styled via CSS
- Built-in `role="switch"`, `aria-checked`, keyboard toggle (Space/Enter)
- `data-state="checked" | "unchecked"` for CSS transitions

CSS: Replace existing `.toggle-switch`/`.toggle-slider` rules with Radix state selectors (`[data-state="checked"]`).

#### 3c. Settings Grouping → `@radix-ui/react-accordion`

Replaces flat `<div className="settings-section">` containers.

Radix provides:
- `<Accordion.Root>` with `type="single"` or `type="multiple"`
- `<Accordion.Item>`, `<Accordion.Trigger>`, `<Accordion.Content>`
- Keyboard navigation between items (Arrow keys, Home/End)
- `data-state="open"|"closed"` for CSS transitions

Grouping scheme (matches current structure, adds collapsibility):
- **Notation** (1 setting: `hideVoice2Rests`)
- **Page Layout** (9 settings: `staffScale`, `systemSpacing`, `stemLength`, `voltaSpacing`, `hairpinOffsetY`, 4 margins)
- **Title Area** (2 settings: `headerHeight`, `headerStaffSpacing`)
- Debug sections (gated on `debugMode`) — rendered as additional Accordion items when `debugMode` is true

CSS: New `.settings-accordion` classes extending existing `.settings-section` spacing.

#### 3d. Tab Switching → `@radix-ui/react-tabs`

Replaces custom `.preview-tabs` / `.preview-tab` button group.

Radix provides:
- `<Tabs.Root>` with `value`, `onValueChange`, `orientation`
- `<Tabs.List>`, `<Tabs.Trigger>`, `<Tabs.Content>`
- Keyboard navigation (Arrow keys between tabs)
- `data-state="active"|"inactive"` for CSS

The existing `settings.activeTab` (`MainTab = "editor" | "page" | "xml"`) maps directly to `<Tabs.Root value={settings.activeTab} onValueChange={(v) => updateSetting("activeTab", v as MainTab)}>`.

CSS: Replace `.preview-tabs`/`.preview-tab` with Radix state selectors.

#### 3e. Zoom Popover → `@radix-ui/react-popover`

Replaces custom `.page-zoom-popover` + outside-click `mousedown` listener (15 lines in App.tsx).

Radix provides:
- `<Popover.Root>`, `<Popover.Trigger>`, `<Popover.Content>`, `<Popover.Close>`
- Built-in outside-click dismiss, Escape key dismiss, focus trapping
- `Portal` rendering (avoids z-index stacking issues)
- `data-state="open"|"closed"` for CSS

CSS: Adapt `.page-zoom-menu`/`.page-zoom-popover` to Radix Popover.Content selectors.

### 4. Non-Goals

- No layout system replacement (keep custom flex CSS)
- No theme engine (keep `data-theme` + CSS variables)
- No PostCSS build pipeline
- No CSS file imports (Radix ships zero CSS)
- No dependency on React component libraries beyond Radix primitives
- No docs page migration (Radix has no CSS to backport)
- No `react-resizable-panels` (current resizer stays)

### 5. CSS Strategy

All visual styling stays in `src/styles.css`. Radix components expose `data-state`, `data-orientation`, `data-disabled` attributes on their DOM elements — CSS selectors target these:

```css
/* Example: Radix Switch */
.toggle-root[data-state="checked"] { background: var(--accent-primary); }
.toggle-thumb[data-state="checked"] { transform: translateX(20px); }

/* Example: Radix Accordion */
.settings-trigger[data-state="open"] { border-bottom-color: var(--accent-primary); }
.settings-content[data-state="open"] { animation: accordionSlideDown 200ms ease; }
.settings-content[data-state="closed"] { animation: accordionSlideUp 200ms ease; }
```

No new CSS files. Obsolete rules (custom `.toggle-switch`/`.toggle-slider`, `.preview-tabs`/`.preview-tab`, `.page-zoom-popover` mousedown logic) are removed from `styles.css` only after their Radix replacements are verified.

### 6. Bundle Budget

Target: main bundle increase ≤ 60 KB gzipped. Verified via `npm run bundle:report` after each task.

---

### Review Round 1
**Reviewer: Lead Engineer (Post-Audit Codebase)**

Awaiting review.

STATUS: PENDING_REVIEW

### Review Round 1
**Reviewer: Critical Architect**

**1. Slider replacement omits stepper buttons entirely**

The proposal says to replace `NumericSettingControl` with `<Slider.Root>` + `<input type="number">`, but the current component (`NumericSettingControl.tsx:80-130`) has THREE controls: the range slider, +/- stepper buttons, AND a number input. Radix Slider provides only the track/thumb/range. The stepper buttons are a separate UI concern with no Radix equivalent. Deleting `NumericSettingControl.tsx` and writing inline code per call site (20 call sites across 7 sections) means duplicating stepper button markup and logic 20 times — a regression in DRY. A better approach: refactor the component to use Radix Slider internally but keep it as a reusable component wrapper (e.g., `NumericSettingControl` still exists but uses `<Slider.Root>` inside).

**2. Tabs dual-rendering conflict with Radix's single-root model**

The current code renders TWO copies of the tab bar (`App.tsx:958-963` in editor pane header, `App.tsx:974-979` in preview pane header), with `.tab-editor` hidden on desktop via `@media (min-width: 769px)`. Radix Tabs expects a single `<Tabs.Root>` context. Two `<Tabs.Root>` instances sharing the same `value` would have independent ARIA state and keyboard navigation — an accessibility regression. The proposal must address this: either (a) use a single `<Tabs.Root>` wrapping the outer layout, (b) keep one tab bar as custom buttons (not Radix), or (c) synchronize two Tabs.Root instances with shared `value`/`onValueChange` and accept duplicate ARIA landmarks.

**3. Radix Slider drag semantics are absolute, not relative**

The current custom slider (`NumericSettingControl.tsx:42-72`) uses a relative drag model: when the user pointer-downs anywhere on the track, drag delta from the initial point is applied relative to the current value. This means clicking at position 30% on a track with value 50 and dragging right increases the value smoothly from 50. Radix Slider's built-in behavior is absolute positioning — the thumb jumps to the click position. This is a UX behavior change that may disorient users who are used to the current relative-drag feel, especially on mobile where precise thumb targeting is difficult. The proposal should note this behavioral difference and whether it's acceptable.

**4. Radix Slider does not handle wheel events**

The current component has custom `handleRangeWheel` (`NumericSettingControl.tsx:74-78`) that adjusts the value by step on wheel scroll (preventDefault). Radix Slider has no built-in wheel support. The proposal says "Drag, wheel, keyboard arrow, Home/End all adjust values correctly" in Task 2 acceptance criteria, but if the wheel handler is removed, that acceptance criterion fails. The wheel handler must be explicitly re-implemented on a parent wrapper since Radix doesn't provide it.

**5. Value normalization (`stepPrecision` / `normalizeSteppedValue`) has no explicit migration path**

`NumericSettingControl.tsx:13-17` applies `normalizeSteppedValue` which clamps to min/max AND rounds to the step's decimal precision. Radix Slider's `onValueChange` returns the raw value. If a user types `0.751` into the number input with `step=0.05`, the current code rounds to `0.75`. The proposal doesn't mention this normalization in the Radix mapping — it must be applied in the `onValueChange` callback for each call site.

**6. Accordion `type="single"` + conditional `debugMode` items = stale controlled index**

When `debugMode` is true, 7 Accordion items exist; when false, only 3 exist. With `type="single"` and a controlled `value` prop, if the open item is "debug-tempo" (index 4) and `debugMode` becomes false, that value reference becomes dangling. The proposal should specify: (a) `type="multiple"` instead, or (b) `type="single"` with `value` explicitly reset when `debugMode` changes, or (c) use uncontrolled mode with `defaultValue` scoped to one of the always-visible items.

**7. Radix Popover Portal breaks z-index stacking context**

Radix Popover renders to `document.body` via `Portal` by default. The current zoom popover relies on `.page-zoom-menu { position: relative }` as its stacking context parent, and z-index 100 within the page surface toolbar. Portal rendering takes it out of the page surface stacking context entirely. This means: (a) the popover won't scroll with the page surface (maybe fine), (b) z-index must be managed globally, and (c) the dark-mode `filter: invert(1)` on `.staff-preview-shell-dark` will NOT apply to the portal-rendered popover. The fix is either `modal={false}` with a custom container, or explicit portal z-index management. The proposal doesn't address this.

**8. Popover controlled state: internal close calls from "100%" button**

The current code calls `setPageZoomMenuOpen(false)` from inside the popover's "100%" reset button (`App.tsx:997`). With Radix Popover in controlled mode (`open={pageZoomMenuOpen} onOpenChange={setPageZoomMenuOpen}`), the "100%" button must also call `setPageZoomMenuOpen(false)`. But if the Popover uses the `<Popover.Close>` component instead, the popover dismisses unconditionally — the "100%" button then needs to both update state AND close. The proposal should clarify: keep controlled mode or use `<Popover.Close>` as a child of the reset button.

**9. CSS preservation checklist is missing critical rules**

The preservation list in Task 6 omits several CSS rules that are NOT being replaced and must survive:
- `.preview-content`, `.preview-surface`, `.preview-surface.active` (visibility toggling for page/XML surfaces; these are distinct from tab triggers and must persist regardless of Tabs replacement)
- `.setting-row`, `.setting-label`, `.setting-value` (individual control row layout inside accordion panels)
- `.padding-grid`, `.padding-grid-container`, `.padding-grid-middle`, `.setting-label-small` (page margins sub-grid)
- `.preview-header-actions`, `.mobile-only-actions` (pane header action containers)
- `--thumb-border`, `--thumb-shadow`, `--thumb-drag-shadow` CSS variables — these exist ONLY for the native range slider thumb pseudo-elements. If the slider thumb pseudo-elements are removed, these variables should be removed too (or explicitly preserved in the checklist if they remain orphaned).

Additionally, the `.preview-tab.tab-editor { display: none }` desktop rule has no equivalent in the Radix Tabs plan. After replacing with `<Tabs.Trigger>`, this needs a CSS rule like `.tabs-trigger[data-editor-tab] { display: none }` at desktop breakpoints.

**10. No `accordionSlideDown`/`accordionSlideUp` keyframes exist**

The proposal's CSS example shows `animation: accordionSlideDown 200ms ease` and `accordionSlideUp 200ms ease` — these keyframe animations don't exist in the codebase. Radix Accordion provides `data-state="open"|"closed"` but NO animation. The `@keyframes accordionSlideDown` and `@keyframes accordionSlideUp` need to be defined in `styles.css` — the proposal should note this as a new CSS addition, not just a replacement.

**11. Bundle budget of "≤ 60 KB gzipped" is misleadingly generous**

Actual Radix package sizes (from bundlephobia, min+gz):
- `@radix-ui/react-slider`: ~2.5 KB
- `@radix-ui/react-switch`: ~0.6 KB
- `@radix-ui/react-accordion`: ~2.2 KB
- `@radix-ui/react-tabs`: ~1.4 KB
- `@radix-ui/react-popover`: ~2.8 KB
Shared primitives (tree-shaken): ~3-5 KB

Realistic total: **~12-15 KB gzipped**. The 60 KB threshold is ~4x the expected size and won't catch an accidental large dependency slipping in. The budget should be ≤ 25 KB gzipped for meaningful enforcement, with an explanation that this includes deduplicated shared primitives.

**12. Task 1 bundle-size acceptance criterion can't be verified**

Task 1 acceptance criteria say "bundle increase ≤ 60 KB gzipped" but no Radix code is imported at install time — the bundle size won't change. This criterion belongs in Tasks 2-5 (post-import), not Task 1.

**13. No settings panel smoke test**

The 440 existing tests cover parser logic, VexFlow rendering, and CLI. Zero tests cover `SettingsPanel`, `NumericSettingControl`, or any UI component. The acceptance criterion "npm test remains green" is vacuous protection — nothing in the test suite can break from a Radix migration. A minimal render smoke test (mount `<SettingsPanel>` with mock settings, verify it renders without crashing) should be added as a task or as an acceptance criterion within Task 2 or 3.

**14. TypeScript: Radix packages fully self-type — no `@types/*` needed, but verify exports**

All 5 Radix packages ship their own `.d.ts` declarations. However, verify that the `onValueChange` callback for Slider correctly types as `(value: number[]) => void` (not `(value: number) => void`). The proposal maps it to `updateSetting("staffScale", value)` which expects a single number, but Radix Slider returns `number[]` (for multi-thumb support). The wrapper must extract `value[0]`.

**15. Missing task for Radix `data-state` CSS selectors migration**

Tasks 2-5 each mention CSS scope but there's no explicit task verifying that all Radix `data-state` selectors are correctly mapped to the existing visual CSS. For example, the current `.preview-tab.active` uses a `.active` class; Radix uses `data-state="active"`. The CSS migration from class-based to attribute-based selectors is substantial (~40+ lines of new CSS) and spans multiple components. This should have a dedicated validation step or be explicitly called out within each task's CSS scope.

**STATUS: CHANGES_REQUESTED**

### Author Response

Accepted. The proposal and tasks are amended here via operative overrides.

#### Response to critique 1: Stepper buttons preserved via component refactor, not deletion

The proposal text "NumericSettingControl.tsx is deleted" is overridden. **NumericSettingControl remains as a reusable component** that internally uses `<Slider.Root>` + its existing stepper buttons + number input. No inline duplication across 20 call sites. The component signature stays the same (`label`, `value`, `min`, `max`, `step`, `onChange`) — SettingsPanel.tsx call sites need zero changes in Task 2.

#### Response to critique 2: Two synchronized Tabs.Root instances

The proposal is amended to use **two separate `<Tabs.Root>` instances** with `value={settings.activeTab}` and `onValueChange={(v) => updateSetting("activeTab", v as MainTab)}` on both. Each renders only the triggers relevant to its location:

- **Editor pane Tabs.Root** (mobile-only): renders all 3 triggers; desktop hides via CSS `display: none` on the editor-pane container
- **Preview pane Tabs.Root**: renders Page and XML triggers; desktop always visible

The components are not wrapped in a single `<Tabs.Content>` since each pane already has its own visibility logic (`.preview-surface.active`). This preserves the existing CSS-based surface switching while Radix handles only the trigger button state and ARIA.

Desktop `.tab-editor` hiding is achieved via CSS `display: none` on the editor pane's `<Tabs.List>` wrapper at `@media (min-width: 769px)`.

#### Response to critique 3: Absolute vs relative drag tradeoff accepted

Radix Slider's absolute-positioning drag model is accepted as a behavioral change. The current relative-drag implementation was an intentional UX choice but is not load-bearing — the slider's primary interaction mode is the stepper buttons (which stay) and direct number input (which stays). The slider track serves as a coarse-adjustment control where absolute positioning is standard.

#### Response to critique 4: Wheel event re-implemented on wrapper

The wheel handler is re-implemented inside `NumericSettingControl` as a `onWheel` listener on the wrapper `<div>` containing the Slider. The handler adjusts the value by `step` in the direction of scroll (down = decrease, up = increase).

#### Response to critique 5: Value normalization preserved via `normalizeSteppedValue`

`normalizeSteppedValue` is applied in the `onValueChange` callback within `NumericSettingControl`. The number input's `onChange` also routes through the same normalization pipeline. Implementation: `onValueChange={(vals) => onChange(normalizeSteppedValue(vals[0], min, max, step))}`.

#### Response to critique 6: Accordion uses `type="multiple"` to avoid stale controlled index

The Accordion uses `<Accordion type="multiple">` (uncontrolled) so each panel's open/close state is independent. When `debugMode` changes, panels are added/removed via conditional rendering. Radix Accordion handles removed panels gracefully — their open state evaporates with the DOM node. No need for `value` prop or reset logic.

#### Response to critique 7: Popover Portal z-index and dark-mode mitigated via `modal={false}`

The Popover uses `<Popover.Portal modal={false}>` which renders the content in the portal but avoids focus trapping. Z-index is set via CSS on the portal content: `.zoom-popover-content { z-index: 50; }`. Dark-mode filter interaction is handled by applying the same CSS variable-based background to the popover content (which inherits from `:root[data-theme]` since Portal children are still in the same document).

#### Response to critique 8: "100%" button closes popover via `onOpenChange(false)`

The "100%" button uses the Popover in controlled mode: `open={pageZoomMenuOpen} onOpenChange={setPageZoomMenuOpen}`. The "100%" button handler calls both `updateSetting("pageScale", 1)` and `setPageZoomMenuOpen(false)`. No `<Popover.Close>` nesting needed — the controlled pattern keeps all close logic in App.tsx event handlers.

#### Response to critique 9: CSS preservation checklist completed

The following CSS rule families are added to the Task 6 preservation list:
- `.preview-content`, `.preview-surface`, `.preview-surface.active` (surface visibility, distinct from Tabs)
- `.setting-row`, `.setting-label`, `.setting-value` (control row layout)
- `.padding-grid-container`, `.padding-grid`, `.padding-grid-middle`, `.setting-label-small` (page margins sub-grid)
- `.preview-header-actions`, `.mobile-only-actions` (pane header action containers)
- `.surface-toolbar`, `.toolbar-group`, `.surface-icon-button` (toolbar buttons)
- `.page-zoom-menu`, `.page-zoom-popover` (if Radix Popover CSS replaces these, they can be removed)
- `--thumb-border`, `--thumb-shadow`, `--thumb-drag-shadow` CSS variables (removed only if native slider pseudo-elements are removed)

Additionally, the `.tab-editor` desktop-hiding behavior is replaced by `@media (min-width: 769px) { .editor-pane-tabs { display: none; } }`.

#### Response to critique 10: `accordionSlideDown`/`accordionSlideUp` keyframes added to proposal

The proposal is amended: Task 3 or Task 6 adds `@keyframes accordionSlideDown { from { height: 0; opacity: 0; } to { height: var(--radix-accordion-content-height); opacity: 1; } }` and the corresponding `accordionSlideUp` reverse animation to `styles.css`.

#### Response to critique 11: Bundle budget tightened to ≤ 25 KB gzipped

Target revised from ≤ 60 KB to **≤ 25 KB gzipped** based on actual Radix package sizes (~12-15 KB + margin for shared primitives). Verified via `npm run bundle:report` at Task 2 (first import of Radix code).

#### Response to critique 12: Bundle check moved to Task 2+

Removed bundle-size criterion from Task 1. Added to Task 2 acceptance criteria: "`npm run bundle:report` shows main bundle increase ≤ 25 KB gzipped vs pre-migration baseline."

#### Response to critique 13: Settings panel smoke test added as Task 5

A new Task 5 (Shim Position) is inserted: "Add Settings Panel Smoke Test". Task 4 (Tabs), Task 5 (Popover), Task 6 (CSS Cleanup), and Task 7 (Archival) are renumbered accordingly. The test mounts `<SettingsPanel>` in jsdom with mock props and verifies:
- All 3 always-visible sections render with correct controls
- `debugMode=true` renders all 7 sections
- `debugMode=false` renders 3 sections
- Component does not crash on mount

#### Response to critique 14: `number[]` extraction added to callback wrapping

All `onValueChange` callbacks use `(vals: number[]) => onChange(someFunc(vals[0]!))`. The `!` is safe because `value` is initialized to a valid range value and Radix always emits non-empty arrays for single-thumb sliders.

#### Response to critique 15: Data-state CSS migration is explicitly called out per task

Each Task 2-4 explicitly states that CSS rules must be added for Radix `data-state` selectors. Task 6 (CSS Cleanup) is now gated on all data-state styles being present and verified. No data-state migration proceeds without corresponding component migration.

---

### Review Round 2
**Reviewer: Critical Architect**

#### F1. (CRITICAL) Preview pane Tabs.Root missing Editor trigger breaks mobile tab switching

The Author Response for critique #2 states that the **preview pane Tabs.Root renders "Page and XML triggers" only**. The current code renders ALL THREE triggers in the preview pane tab bar (`App.tsx:976-978`), with the Editor trigger hidden on desktop via `@media (min-width: 769px) { .preview-tab.tab-editor { display: none; } }` (`styles.css:1291-1296`). The `.tab-editor` is **visible on mobile**.

On mobile (`≤768px`), only the active pane is visible (`styles.css:1244-1258`): `.pane` has `visibility: hidden` and `.pane.active` has `visibility: visible`. When viewing Page or XML, the preview pane is active and the editor pane is `visibility: hidden` (unfocusable, unclickable, invisible). The **only** way to switch back to the Editor view on mobile is the Editor trigger inside the **preview pane** tab bar. Removing it from the preview pane Tabs.Root means mobile users on Page/XML views cannot switch to Editor — a confirmed UI regression.

**Required fix**: The preview pane Tabs.Root MUST render all 3 triggers (Editor, Page, XML). The Editor trigger is hidden on desktop via `@media (min-width: 769px) { .tabs-trigger[data-editor-tab] { display: none; } }`, replicating the existing `.tab-editor` desktop-hide pattern.

This affects:
- Proposal §3d Author Response override (currently says "Page and XML triggers only")
- Task 4 acceptance criteria (needs: "Preview pane Tabs.Root includes Editor trigger; hidden on desktop via CSS")
- Task 7 removal list (`.tab-editor` CSS removal must note replacement by `[data-editor-tab]` desktop-hide rule)

#### F2. (CRITICAL) `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` unaccounted in Task 7 CSS cleanup

The zoom popover's inner content uses 5 CSS classes (readout text, button grid, action buttons, reset button, fit-width modifier; `styles.css:547-591`). These are **not** the `.page-zoom-popover` container — they are child elements that remain functional inside `<Popover.Content>` (Task 6 criteria: "Zoom controls remain functional"). Task 7 lists `.page-zoom-popover` for removal but neither preserves nor removes these 5 child classes. They risk being orphaned or accidentally deleted during cleanup.

**Required fix**: Add these 5 classes to the Task 7 **Preserved** checklist (they style functional popover content, not the removed container). Alternatively, if replaced by new Radix Popover CSS classes, add them to the **Removed** list with a note about their replacements.

#### F3. (MODERATE) No final bundle-size verification after all 5 packages imported

Bundle budget (≤25 KB) is checked only in Task 2 (first Radix import, `@radix-ui/react-slider` alone ≈2.5 KB). Tasks 3, 4, and 6 each add more packages but carry no bundle-size criterion. By Task 7 (CSS Cleanup), **all 5 packages are imported** and CSS is finalized — the natural point for a definitive bundle check — yet Task 7 lacks one. The 25 KB threshold is trivially satisfied by any single-package import and provides no guard against cumulative bloat.

**Required fix**: Add `npm run bundle:report` shows main bundle increase ≤25 KB gzipped vs pre-migration baseline to Task 7 acceptance criteria, or add bundle checks to Tasks 3, 4, and 6 individually.

#### F4. (MODERATE) `.editor-pane-tabs` referenced in Task 7 removal list before it exists

Task 7 states: `Removed: .preview-tabs, .preview-tab, .tab-editor (replaced by Radix Tabs + display: none on .editor-pane-tabs)`. But `.editor-pane-tabs` **does not exist** in the current codebase — it will be newly created in Task 4. The parenthetical implies it already exists and needs a rule change. This is confusing for implementers.

**Required fix**: Rephrase: "(replaced by Radix Tabs CSS; editor pane Tabs.List hidden on desktop via new class `.editor-pane-tabs` with `display: none` at `@media (min-width: 769px)`)".

#### F5. (MINOR) Proposal Author Response #9 uses conditional language inconsistent with resolved Task 7

Proposal §9 Author Response says: "`.page-zoom-menu`, `.page-zoom-popover` (if Radix Popover CSS replaces these, they can be removed)" — the conditional "if...they can be" is deprecated. Task 7 already definitively lists `.page-zoom-popover` for **removal** and `.page-zoom-menu` for **preservation**. The proposal language should match the resolved decision.

**Required fix**: Update proposal Author Response #9 to state: "`.page-zoom-popover` (removed, replaced by Radix Popover.Content CSS); `.page-zoom-menu` (preserved, serves as trigger container)".

#### F6. (MINOR) `accordionSlideDown`/`accordionSlideUp` keyframes missing `overflow: hidden` requirement

Radix Accordion content height animation requires `overflow: hidden` on `.AccordionContent` during expand/collapse to prevent text flash. Neither Task 3 criteria nor the proposal mentions this. An implementer following only the task description may produce a flash/jitter animation.

**Required fix**: Add to Task 3 CSS scope: "`.settings-content` needs `overflow: hidden` during open/close animation transitions (standard Radix Accordion animation pattern)".

#### Verifications that PASS

- **Critique 1 (stepper buttons)**: NumericSettingControl refactored as wrapper with unchanged signature; Task 2 scope covers only that file + CSS; SettingsPanel.tsx needs zero changes in Task 2. ✓
- **Critique 2 (keyboard nav interaction)**: Radix Tabs controlled mode uses arrow keys for roving tabindex (focus only) — `onValueChange` fires only on click/Enter activation. Two shared-`value` instances will not interfere via keyboard. ✓ (Subject to F1 fix for trigger set.)
- **Critique 3 (absolute vs relative drag)**: Accepted tradeoff documented; stepper buttons remain as precision controls. ✓
- **Critique 4 (wheel events)**: Explicitly re-implemented as `onWheel` on wrapper div in Task 2 criteria. ✓
- **Critique 5 (normalizeSteppedValue)**: Applied in `onValueChange` callback; unchanged `applyValue()` routing. ✓
- **Critique 6 (Accordion type="multiple")**: Uncontrolled, independent panel state; `debugMode` toggle unmounts items cleanly. Console-error criterion added. ✓
- **Critique 7 (Popover Portal dark mode)**: `modal={false}`, z-index via `.zoom-popover-content`, background inherits from `:root[data-theme]`. Popover was never inside `.staff-preview-shell-dark`. ✓
- **Critique 8 ("100%" close)**: Controlled mode; `setPageZoomMenuOpen(false)` in button handler. ✓
- **Critique 9 (CSS preservation)**: `.preview-content/.preview-surface/.preview-surface.active`, `.setting-row/.setting-label/.setting-value`, `.padding-grid*`, `.preview-header-actions/.mobile-only-actions`, `.surface-toolbar/*` all now listed. ✓ (Subject to F2 above.)
- **Critique 10 (keyframes)**: `@keyframes` added to Task 3 CSS scope. ✓ (Subject to F6 above.)
- **Critique 11 (bundle budget)**: Updated to ≤25 KB. ✓ (Subject to F3 above.)
- **Critique 12 (bundle check placement)**: Removed from Task 1, added to Task 2. ✓
- **Critique 13 (smoke test)**: New Task 5 inserted at correct position; depends on Task 3 (transitively Task 2). ✓
- **Critique 14 (number[] extraction)**: `vals[0]!` extraction documented; `tsc -b` verification in Task 1. ✓
- **Critique 15 (data-state CSS)**: Called out per-task (Tasks 2, 3, 4, 6 CSS scopes). ✓
- **Task ordering**: Task 1→2→3→5(smoke)→4(Tabs, deps T1)→6(Popover, deps T1)→7(CSS, deps T3,T4,T6)→8(Archive, deps T7). No deadlocks. Task 7 transitively depends on Task 2 through Task 3. ✓
- **NumericSettingControl zero call-site changes**: Signature preserved; SettingsPanel.tsx excluded from Task 2 scope. ✓
- **`bundle:report` script verification**: Exists at `scripts/report_bundle.mjs` (`package.json:11`). ✓

**STATUS: CHANGES_REQUESTED**

F1 and F2 are blocking. F3 and F4 require attention. F5 and F6 are nice-to-fix.

### Author Response (Round 2)

Accepted. All six findings are resolved as follows.

#### F1 (BLOCKING): Preview pane Tabs.Root now renders all 3 triggers

Overridden. The preview pane `<Tabs.Root>` renders **Editor, Page, XML** triggers in all viewport sizes. On desktop (`@media (min-width: 769px)`), the Editor trigger in the preview pane is hidden via CSS `display: none` — matching the current `.tab-editor` strategy. On mobile, this trigger is the sole touch target to switch back from Page/XML to the editor.

Task 4 acceptance criterion added: "Preview pane Tabs.Root renders all 3 triggers; Editor trigger hidden on desktop via CSS."

#### F2 (BLOCKING): Zoom popover inner-content CSS preserved

Task 7 preservation checklist gains:
- `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button`

These style the popover's inner content (scale display, steppers, toggle, reset) — the JSX content stays identical, only the container changes from custom `<div>` to `<Popover.Content>`.

#### F3 (MODERATE): Accumulative bundle check added

Task 7 acceptance criteria gain: "`npm run bundle:report` shows total bundle increase ≤ 25 KB gzipped vs pre-migration baseline (all 5 Radix packages accumulated)."

#### F4 (MODERATE): Class existence resolved

`.editor-pane-tabs` is created by Task 4 and referenced by Task 7. Since Task 7 depends on Task 4, the class exists at execution time. No amendment needed.

#### F5: `overflow: hidden` added to keyframes

The `@keyframes accordionSlideDown`/`accordionSlideUp` definitions include `overflow: hidden` on both `from` and `to` keyframes. Documented in Task 3 CSS scope.

#### F6: "Can be removed" wording resolved

The proposal text `.page-zoom-popover` is definitively resolved: **inner-content CSS classes are preserved**, the `.page-zoom-popover` outer positioning CSS block is **removed**. Task 7 reflects this.


### Review Round 3
**Reviewer: Final Arbiter**

All six Round 2 findings verified against Author Response (Round 2):

- **F1 (BLOCKING):** Preview pane Tabs.Root now includes all 3 triggers (Editor, Page, XML). Editor trigger hidden on desktop via `[data-editor-tab]` CSS. Matches existing mobile tab-switching behavior. ✓
- **F2 (BLOCKING):** `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` added to Task 7 preservation checklist. Only `.page-zoom-popover` outer container CSS is removed. ✓
- **F3 (MODERATE):** Accumulative bundle check (≤25 KB gzipped, all 5 packages) added to Task 7 acceptance criteria. ✓
- **F4 (MODERATE):** `.editor-pane-tabs` class existence resolved — created in Task 4, consumed in Task 7; dependency chain guarantees availability. ✓
- **F5 (MINOR):** `overflow: hidden` added to `accordionSlideDown`/`accordionSlideUp` keyframes; documented in Task 3 CSS scope. ✓
- **F6 (MINOR):** Conditional ".page-zoom-popover" language in proposal §9 resolved to definitive removal/preservation statements. ✓

Minor observation: proposal Author Response F5/F6 labels are swapped relative to Review Round 2 labels, but both substantive concerns are correctly addressed. Non-blocking. No regressions or new ambiguities introduced.

**STATUS: APPROVED**
