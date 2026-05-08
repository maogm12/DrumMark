# Mantine UI Migration Proposal

## Addendum v1.0: Mantine UI Integration

### Goal
Refactor the current manual UI (hand-rolled CSS and primitive controls) to use **Mantine UI**. This aims to solve the usability issues in the settings panel (clutter and mobile touch targets) and provide a more robust, accessible foundation for future features.

### 1. Core Integration
- **Dependencies**: Install `@mantine/core`, `@mantine/hooks`, `@mantine/ds`, `@mantine/notifications`, `@emotion/react`, `@emotion/styled`.
- **Provider**: Wrap the application in `MantineProvider` in `src/main.tsx`.
- **Theme**: Define a Mantine theme that maps the existing CSS variables (e.g., `--accent-primary`, `--bg-app`) to Mantine's theme object to ensure brand consistency.

### 2. Layout & Navigation
- **AppShell**: Replace the custom flex-based `.app-shell` with Mantine's `AppShell` component.
- **Header**: Use `AppShell.Header` for the logo and global export buttons.
- **Panes**: Use Mantine's `Group` and `Stack` for layout alignment, and `Tabs` for switching between "Editor", "Page", and "XML" views on mobile/desktop.

### 3. Settings Panel Refactor
- **Grouping**: Use an `Accordion` or `Tabs` within the settings panel to categorize the 16+ parameters into "Layout", "Engraving", and "Advanced" groups.
- **Numeric Controls**: 
    - Replace the custom `NumericSettingControl` with Mantine's `Slider`.
    - Enable `label` (floating bubble) for immediate feedback during dragging.
    - Use `NumberInput` with controls for precise adjustment.
    - Set `size="lg"` on mobile to increase touch targets.
- **Toggles**: Replace custom checkboxes/switches with Mantine's `Switch` component.

### 4. Documentation Migration
- Update `docs.template.html` and `docs.css` to use Mantine typography and layout components.
- Ensure the "Copy Code" buttons and pre-rendered SVGs remain functional within the new layout.

### 5. Transition Strategy
- **CSS Variable Compatibility**: Keep the existing CSS variable system active so the custom VexFlow rendering (which depends on these variables) stays in sync with the Mantine theme.
- **Incremental Swap**: The editor (CodeMirror) and the score preview (SVG) will remain as-is, while the surrounding "shell" and "controls" migrate.

---

### Review Round 1
**Reviewer: Codebase Investigator (Architect)**

1. **Emotion Dependency Anachronism**: The proposal suggests installing `@emotion/react` and `@emotion/styled`. Mantine v7 (which is required for React 19) has moved away from Emotion to PostCSS/native CSS modules. Installing Emotion is unnecessary and adds bloat. The dependency list must be updated to reflect Mantine v7 requirements (PostCSS, `mantine-postcss-loader` or similar if needed).
2. **React 19 Compatibility**: Mantine v7.x has beta/early support for React 19, but specific hooks (like those in `@mantine/hooks`) and the `MantineProvider` must be verified for compatibility with React 19's new ref/prop patterns. The proposal should explicitly state which Mantine version is targeted (v7.10+).
3. **Theme Synchronization Deadlock**: The project currently uses `data-theme="dark/light"` on the root and a `resolveDocumentTheme` utility. Mantine uses its own `data-mantine-color-scheme`. If these aren't synchronized, the VexFlow staves (using CSS variables) and the Mantine components will drift. The proposal needs a concrete plan for keeping `localStorage`, `data-theme`, and `MantineColorScheme` in one-way or two-way sync.
4. **Documentation Pipeline Gap**: `docs.template.html` is processed by `build-docs.ts` into static HTML via JSDOM. Using "Mantine components" in this template is non-trivial because Mantine components require a React runtime and a Provider to render. Is the proposal suggesting a full rewrite of the docs generator to use `renderToString`? Or just using Mantine's CSS classes? This ambiguity must be resolved.
5. **Layout Shift Risk**: The current `AppShell` refactor mentions "Navbar/Aside" but doesn't address the current "horizontal resizer" logic. Mantine's `AppShell` doesn't natively support user-resizable dividers without extra implementation. If we lose the resizable editor/preview split, power users will be frustrated.

**STATUS: CHANGES_REQUESTED**

### Author Response

1. **Dependency Cleanup**: Removed all Emotion-related dependencies. Target Mantine v7.11+ which uses zero-runtime PostCSS. Updated installation plan to include PostCSS configuration.
2. **React 19 / Mantine v7**: Confirmed target version v7.11 for best React 19 compatibility.
3. **Theme Sync Logic**: 
    - The existing `data-theme` attribute and `resolveDocumentTheme` will remain the "Source of Truth".
    - A custom hook will be added to `App.tsx` that calls `setColorScheme` on the Mantine hook whenever our internal theme state changes.
    - Mantine's `forceColorScheme` prop will be used to ensure Mantine components follow our existing toggle.
4. **Docs Strategy Clarification**: 
    - **No React components in static docs.**
    - Instead, we will extract Mantine's core CSS (grid, typography, variables) into a standalone CSS file or use Mantine's PostCSS mixins to generate a "Mantine-like" `docs.css`.
    - This ensures the build-time JSDOM rendering (`build-docs.ts`) remains fast and dependency-free.
5. **Resizable Layout**: Mantine's `AppShell` will provide the outer structure, but we will use `react-resizable-panels` (or keep our current custom resizer logic) *inside* the `AppShell.Main` to preserve the flexible editor/preview split.

## Addendum v1.1: Refined Migration Plan

### 1. Updated Dependencies
- `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` (v7.11+)
- `postcss`, `postcss-preset-mantine`, `postcss-simple-vars`
- `react-resizable-panels` (for the editor divider)

### 2. Theme Bridge
```tsx
// Proposed Bridge in App.tsx
const { setColorScheme } = useMantineColorScheme();
useEffect(() => {
  setColorScheme(theme); // theme is our existing 'light' | 'dark'
}, [theme]);
```

### 3. Settings Panel Schema
- **Section 1: Page Layout** (Scale, Padding)
- **Section 2: Staff Metrics** (Staff Scale, Stem Length, Spacing)
- **Section 3: Markings** (Volta, Hairpin, Tempo, Measure Numbers)
- **Section 4: Advanced** (Duration Compression, Hide Rests)

### Review Round 2
**Reviewer: Codebase Investigator (Architect)**

The author's response in Addendum v1.1 and the Refined Migration Plan satisfactorily address all architectural concerns raised in Round 1.

1. **Theme Bridge**: The decision to keep the existing `data-theme` as the Source of Truth and push updates to Mantine via a `useEffect` is correct for a migration. Note: Ensure `MantineProvider` has `defaultColorScheme` set to the initial resolved theme to prevent a "flash of wrong theme" during hydration.
2. **Resizable Layout**: `react-resizable-panels` is a high-quality replacement for the current manual `mousemove` resizer. It handles keyboard accessibility and focus management much better than the current implementation.
3. **Docs**: The clarification that React components will NOT be used in static docs is critical. Extracting CSS variables/tokens to share with `docs.css` is a sound strategy.

**STATUS: APPROVED**
