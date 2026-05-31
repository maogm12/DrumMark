# History

## Path A — Full Plan Review

### Round 1 - Plan Review

Reviewer: self-review

### Review Checklist

- [x] Problem clarity — Clear. The plan identifies the current pair-specific visual-height stride and the desired uniform spacing derived from the maximum non-overlap need.
- [x] Goal and non-goals — Clear. It explicitly removes mode choices, treats the setting as offset, allows overlap from negative offsets, and avoids changing individual span semantics.
- [x] Scope reasonableness — Reasonable for a Spec / Contract Change. Scope spans layout pagination, options/WASM/app wiring, tests, goldens, and a contract addendum.
- [x] Hidden compatibility risks — Identified. Dropping old persisted `systemSpacing` values is intentional per user request; page breaks and goldens may change.
- [x] Task actionability — Actionable. Tasks have file scopes, behavior changes, acceptance criteria, and verification commands.
- [x] Task independence — Mostly independent and ordered correctly: contract/approval, option semantics, pagination algorithm, then WASM/app wiring.
- [x] Acceptance criteria verifiability — Verifiable. The plan asks for tests showing uniform gaps, offset behavior including negative overlap allowance, and settings reset behavior.
- [x] Test plan sufficiency — Sufficient. It includes layout tests, app settings tests, typecheck, WASM rebuild, and golden handling.
- [x] Unresolved design questions — None blocking. Formula and no-migration behavior match the user's latest decisions.
- [x] Spec Delta required? — Yes, because this changes layout contract and option semantics.
- [x] Spec Delta specificity (if present) — Specific enough. It gives formulas, scope of header behavior, negative offset semantics, and visual-bound diagnostic requirements.
- [x] ADR-worthy decision? — No. This is a layout behavior contract change with clear product direction, not a broad architecture boundary decision requiring ADR.
- [x] Human stamp required? — Yes. This is a Spec / Contract Change and changes user-visible layout behavior.

### Comments

1. The plan should keep `requiredNonOverlapSpacing` implementation focused on adjacent visual bounds relative to staff origins. It should avoid sampling item roles ad hoc; system boxes already carry visual bounds.
2. The plan correctly notes that visual validation must remain available even though per-pair stride stops using visual height directly.
3. The implementation should be careful with the unpaginated scene's preliminary `sys_y`; if those local origins are only staging coordinates, changing them should not leak into final page coordinates except through system-box relative measurements.

### Agent Response

- No plan changes required. The current tasks already call out system-box visual bounds, preservation of diagnostics, and removal of pre-spacing by user-controlled absolute spacing.

### Resolution

- R1: approved, no plan revision required.

STATUS: APPROVED

### Approved Plan

Approved file: `docs/changes/active/2026-05-31-uniform-system-spacing-auto/plan.md`
Approved commit: d053618
Approved summary:
- Implement uniform automatic system spacing with one final spacing value shared across systems.
- Compute automatic base spacing as the maximum of a layout default and required non-overlap spacing plus a gap.
- Apply the app/user setting as a final offset, allowing negative values to intentionally overlap systems.
- Do not expose a mode toggle and do not migrate old `systemSpacing` saved values.
- Append the layout contract addendum from the plan's Spec Delta.

Open conditions:
- Human stamp required before implementation.
