# DRUMMARK_SPEC_tasks_volta_terminator_repeat.md

## Execution Plan: Volta-Terminator + Repeat-Start Coalescing (`|:.`)

### Task 1: Grammar — Add VoltaTerminatorRepeatStartBarline to BarlineNode
- [x] **Status**: Done
- **Scope**: `src/dsl/drum_mark.grammar`
- **Commits**:
  - `feat(grammar): add |:. compound barline for volta-terminator + repeat-start`
  - Insert `VoltaTerminatorRepeatStartBarline` before `VoltaBarline` in `BarlineNode`.
  - Define `VoltaTerminatorRepeatStartBarline { "|:." }` (no trailing space in token).
  - Rename `VoltaTerminatorBarline` to `VoltaTerminator` if needed for consistency — no, keep existing name.
- **Acceptance Criteria**:
  - `|:. d d d d` parses as a single MeasureSection (not `|:` + orphan `.`).
  - `|:1. d d d d` still parses as VoltaBarline (no false match).
  - `|. d d d d` still parses as VoltaTerminatorBarline (unchanged).
  - `|: d d d d` still parses as RepeatStartBarline (unchanged).
  - Existing `.drummark` test files parse without regression (`npm run drummark`).
- **Dependencies**: none

### Task 2: Parser Regeneration
- [x] **Status**: Done
- **Scope**: `src/dsl/drum_mark.parser.js`, `src/dsl/drum_mark.parser.terms.js`
- **Commits**:
  - `chore(parser): regenerate Lezer parser for |:. barline`
  - Run `npx lezer-generator --typeScript --output src/dsl/drum_mark.parser.js src/dsl/drum_mark.grammar`.
  - Verify no diffs to existing parser rules beyond the added token.
- **Acceptance Criteria**:
  - `npm run drummark` passes with regenerated parser.
  - Parse tree shows `VoltaTerminatorRepeatStartBarline` node for `|:.` input.
- **Dependencies**: Task 1

### Task 3: Skeleton Builder — Handle VoltaTerminatorRepeatStartBarline in parseBarlineBoundaryInfo
- [x] **Status**: Done
- **Scope**: `src/dsl/lezer_skeleton.ts`
- **Commits**:
  - `feat(parser): map |:. barline to openRepeatStart + closeVoltaTerminator in skeleton`
  - In `parseBarlineBoundaryInfo()`, add handler for `VoltaTerminatorRepeatStartBarline` child node.
  - Return: `{ openRepeatStart: true, closeBarlineType: "repeatStart", closeRepeatEnd: false, closeVoltaTerminator: true }`.
  - No changes to implicit repeat-end inference (already excluded by `closeBarlineType !== "single"` guard).
- **Acceptance Criteria**:
  - `npm run drummark --format ast <file-with-|:.>` shows `repeatStart: true, voltaTerminator: true` on the `|:.` measure.
  - Implicit repeat-end does NOT fire on the measure preceding `|:.`.
  - `npm test` passes all existing tests.
- **Dependencies**: Task 2

### Task 4: Tests — Add |:. test cases
- [x] **Status**: Done
- **Scope**: test files in `src/dsl/`
- **Commits**:
  - `test(parser): add |:. compound barline test cases`
  - Add tests to `spec-c11-repeat-barlines.test.ts` or create new `spec-c11b-volta-repeat-compound.test.ts`:
    1. `|:.` parses as single compound barline (AST)
    2. `|:. d d d d :|` produces repeat-both + voltaTerminator (IR)
    3. `|: A |1. B :|2. C |:. D :|` produces correct repeat spans (no nested error)
    4. `|: A |1. B |:. C :|` produces nested repeat start error (no `:|` before `|:.`)
    5. `|:.` followed by regular `|.` works independently
    6. `|:.` at score start with no active volta (no-op for terminator)
  - Verify via `npm run drummark --format ir` on each test case.
- **Acceptance Criteria**:
  - All test cases produce expected IR/repeat spans.
  - Existing tests pass without regression (`npm test`).
- **Dependencies**: Task 3

### Task 5: Spec Consolidation — Append final Addendum to DRUMMARK_SPEC.md
- [x] **Status**: Done
- **Scope**: `docs/DRUMMARK_SPEC.md`
- **Commits**:
  - `docs(spec): add |:. volta-terminator repeat-start compound barline addendum`
  - Append clean Addendum (synthesized from approved proposal + review resolutions) to DRUMMARK_SPEC.md.
  - Update Local Barline Mapping table in Addendum 2026-05-06 to include `|:.`.
  - Move proposal and tasks files to `docs/archived/`.
- **Acceptance Criteria**:
  - Addendum text in DRUMMARK_SPEC.md matches approved proposal content.
  - Proposal and tasks files moved to `docs/archived/`.
- **Dependencies**: Task 4

### Review Round 1

**STATUS: APPROVED**

**Reviewer**: Critical architect review of the implementation task plan for `|:.` volta-terminator+repeat-start coalescing.

---

#### Finding 1 (INFO): Coverage — No missing tasks

Verified that every change required by the approved proposal is covered:

| Proposal Change | Task | Status |
|---|---|---|
| Grammar: `VoltaTerminatorRepeatStartBarline` in `BarlineNode` | Task 1 | ✅ |
| Parser regeneration via `lezer-generator` | Task 2 | ✅ |
| Skeleton builder: handler in `parseBarlineBoundaryInfo()` | Task 3 | ✅ |
| Tests: AST, IR, repeat-span, nested-error, standalone, no-op cases | Task 4 | ✅ |
| Spec consolidation + archival | Task 5 | ✅ |

