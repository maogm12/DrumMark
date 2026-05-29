---
name: change-workflow
description: Use when deciding how to handle code changes, bug fixes, product feedback, implementation plans, spec changes, spikes, or architecture decisions. Routes work into the smallest workflow that preserves correctness.
---

# Change Workflow

This skill routes development work into the appropriate workflow.

Use it when deciding how to handle:

- code changes
- bug fixes
- product feedback
- implementation plans
- spec or contract changes
- refactors
- spikes / feasibility checks
- architecture decisions

Not every change needs a plan.

Choose the smallest workflow that preserves correctness.

For project-specific rules, read:

```text
.agents/skills/change-workflow/references/project-rules.md
```

For templates, read:

```text
.agents/skills/change-workflow/references/plan-template.md
.agents/skills/change-workflow/references/history-template.md
.agents/skills/change-workflow/references/bug-issue-template.md
.agents/skills/change-workflow/references/adr-template.md
```

---

## Entry Checklist

Before starting work, answer:

- [ ] Is this a tiny change that can be safely fixed directly? (Check [Tiny Change Exclusion Criteria](.agents/skills/change-workflow/references/project-rules.md#tiny-change-exclusion-criteria) first.)
- [ ] Is this a bug or feedback item that should be recorded as a GitHub Issue?
- [ ] Is this a normal change that needs a reviewed plan?
- [ ] Is this a spec or contract change that needs `## Spec Delta` and a human stamp? (If yes: read [project-rules.md](.agents/skills/change-workflow/references/project-rules.md) before planning.)
- [ ] Is this a large or risky change that may need an ADR?
- [ ] Is this an exploratory question that should be handled as a spike?
- [ ] What tests or verification will prove the work is done?

Do not start implementation for a Normal, Large, or Spec / Contract Change until the required plan review is approved — except for Light Normal Change or a Normal Change with a recorded skip reason (see [Light Normal Change](#light-normal-change)).

---

### Single-Agent Environment Fallback

When the agent cannot spawn a sub-agent for review:

- **Plan review**: Agent executes the review checklist (see [Plan Review Rules](#plan-review-rules)) itself, appends the result to `history.md`, and labels it `Reviewer: self-review`.
- **Implementation review**: Same procedure — self-review with checklist, recorded in `history.md`.
- A self-review is not equivalent to external review, but it preserves the checklist record.
- If the user is available in the conversation, prefer asking the user for a human review in place of a sub-agent review.

---

## Workflow Decision Table

| Work type | Change folder | Plan review | Human stamp | ADR |
|---|---:|---:|---:|---:|
| Tiny Change | No | No | No | No |
| Small in-scope bug | No | No | No | No |
| Bug / feedback needing tracking | GitHub Issue | No | No | No |
| Normal Change | Yes | Yes | No | Usually no |
| Normal Change (light) | Yes | Optional | No | No |
| Medium bug with behavior risk | Yes | Yes | No, unless public behavior changes | Maybe |
| Spec / Contract Change | Yes | Yes | Yes | Maybe |
| Large internal refactor | Yes | Yes | Optional; required if high risk | Maybe |
| Large architecture/public behavior change | Yes | Yes | Yes | Usually yes |
| Spike | Spike note | No | No | No |

### Overlap Priority

When a change matches multiple work types, use this priority order:

```text
Spec / Contract Change > Large Change > Normal Change > Tiny Change
```

1. If a change meets Spec / Contract Change criteria, follow the Spec / Contract workflow even if it also qualifies as Large.
2. If a change meets Large Change criteria, do not downgrade to Normal unless: (a) it does not involve architecture boundary, public behavior, compatibility, or migration, and (b) the plan reviewer explicitly agrees to the downgrade.
3. Spec / Contract Changes that are also Large inherit the extra Large Change requirements (ADR, human stamp when applicable) on top of the Spec workflow.

---

## Workflow Selection

### Tiny Change

Use Tiny Change for:

- typos
- comments
- small styling tweaks
- obvious one-line fixes
- small tests
- low-risk local refactors
- small fixes already covered by the current task scope

Tiny Change workflow:

```text
1. Make the change.
2. Run relevant checks.
3. Ask for implementation review if appropriate.
4. Merge or summarize.
```

Tiny Changes do not require a change folder, `plan.md`, or `history.md`.

If a Tiny Change becomes risky, cross-cutting, or ambiguous, escalate to Normal Change.

Before classifying a change as Tiny, check [project-rules.md § Tiny Change Exclusion Criteria](.agents/skills/change-workflow/references/project-rules.md#tiny-change-exclusion-criteria). If any exclusion criterion is met, the change is at least Normal.

---

### Normal Change

Use Normal Change for most non-trivial work:

- normal features
- medium bug fixes
- behavior changes
- small-to-medium refactors
- changes with clear scope and limited risk
- implementation work that benefits from plan review

Normal Changes require:

```text
docs/changes/active/<change-id>/
  plan.md
  history.md
```

Normal Change workflow:

```text
1. Create docs/changes/active/<change-id>/plan.md.
2. Create docs/changes/active/<change-id>/history.md.
3. Write the initial plan in plan.md.
4. Ask a sub-agent to review the plan (or self-review if unavailable — see [Single-Agent Environment Fallback](#single-agent-environment-fallback)).
5. Append the review to history.md.
6. Rewrite plan.md based on review feedback.
7. Repeat until plan review reaches STATUS: APPROVED.
8. Append ### Approved Plan to history.md.
9. Create a branch or PR and implement.
10. Run relevant tests and verification.
11. Ask a sub-agent to review the implementation (or self-review if unavailable).
12. Append the implementation review to history.md.
13. Fix review findings.
14. Merge only after implementation review reaches STATUS: APPROVED.
15. Archive the change folder.
```

### Light Normal Change

Light Normal Change is a variant for low-risk Normal Changes that do not need formal plan review. It is the recommended path when plan review would be disproportionate to the change size.

Light Normal Change may be used when **all** of the following are true:

- change is confined to a single subsystem
- does not modify public API, CLI interface, or contracts
- expected diff < ~200 lines
- existing tests cover the affected paths

Light Normal Change workflow:

```text
1. Create docs/changes/active/<change-id>/plan.md.
2. Create docs/changes/active/<change-id>/history.md.
3. Write the plan in plan.md. Note the skip reason in the plan.
4. Append ### Plan Review Skipped to history.md:
     Skip reason: [reason]
     Plan file: docs/changes/active/<change-id>/plan.md
5. Create a branch or PR and implement.
6. Run relevant tests and verification.
7. Ask a sub-agent to review the implementation (or self-review if unavailable).
8. Append the implementation review to history.md.
9. Fix review findings.
10. Merge only after implementation review reaches STATUS: APPROVED.
11. Archive the change folder.
```

### Skipping Plan Review for Other Normal Changes

For a Normal Change that does **not** meet the Light criteria, plan review may still be skipped if **all** of the following are true:

- change is confined to a single file or single module
- does not modify any public interface or contract
- existing tests cover the change paths
- the agent records the reason for skipping in `plan.md`

The same `### Plan Review Skipped` section (as above) must be recorded in `history.md` before implementation starts.

Skipping plan review does **not** skip implementation review. Merge still requires `STATUS: APPROVED` from implementation review.

If skipping plan review proves to have been wrong (scope grows, risk discovered), escalate and request a plan review before continuing.

---

### Large Change

Use Large Change for unusually large, risky, or cross-cutting work:

- architecture redesign
- public API changes
- DSL / IR / schema / file format changes
- compatibility or migration-sensitive changes
- changes spanning multiple subsystems
- changes likely to require several review rounds

Large Changes use the same `plan.md` + `history.md` structure as Normal Changes.

Large Changes may also require:

- ADRs for long-term decisions
- human stamp before implementation
- multiple implementation PRs
- explicit migration or rollback plan

---

### Spec / Contract Change

A change is a Spec / Contract Change if it modifies or clarifies:

- DSL syntax or semantics
- IR structure or semantics
- parser behavior
- validation rules
- rendering behavior contract
- layout contract
- public CLI behavior
- compatibility or migration behavior
- persisted file or data format

Spec / Contract Changes must use the Normal or Large Change workflow.

`plan.md` must include:

- `## Spec Delta`
- `## Affected Specs / Contracts`
- at least one task that updates the affected spec or contract

Spec / Contract Changes require:

- plan review approval
- `### Approved Plan` recorded in `history.md`
- human stamp recorded in `history.md`
- implementation review before merge
- spec merge protocol from `references/project-rules.md`

ADR records why a decision was made.

Spec Delta records what the spec, language, behavior, or contract requires.

Do not use ADR as a replacement for spec text.

After plan review reaches `STATUS: APPROVED`, do not silently change `## Spec Delta`.

If `## Spec Delta` changes materially, request another plan review and human stamp.

---

### Bug / Feedback

Use GitHub Issues for bugs, feedback, and backlog items when:

- the issue should be tracked but not fixed immediately
- reproduction steps matter
- evidence, priority, or severity matter
- discussion or triage is needed
- the bug is discovered during work but is out of scope for the current plan
- the item may become a future change plan or PR

Small, obvious bugs may be fixed directly without creating an issue if:

- the fix is immediate
- the fix is in scope
- the PR or commit can fully document the change
- appropriate tests or verification are added

When in doubt:

- If the bug interrupts current work or needs tracking, create an issue.
- If the bug is small and already in scope, fix it directly.

---

### Spike

Use a spike when feasibility is unknown.

Examples:

- testing whether a library works
- measuring bundle size
- checking platform behavior
- evaluating rendering quality
- measuring performance
- comparing implementation strategies

Spike notes live under:

```text
docs/spikes/
```

A spike should answer a question, not become production implementation.

If the result leads to implementation, create a Normal or Large Change plan.

---

### ADR-worthy Decision

Use ADRs only for important long-term decisions.

Create an ADR when a decision:

- affects architecture boundaries
- affects public API, DSL, IR, schema, or file format
- is likely to be debated again
- affects compatibility or migration
- has multiple reasonable alternatives
- has long-term consequences

Do not create ADRs for small implementation details.

ADR files live under:

```text
docs/adr/
```

---

## Required File Layout for Normal and Large Changes

For every Normal Change or Large Change, create a dedicated change folder:

```text
docs/changes/active/<change-id>/
  plan.md
  history.md
```

Use this change id format:

```text
YYYY-MM-DD-short-kebab-title
```

Example:

```text
docs/changes/active/2026-05-27-rest-layout/
  plan.md
  history.md
```

The agent must not create `plan.md` or `history.md` in the repository root.

The agent must not create loose change files under `docs/changes/active/`.

The only valid location for a normal or large change plan is:

```text
docs/changes/active/<change-id>/plan.md
```

The only valid location for review history is:

```text
docs/changes/active/<change-id>/history.md
```

After merge, move the entire folder to:

```text
docs/changes/archive/<year>/<change-id>/
```

---

## plan.md Rules

`plan.md` always means:

```text
docs/changes/active/<change-id>/plan.md
```

unless the change has already been archived.

`plan.md` is the current truth.

It must stay clean and editable.

The agent may rewrite `plan.md` after review.

Do not append old proposals, stale review notes, old task versions, or review history to `plan.md`.

Git history preserves old versions.

Use the template in:

```text
.agents/skills/change-workflow/references/plan-template.md
```

---

## history.md Rules

`history.md` always means:

```text
docs/changes/active/<change-id>/history.md
```

unless the change has already been archived.

`history.md` is append-only.

All plan reviews, implementation reviews, approved plan records, human stamps, consolidated changes, and agent responses go here.

Do not use `history.md` as the current source of truth.

Use the template in:

```text
.agents/skills/change-workflow/references/history-template.md
```

Every review must end with exactly one of:

```text
STATUS: CHANGES_REQUESTED
```

or:

```text
STATUS: APPROVED
```

---

## Plan Review Rules

For Normal (except Light / recorded skip), Large, and Spec / Contract Changes, the agent must ask a sub-agent to review `plan.md` before implementation. Spec / Contract and Large Changes may never skip plan review.

The reviewer should act as a skeptical architect.

The reviewer checks:

- Is the problem clear?
- Are goal and non-goals clear?
- Is the scope reasonable?
- Are there hidden compatibility risks?
- Are tasks actionable?
- Are tasks independently implementable and testable?
- Are acceptance criteria verifiable?
- Is the test plan sufficient?
- Are there unresolved design questions?
- Is `## Spec Delta` required?
- If `## Spec Delta` exists, is it specific enough?
- Should any important decision become an ADR?
- Is a human stamp required?

The reviewer must not rubber-stamp.

"Looks good" without analysis is not acceptable.

The review must be recorded in `history.md` using the following checklist format. Every item must have a concrete answer. Missing per-item answers invalidates the review:

```markdown
### Review Checklist
- [ ] Problem clarity — ...
- [ ] Goal and non-goals — ...
- [ ] Scope reasonableness — ...
- [ ] Hidden compatibility risks — ...
- [ ] Task actionability — ...
- [ ] Task independence — ...
- [ ] Acceptance criteria verifiability — ...
- [ ] Test plan sufficiency — ...
- [ ] Unresolved design questions — ...
- [ ] Spec Delta required? — ...
- [ ] Spec Delta specificity (if present) — ...
- [ ] ADR-worthy decision? — ...
- [ ] Human stamp required? — ...
```

If the reviewer responds with free-form text instead of the checklist, the review is considered incomplete. The agent must request a re-review in checklist format.

Implementation may start only after plan review reaches:

```text
STATUS: APPROVED
```

or after `### Plan Review Skipped` has been recorded for an eligible Normal Change (see [Light Normal Change](#light-normal-change)). Spec / Contract and Large Changes may not skip plan review.

For Spec / Contract Changes and Large Changes that require human stamp, implementation may start only after both:

```text
STATUS: APPROVED
```

and a recorded human stamp.

---

## Approved Plan Recording

Whenever plan review reaches `STATUS: APPROVED`, append `### Approved Plan` to `history.md`.

Required fields:

```md
### Approved Plan

Approved file: `docs/changes/active/<change-id>/plan.md`
Approved commit: <commit-hash-if-available>
Approved summary:
- ...
Open conditions:
- None / ...
```

If no commit hash is available, record a concise summary of the approved plan and create a commit before implementation whenever practical.

For Spec / Contract Changes, the approved `## Spec Delta` must be represented in the approved plan summary.

---

## Human Stamp

A human stamp is required before implementation for:

- Spec / Contract Changes
- Large changes that affect public behavior, architecture boundary, compatibility, migration, or user-visible semantics
- changes where the user explicitly requests final sign-off

Human stamp is optional for large internal refactors that do not change public behavior, unless the reviewer requests it.

Tiny Changes and ordinary Normal Changes do not require a human stamp unless requested.

When a human stamp is required, the approval must be recorded in `history.md` before implementation starts.

Do not rely only on chat history.

Do not record the stamp only by changing `plan.md` status.

Append this section to `history.md`:

```md
## Human Stamp

Date: YYYY-MM-DD
Approved by: <user or role>
Approved plan: `docs/changes/active/<change-id>/plan.md`
Approved plan commit: <commit-hash-if-available>
Scope: <what is approved>

Approval text:

> <verbatim user approval message; if none, write "Verbally approved in conversation">

Conditions:
- <any constraints or caveats>
- or `None`

Status: APPROVED_FOR_IMPLEMENTATION
```

### Operation Flow

1. The user confirms approval verbally in the conversation (e.g., "approved", "可以开始了", "LGTM"). Any affirmative statement is sufficient.
2. The agent is responsible for writing the `## Human Stamp` section to `history.md`.
3. In the `Approval text` field, the agent quotes the user's approval message verbatim. If no verbatim text is available, write `Verbally approved in conversation`.
4. After writing, the agent notifies the user: "Human stamp recorded in `history.md`. Beginning implementation."
5. Do not rely only on chat history; the stamp must be in `history.md` before implementation starts.

Implementation may begin only after `history.md` contains:

```text
Status: APPROVED_FOR_IMPLEMENTATION
```

If the plan changes materially after the stamp, the stamp is no longer valid.

Material changes include:

- changed `## Spec Delta`
- changed public behavior
- changed compatibility or migration behavior
- changed task scope in a way that adds risk
- changed architecture approach
- removed or weakened acceptance criteria

When a material change happens, request plan review again and obtain a new human stamp.

---

## Task Independence Rule

Each task in `plan.md` must be independently implementable and testable.

Each task must include:

- Scope
- Action
- Input / output contract when applicable
- Dependencies
- Acceptance criteria
- Verification

Avoid hidden coupling between tasks.

A task is not actionable if it requires unstated work from another task.

Foundation tasks should come before dependent tasks.

Independent modules that consume the same foundation output should remain separate.

Algorithms with no external dependencies should be their own task and should be testable with hand-crafted input.

Orchestrator tasks that call modules in sequence should come last, after independent modules are built and tested.

Avoid tasks that are only logical phases but cannot be tested independently.

---

## Implementation Rules

Before implementation, confirm:

- [ ] The work is not Tiny Change, or Tiny Change has been intentionally chosen.
- [ ] The change folder exists if this is Normal or Large.
- [ ] `docs/changes/active/<change-id>/plan.md` exists.
- [ ] `docs/changes/active/<change-id>/history.md` exists.
- [ ] Plan review reached `STATUS: APPROVED`, or plan review was intentionally skipped with `### Plan Review Skipped` recorded in `history.md` (see [Light Normal Change](#light-normal-change)).
- [ ] If plan review was performed, `### Approved Plan` was appended to `history.md`. If skipped, `### Plan Review Skipped` was appended.
- [ ] Human stamp was received and recorded if required.
- [ ] Relevant GitHub Issues are linked if applicable.
- [ ] Relevant ADRs are linked if applicable.

During implementation:

1. Create or use a dedicated branch.
2. Implement task by task.
3. Update task status in `plan.md`.
4. **Commit per task.** After each task completes (status → done, all checks pass), create a commit with a message referencing the task: `[Task N.M] brief description`. Do not accumulate changes from multiple tasks in a single commit. Untracked plan/history files go in their own commit.
5. Run relevant checks after meaningful milestones.
6. Do not silently expand scope.
7. If the implementation changes the plan, update `plan.md`.
8. If the change is significant, request another plan review.
9. If `## Spec Delta` changes materially, request another plan review and human stamp.

During implementation, do not request formal plan review after every task or commit.

Default behavior:

- update task status in `plan.md`
- run relevant checks
- continue implementation
- request one implementation review when all planned tasks are complete

Request another plan review only if scope, architecture, Spec Delta, public behavior, compatibility, or risk materially changes.

---

## Implementation Review Rules

When implementation is complete, ask a sub-agent to review the branch or PR (or self-review if unavailable — see [Single-Agent Environment Fallback](#single-agent-environment-fallback)).

The implementation reviewer checks:

- Does the code match `plan.md`?
- Are all tasks complete?
- Are acceptance criteria satisfied?
- Are relevant tests added or updated?
- Do tests pass?
- Was unnecessary scope creep introduced?
- Are linked bugs fixed?
- Are linked GitHub Issues updated?
- Are affected specs or contracts updated when required?
- Are any ADRs contradicted?
- Are migration or compatibility notes handled?
- Is the change ready to merge?

Append the implementation review to `history.md`.

The branch may merge only after implementation review reaches:

```text
STATUS: APPROVED
```

For Tiny Changes, implementation review is optional unless requested or risk is discovered.

---

## Test and Verification Rules

Use tests as executable acceptance criteria.

For bug fixes, prefer:

1. minimal reproduction
2. failing regression test
3. fix
4. passing regression test

For changes where automated tests are not practical, record manual verification steps in `plan.md`.

Also follow project-specific verification rules in:

```text
.agents/skills/change-workflow/references/project-rules.md
```

---

## Merge and Archive Rules

Before merge, confirm:

- [ ] Implementation review reached `STATUS: APPROVED`.
- [ ] All tasks are done or explicitly deferred.
- [ ] Tests and verification are complete.
- [ ] Affected specs or contracts are updated if required.
- [ ] GitHub Issues are updated if applicable.
- [ ] ADRs are added or updated if required.
- [ ] `plan.md` status is updated.
- [ ] `history.md` contains the final implementation review.

After approval:

1. Merge the branch into `main`.
2. Prefer squash merge unless the user or project explicitly requests otherwise.
3. Update `plan.md` status to `merged`.
4. Add the PR link or final commit if available.
5. Move the change folder from:

```text
docs/changes/active/<change-id>/
```

to:

```text
docs/changes/archive/<year>/<change-id>/
```

---

## Legacy and Roadmap Documents

Do not create new proposal or tasks files under:

```text
docs/proposals/
```

Existing files under `docs/proposals/` and `docs/archived/` are historical artifacts. Read them only for context.

New change records must use:

```text
docs/changes/active/<change-id>/
  plan.md
  history.md
```

New completed change records are archived under:

```text
docs/changes/archive/<year>/<change-id>/
```

`docs/PLAN.md` and `docs/TASKS.md`, if present, are roadmap-level documents.

They are not substitutes for per-change `plan.md`.

---

## Relationship Between Artifacts

Use each artifact for its proper job:

| Artifact | Purpose |
|---|---|
| GitHub Issue | Bugs, feedback, backlog items, tracking, triage |
| `plan.md` | Current implementation plan for a Normal or Large Change |
| `history.md` | Append-only review history |
| Branch / PR | Implementation and code review |
| Test | Executable acceptance criteria and regression prevention |
| ADR | Long-term architecture decisions |
| Spec Delta | Exact change to spec, language, behavior, or contract |
| LEARNINGS.md | Reusable lessons from investigation or debugging |

Rules:

```text
Issue records the problem.
plan.md records the current plan.
history.md records reviews, approved plans, plan review skipped records, stamps, and consolidated changes.
Branch / PR records implementation.
Tests prove behavior.
ADR records long-term decisions.
Spec Delta records spec or contract requirements.
LEARNINGS.md records reusable project knowledge.
```

Do not overload one artifact with every type of information.

---

## Practical Defaults

Use these defaults:

```text
Tiny change:
  No plan. Fix directly. Review if needed.

Normal feature or medium bug:
  plan.md + history.md.

Bug report or feedback:
  GitHub Issue if tracking, reproduction, severity, priority, or discussion is needed.

Spec / Contract Change:
  plan.md + history.md + Spec Delta + affected spec update task + human stamp.

Large architecture change:
  plan.md + history.md + optional ADR + human stamp when needed.

Feasibility question:
  Spike note first, then plan if implementation proceeds.
```

The most important rules:

```text
Choose the smallest workflow that preserves correctness.
Keep the current plan clean.
Keep review history separate.
Record approved plans and human stamps in history.md.
Use GitHub Issues for bugs and feedback that need tracking.
Use tests for verification.
Use ADRs only for decisions worth remembering.
Use Spec Delta for spec or contract requirements.
Do not create new docs/proposals files.
```
