# AGENTS.md

## Engineering Integrity

- **Research First:** When encountering technical obstacles or unfamiliar APIs, prioritize reading source code and official documentation to understand implementation details and usage patterns.
- **Avoid "Shotgun" Debugging:** Do not make speculative changes (guess-and-check) followed by requests for user verification.
- **Prototype Verification:** Before applying complex fixes or features, implement small-scale prototypes or reproduction scripts to verify assumptions autonomously.
- **Technical Rigor:** Ensure every change is idiomatically correct and does not introduce regressions or syntax errors (like omission placeholders) into the codebase.
- **Knowledge Retention:** After researching source code or documentation to solve a problem, document the findings (API details, internal logic, discovered constraints) in `LEARNINGS.md`. **All updates to `LEARNINGS.md` MUST follow the Append-Only Protocol** to prevent accidental data loss and maintain a chronological record of technical discoveries.
- **Design First**: For any significant DSL or architectural changes, the agent MUST present a design proposal (documented in the relevant specification file or a dedicated design document) and obtain explicit user approval before writing or modifying any implementation code. **All design proposals and their subsequent reviews MUST follow the Linear Ledger Protocol defined below.**
- **Mandatory Post-Change Review**: After every code modification (feature implementation or bug fix), the agent MUST invoke a sub-agent to review the change. The reviewer must verify technical correctness, check for potential side effects, and ensure compliance with existing patterns.

## Specification & Design Review Protocol

To ensure technical integrity and historical traceability, all formal specifications (e.g., `DRUMMARK_SPEC.md`, `DRUM_IR_SPEC.md`) and design proposals must follow this **Linear Ledger Protocol**:

1. **Strict Physical Append**: Never modify the "Base" version OR any previously written Addendum/Review Note. All new content (Addendums, Amendments, or Review Notes) MUST be appended to the **very end of the file**, below the last existing character.
2. **Chrono-Log Format**: The file must grow downward like a ledger. Each proposal and its associated reviews form a logical unit in the history:
    - **Addendum Title Format**: `## Addendum [vX.Y]: [Descriptive Title]` (e.g., `## Addendum v1.2: Support for Multi-Measure Repeats`).
    - **Sequence**: `[Proposal Addendum] -> [Review Round 1] -> [Addendum (Amendment) if needed] -> [Review Round 2] -> [Consolidated Changes]`.
3. **Prohibition of Anchoring**: Do NOT use `replace` to insert content above an existing "Review Notes" or "Addendum" header. If you need to add a response to a review, it must be a NEW Addendum (Amendment) at the bottom, not an edit to an old one.
4. **Mandatory Sub-agent Review**: After proposing an update or a new design, the agent MUST invoke a sub-agent to review it.
    - **Constructive Hostility**: The reviewer must act as a critical architect, searching for logic deadlocks, ambiguities, or implementation gaps.
    - **No Rubber Stamping**: "Looks good" is an automatic failure. The reviewer must provide specific, actionable critiques or verify complex edge cases.
    - **Physical Documentation**: The reviewer MUST append their review notes to the very end of the document being reviewed, following the Linear Ledger Protocol.
    - **Review Round ID**: Every review must clearly state its round number (e.g., `### Review Round 1`).
5. **Final Approval & Consolidation**:
    - Implementation may ONLY begin once a sub-agent review concludes with a clear `STATUS: APPROVED`.
    - **Consolidated Changes**: After receiving final approval from all reviewers, the primary agent MUST append a final `### Consolidated Changes` section. This section must synthesize all agreed-upon changes from the proposal and its subsequent review rounds into a single, cohesive summary for future reference. This summary and all associated review notes are part of the same Addendum's logical record.

## Design Decisions (2026-04-26)

### DSL Refactoring: Anonymous Tracks & Universal Summoning
- **Status:** APPROVED
- **Change:** Removed `DR` track. Introduced Anonymous Tracks (`|` prefix) and Track Routing Scopes (`{}`).
- **Key Features:**
    - Global Magic Tokens: `s`, `b`, `t1`, etc., are available everywhere.
    - Colon Operator: `Track:Note:Modifier` for surgical control.
    - Routing Scopes: `SD { ... }` for bulk track routing.
- **Rationale:** Eliminate the "island" effect of special tracks, unify syntax across all tracks, and provide a more intuitive "Tab-like" writing experience.

## Rendering Rules

- **Total Delegation:** All score rendering (staves, notes, headers, titles, tempo) must be handled exclusively by VexFlow.
- **No Manual Simulation:** Do not add custom HTML, CSS, or Canvas/SVG drawing code to simulate or "patch" missing score elements that should be part of the VexFlow output.
- **Graceful Failure:** If VexFlow cannot render a specific input, fall back only to empty preview states or clear error messages instead of trying to manually draw placeholders.

## Debugging Tools

- **Initial Diagnosis**: When encountering parser, normalization, or rendering bugs, ALWAYS use `npm run drummark` to isolate the problem.
    - Use `--format ir` to verify if the issue is in the parser/normalization phase.
    - Use `--format svg` or `--format xml` to verify if the issue is in the rendering/export phase.
- **Verification**: After applying a fix, use the tool to verify the output in the relevant format.
