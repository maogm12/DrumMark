# Radix UI Migration Tasks

## Task 1: Install Radix Dependencies
- [ ] **Status**: Pending
- **Scope**: `package.json`, `package-lock.json`
- **Commits**: `chore: add radix-ui dependencies`
- **Acceptance Criteria**:
  - `npm install` succeeds with all 5 Radix packages (`@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-accordion`, `@radix-ui/react-tabs`, `@radix-ui/react-popover`)
  - `npm run build` remains green
  - `npm test` remains green (440 tests)
  - `npm run bundle:report` shows main bundle increase ≤ 60 KB gzipped
- **Dependencies**: None

## Task 2: Replace Settings Slider with Radix Slider
- [ ] **Status**: Pending
- **Scope**: `src/components/NumericSettingControl.tsx`, `src/components/SettingsPanel.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace custom NumericSettingControl with Radix Slider`
- **Acceptance Criteria**:
  - All 19 numeric settings in `SettingsPanel` use `<Slider.Root>` + `<input type="number">`
  - Drag, wheel, keyboard arrow, Home/End all adjust values correctly
  - `min`, `max`, `step` constraints are enforced
  - Settings values persist to localStorage and flow to VexFlow rendering unchanged
  - `src/components/NumericSettingControl.tsx` is deleted (replaced by inline Radix + number input per call site)
  - Mobile touch targets are significantly larger (Radix Thumb default ~20px, configurable via CSS)
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1

## Task 3: Replace Toggle with Radix Switch + Accordion Groups
- [ ] **Status**: Pending
- **Scope**: `src/components/SettingsPanel.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace settings toggle with Radix Switch and add Accordion grouping`
- **Acceptance Criteria**:
  - `hideVoice2Rests` boolean uses `<Switch.Root>` + `<Switch.Thumb>` with proper ARIA role
  - Keyboard toggle (Space/Enter) works
  - Settings panel sections are grouped into `<Accordion.Root>` items:
    - Notation (always visible)
    - Page Layout (always visible)
    - Title Area (always visible)
    - Debug: Tempo Marking (visible only when `debugMode` is true)
    - Debug: Measure Numbers (visible only when `debugMode` is true)
    - Debug: Note Spacing (visible only when `debugMode` is true)
    - Debug: Measure Widths (visible only when `debugMode` is true)
  - Accordion items are collapsible with animated open/close
  - Keyboard navigation between Accordion items works
  - All Accordion content renders correctly (Radix Slider components from Task 2 inside Accordion panels)
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 2

## Task 4: Replace Tab Switching with Radix Tabs
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace custom tab switching with Radix Tabs`
- **Acceptance Criteria**:
  - Editor/Page/XML view switching uses `<Tabs.Root>`, `<Tabs.List>`, `<Tabs.Trigger>`, `<Tabs.Content>`
  - `settings.activeTab` drives `value` prop; `onValueChange` calls `updateSetting("activeTab", ...)`
  - Keyboard arrow key navigation between tabs
  - Current tab has `data-state="active"` for CSS styling
  - Mobile layout (tab bar in editor pane header) still works
  - Desktop layout (tab bar in preview pane header, editor tab hidden) still works
  - Settings panel auto-collapse on tab switch still works
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1

## Task 5: Replace Zoom Popover with Radix Popover
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace custom zoom popover with Radix Popover`
- **Acceptance Criteria**:
  - Zoom menu uses `<Popover.Root>`, `<Popover.Trigger>`, `<Popover.Content>`
  - Outside-click dismiss works (built into Radix, no manual `mousedown` listener)
  - Escape key dismiss works
  - Zoom controls (scale, fit-width, reset) remain functional
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1

