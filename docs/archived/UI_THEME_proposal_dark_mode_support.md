# UI_THEME_proposal_dark_mode_support.md

## Addendum v1.0: Dark Mode Support

### Motivation

The app currently assumes a light surface almost everywhere. The shell, settings drawer, docs pages, CodeMirror theme, syntax highlighting, XML preview, and several status surfaces all use light-only color values or hard-coded white backgrounds. On devices configured for dark appearance, the result is high glare and inconsistent contrast.

This addendum defines dark mode support for the web UI while explicitly preserving white page surfaces for notation rendering, export fidelity, and printing.

### Goals

- Support dark appearance automatically when the user agent prefers dark color schemes.
- Keep the palette coherent across the app shell, settings panel, docs pages, editor chrome, XML preview, and status/error UI.
- Avoid changing notation semantics or exported artifacts.
- Preserve readable contrast and clear interaction affordances.

### Non-Goals

- No user-facing theme picker in this change.
- No dark-background score paper or dark export output.
- No attempt to recolor generated SVG notation itself.

### Theme Model

The UI theme model gains two semantic modes:

- `light`
- `dark`

The implementation must support both of these activation paths:

- Automatic dark mode through `@media (prefers-color-scheme: dark)`.
- An explicit root-level `data-theme="light|dark"` override hook for future use and deterministic testing.

This change does **not** add a visible toggle yet. If no explicit `data-theme` is present, the system preference determines the active palette.

### Token Strategy

The app already uses a partial CSS variable layer in `src/styles.css`. Dark mode support standardizes that approach:

- Promote all major surfaces to semantic tokens rather than direct literals.
- Separate application-shell tokens from score-paper tokens.
- Add missing tokens for secondary panels, code surfaces, overlays, selection backgrounds, and XML/docs accents.

Representative token groups:

- App shell: `--bg-app`, `--bg-card`, `--bg-sidebar`
- Borders: `--border-subtle`, `--border-strong`
- Text: `--text-main`, `--text-muted`, `--text-inverse`
- Interactive: `--accent-primary`, hover states, focus/active states
- Code/editor/docs: dedicated semantic tokens rather than scattered hard-coded hex values
- Paper/export: dedicated white-surface tokens that remain invariant across themes

### Scope of Visual Changes

#### 1. Main Application Shell

Dark mode applies to:

- header
- editor pane chrome
- preview chrome
- settings panel
- buttons and toggles
- status bar
- error list
- empty states

These surfaces must derive from semantic tokens only. Hard-coded whites and light grays in shared UI must be removed or isolated behind theme tokens.

#### 2. CodeMirror Editor

The editor currently installs a single light-only theme (`dark: false`) and light-only syntax colors.

Dark mode support requires:

- a dark editor chrome theme
- a dark syntax highlighting palette
- runtime selection of the appropriate editor extensions based on active theme

The dark syntax palette should remain structurally parallel to the light one so token categories still read consistently:

- comments muted
- headers visually distinct
- tracks, operators, modifiers, and repeat/control tokens differentiated

#### 3. Documentation Pages

The generated docs pages currently redefine their own light-only variables in `src/docs.css`.

Dark mode support requires:

- dark equivalents for docs variables
- docs header/sidebar/main content adapting with the same semantic logic
- code snippets, example cards, tables, and navigation states adopting dark-safe surfaces and contrast

The docs may keep their own token namespace (`--docs-*`) but must follow the same light/dark activation model as the app shell.

#### 4. XML Preview and Auxiliary Code-Like Surfaces

The XML preview and similar developer-facing panes currently use hard-coded light colors. These need dark-mode tokenization so they remain readable in dark appearance without turning into low-contrast gray-on-gray blocks.

### Explicitly Preserved White Surfaces

Dark mode must **not** recolor these surfaces:

- printable score page backgrounds
- score paper canvas/page wrappers that intentionally represent white paper
- exported SVG and MusicXML contents
- print HTML injected by the print/export flow

The preview can still sit inside a dark shell, but the page itself remains white. This preserves WYSIWYG expectations and avoids dark-mode-only export regressions.

### Accessibility / Contrast Requirements

- Body text must retain strong contrast against its background in both modes.
- Muted text remains secondary but still legible.
- Control borders and dividers remain perceptible without becoming noisy.
- Focus/hover/selected states remain visible in both themes.
- Color should not be the only signal for active tabs, toggles, or errors.

### Testing / Verification

Dark mode is accepted only if all of the following hold:

- app shell is readable in both light and dark appearance
- editor chrome and syntax highlighting switch coherently
- settings panel controls remain legible and clearly interactive
- docs pages remain readable in both modes
- score preview page remains white in both modes
- print/export flows still emit white-background content

### Implementation Notes

- Favor CSS variable indirection over duplicating full component rule sets.
- Keep the override model simple: base light tokens in `:root`, dark tokens in either `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)` blocks.
- Use explicit paper tokens for notation surfaces to prevent accidental inheritance from shell background tokens.

### Review Round 1