**Non-changes verified as correctly omitted:**

- **`normalize.ts`**: Volta propagation loop at lines ~839-857 already checks `voltaTerminators[index]`. The `|:.` measure sets `voltaTerminator: true` at line 1217 of `lezer_skeleton.ts`, so the active volta is correctly cleared. No change needed.
- **`ast.ts`**: `validateAndBuildRepeats` already processes `repeatStart: true` (from any source) identically. Nested-repeat detection works without modification. No change needed.
- **`types.ts`**: `BarlineBoundaryInfo` (at `lezer_skeleton.ts:45-51`) already has `openRepeatStart`, `closeBarlineType`, `closeVoltaTerminator`. No new fields required.
- **`renderer.ts` and `musicxml.ts`**: Neither file references `voltaTerminator` directly. Both consume `measure.volta` (set during normalization from the active volta state, not from `voltaTerminator`). The renderer's `voltaTypeForMeasure()` derives volta begin/end from adjacent-measure comparisons. The `|:.` barline causes normalization to clear the active volta (via `voltaTerminators[index]`), which makes the renderer/MusicXML correctly end the volta bracket after the `|:.` measure. No change needed.
- **Trailing metadata cleanup**: `lezer_skeleton.ts:1247` already includes `voltaTerminator === true` in its metadata-only-trailing-measure detection. If `|:.` produces an empty trailing measure, its `voltaTerminator` is correctly propagated to the previous measure. No change needed.

---

#### Finding 2 (INFO): Ordering — Dependency chain correct

Task dependencies form a proper linear chain: Grammar (Task 1) → Parser regeneration (Task 2) → Skeleton builder (Task 3) → Tests (Task 4) → Spec consolidation (Task 5). The grammar must change before the parser is regenerated; the parser must be regenerated before the skeleton builder can reference the new tree node name; tests require the skeleton to produce correct output.

The grammar ordering instruction in Task 1 ("Insert `VoltaTerminatorRepeatStartBarline` before `VoltaBarline`") correctly places the new token before both `VoltaBarline` (line 198) and `RepeatStartBarline` (line 199), since `RepeatStartBarline` already follows `VoltaBarline`. This matches the proposal's disambiguation requirement.

---

#### Finding 3 (LOW): Commits fields mix implementation instructions with planned commit messages

Task 1's **Commits** field contains three entries, but only the first (`feat(grammar): add |:. compound barline for volta-terminator + repeat-start`) is a conventional commit message. The other two ("Insert..." and "Define...") are implementation instructions. Similarly, Task 3's Commits field has one commit message followed by three implementation sub-steps.

**Recommendation**: Either (a) move implementation sub-steps into the **Scope** field, (b) add them as indented sub-bullets under the commit message, or (c) replace them with a brief implementation note. This is cosmetic — the task intent is unambiguous. **Not a blocker.**

---

#### Finding 4 (LOW): Task 4 — Test file placement is unresolved

The Commits field says "Add tests to `spec-c11-repeat-barlines.test.ts` or create new `spec-c11b-volta-repeat-compound.test.ts`". The either/or phrasing leaves the implementor to decide. Both are valid: extending the existing file keeps related tests together; a new file isolates the compound barline cases. The 6 planned test cases are substantial enough (~50-100 lines each) to warrant a dedicated file, but the existing file (144 lines) could absorb them. Either choice is acceptable. **Not a blocker.**

---

#### Finding 5 (INFO): Acceptance criteria — appropriate verifiability

**Task 1**: `|:. d d d d` parsing as single MeasureSection — verifiable via `npm run drummark --format ast`. Existing-file regression — verifiable via `npm run drummark`. The `|:1.` false-match check is validated by grammar disambiguation (Finding 6 of proposal Review Round 1). ✅

**Task 2**: Parse tree showing `VoltaTerminatorRepeatStartBarline` — verifiable by dumping the parse tree. The "no diffs to existing rules" criterion is aspirational but practically verified by the existing-test regression in Task 1. ✅

**Task 3**: `--format ast` showing `repeatStart: true, voltaTerminator: true` — verifiable via CLI. Implicit repeat-end exclusion — verified by source-code trace (the `closeBarlineType === "single"` guard at line 1223 fails for `"repeatStart"`). ✅

**Task 4**: Six test cases with specific expected behaviors, all verifiable via `npm run drummark --format ir` or Vitest assertions. ✅

**Task 5**: Addendum match + file archival — straightforwardly verifiable. ✅

---

#### Finding 6 (INFO): Implicit repeat-end guard verification

Traced through `lezer_skeleton.ts:1219-1228` for the `|:.` case: the `closeBarlineType === "single"` condition fails (value is `"repeatStart"`), AND the `nextBoundary.openVoltaIndices !== undefined` condition fails (`|:.` has no indices). Both paths independently block the implicit repeat-end. Additionally, `closeVoltaTerminator: true` triggers the volta clear at line 1216-1218, hardening the boundary. Task 3's claim that "no changes to implicit repeat-end inference" is accurate.

---

#### Summary

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| 1 | INFO | Coverage complete; no missing tasks | None required |
| 2 | INFO | Dependency chain correct | None required |
| 3 | LOW | Commits fields contain implementation notes | Cosmetic cleanup (non-blocking) |
| 4 | LOW | Test file location unresolved | Either file is acceptable (non-blocking) |
| 5 | INFO | Acceptance criteria are measurable | None required |
| 6 | INFO | Implicit repeat-end guard verified | None required |

**STATUS: APPROVED** — The task plan is complete, correctly ordered, and verifiable. No blocking issues found.
