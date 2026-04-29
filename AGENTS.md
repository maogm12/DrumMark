# AGENTS.md

## Engineering Integrity

- **Research First:** When encountering technical obstacles or unfamiliar APIs, prioritize reading source code and official documentation to understand implementation details and usage patterns.
- **Avoid "Shotgun" Debugging:** Do not make speculative changes (guess-and-check) followed by requests for user verification.
- **Prototype Verification:** Before applying complex fixes or features, implement small-scale prototypes or reproduction scripts to verify assumptions autonomously.
- **Technical Rigor:** Ensure every change is idiomatically correct and does not introduce regressions or syntax errors (like omission placeholders) into the codebase.
- **Knowledge Retention:** After researching source code or documentation to solve a problem, document the findings (API details, internal logic, discovered constraints) in `LEARNINGS.md` or a similar technical log to prevent future regressions and aid collaboration.
- **Design First:** For any significant DSL or architectural changes, the agent MUST present a design proposal and obtain explicit user approval before writing or modifying any implementation code.

## Specification Evolution & Review Protocol

To ensure technical integrity and historical traceability, all formal specifications (e.g., `DRUMMARK_SPEC.md`, `DRUM_IR_SPEC.md`) must follow this **Linear Ledger Protocol**:

1. **Strict Physical Append**: Never modify the "Base" version OR any previously written Addendum/Review Note. All new content (Addendums, Amendments, or Review Notes) MUST be appended to the **very end of the file**, below the last existing character. 
2. **Chrono-Log Format**: The file must grow downward like a ledger: `[Base] -> [Addendum v1.1] -> [Review Round 1] -> [Addendum v1.2] -> [Review Round 2]...`.
3. **Prohibition of Anchoring**: Do NOT use `replace` to insert content above an existing "Review Notes" or "Addendum" header. If you need to add a response to a review, it must be a NEW Addendum at the bottom, not an edit to an old one.
4. **Mandatory Sub-agent Review**: After proposing an update, the agent MUST invoke a sub-agent to review the specification.
    - **Constructive Hostility**: The reviewer must act as a critical architect, searching for logic deadlocks, ambiguities, or implementation gaps.
    - **No Rubber Stamping**: "Looks good" is an automatic failure. The reviewer must provide specific, actionable critiques or verify complex edge cases.
    - **Review Round ID**: Every review must clearly state its round number (e.g., `### Review Round 1`).
5. **Final Approval**: Implementation may ONLY begin once a sub-agent review concludes with a clear `STATUS: APPROVED`.

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