1. The activation model is underspecified where precedence matters. You say both `@media (prefers-color-scheme: dark)` and `data-theme="light|dark"` must exist, but you do not state which wins when both are present. That is not a cosmetic omission: CodeMirror theme selection will need a single authoritative theme value, and docs pages may otherwise diverge from the app shell. The addendum should explicitly require `data-theme` to override system preference when present.
2. The proposal does not define the source of truth for runtime theme selection in JS-managed surfaces. CSS alone can flip shell colors, but the editor theme requires imperative extension selection. Without stating that the active theme must be resolved from the root element or a shared helper, the implementation can easily split into one logic path for CSS and another for CodeMirror, producing mismatches during deterministic testing.
3. “Preserve white page surfaces” is directionally correct but still ambiguous around preview chrome boundaries. The proposal should distinguish between the outer preview container, the white page rectangle, and any embedded export/print HTML. Otherwise an implementation could accidentally darken the page wrapper or shadow surface and still claim compliance.
4. Testing requirements are too qualitative. “Readable” and “coherent” are useful goals, but they are weak as acceptance language for a change that touches many hard-coded colors. At minimum, require deterministic verification of both explicit override modes (`data-theme="light"` and `data-theme="dark"`) in addition to system dark preference, otherwise regressions can hide behind whichever OS appearance the developer happens to use.
5. Docs integration is missing a constraint about how generated docs acquire the same override semantics. The proposal says docs should follow the same activation model, but does not require the generated HTML/template layer to expose `data-theme` on the root or otherwise allow deterministic theme forcing. That is a real scope gap, not editorial nitpicking.

Residual risk even after fixing the above: native form controls and scrollbars may still render with platform-default styling unless `color-scheme` or equivalent browser hints are set intentionally. If you want dark mode to feel complete, that should be considered explicitly, though I do not consider it a blocker for this addendum.

STATUS: CHANGES_REQUESTED

### Author Response

The review correctly identified four missing implementation constraints and one missing testability constraint. This response closes those gaps without replacing the original addendum text.

#### 1. Theme precedence is now explicit

The authoritative precedence order is:

1. `data-theme="light"` or `data-theme="dark"` on the document root
2. system preference from `prefers-color-scheme`
3. light fallback when neither signal is available

When an explicit `data-theme` is present, it **must** override system preference for both CSS-driven and JS-driven surfaces.

#### 2. CSS and JS must share one theme source of truth

The active theme for runtime-managed UI must be resolved from the same root signal that drives CSS:

- CSS responds to the root `data-theme` override when present, otherwise to `prefers-color-scheme`
- JS-managed surfaces such as CodeMirror must derive the effective theme from the root document state, not from a separate local heuristic

Concretely, the implementation must introduce a single theme-resolution path so the shell, docs, and editor cannot drift into mixed modes during testing or runtime.

#### 3. Preview chrome vs. white paper is now explicitly separated

The preserved-white rule applies to three distinct layers:

- preview chrome: may become dark with the rest of the app shell
- page frame / paper rectangle: remains white in both themes
- print/export HTML and generated assets: remain white-background outputs

An implementation that darkens the page rectangle itself is non-compliant, even if the surrounding preview shell is dark.

#### 4. Docs must support deterministic theme forcing

The generated docs pages must honor the same override semantics as the app:

- if the root has `data-theme="light"` or `data-theme="dark"`, docs styling must follow it
- if there is no explicit override, docs may fall back to `prefers-color-scheme`

This may be implemented through shared root attributes, docs-specific root selectors, or a small bootstrapping step in generated HTML, but deterministic forcing is required.

#### 5. Verification is now explicit rather than qualitative

Acceptance for this addendum requires deterministic verification of all three cases:

- explicit light override
- explicit dark override
- no explicit override with dark system preference

At minimum, verification must confirm:

- app shell colors switch correctly
- CodeMirror follows the same resolved theme
- docs pages honor the same override semantics
- page paper remains white
- print/export output remains white

#### 6. Browser `color-scheme` hint is included in scope

The implementation should set `color-scheme` intentionally on the root so native controls and scrollbars align with the active theme where supported. This is not a standalone feature, but it is part of making dark mode feel complete and is therefore included in scope for this addendum.

### Review Round 2

The author response closes the substantive gaps from Round 1.

1. Precedence is now explicit and technically usable: `data-theme` wins over `prefers-color-scheme`, which removes the main ambiguity that would have caused CSS and CodeMirror to diverge.
2. The single-source-of-truth requirement for JS-managed surfaces is now stated clearly enough to constrain implementation, rather than leaving theme resolution to ad hoc local heuristics.
3. The preview-shell versus white-paper distinction is now concrete and testable. That was a real risk area for this feature, and the response now makes non-compliance obvious.
4. Deterministic verification requirements now include both explicit override modes plus system-dark fallback, which is the minimum bar needed for a multi-surface theme change.
5. Docs are now explicitly required to support deterministic override semantics, which closes the earlier scope hole between app CSS and generated docs.

Residual risk remains around how aggressively the implementation will normalize legacy hard-coded literals across the codebase, but that is an execution-quality concern rather than a proposal ambiguity at this point.

STATUS: APPROVED

### Consolidated Changes

The approved dark mode design is:

- automatic dark-mode support follows system preference unless the document root carries an explicit `data-theme="light"` or `data-theme="dark"` override
- explicit `data-theme` always wins over `prefers-color-scheme`
- CSS and JS-managed surfaces must resolve theme from the same root-level source so the shell, docs, and CodeMirror cannot drift
- app shell, settings UI, XML preview, docs pages, and editor chrome/syntax all receive light/dark token coverage
- score paper, print HTML, and exported assets remain white-background surfaces regardless of shell theme
- root `color-scheme` is set intentionally so native controls and scrollbars align with the active mode where supported
- acceptance requires deterministic verification of explicit light override, explicit dark override, and system-dark fallback behavior
