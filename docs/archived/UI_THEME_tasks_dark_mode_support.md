# UI_THEME_tasks_dark_mode_support.md

## Execution Plan: Dark Mode Support

### Task 1: Theme Architecture — Define light/dark token model
- [x] **Status**: Done
- **Scope**: `src/styles.css`, `src/docs.css`
- **Commits**:
  - `feat(theme): define dark mode token architecture`
- **Acceptance Criteria**:
  - Shared UI surfaces use semantic color tokens rather than scattered hard-coded light literals.
  - A root-level dark override path exists through `@media (prefers-color-scheme: dark)` and `data-theme="dark"`.
  - White paper/export surfaces have dedicated invariant tokens and do not flip in dark mode.
- **Dependencies**: none

### Task 2: App Shell — Apply dark tokens across interactive UI
- [x] **Status**: Done
- **Scope**: `src/styles.css`, `src/App.tsx`
- **Commits**:
  - `feat(ui): apply dark mode to app shell and settings`
- **Acceptance Criteria**:
  - Header, panes, tabs, settings drawer, status bar, buttons, error surfaces, and XML preview are legible in both modes.
  - There are no obvious light-only blocks inside the main application chrome.
- **Dependencies**: Task 1

### Task 3: Editor — Add dark CodeMirror theme and syntax palette
- [x] **Status**: Done
- **Scope**: `src/drummark.ts`, `src/App.tsx`
- **Commits**:
  - `feat(editor): add dark codemirror theme support`
- **Acceptance Criteria**:
  - CodeMirror chrome adapts to dark mode.
  - Syntax highlighting remains category-distinct and readable in dark mode.
  - Theme selection follows the active app theme without recreating unrelated editor behavior.
- **Dependencies**: Task 1

### Task 4: Docs — Apply dark mode to generated documentation pages
- [x] **Status**: Done
- **Scope**: `src/docs.css`, generated docs via existing templates/build pipeline
- **Commits**:
  - `feat(docs): add dark mode support to docs pages`
- **Acceptance Criteria**:
  - Docs header, sidebar, tables, cards, code snippets, and navigation remain readable in dark mode.
  - Example previews and code blocks do not regress contrast.
- **Dependencies**: Task 1

### Task 5: Verification, Learnings, and Consolidation
- [x] **Status**: Done
- **Scope**: `LEARNINGS.md`
- **Commits**:
  - `docs(learnings): record dark mode theme constraints`
- **Acceptance Criteria**:
  - `npm run build` passes.
  - Relevant UI tests or targeted checks pass if present.
  - `LEARNINGS.md` appends the dark-mode implementation constraints discovered during the change.
- **Dependencies**: Task 2, Task 3, Task 4

### Review Round 1

1. This task plan is incomplete against the repository protocol. The final task must include proposal/spec consolidation, and after completion the approved proposal/tasks files must be archived. Neither action is represented here. As written, the plan can finish implementation and still violate the documented process.
2. Task 1 is too broad for safe ordering because it mixes app and docs token architecture into one step, while Task 3 and Task 4 depend on it in different ways. If docs keep a separate token namespace, the plan should either say that explicitly in Task 1 acceptance criteria or split docs token plumbing from app token plumbing. Right now “define dark mode token architecture” is vague enough that downstream tasks can each invent their own model.
3. Task 2 acceptance criteria are too informal to catch the likely regressions. “No obvious light-only blocks” is a smell, not a criterion. This should explicitly mention the known high-risk surfaces called out in the proposal: XML preview, error list, empty states, toggles, and status surfaces.
4. Task 3 is missing a verification hook for theme switching behavior. The risk here is not just whether a dark theme exists, but whether the editor follows the same active theme as the app without stale extensions or remount glitches. The acceptance criteria should require deterministic switching under explicit root overrides.
5. Task 4 does not mention regenerating and verifying the built docs artifacts. For this repo, docs changes are not complete until the generated outputs are rebuilt and checked. That belongs either here or in the final verification task.
6. Task 5 scope is wrong for its title. “Verification, Learnings, and Consolidation” claims consolidation, but the scope only lists `LEARNINGS.md` and the acceptance criteria omit consolidation entirely. Either rename the task or add the actual consolidation work.

