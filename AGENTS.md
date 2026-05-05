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

To ensure technical integrity and historical traceability, all formal specifications (e.g., `DRUMMARK_SPEC.md`, `DRUM_IR_SPEC.md`) and design proposals must follow this **Proposal-based Review Protocol**. Proposals are authored, reviewed, and iterated in isolated files; only the final approved result lands in the spec.

### 1. Proposal File

- **Create a standalone proposal file** in `docs/` for each change, named `<SpecName>_proposal_<topic>.md` (e.g., `DRUMMARK_SPEC_proposal_rehearsal_marks.md`).
- The proposal file contains the full Addendum text as it would appear in the spec.
- **Each proposal gets its own file** — concurrent proposals do not block each other.

### 2. Review Iteration (Linear Ledger within the Proposal)

The proposal file itself follows the **Linear Ledger Protocol** for review notes:

- **Strict Physical Append**: Never modify the original proposal text or any previous review round. All review notes and author responses MUST be appended to the **very end of the file**.
- **Chrono-Log Format**: The file grows downward:
    - `## Addendum vX.Y: [Title]` (the original proposal)
    - `### Review Round 1` (reviewer notes)
    - `### Author Response` (author addresses feedback)
    - `### Review Round 2` → `### Author Response` → ... until approval
- **Prohibition of Anchoring**: Do NOT insert content above an existing header. Every response is a new section at the bottom.

### 3. Mandatory Sub-agent Review

After authoring a proposal, the agent MUST invoke a sub-agent to review it:

- **Constructive Hostility**: The reviewer must act as a critical architect, searching for logic deadlocks, ambiguities, or implementation gaps.
- **No Rubber Stamping**: "Looks good" is an automatic failure. The reviewer must provide specific, actionable critiques or verify complex edge cases.
- **Physical Documentation**: The reviewer MUST append their review notes to the proposal file, following the Linear Ledger Protocol.
- **Review Round ID**: Every review must clearly state its round number (e.g., `### Review Round 1`).
- The reviewer must end with a clear status: `STATUS: CHANGES_REQUESTED` or `STATUS: APPROVED`.

### 4. Final Approval, Consolidation & Archival

- Implementation may ONLY begin once a sub-agent review concludes with `STATUS: APPROVED`.
- After approval, the author MUST:
    1. **Append `### Consolidated Changes`** to the proposal file, synthesizing all agreed-upon changes from the proposal and its review rounds into a single, cohesive summary.
    2. **Append a clean Addendum** to the actual spec file (`DRUMMARK_SPEC.md` etc.) following the Linear Ledger Protocol — no review noise, just the final approved content.
    3. **Move the proposal file** to `docs/archived/` for historical record.
- The spec file itself remains append-only: Addendums are added to its end, never inserted above existing content.

## Rendering Rules

- **Total Delegation:** All score rendering (staves, notes, headers, titles, tempo) must be handled exclusively by VexFlow.
- **No Manual Simulation:** Do not add custom HTML, CSS, or Canvas/SVG drawing code to simulate or "patch" missing score elements that should be part of the VexFlow output.
- **Graceful Failure:** If VexFlow cannot render a specific input, fall back only to empty preview states or clear error messages instead of trying to manually draw placeholders.

## Debugging Tools

- **Initial Diagnosis**: When encountering parser, normalization, or rendering bugs, ALWAYS use `npm run drummark` to isolate the problem.
    - Use `--format ir` to verify if the issue is in the parser/normalization phase.
    - Use `--format svg` or `--format xml` to verify if the issue is in the rendering/export phase.
- **Verification**: After applying a fix, use the tool to verify the output in the relevant format.
