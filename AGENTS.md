# AGENTS.md

## Engineering Integrity

- **Research First:** When encountering technical obstacles or unfamiliar APIs, prioritize reading source code and official documentation to understand implementation details and usage patterns.
- **Avoid "Shotgun" Debugging:** Do not make speculative changes (guess-and-check) followed by requests for user verification.
- **Prototype Verification:** Before applying complex fixes or features, implement small-scale prototypes or reproduction scripts to verify assumptions autonomously.
- **Technical Rigor:** Ensure every change is idiomatically correct and does not introduce regressions or syntax errors (like omission placeholders) into the codebase.
- **Knowledge Retention:** After researching source code or documentation to solve a problem, document the findings (API details, internal logic, discovered constraints) in `LEARNINGS.md` or a similar technical log to prevent future regressions and aid collaboration.
- **Design First:** For any significant DSL or architectural changes, the agent MUST present a design proposal and obtain explicit user approval before writing or modifying any implementation code.

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
