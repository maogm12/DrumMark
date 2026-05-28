# CLAUDE.md

## Primary Mandate

You MUST strictly adhere to all instructions, protocols, and engineering standards defined in **[AGENTS.md](./AGENTS.md)**.

For code changes, bug fixes, implementation plans, spec/contract changes, spikes, and architecture decisions, also follow **[Change Workflow](./.agents/skills/change-workflow/SKILL.md)** and **[project-rules.md](./.agents/skills/change-workflow/references/project-rules.md)**.

## Key Protocols to Follow

- **Change Workflow**: Route work through the smallest correct workflow in `.agents/skills/change-workflow/SKILL.md`. New Normal, Large, and Spec / Contract work uses `docs/changes/active/<change-id>/plan.md` and `history.md`. Do not create new `docs/proposals/` files.
- **Plan vs History**: `plan.md` is the current editable plan. `history.md` is append-only and records reviews, approved plans, human stamps, consolidated spec summaries, and implementation reviews.
- **Mandatory Sub-agent Review**: Non-trivial plans require sub-agent plan review before implementation (low-risk Normal Changes may skip plan review under the Light Normal Change path; record `### Plan Review Skipped`). Completed branches require one concentrated implementation review before merge. When a sub-agent is unavailable, use self-review per the Single-Agent Environment Fallback in the change-workflow skill. Do not rubber-stamp.
- **Human Stamp**: Spec / Contract Changes and other stamped work require explicit user approval recorded in `history.md` with `Status: APPROVED_FOR_IMPLEMENTATION` before implementation starts.
- **Spec Merge**: For spec or contract changes, follow `project-rules.md`: draft in `## Spec Delta`, record `## Consolidated Changes` in `history.md`, then append the final addendum to the affected spec or contract. Keep spec files append-only unless the user explicitly approves a rewrite.
- **Research & Verification**: Prioritize reading source code/documentation and creating reproduction scripts before making complex changes. Use `npm run drummark` for parser, IR, and rendering diagnosis when relevant.
- **Append-Only Learnings**: Reusable investigation findings go in `LEARNINGS.md` following the Append-Only Protocol.

Failure to follow the protocols in `AGENTS.md` and the change workflow skill is a violation of the project's engineering integrity.
