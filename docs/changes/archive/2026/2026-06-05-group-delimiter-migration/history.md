# Group Delimiter Migration History

## 2026-06-05

### Draft Created

Plan file: `docs/changes/active/2026-06-05-group-delimiter-migration/plan.md`

Status: draft - pending plan review and human stamp before implementation.

### Plan Review Round 1

Reviewer: subagent `019e9ff1-04a0-78c3-974e-6165b7ff928d`

Status: CHANGES_REQUESTED

Findings:
- High: The plan missed dynamic-directive delimiter behavior, so a naive `[] -> ()` migration could break legal grouped content such as `(@p)` by tripping `invalid dynamic directive boundary`.
- Medium: The migration audit scope was too narrow for the stated repository-wide syntax-alignment goal.
- Medium: The Spec Delta did not pin the canonical integration points inside `DRUMMARK_SPEC.md`, leaving room for an inconsistent rewrite.

Resolution:
- Added explicit Task 1 action, acceptance, and test coverage for delimiter-sensitive parser helpers, especially migrated `)` dynamic boundaries.
- Widened Task 3 migration auditing from a handful of files to repository-level `docs examples crates src` review, with explicit treatment of developer-facing grammar commentary.
- Pinned Spec Delta integration points to `6.4 Groups`, `12. Compatibility And Deprecated Syntax`, and conditional `9.4 Header And Paragraph Legality` updates.

### Plan Review Round 2

Reviewer: subagent `019e9ff1-04a0-78c3-974e-6165b7ff928d`

Status: APPROVED

Summary:
- Round 2 confirmed the revised plan closes the parser-boundary risk, scopes bracket invalidation correctly, broadens the migration audit appropriately, and pins consistent canonical spec integration points.

### Approved Plan

Plan file: `docs/changes/active/2026-06-05-group-delimiter-migration/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.

## Human Stamp

Date: 2026-06-06
Approved by: user
Approved plan: `docs/changes/active/2026-06-05-group-delimiter-migration/plan.md`
Approved plan commit: N/A
Scope: Implement the revised no-migration-hint rhythmic-group delimiter migration after Round 4 approval

Approval text:

> 开工吧

Conditions:
- None

Status: APPROVED_FOR_IMPLEMENTATION

## Human Stamp

Date: 2026-06-06
Approved by: user
Approved plan: `docs/changes/active/2026-06-05-group-delimiter-migration/plan.md`
Approved plan commit: N/A
Scope: Implement the approved rhythmic-group delimiter migration from `[]` to `()`

Approval text:

> 开工吧

Conditions:
- None

Status: APPROVED_FOR_IMPLEMENTATION

## Consolidated Changes

Source:
- `plan.md` > `## Spec Delta`

Affected specs/contracts:
- `docs/DRUMMARK_SPEC.md`

Summary:
- Canonical rhythmic-group syntax now uses `(` and `)` in authored measure content instead of `[` and `]`.
- Legacy bracketed rhythmic groups are listed under removed or rejected syntax without requiring migration-oriented parser messaging.
- Active docs/examples and parser-facing commentary were migrated to the parenthesized group syntax, while raw-text metadata remains free to contain literal bracket characters.
- WASM parser parity was rebuilt against the new delimiter syntax.

Final integration location:
- Integrated into `docs/DRUMMARK_SPEC.md` sections:
  - `6.4 Groups`
  - `12.2 Removed Or Rejected Syntax`

## Implementation Review

### Round 1 - Implementation Review

Reviewer: subagent `019ea047-cead-7a00-842a-16225c496bdd`

Status: CHANGES_REQUESTED

Findings:
- High: The frontend editor grammar still recognized `[` and `]` as group brackets and had not been migrated to `(` / `)`.
- High: The revised no-migration-hint plan did not yet have a renewed `APPROVED_FOR_IMPLEMENTATION` stamp recorded after Round 4 approval.
- Medium: `src/renderer/svgParity.test.ts` still used legacy bracket-group fixtures even though the canonical syntax had changed.
- Low: `crates/drummark-core/src/normalize.rs` still had bracket-group wording in parser-facing commentary.

Resolution:
- Updated `src/drummark.ts` so the frontend grammar tokenizes `(` and `)` as group brackets instead of `[` and `]`.
- Replaced the active `svgParity` bracket-group fixture with canonical parenthesized syntax.
- Updated the remaining normalize commentary to `(N: ...)` wording.
- Recorded a renewed `APPROVED_FOR_IMPLEMENTATION` human stamp for the revised Round 4-approved plan.

### Round 2 - Implementation Review

Reviewer: subagent `019ea047-cead-7a00-842a-16225c496bdd`

Checks:
- Tasks complete: Yes
- Tests pass: `cargo test -p drummark-core parser -- --nocapture`, `cargo test -p drummark-core normalize -- --nocapture`, `npm test -- --run src/wasm/parser_ast_contract.test.ts src/wasm/parser_layout_parity.test.ts src/drummark.test.ts`
- Spec/contract updated if required: Yes
- GitHub Issues updated if applicable: N/A
- ADRs respected: N/A
- Scope creep: No additional scope beyond closing implementation-review findings

Agent Response:
- No remaining delimiter-migration blockers after the frontend grammar, active fixture, commentary, and revised-plan stamp fixes.
- The known `src/renderer/svgParity.test.ts:258` eighth-rest-count failure remains treated as unrelated to this delimiter migration.

STATUS: APPROVED

## 2026-06-06

### Post-Approval Plan Revision

Reason:
- User requested that legacy `[]` group syntax fail directly without any migration-oriented diagnostic about `()` because rehearsal-mark work will follow immediately.

Change summary:
- Removed migration-hint expectations from parser behavior.
- Tightened Spec Delta so legacy bracket groups are simply invalid syntax, with no diagnostic wording requirement beyond rejection.

Status:
- Prior approval superseded by a material plan revision.
- Re-review required before implementation.

### Plan Review Round 3

Reviewer: subagent `019ea03f-24c7-7352-8a55-647fe138105c`

Status: CHANGES_REQUESTED

Findings:
- Medium: The revised Spec Delta still tried to route measure-expression delimiter invalidation through `9.4 Header And Paragraph Legality` instead of keeping it in `6.4 Groups` plus `12.2 Removed Or Rejected Syntax`.
- Medium: The plan still failed to call out stale bracket-specific parser diagnostics and lossy recovery coverage for unclosed canonical `(` groups.

Resolution:
- Removed the `9.4` integration path from Spec Delta and Task 3 so the normative spec change stays in `6.4 Groups` and `12. Compatibility And Deprecated Syntax`.
- Added explicit Task 1 and Test Plan coverage for canonical delimiter wording in parser diagnostics and lossy recovery after unclosed `(` groups.

### Plan Review Round 4

Reviewer: subagent `019ea03f-24c7-7352-8a55-647fe138105c`

Status: APPROVED

Summary:
- Round 4 confirmed the revised no-migration-hint policy is internally consistent, keeps the spec delta in the correct sections, and closes the remaining parser diagnostic and recovery gaps.

### Approved Plan

Plan file: `docs/changes/active/2026-06-05-group-delimiter-migration/plan.md`

Status: APPROVED

Implementation remains blocked until a human stamp records `Status: APPROVED_FOR_IMPLEMENTATION` because this is a Spec / Contract Change.