## Task 6: CSS Cleanup
- [ ] **Status**: Pending
- **Scope**: `src/styles.css`
- **Commits**: `style(ui): remove obsolete CSS rules replaced by Radix components`
- **Acceptance Criteria**:
  - Removed: `.toggle-switch`, `.toggle-slider` (replaced by Radix Switch CSS)
  - Removed: `.preview-tabs`, `.preview-tab`, `.tab-editor` (replaced by Radix Tabs CSS)
  - Removed: `.page-zoom-popover` outside-click logic (replaced by Radix Popover)
  - Removed: manual slider pseudo-element rules (`.setting-range::-webkit-slider-thumb`, `::-moz-range-thumb`) if no longer needed
  - **Preserved** (explicit checklist):
    - `.staff-preview-shell-dark` (VexFlow dark mode SVG inversion)
    - `@font-face` Bravura declaration
    - `.xml-preview`, `.xml-*` classes (MusicXML tree viewer)
    - `.staff-preview-page`, `.staff-printable*` (print support)
    - `.editor-shell`, `.editor-container` (CodeMirror wrapper)
    - `:root` / `:root[data-theme="dark"]` CSS variable blocks
    - `.app-shell`, `.workspace`, `.pane`, `.resizer` (layout)
    - `.app-header`, `.status-bar`, `.error-list` (chrome)
    - `.settings-panel`, `.settings-panel.active` (panel visibility)
    - Responsive `@media (max-width: 768px)` block
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 2, Task 3, Task 4, Task 5

