# Mantine UI Migration Tasks

## Task 1: Environment Setup
- [ ] **Status**: Pending
- **Scope**: `package.json`, `vite.config.ts`, `postcss.config.js`
- **Commits**: `chore: add mantine and postcss dependencies`
- **Acceptance Criteria**: `npm install` succeeds; Vite dev server starts without PostCSS errors.

## Task 2: Root Provider & Theme Bridge
- [ ] **Status**: Pending
- **Scope**: `src/main.tsx`, `src/App.tsx`, `src/theme.ts`
- **Commits**: `feat(ui): add MantineProvider and theme synchronization`
- **Acceptance Criteria**: App renders with `MantineProvider`; Mantine components (test with a Button) correctly follow the existing light/dark toggle.

## Task 3: AppShell & Resizable Layout
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `feat(ui): replace custom flex layout with Mantine AppShell and react-resizable-panels`
- **Acceptance Criteria**: Header and Main area are correctly positioned; Editor/Preview divider is draggable and persists its position (if implemented).

## Task 4: Settings Panel Refactor (Accordion & Sliders)
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `feat(ui): refactor settings panel into grouped Accordions with Mantine Sliders`
- **Acceptance Criteria**: 16+ settings are grouped; Sliders have value bubbles; Mobile touch targets are significantly larger.

## Task 5: Component Cleanup & Refinement
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace remaining custom inputs, buttons, and switches with Mantine equivalents`
- **Acceptance Criteria**: Visual consistency across all UI elements; obsolete CSS rules removed from `styles.css`.

## Task 6: Documentation Styling Sync
- [ ] **Status**: Pending
- **Scope**: `src/docs.css`, `build-docs.ts`
- **Commits**: `style(docs): align static documentation with Mantine theme tokens`
- **Acceptance Criteria**: `npm run build-docs` produces documentation that matches the main app's aesthetic.

## Task 7: Consolidation & Archival
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/`, `AGENTS.md`
- **Commits**: `docs: consolidate mantine migration proposal into project records`
- **Acceptance Criteria**: Proposal and Tasks files moved to archived; final summary added to `LEARNINGS.md`.

### Review Round 1
**Reviewer: Codebase Investigator**

1. **Task 4 Completeness**: The proposal explicitly mentions using 'NumberInput' with controls for precise adjustment alongside 'Slider'. Task 4 currently only lists 'Mantine Sliders'. Please update Task 4 to include 'NumberInput'.
2. **Main Navigation (Tabs)**: Section 2 of the proposal specifies using Mantine 'Tabs' for switching between 'Editor', 'Page', and 'XML' views. This is missing from the tasks. It should be added to Task 3 or Task 5.
3. **Task Ordering & Verification**: The flow is logical, and the acceptance criteria are concrete and verifiable.

**STATUS: CHANGES_REQUESTED**

### Author Response

- **Task 3 Updated**: Added Mantine 'Tabs' for switching between Editor, Page, and XML views.
- **Task 4 Updated**: Added Mantine 'NumberInput' for precise value entry.

## Refined Tasks (v1.1)

### Task 1: Environment Setup
- [ ] **Status**: Pending
- **Scope**: `package.json`, `vite.config.ts`, `postcss.config.js`
- **Commits**: `chore: add mantine and postcss dependencies`
- **Acceptance Criteria**: `npm install` succeeds; Vite dev server starts without PostCSS errors.

### Task 2: Root Provider & Theme Bridge
- [ ] **Status**: Pending
- **Scope**: `src/main.tsx`, `src/App.tsx`, `src/theme.ts`
- **Commits**: `feat(ui): add MantineProvider and theme synchronization`
- **Acceptance Criteria**: App renders with `MantineProvider`; Mantine components (test with a Button) correctly follow the existing light/dark toggle.

### Task 3: AppShell, Tabs & Resizable Layout
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `feat(ui): replace custom flex layout with Mantine AppShell, Tabs, and react-resizable-panels`
- **Acceptance Criteria**: Header and Main area are correctly positioned; "Editor/Page/XML" view switching uses Mantine Tabs; Editor/Preview divider is draggable.

### Task 4: Settings Panel Refactor (Accordion, Sliders, NumberInput)
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `feat(ui): refactor settings panel into grouped Accordions with Mantine Sliders and NumberInputs`
- **Acceptance Criteria**: 16+ settings are grouped; Sliders have value bubbles; NumberInputs allow precise entry; Mobile touch targets are significantly larger.

### Task 5: Component Cleanup & Refinement
- [ ] **Status**: Pending
- **Scope**: `src/App.tsx`, `src/styles.css`
- **Commits**: `refactor(ui): replace remaining custom inputs, buttons, and switches with Mantine equivalents`
- **Acceptance Criteria**: Visual consistency across all UI elements; obsolete CSS rules removed from `styles.css`.

### Task 6: Documentation Styling Sync
- [ ] **Status**: Pending
- **Scope**: `src/docs.css`, `build-docs.ts`
- **Commits**: `style(docs): align static documentation with Mantine theme tokens`
- **Acceptance Criteria**: `npm run build-docs` produces documentation that matches the main app's aesthetic.

### Task 7: Consolidation & Archival
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/`, `AGENTS.md`
- **Commits**: `docs: consolidate mantine migration proposal into project records`
- **Acceptance Criteria**: Proposal and Tasks files moved to archived; final summary added to `LEARNINGS.md`.

### Review Round 2
**Reviewer: Codebase Investigator**

1. **Refined Tasks (v1.1) Validation**: The updated tasks now correctly reflect the architectural requirements defined in the Mantine Migration Proposal (v1.1).
2. **Navigation (Tabs)**: Task 3 has been updated to include Mantine 'Tabs' for the 'Editor/Page/XML' views. This ensures the mobile/desktop view switching logic is part of the AppShell refactor.
3. **Precision Controls**: Task 4 now includes 'NumberInput' alongside 'Slider', satisfying the requirement for precise numeric adjustments in the settings panel.
4. **Consistency**: The acceptance criteria across all tasks are now aligned with the proposed implementation strategy, including the use of 'react-resizable-panels'.

**STATUS: APPROVED**