Residual risk if you fix the protocol gaps but leave the current task granularity: the implementation may still ship with mixed token names between app shell and docs, which tends to create follow-up churn rather than one clean theme pass.

STATUS: CHANGES_REQUESTED

### Author Response

The review is correct: the original task plan was missing protocol-closeout work and left too much ambiguity in token ownership and verification. This response amends the plan as follows.

#### 1. Task 1 is narrowed to shared theme resolution and app-shell token plumbing

Task 1 is now interpreted as:

- define the root light/dark activation model
- define theme precedence (`data-theme` override over system preference)
- add shared app-shell semantic tokens
- add explicit invariant paper/export tokens
- set root `color-scheme`

Docs-specific token plumbing is **not** implicitly bundled into Task 1.

#### 2. Task 2 verification is expanded to the known high-risk surfaces

Task 2 acceptance must explicitly cover:

- header
- pane chrome
- tabs
- settings panel
- status bar
- error list
- empty states
- toggle/switch controls
- XML preview shell and line rendering

“No obvious light-only blocks” is retained only as a shorthand summary, not as the primary acceptance criterion.

#### 3. Task 3 must verify deterministic switching under explicit overrides

Task 3 acceptance must include:

- editor renders correctly under explicit `data-theme="light"`
- editor renders correctly under explicit `data-theme="dark"`
- theme switches without stale light-theme extensions remaining active

#### 4. Task 4 must include docs regeneration and verification

Task 4 acceptance must include:

- `npm run build-docs` regenerates docs artifacts successfully
- generated docs honor explicit root light/dark overrides
- generated docs remain readable when no explicit override is present and system dark preference is active

#### 5. A dedicated protocol-closeout task is required

Add a final task after implementation verification:

### Task 6: Consolidation and Archival
- [ ] **Status**: Pending
- **Scope**: `docs/proposals/UI_THEME_proposal_dark_mode_support.md`, `docs/proposals/UI_THEME_tasks_dark_mode_support.md`, `docs/archived/`
- **Commits**:
  - `docs: archive completed dark mode proposal artifacts`
- **Acceptance Criteria**:
  - proposal and tasks files reflect final approved review state
  - any required consolidation notes are appended
  - both files are moved from `docs/proposals/` to `docs/archived/`
- **Dependencies**: Task 5

#### 6. Task 5 title is narrowed to match actual scope

Task 5 should be interpreted as implementation verification and learnings capture only. Consolidation/archive responsibilities move to Task 6.

### Task 6: Consolidation and Archival
- [x] **Status**: Done
- **Scope**: `docs/proposals/UI_THEME_proposal_dark_mode_support.md`, `docs/proposals/UI_THEME_tasks_dark_mode_support.md`, `docs/archived/`
- **Commits**:
  - `docs: archive completed dark mode proposal artifacts`
- **Acceptance Criteria**:
  - proposal and tasks files reflect final approved review state
  - consolidation notes are appended
  - both files are moved from `docs/proposals/` to `docs/archived/`
- **Dependencies**: Task 5

### Review Round 2

The author response closes the protocol and sequencing gaps sufficiently for execution.

1. The missing closeout work is now covered by an explicit Task 6 for consolidation and archival. That was the largest process defect in the original plan.
2. Task 1 is now constrained to shared theme resolution and app-shell token plumbing, which reduces the chance that app and docs token models drift under an overly broad “architecture” task.
3. Task 2 now names the previously hand-wavy high-risk surfaces explicitly, which makes the acceptance criteria materially stronger.
4. Task 3 now includes deterministic override switching and stale-extension avoidance, which is exactly the failure mode that tends to bite CodeMirror theme work.
5. Task 4 now includes docs regeneration and verification, which is necessary in this repo and was previously missing.
6. Task 5 and Task 6 now have cleaner responsibility boundaries: verification/learnings first, protocol closeout second.

Residual risk: because these corrections live in the appended author response rather than a rewritten task list, execution discipline matters. A sloppy implementer could still read only the original task headings and miss the refinements. That is not enough to block approval, but it is worth noting.

STATUS: APPROVED