## Task 7: Consolidation & Archival
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/MANTINE_MIGRATION_proposal_v1.md`, `docs/proposals/MANTINE_MIGRATION_tasks_v1.md`, `docs/archived/`, `LEARNINGS.md`
- **Commits**: `docs: consolidate radix migration proposal and archive artifacts`
- **Acceptance Criteria**:
  - Proposal and tasks files renamed to `RADIX_MIGRATION_*` and moved to `docs/archived/`
  - Final summary added to `LEARNINGS.md`
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 6

### Review Round 1
**Reviewer: Critical Architect**

**1. Task 1 bundle-size acceptance criterion is impossible to verify at install time**

Task 1 says "bundle increase ≤ 60 KB gzipped" as an acceptance criterion, but no Radix code is imported at install time — the main bundle won't change. This criterion cannot be validated at Task 1. Move it to Tasks 2-5 where `@radix-ui/*` imports first appear, and lower the threshold from 60 KB to 25 KB (see proposal review item #11 for actual size calculation).

**2. Task 1 should also verify TypeScript type resolution**

After `npm install`, verify that `import { Root, Track, Range, Thumb } from "@radix-ui/react-slider"` type-checks (`tsc -b`). Radix Slider's `onValueChange` returns `number[]` (array for multi-thumb), but the settings code expects a single `number`. The type assertion `(vals: number[]) => updateSetting("staffScale", vals[0])` must be validated at this stage to avoid mid-implementation type errors.

**3. Task 2 (Slider) missing stepper button implementation plan**

Task 2 says "replace custom NumericSettingControl with Radix Slider" and "NumericSettingControl.tsx is deleted (replaced by inline Radix + number input per call site)." But the current component has three controls: range slider, stepper buttons (+/-), and number input. Replacing with just `<Slider.Root>` + `<input type="number">` drops the stepper buttons entirely. Either:

- Task 2 must include stepper button markup inline at each call site (20x duplication, regression in DRY), or
- `NumericSettingControl.tsx` should be refactored (not deleted) to use Radix Slider internally while keeping the stepper buttons and number input in a reusable wrapper.

Acceptance criteria should explicitly list: "All three controls (slider range, +/- stepper buttons, number input) remain at each call site."

**4. Task 2 must re-implement wheel scroll handling**

The current code has `handleRangeWheel` (`NumericSettingControl.tsx:74-78`) that adjusts values on mouse wheel. Radix Slider has no built-in wheel support. Task 2 acceptance criteria say "Drag, **wheel**, keyboard arrow, Home/End all adjust values correctly" — but wheel handling won't work out of the box. The task must explicitly add a wheel event listener on a wrapper element.

**5. Task 2 must preserve `stepPrecision` normalization**

`NumericSettingControl.tsx:13-17` rounds values to step decimal precision (e.g., `step=0.05` → 2 decimal places). Radix Slider `onValueChange` returns raw values. If a user types `0.751` into the number input, `parseFloat` would set `0.751` which violates the `step=0.05` constraint. Task 2's inline replacement must apply this normalization in each `onChange`/`onValueChange` callback. Add acceptance criterion: "Values typed into the number input are normalized to step precision (e.g., 0.751 → 0.75 for step=0.05)."

**6. Task 3 dependency on Task 2 creates a file-level deadlock**

Task 3 depends on Task 2 AND modifies `src/components/SettingsPanel.tsx`. If Task 2 also modifies SettingsPanel.tsx (replacing `<NumericSettingControl>` call sites with inline Radix Slider + stepper + number input), Task 3 must merge or re-implement those same call sites. Since the SettingsPanel.tsx call sites ARE the slider instances, Task 2 and Task 3 are not truly independent — they both rewrite the same component. Suggested fix: merge Tasks 2 and 3 into a single task, or make Task 2 modify only `NumericSettingControl.tsx` (keep it as a reusable wrapper) and Task 3 add Accordion wrapping in SettingsPanel.tsx and replace the toggle with Switch.

**7. Task 3 Accordion `debugMode` conditional items need explicit behavior spec**

When `debugMode` is false (no `?debug` query param), only 3 accordion items exist. When true, 7 items exist (4 debug sections added). Task 3 doesn't specify:
- Which Accordion `type` (`"single"` or `"multiple"`)? If `"single"`, what happens when `debugMode` changes from true to false and the currently-open item was a debug section?
- Should the Accordion use controlled `value` (to reset on `debugMode` change) or uncontrolled `defaultValue`?
- Are debug sections collapsible (always start expanded, user can close)?

Add acceptance criterion: "When `debugMode` transitions from true to false while a debug Accordion item is open, the open state resets cleanly to a valid item without console errors."

**8. Task 4 (Tabs) must handle the dual-tab-bar architecture**

The current code renders TWO tab bars: one in the editor pane header (mobile-only) and one in the preview pane header (desktop, with `.tab-editor` hidden via CSS). Task 4 says to replace with `<Tabs.Root>` but doesn't specify if there's one or two Tabs.Root instances. A single Tabs.Root wrapping the outer layout requires structural refactoring of App.tsx. Two Tabs.Root instances sharing `value` + `onValueChange` require synchronization and create duplicate ARIA tablist landmarks — an accessibility concern.

Add acceptance criteria:
- "The single Tabs.Root architecture is designed and documented (wrapped around outer layout, or two synchronized Roots)."
- "Desktop media query hides the 'Editor' `<Tabs.Trigger>` via CSS (not DOM removal) to preserve keyboard navigation order."
- "`aria-orientation` is correctly set for both horizontal tab bars."

**9. Task 4 dependency = "Task 1" but `src/styles.css` conflicts with Tasks 2, 3, 5**

Task 4 modifies `src/styles.css` (tab CSS) while Tasks 2, 3, and 5 also modify the same file. If these tasks run on separate branches, CSS merge conflicts are inevitable. Suggested fix: either (a) Tasks 2-5 are sequential (each depends on the previous), or (b) CSS changes for all tasks are extracted into Task 6 (CSS Cleanup), making Tasks 2-5 only touch `.tsx` files.

**10. Task 5 (Popover) must handle Portal z-index and dark-mode filter interaction**

Radix Popover defaults to `<Portal>` (renders to `document.body`). The current `.page-zoom-popover` is positioned within `.page-zoom-menu { position: relative }` at z-index 100 relative to the page surface. Portal rendering means:
- The popover escapes the `.preview-surface` stacking context — z-index must be set on the portal container.
- The dark-mode `filter: invert(1)` applied to `.staff-preview-shell-dark` will NOT affect the portal-rendered popover (Portal children don't inherit CSS from the trigger's ancestor tree).

Add acceptance criterion: "Zoom popover renders correctly in both light and dark themes with proper z-index (above SVG staves, below modal dialogs if any)."

**11. Task 5 Popover controlled state: "100%" button must close the popover**

The current "100%" reset button calls `setPageZoomMenuOpen(false)` explicitly (`App.tsx:997`). With Radix Popover in controlled mode, this button must still close the popover. The task should clarify: either wrap the "100%" button in `<Popover.Close>` or make it call `onOpenChange(false)`.

Add acceptance criterion: "Clicking '100%' reset button in the zoom popover both resets page scale to 1.0 AND closes the popover."

**12. Task 6 CSS cleanup missing orphaned CSS variables**

When the native range slider pseudo-element rules (`::-webkit-slider-thumb`, etc.) are removed, the CSS variables `--thumb-border`, `--thumb-shadow`, `--thumb-drag-shadow` (lines 69-71, 147-149, 210-212 in `styles.css`) become unused. Task 6's removal list should include these variables.

Also, Task 6 says "Removed: `.page-zoom-popover` outside-click logic" but this is JS logic removal, not CSS removal. The `.page-zoom-popover` CSS rules (lines 534-591) should be in the removal list for CSS, and the JS `useEffect` `mousedown` listener (App.tsx:580-589) should be in Task 5's scope.

**13. Task 6 preservation checklist should include `.preview-surface`, `.surface-toolbar`, and `.setting-row` families**

Missing from the explicit preservation list:
- `.preview-content`, `.preview-surface`, `.preview-surface.active` — these control page/XML visibility and are separate from the tab trigger CSS.
- `.surface-toolbar`, `.toolbar-group`, `.surface-icon-button` — zoom trigger button and toolbar layout styles.
- `.setting-row`, `.setting-label`, `.setting-value` — individual control row layout inside accordion panels.
- `.padding-grid`, `.padding-grid-container`, `.padding-grid-middle`, `.setting-label-small` — page margins sub-grid.

**14. Missing task: SettingsPanel render smoke test**

None of the 440 tests cover `SettingsPanel` or any UI component. The "npm test remains green" acceptance criterion is vacuously satisfied — nothing can break. Add a task (or add to Task 2/3 scope) a minimal smoke test:

```
### Task X: Add Settings Panel Smoke Test
- **Scope**: `src/components/SettingsPanel.test.tsx`
- **Commits**: `test(ui): add settings panel render smoke test`
- **Acceptance Criteria**: `<SettingsPanel>` mounts with mock settings without crash; 19 slider controls render; `debugMode=true` renders all 7 sections; `debugMode=false` renders 3 sections
```

**15. Missing task: CI typecheck validation via `npm run build` for Radix typings**

All acceptance criteria say "npm run build remains green," but `tsc -b` is part of `build`. Since Radix Slider's `onValueChange` returns `number[]` (not `number`), the inline callbacks may need explicit type narrowing. There should be an explicit verification that `npm run build` passes at each task boundary.

**STATUS: CHANGES_REQUESTED**

### Author Response

Accepted. All task-level amendments are recorded here as operative overrides. The tasks file is reissued below (v2.0) to incorporate all amendments cleanly.

Key amendments:
- **NumericSettingControl.tsx is REFACTORED, not deleted** (critique 1, 3). It becomes a Radix Slider wrapper that preserves stepper buttons, number input, wheel handler, and value normalization.
- **Bundle budget lowered to ≤ 25 KB gzipped**, measured at Task 2 (critique 11, 12).
- **Accordion uses `type="multiple"`** to avoid stale index on debugMode toggle (critique 6, 7).
- **Two synchronized Tabs.Root instances** for dual-tab-bar architecture (critique 2, 8).
- **Popover uses `modal={false}`** for z-index control; "100%" button calls `setPageZoomMenuOpen(false)` (critique 7, 8, 10, 11).
- **Settings panel smoke test added** as new Task 5 (critique 13, 14).
- **CSS preservation checklist completed** in Task 7 (critique 9, 12, 13).
- **Data-state CSS migration called out per task** (critique 15).

## Refined Tasks (v2.0)

### Task 1: Install Radix Dependencies
- [ ] **Status**: Pending
- **Scope**: `package.json`, `package-lock.json`
- **Commits**: `chore: add radix-ui dependencies`
- **Acceptance Criteria**:
  - `npm install` succeeds with all 5 Radix packages
  - `tsc -b` passes (verifies TypeScript resolution of Radix exports, including `onValueChange: (value: number[]) => void`)
  - `npm run build` remains green
  - `npm test` remains green (440 tests)
- **Dependencies**: None

### Task 2: Refactor NumericSettingControl with Radix Slider
- [ ] **Status**: Pending
- **Scope**: `src/components/NumericSettingControl.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): use Radix Slider inside NumericSettingControl`
- **Acceptance Criteria**:
  - `NumericSettingControl` internally uses `<Slider.Root>`, `<Slider.Track>`, `<Slider.Range>`, `<Slider.Thumb>`
  - All three controls present: Radix Slider track, +/- stepper buttons, `<input type="number">`
  - Stepper buttons and number input unchanged from current implementation
  - Wheel scroll on wrapper adjusts value by step (re-implemented via `onWheel` handler)
  - Value normalization (`normalizeSteppedValue`) applied to both slider `onValueChange` and number input `onChange`
  - `onValueChange` extracts `vals[0]` (Radix returns `number[]` for multi-thumb)
  - `SettingsPanel.tsx` call sites need zero changes (component signature unchanged)
  - CSS: Radix Slider thumb/track/range styled via data-state selectors in `styles.css`
  - `npm run bundle:report` shows main bundle increase ≤ 25 KB gzipped vs pre-migration baseline
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1

### Task 3: Replace Toggle with Radix Switch + Add Accordion Grouping
- [ ] **Status**: Pending
- **Scope**: `src/components/SettingsPanel.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace settings toggle with Radix Switch and add Accordion grouping`
- **Acceptance Criteria**:
  - `hideVoice2Rests` boolean uses `<Switch.Root>` + `<Switch.Thumb>` with `role="switch"` and `aria-checked`
  - Keyboard toggle (Space/Enter) works
  - Settings panel sections wrapped in `<Accordion.Root type="multiple">` with `<Accordion.Item>`, `<Accordion.Trigger>`, `<Accordion.Content>`
  - 3 always-visible items: Notation, Page Layout, Title Area
  - 4 debug items rendered when `debugMode` is true: Debug: Tempo, Debug: Measure Numbers, Debug: Note Spacing, Debug: Measure Widths
  - When `debugMode` changes from true to false while a debug item is open, no console errors occur (item unmounts cleanly)
  - Radix Slider components (Task 2) render correctly inside Accordion panels — no regression
  - CSS: `.settings-trigger[data-state="open"]`, `.settings-content[data-state="open"]` selectors, `@keyframes accordionSlideDown`/`accordionSlideUp` animations added
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 2

### Task 4: Replace Tab Switching with Radix Tabs
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace custom tab switching with dual Radix Tabs instances`
- **Acceptance Criteria**:
  - Two separate `<Tabs.Root>` instances: one in editor pane header, one in preview pane header
  - Both share `value={settings.activeTab}` and `onValueChange={(v) => updateSetting("activeTab", v as MainTab)}`
  - Editor pane Tabs.Root renders all 3 triggers; preview pane Tabs.Root renders Page and XML only
  - Desktop `@media (min-width: 769px)`: editor pane `<Tabs.List>` hidden via `display: none`
  - Mobile `@media (max-width: 768px)`: editor pane Tabs visible, preview pane Tabs visible
  - Keyboard arrow key navigation between tabs works in each Tabs.Root independently
  - Settings panel auto-collapse on tab switch still works
  - CSS: `.tabs-trigger[data-state="active"]` replaces `.preview-tab.active` styling
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1 (SettingsPanel not required for Tabs)

### Task 5: Add Settings Panel Smoke Test
- [ ] **Status**: Pending
- **Scope**: `src/components/settings-panel.test.tsx`
- **Commits**: `test(ui): add settings panel render smoke test`
- **Acceptance Criteria**:
  - `<SettingsPanel>` mounts in jsdom with mock props without crashing
  - `debugMode=true` renders all 7 Accordion items
  - `debugMode=false` renders 3 Accordion items
  - At least one Slider control is verified per section (via `aria-label` or role selectors)
  - `npm test` remains green with at least 4 new test cases
- **Dependencies**: Task 3

### Task 6: Replace Zoom Popover with Radix Popover
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace custom zoom popover with Radix Popover`
- **Acceptance Criteria**:
  - Zoom menu uses `<Popover.Root open={pageZoomMenuOpen} onOpenChange={setPageZoomMenuOpen}>` (controlled mode)
  - `<Popover.Portal modal={false}>` wraps content
  - Outside-click dismiss works (Radix built-in)
  - Escape key dismiss works (Radix built-in)
  - Zoom controls (scale stepper, fit-width toggle, 100% reset) remain functional
  - "100%" reset button calls both `updateSetting("pageScale", 1)` and `setPageZoomMenuOpen(false)`
  - Popover renders correctly in both light and dark themes
  - `useEffect` mousedown outside-click listener (App.tsx:580-588) is removed
  - CSS: `.zoom-popover-content` with `z-index: 50` and background from CSS variables
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 1

### Task 7: CSS Cleanup
- [ ] **Status**: Pending
- **Scope**: `src/styles.css`
- **Commits**: `style(ui): remove obsolete CSS rules replaced by Radix components`
- **Acceptance Criteria**:
  - Removed: `.toggle-switch`, `.toggle-slider` (replaced by Radix Switch)
  - Removed: `.preview-tabs`, `.preview-tab`, `.tab-editor` (replaced by Radix Tabs + `display: none` on `.editor-pane-tabs`)
  - Removed: `.page-zoom-popover` CSS (replaced by Radix Popover CSS)
  - Removed: `.setting-range::-webkit-slider-thumb`, `::-moz-range-thumb` (replaced by Radix Slider thumb CSS)
  - Removed: `--thumb-border`, `--thumb-shadow`, `--thumb-drag-shadow` CSS variables (orphaned by slider pseudo-element removal)
  - **Preserved** (explicit, extended checklist):
    - `:root` / `:root[data-theme="dark"]` CSS variable blocks
    - `.staff-preview-shell-dark` + `filter: invert(1)` (VexFlow dark mode)
    - `@font-face` Bravura declaration
    - `.xml-preview`, `.xml-*` classes (MusicXML tree viewer)
    - `.staff-preview-page`, `.staff-printable*` (print support)
    - `.editor-shell`, `.editor-container` (CodeMirror wrapper)
    - `.app-shell`, `.workspace`, `.pane`, `.resizer` (layout)
    - `.app-header`, `.status-bar`, `.error-list` (chrome)
    - `.settings-panel`, `.settings-panel.active` (panel visibility)
    - `.preview-content`, `.preview-surface`, `.preview-surface.active` (surface visibility)
    - `.setting-row`, `.setting-label`, `.setting-value` (control row layout)
    - `.padding-grid-container`, `.padding-grid`, `.padding-grid-middle`, `.setting-label-small` (page margins sub-grid)
    - `.preview-header-actions`, `.mobile-only-actions` (pane header actions)
    - `.surface-toolbar`, `.toolbar-group`, `.surface-icon-button` (toolbar buttons)
    - `.page-zoom-menu` (zoom trigger button — Popover replaces only the popover, not the trigger)
    - Responsive `@media (max-width: 768px)` block
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 3, Task 4, Task 6

### Task 8: Consolidation & Archival
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/MANTINE_MIGRATION_proposal_v1.md`, `docs/proposals/MANTINE_MIGRATION_tasks_v1.md`, `docs/archived/`, `LEARNINGS.md`
- **Commits**: `docs: consolidate radix migration proposal and archive artifacts`
- **Acceptance Criteria**:
  - Proposal and tasks files renamed to `RADIX_MIGRATION_*` and moved to `docs/archived/`
  - Final summary added to `LEARNINGS.md`
  - `npm run build` and `npm test` remain green
- **Dependencies**: Task 7

---

### Review Round 2
**Reviewer: Critical Architect**

#### F1. (CRITICAL) Task 4: Preview pane Tabs.Root missing Editor trigger breaks mobile tab switching

The v2.0 Task 4 acceptance criteria say "preview pane Tabs.Root renders Page and XML only." On mobile (`≤768px`), the preview pane is the only visible pane when viewing Page/XML — the editor pane is `visibility: hidden` (unfocusable, unclickable). The current preview pane tab bar includes the Editor trigger visible on mobile; removing it means mobile users cannot switch back to Editor from Page/XML views.

**Required fix**: Add to Task 4 acceptance criteria: "Preview pane Tabs.Root includes Editor trigger; Editor trigger hidden on desktop via `@media (min-width: 769px) { .tabs-trigger[data-editor-tab] { display: none; } }`."

**Required fix**: Task 4 CSS scope must include the desktop-hide rule for the Editor trigger (`[data-editor-tab]` attribute selector).

#### F2. (CRITICAL) Task 7: `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` unaccounted

These 5 CSS classes (`styles.css:547-591`) style the zoom popover's inner content (readout, button grid, action buttons). They are NOT the container `.page-zoom-popover` (which is correctly listed for removal). They remain functional inside `<Popover.Content>` per Task 6 criteria. Task 7 lists neither preservation nor removal for them.

**Required fix**: Add these 5 classes to Task 7's **Preserved** checklist:
```
- `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` (zoom popover inner content — reused inside Radix Popover.Content)
```
Or, if they will be replaced by new Radix Popover CSS classes, add them to the **Removed** list with explicit replacement notes.

#### F3. (MODERATE) Task 7: Missing final bundle-size verification

Bundle budget (≤25 KB) appears only in Task 2 (first single-package import). By Task 7, all 5 packages are imported and CSS is finalized. Task 7 should include a bundle-size check to guard against cumulative bloat from Tasks 3, 4, and 6.

**Required fix**: Add to Task 7 acceptance criteria: "`npm run bundle:report` shows main bundle increase ≤25 KB gzipped vs pre-migration baseline."

#### F4. (MODERATE) Task 7: `.editor-pane-tabs` referenced before creation

The removal list says `(replaced by Radix Tabs + display: none on .editor-pane-tabs)`. `.editor-pane-tabs` is a new class to be created in Task 4 — it does not exist in the current codebase. The phrasing implies it's an existing class being modified.

**Required fix**: Rephrase to: "(replaced by Radix Tabs CSS; editor pane Tabs.List hidden on desktop via new class `.editor-pane-tabs` with `display: none` at `@media (min-width: 769px)`)".

#### F5. (MINOR) Task 3: `accordionSlideDown`/`accordionSlideUp` missing `overflow: hidden` detail

Task 3 CSS scope lists the keyframes but omits the standard Radix Accordion requirement that `.settings-content` needs `overflow: hidden` during animation to prevent text flash.

**Required fix**: Add to Task 3 CSS scope: "`.settings-content` requires `overflow: hidden` during `data-state` open/close animation transitions."

#### F6. (MINOR) Task 7: Dependency list should note transitive Task 2 dependency

Task 7 lists dependencies as "Task 3, Task 4, Task 6." Task 3 depends on Task 2, so Task 2's slider migration is guaranteed complete before Task 7's CSS cleanup runs. This is correct but under-documented — the slider pseudo-element removal in Task 7 depends on Task 2 having replaced them with Radix Slider CSS. Adding Task 2 explicitly (as a dependency) or noting the transitive chain would aid implementers.

**Required fix**: Add note to Task 7 dependencies: "Task 3, Task 4, Task 6 (Task 2 is transitively resolved via Task 3's dependency chain)."

#### Verifications that PASS

- **Task numbering is correct**: Task 1→2→3→5(smoke)→4(Tabs)→6(Popover)→7(CSS)→8(Archive). No gaps. ✓
- **Task 5 (smoke test) positioned correctly**: Depends on Task 3 (Accordion), which transitively includes Task 2 (Slider). Tests Slider controls inside Accordion panels at the right integration point. ✓
- **Task 2 scope**: Only `NumericSettingControl.tsx` + `styles.css`; SettingsPanel.tsx untouched. Component signature preserved. ✓
- **Task 2 acceptance criteria**: All three controls (Slider, stepper, number input), wheel handler, value normalization, `vals[0]` extraction, bundle check — all covered. ✓
- **Task 3 Accordion `type="multiple"`**: Uncontrolled, independent panel state; `debugMode` toggle console-error criterion present. ✓
- **Task 4 dual Tabs.Root keyboard isolation**: Verified — Radix Tabs controlled mode uses arrow keys for roving tabindex only, `onValueChange` fires only on click/Enter. Two instances with shared `value` won't interfere. ✓
- **Task 6 Popover controlled state**: `open`/`onOpenChange`, `modal={false}`, "100%" button calls `setPageZoomMenuOpen(false)`, `useEffect` removed at `App.tsx:580-588`. ✓
- **Task 7 CSS preservation**: All Round 1 missing classes now listed (`.preview-content` family, `.setting-row` family, `.padding-grid` family, `.preview-header-actions`/`.mobile-only-actions`, `.surface-toolbar`/`.toolbar-group`/`.surface-icon-button`, `.page-zoom-menu`). ✓ (Subject to F2 above.)
- **Bundle report script**: `npm run bundle:report` → `node scripts/report_bundle.mjs`; verified exists at `package.json:11`. ✓
- **TypeScript verification**: `tsc -b` added to Task 1; `onValueChange` number[] extraction documented in Task 2. ✓

**STATUS: CHANGES_REQUESTED**

F1 and F2 are blocking. F3 and F4 require attention. F5 and F6 are nice-to-fix.

### Author Response (Round 2)

Accepted. All six task findings resolved via amendments below.

#### F1 (BLOCKING): Preview pane Tabs.Root now renders all 3 triggers

Task 4 acceptance criteria amended:
- Old: "Editor pane Tabs.Root renders all 3 triggers; preview pane Tabs.Root renders Page and XML only"
- New: "Both Tabs.Root instances render all 3 triggers (Editor, Page, XML). Editor trigger in preview pane hidden on desktop via `@media (min-width: 769px) { .tabs-trigger[data-tab="editor"] { display: none; } }`"

Task 4 CSS scope: add the desktop-hide rule for the Editor trigger.

#### F2 (BLOCKING): Zoom popover inner-content CSS preserved

Task 7 preservation checklist amended — the following classes are **preserved** (not removed):
- `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` (zoom popover inner content — reused inside Radix Popover.Content)

Only `.page-zoom-popover` outer positioning CSS block is removed (replaced by `.zoom-popover-content`).

#### F3 (MODERATE): Accumulative bundle check added

Task 7 acceptance criteria gain: "`npm run bundle:report` shows total bundle increase ≤ 25 KB gzipped vs pre-migration baseline (all 5 Radix packages accumulated)."

#### F4 (MODERATE): `.editor-pane-tabs` phrasing clarified

Task 7 removal list rephrased: "(replaced by Radix Tabs CSS; editor pane `<Tabs.List>` hidden on desktop via class `.editor-pane-tabs` with `display: none` at `@media (min-width: 769px)`)."

#### F5: `overflow: hidden` added to Task 3 CSS scope

Task 3 CSS scope amended: "`.settings-content` requires `overflow: hidden` during `[data-state="open"]`/`[data-state="closed"]` animation transitions (standard Radix Accordion animation pattern)."

#### F6: Task 7 dependency chain documented

Task 7 dependencies amended to: "Task 3, Task 4, Task 6 (Task 2 is transitively resolved via Task 3's dependency chain)."


### Review Round 3
**Reviewer: Final Arbiter**

All six Round 2 findings verified against Author Response (Round 2):

- **F1 (BLOCKING):** Task 4 acceptance criteria now specify both Tabs.Root instances render all 3 triggers. Preview pane Editor trigger hidden on desktop via `[data-tab="editor"]` CSS selector. Mobile switching path preserved. ✓
- **F2 (BLOCKING):** `.page-zoom-readout`, `.page-zoom-buttons`, `.page-zoom-action`, `.page-zoom-reset`, `.fit-width-button` added to Task 7 Preserved checklist. Only `.page-zoom-popover` outer block removed. ✓
- **F3 (MODERATE):** Task 7 acceptance criteria now include `npm run bundle:report` showing ≤25 KB gzipped increase (all 5 packages accumulated). ✓
- **F4 (MODERATE):** Task 7 removal list rephrased — `.editor-pane-tabs` existence clarified as created in Task 4, referenced in Task 7. ✓
- **F5 (MINOR):** Task 3 CSS scope now includes `overflow: hidden` on `.settings-content` during open/close animation transitions. ✓
- **F6 (MINOR):** Task 7 dependency list now documents transitive Task 2 resolution via Task 3's dependency chain. ✓

No new issues introduced. All Round 1/Round 2 critique traces are resolved. Task ordering (1→2→3→5→4→6→7→8) is correct and gated appropriately.

**STATUS: APPROVED**

