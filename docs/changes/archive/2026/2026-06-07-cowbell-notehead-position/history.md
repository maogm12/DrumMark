# Cowbell Notehead Position History

## 2026-06-07

### Draft Created

Plan file: `docs/changes/active/2026-06-07-cowbell-notehead-position/plan.md`

Status: pending plan review and human stamp.

### Plan Review

Reviewer: self-review

### Review Checklist
- [x] Problem clarity — Current `CB` behavior is generic and does not match the requested cowbell notation semantics.
- [x] Goal and non-goals — Scope is limited to `CB` notehead, staff position, MusicXML alignment, and regression coverage; no broader percussion remapping.
- [x] Scope reasonableness — The change is localized to track mapping, notehead selection, export mapping, and append-only spec updates.
- [x] Hidden compatibility risks — The main risk is the staff-space interpretation of "fourth space"; the plan records the standard bottom-up assumption explicitly.
- [x] Task actionability — Tasks separate audit, implementation, and spec/coverage closure.
- [x] Task independence — Task 1 defines the exact target; Task 2 implements it; Task 3 locks spec and regressions.
- [x] Acceptance criteria verifiability — Each task has concrete rendering/export assertions and commands.
- [x] Test plan sufficiency — Layout and MusicXML coverage are both included, plus CLI verification.
- [x] Unresolved design questions — Only the "fourth space" numbering convention needed pinning; the plan resolves it with an explicit assumption.
- [x] Spec Delta required? — Yes; this is a user-facing rendering/export semantics change for a named track.
- [x] Spec Delta specificity (if present) — The addenda name notehead shape, staff placement, and MusicXML output expectation directly.
- [x] ADR-worthy decision? — No; this is notation semantics, not a long-term architecture choice.
- [x] Human stamp required? — Yes; the change has `Spec Impact: Yes`.

STATUS: APPROVED

### Approved Plan

Approved file: `docs/changes/active/2026-06-07-cowbell-notehead-position/plan.md`
Approved commit: N/A
Approved summary:
- Change `CB` to an upward-pointing triangle notehead.
- Move `CB` to the fourth space using the standard bottom-up space numbering assumption.
- Align MusicXML output and append matching spec/contract addenda.
Open conditions:
- Human stamp required before implementation.

### Superseded

Superseded by: `docs/changes/active/2026-06-01-modifier-visual-export-completion/plan.md`

Reason:
- User requested merging cowbell-specific work into the broader visual/export completion change together with other still-undefined specialty-track semantics such as `WB`, `SPL`, and `CHN`.

Status:
- superseded before implementation
