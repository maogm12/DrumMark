# Above-Staff Marking Avoidance History

## 2026-06-07

### Draft Created

Plan file: `docs/changes/active/2026-06-07-above-staff-marking-avoidance/plan.md`

Reason:
- General above-staff avoidance is broader than the rehearsal / section mark feature and should be planned as its own layout-policy change.

Status:
- pending plan review

### Plan Review Round 1

Reviewer: subagent `019ea432-5bd6-7c01-a3f6-820d8cd660a7`

Status: CHANGES_REQUESTED

Findings:
- Blocker: `lane` and conflict resolution semantics were not defined precisely enough for implementation.
- Blocker: the contract relationship to the active rehearsal / section-marking plan was unresolved and risked overlapping append-only rules.
- Material: the plan did not cover pagination / overflow consequences of increasing system-top padding.

Resolution:
- Defined lanes as system-local shared horizontal bands with explicit non-overlap sharing and deterministic tie-break rules.
- Added an explicit supersession strategy for the rehearsal plan's temporary narrow priority wording.
- Expanded tests and risks to cover pagination, overflow, and system-box height changes.

Status:
- revised after review; pending re-review

### Plan Review Round 2

Reviewer: subagent `019ea436-dff3-7992-966a-29963d65038d`

Status: APPROVED

Summary:
- Supersession now explicitly covers both `DRUMMARK_SPEC.md` and `RENDER_LAYOUT_CONTRACT.md` when needed.
- Pagination and overflow consequences are now part of concrete task-level acceptance and verification, not only top-level notes.

### Approved Plan

Plan file: `docs/changes/active/2026-06-07-above-staff-marking-avoidance/plan.md`

Status: APPROVED
