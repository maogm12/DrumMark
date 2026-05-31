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

---

### Round 2 - Plan Review

Reviewer: Rawls (sub-agent)

### Review Checklist

- [x] Problem clarity — Clear. The plan identifies the current pair-specific visual-height advance problem and the desired uniform spacing behavior.
- [x] Goal and non-goals — Mostly clear. It explicitly chooses no mode toggle, no migration, offset semantics, and allows negative-offset overlap.
- [ ] Scope reasonableness — Scope is right for a Spec / Contract Change, but the plan underestimates pagination complexity: computing one spacing before pagination can change page breaks, which can change adjacency sets, which can change required spacing.
- [ ] Hidden compatibility risks — Not fully covered. Dropping old `systemSpacing` is stated, but the wire/WASM compatibility story is vague: “keep the wire option key stable only where needed” is not actionable enough.
- [ ] Task actionability — Partially actionable. The high-level tasks are good, but Task 3 needs a concrete algorithm for document-wide vs page-local spacing, repagination convergence, and how first systems on new pages participate.
- [x] Task independence — Reasonable. Option semantics, pagination, WASM/app wiring are separated enough, with clear dependencies.
- [ ] Acceptance criteria verifiability — Needs tightening. “Uniform system-origin gaps” must define whether the measured gap is staff-origin-to-staff-origin, previous staff-bottom-to-next staff-top, or visual-bound spacing.
- [ ] Test plan sufficiency — Good baseline commands, but insufficient pagination tests. Needs tests for page breaks after spacing expansion, multi-page documents, first system after page break, and negative offset intentionally causing overlap.
- [ ] Unresolved design questions — Yes. Biggest open question: is the computed final spacing global for the whole score, per page, or per layout pass? User said “所有system都用这个间距”, which sounds score-wide, but pagination may require a fixed-point pass.
- [x] Spec Delta required? — Yes. This changes layout contract behavior and option semantics; Spec Delta is correctly included.
- [ ] Spec Delta specificity (if present) — Close, but not specific enough. It needs a precise definition of `requiredNonOverlapSpacing`, coordinate basis, page scope, and whether systems separated by a page break are excluded from adjacency calculations.
- [ ] ADR-worthy decision? — Probably no ADR required. This is a layout contract behavior change, not a long-term architecture decision, as long as the algorithm is documented in the contract addendum.
- [x] Human stamp required? — Yes. This is a Spec / Contract Change affecting layout contract and WASM/app behavior, so `APPROVED_FOR_IMPLEMENTATION` is required before coding.

### Comments

1. The plan has the right product direction, but the pagination algorithm is underspecified. The hard part is deciding when spacing computation happens relative to pagination.
2. If spacing is score-wide, the engine likely needs a two-pass or fixed-point strategy: build unpaginated system boxes, compute uniform spacing from adjacent systems, paginate with that spacing, and ensure page boundaries do not introduce a different adjacency rule.
3. The plan should explicitly say whether adjacent systems on different pages contribute to `requiredNonOverlapSpacing`. Recommendation: compute required spacing from logical adjacent systems in the score before pagination, then use that score-wide spacing everywhere; page boundaries do not add extra pair-specific spacing.
4. The option rename needs sharper wording. If there is a Rust field rename, TS type rename, and localStorage reset, list the exact old/new names or state that implementation will discover them and update the plan before coding.
5. Acceptance should include concrete cases: one system has a tall volta/hairpin and all same-page staff gaps become equal; multi-page output uses the same final spacing after page breaks; negative offset reduces all gaps equally and may overlap; old persisted `systemSpacing` is ignored.

### Agent Response

- Will revise the plan to define score-wide spacing computation before pagination.
- Will define spacing as the gap between the previous system's staff-bottom boundary and the next system's staff-top boundary; origin-to-origin stride is derived from staff height plus this gap.
- Will state that logical adjacent systems across future page breaks still contribute to the score-wide required spacing calculation, while actual page breaks do not create pair-specific spacing.
- Will replace vague WASM compatibility wording with explicit old/new option names and localStorage reset behavior.
- Will add multi-page, negative-offset, same-page uniformity, and old-setting-reset acceptance criteria.

### Resolution

- R2: open, plan revision pending.

STATUS: CHANGES_REQUESTED

### Round 2 Follow-up

Date: 2026-05-31

Plan revision commit: pending

Changes made:
- Defined `finalSystemSpacing` as the extra same-page advance after `staff_bounding_height_pt`.
- Defined `requiredForPair` and `requiredNonOverlapSpacing` from local `SystemLayoutBox` visual bounds and origins.
- Clarified that spacing is score-wide and computed from logical adjacent systems before pagination.
- Clarified that systems later split by a page break still contribute to the score-wide maximum, but page breaks do not receive pair-specific page-crossing spacing.
- Replaced vague WASM compatibility language with explicit names: `system_spacing_offset_pt`, `systemSpacingOffsetPt`, and `systemSpacingOffset`.
- Added acceptance/test coverage for same-page uniform spacing, multi-page spacing, negative offset overlap allowance, and old persisted `systemSpacing` reset.

Resolution:
- R2: addressed in `plan.md`; pending sub-agent re-review.
