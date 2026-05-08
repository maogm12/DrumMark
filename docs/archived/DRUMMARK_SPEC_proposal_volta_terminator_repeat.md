# DRUMMARK_SPEC_proposal_volta_terminator_repeat.md

## Addendum v1.0: Volta-Terminator + Repeat-Start Coalescing (`|:.`)

### Motivation

When a repeat section contains voltas (alternate endings), a common scenario is "volta ends, new repeat starts":

```
|: d d d d |1. d d d d :|2. d d d d |. |: d d d d :|
```

Currently, `|.` (volta terminator) and `|:` (repeat start) are parsed as two separate `MeasureSection` nodes because each `MeasureSection` requires exactly one `BarlineNode`. With no measure body between them, `|.` creates a spurious empty generated measure (bar 3 below), which is musically incorrect -- an extra bar of silence appears between the volta ending and the new repeat:

```
Bar 0: |: d d d d          (repeat-start)
Bar 1: |1. d d d d :|      (volta [1], repeat-end)
Bar 2: |2. d d d d |.      (volta [2], volta-terminator)
Bar 3: (empty, generated)  <-- STRAY EMPTY BAR
Bar 4: |: d d d d :|       (repeat-both)
```

There is no syntax to express "terminate the volta bracket AND start a new repeat" at the same barline boundary.

### Design Decision: `|.` vs `|:.` Syntax

Two candidate forms were considered:

| Candidate | Reasoning |
|-----------|-----------|
| `|.|:` | Concatenation of `|.` and `|:`. Visually risky: reads as two separate barlines; tokenizer disambiguation depends solely on grammar ordering. |
| `|:. ` | **Chosen.** Follows the existing `|:X.` pattern (`|:1.` = repeat-start + volta 1, `|:2.` = repeat-start + volta 2). The `.` suffix means "terminate the current volta" (as opposed to a numeric suffix meaning "open volta N"). Compact, unambiguously a single token. |

**Consistency with existing patterns:**

| Token | Meaning |
|-------|---------|
| `|:` | repeat-start |
| `|:1.` | repeat-start + open volta 1 |
| `|:2.` | repeat-start + open volta 2 |
| `|:1,2.` | repeat-start + open volta 1,2 |
| **`|:.`** | **repeat-start + terminate volta** |
| `|.` | terminate volta (without repeat-start) |

### Proposed Solution

Introduce a **compound barline** `|:.` that coalesces volta-termination and repeat-start into a single `BarlineNode`.

### Syntax

```
|:.
```

**Example:**

```
|: d d d d |1. d d d d :|2. d d d d |:. d d d d :|
```

Which normalizes as:

```
Bar 0: |: d d d d          (repeat-start)
Bar 1: |1. d d d d :|      (volta [1], repeat-end)
Bar 2: |2. d d d d         (volta [2])
Bar 3: |:. d d d d :|      (volta-terminator + repeat-both)
```

No stray empty bar.

### Semantics

The compound barline `|:.` carries **both** semantics simultaneously:

| Property | Value | Source |
|----------|-------|--------|
| `openRepeatStart` | `true` | from `|:` prefix |
| `closeVoltaTerminator` | `true` | from `.` suffix |
| `closeBarlineType` | `"repeatStart"` | from `|:` prefix |
| `closeRepeatEnd` | `false` | compound does not close a repeat |
| `openVoltaIndices` | `undefined` | `.` is not a volta index |

The barline serves as the right boundary of its measure:
- `closeVoltaTerminator = true` fires on the measure whose right boundary this is, terminating the active volta bracket at that measure's end.
- `openRepeatStart = true` fires on the measure following the right boundary, starting a new repeat section.

**Sharp Edge — Nested Repeat Risk**: `|:.` does **NOT** close any open repeat. Any prior repeat (started by `|:`) MUST be explicitly closed with `:|` before `|:.` appears, or a "nested repeat start" error will fire. Example:

```drummark
|: A |1. B |:. C :|              // ERROR: nested repeat start
|: A |1. B :|2. C |:. D :|       // OK: first repeat closed by :| after bar 1
```

This is intentional: making `|:.` auto-close a prior repeat would conflate voltatermination with repeat-closure, violating Addendum H's principle that `|.`-family tokens do not carry repeat-end semantics. The user must explicitly write `:|`.

**Rationale for `closeBarlineType = "repeatStart"`:** When two barline types collide at the same boundary, the right-edge barrier (volta terminator) is expressed via `closeVoltaTerminator`, while the repeat-start opening is expressed via `openRepeatStart`. `closeBarlineType = "repeatStart"` is a **structural placeholder** — it does not affect right-edge barline assignment (the skeleton builder at `lezer_skeleton.ts:1208` excludes both `"repeatStart"` and `"single"` from setting the previous measure's barline). The value mirrors how plain `|:` maps in `parseBarlineBoundaryInfo()`. The actual semantic effects come from `openRepeatStart` and `closeVoltaTerminator`.

### Implicit Repeat-End Exclusion

This compound barline inherits the existing rule from Addendum 2026-04-30H: `|.` (and by extension `|:.`) does **not** trigger implicit repeat-end inference. The measure preceding `|:.` does not receive an inferred repeat-end.

The measure preceding `|:.` may still carry an explicit `:|` (volta + repeat-end), as shown in the example where `|1. d d d d :|` explicitly closes the first repeat.

### Grammar Changes

In `src/dsl/drum_mark.grammar`, add `VoltaTerminatorRepeatStartBarline` to `BarlineNode`, placed **before** `VoltaBarline` and `RepeatStartBarline` so `|:.` matches as a single token rather than being consumed as `|:` + leftover `.`:

```
BarlineNode {
  DoubleVoltaTerminatorBarline |
  DoubleBarline |
  VoltaTerminatorRepeatStartBarline |   // NEW (before VoltaBarline for |:. disambiguation)
  VoltaBarline |
  RepeatStartBarline |
  RepeatEndBarline |
  VoltaTerminatorBarline |
  RegularBarline
}

VoltaTerminatorRepeatStartBarline { "|:." }
```

**Token ordering rationale:** `VoltaTerminatorRepeatStartBarline` must appear before both `VoltaBarline` and `RepeatStartBarline`:
- Before `VoltaBarline`: `VoltaBarline` matches `|:` as its first alternative prefix. If `|:.` is not consumed first, the `|:` part would be consumed by `VoltaBarline`, and `.` would fail the `Integer` expectation, producing a parse error.
- Before `RepeatStartBarline`: `RepeatStartBarline { "|:" }` would match the `|:` prefix of `|:.`, leaving `.` as a syntax error.

**Parser Regeneration:** After modifying `drum_mark.grammar`, regenerate the Lezer parser:

```
npx lezer-generator --typeScript --output src/dsl/drum_mark.parser.js src/dsl/drum_mark.grammar
```

### Local Barline Mapping (Addition to Addendum 2026-05-06)

Insert after the `|.` mapping:

```
- `|:.` -> `VoltaTerminatorRepeatStartBarline`
```

### Skeleton Builder Changes

In `parseBarlineBoundaryInfo()` in `src/dsl/lezer_skeleton.ts`, add a handler for `VoltaTerminatorRepeatStartBarline`:

```typescript
if (childNames.has("VoltaTerminatorRepeatStartBarline")) {
  return {
    openRepeatStart: true,
    closeBarlineType: "repeatStart",
    closeRepeatEnd: false,
    closeVoltaTerminator: true,
  };
}
```

In the implicit repeat-end inference block, `VoltaTerminatorRepeatStartBarline` is automatically excluded because:
1. Its `closeBarlineType` is `"repeatStart"` (not `"single"`), which fails the inference guard.
2. Its `closeVoltaTerminator` is `true`, hardening the boundary.

No additional inference exclusion code is needed beyond the existing checks.

### Volta Propagation in `normalize.ts`

The existing volta propagation loop in `normalize.ts` (lines ~839-857) clears the active volta on `voltaTerminators[index]`. The `|:.` barline produces `voltaTerminator: true` on its measure, so the active volta is correctly cleared at that measure's right boundary. No changes needed to the normalization logic.

### Repeat-Span Validation

The repeat validator (`validateAndBuildRepeats` in `src/dsl/ast.ts`) sees `repeatStart: true` from `|:.` and processes it identically to a plain `|:`. No changes needed.

The "nested repeat start" error avoidance depends on the preceding repeat being properly closed by an explicit `:|`. The `|:.` itself does **not** close the prior repeat; it only opens a new one. This is correct behavior.

### Edge Cases

**1. `|:.` at score start (first measure):**
`closeVoltaTerminator = true` is a no-op (no active volta). `openRepeatStart = true` starts a repeat normally. Equivalent to `|: ...` for repeat semantics, with a harmless extra volta-terminator flag.

**2. `|:.` with no active volta:**
Same as edge case 1. The volta-terminator flag is silently ignored.

**3. `|:.` followed by `:|` (repeat-both):**
```drummark
|:. d d d d :|
```
This produces a `repeat-both` measure (the `|:.` gives repeat-start, the `:|` gives repeat-end). This is valid and should work identically to `|: d d d d :|` for repeat purposes, plus the volta-terminator flag.

**4. Cannot compound further:**
`|:.` is a single compound token. Attempting to further combine (e.g., `|:.:|` or `|:.|.` or `|:|:.`) is not valid syntax and will be a parse error. If the user needs repeat-end on the same bar AND volta termination, use `|:. ... :|`.

**5. Interaction with `|.` (plain volta terminator):**
Plain `|.` without `:` continues to work unchanged. `|:.` is only matched when the full token `|:.` appears.

**6. Interaction with navigation markers:**
Navigation markers can coexist with `|:.` in the same measure, subject to existing navigation placement rules. The `closeBarlineType = "repeatStart"` does not conflict with `@to-coda` (which is permitted on repeat-ending measures per Addendum 2026-04-30E). The `closeVoltaTerminator = true` does not conflict with any navigation marker.

### Non-Changes

- `|.` alone (without `:`) continues to work as a plain volta terminator and creates an empty measure when it has no body. This is unchanged.
- The implicit repeat-end inference rules (Addenda G and H) are unchanged.
- Existing `VoltaBarline` compound forms (`|:N.`, `:|N.`) are unchanged.

### Review Round 1

**STATUS: CHANGES_REQUESTED**

**Reviewer**: Critical architect review of the volta-terminator + repeat-start coalescing proposal.

---

#### Finding 1 (CRITICAL): Trailing space in token definition `"|:. "`

The proposal defines the grammar rule as:

```
VoltaTerminatorRepeatStartBarline { "|:." }
```

This includes a **trailing space** inside the inline token string. In Lezer, `{ "|:. " }` means the tokenizer matches the literal 4-character string `|:. ` (pipe, colon, dot, space). This fails in at least two scenarios:

1. **`|:.` at end of input** — no trailing space exists (e.g., `|2. d d d d |:.`)
2. **`|:.` immediately followed by another barline** — the tokenizer sees `|:.|` and the space doesn't match `|`

Compare with every other barline token in the grammar:
- `"|:"` — no trailing space
- `"|."` — no trailing space
- `"||."` — no trailing space
- `"|"` — no trailing space

The Lezer tokenizer greedily matches inline tokens. `"|:."` (3 chars) would match correctly and, due to placement before `VoltaBarline` and `RepeatStartBarline` in the alternative ordering, would win over `"|:"` (2 chars). The trailing space is an error.

**Fix**: Change `"|:. "` to `"|:."`. If the intent was to ensure disambiguation by requiring a space, that is unnecessary — longest-match greediness already handles it.

---

#### Finding 2 (MEDIUM): Implicit repeat-end and `|:.` interaction — needs explicit documentation

When `|:.` terminates a volta, the **preceding volta measure** does NOT receive an implicit repeat-end. Tracing through `lezer_skeleton.ts:1219-1228`:

```typescript
if (
  !lastMeasure.repeatEnd &&                         // may be true
  lastMeasure.voltaIndices !== undefined &&           // true (inside volta)
  nextBoundary.openVoltaIndices !== undefined &&      // FALSE — |:. has no openVoltaIndices
  nextBoundary.closeBarlineType === "single" &&       // FALSE — |:. has closeBarlineType="repeatStart"
  !sameVoltaIndices(...)
)
```

Both gate conditions fail because `|:.` carries neither `openVoltaIndices` nor `closeBarlineType="single"`. This is **consistent** with Addendum H (which excludes `|.` and `||.` from implicit inference), but it means:

```drummark
|: A |1. B |:. C :|2. D |
```

Will produce a **"nested repeat start" error** because the repeat from bar 0 is never closed before `|:.` opens a new one at bar 2. The proposal acknowledges this obliquely ("The `|:.` itself does **not** close the prior repeat"), but this is a sharp edge that should be documented prominently in the semantics table rather than buried in the repeat-span validation section.

**Recommendation**: Add an explicit note to the semantics table: "`|:.` does NOT close any open repeat. The prior repeat MUST be explicitly closed with `:|` before `|:.` appears." Consider whether the proposal should weaken this restriction for usability (e.g., should `|:.` auto-close the prior repeat when inside a volta?).

---

#### Finding 3 (LOW-MEDIUM): `closeBarlineType = "repeatStart"` is a no-op — clarify design rationale

The proposal sets `closeBarlineType = "repeatStart"` for `|:.`. However, in the skeleton processing loop (`lezer_skeleton.ts:1205-1211`):

```typescript
if (
  nextBoundary.closeBarlineType !== "single" &&
  nextBoundary.closeBarlineType !== "repeatStart" &&  // <-- excluded
  nextBoundary.closeBarlineType !== "repeatEnd"
) {
  lastMeasure.barline = nextBoundary.closeBarlineType;
}
```

`"repeatStart"` is explicitly excluded from setting the previous measure's right-edge barline. This makes sense (a repeat-start double-bar is a left-edge visual), but the proposal's rationale paragraph reads as if `closeBarlineType = "repeatStart"` carries semantic weight ("consistent with how plain `|:` already maps"). In practice, it's a no-op — the real work is done by `openRepeatStart = true` for the measure created from the `|:.` section, plus `closeVoltaTerminator = true` for the preceding measure.

**Recommendation**: Clarify in the proposal that `closeBarlineType = "repeatStart"` is a **documentation-only value** that does not affect right-edge barline processing. Consider whether it should be `"single"` instead for hygiene, since `|:.`'s right-edge visual identity is a function of the next measure's `openRepeatStart`, not the previous measure's `closeBarlineType`.

---

#### Finding 4 (LOW): Volta propagation — correct but verification trace could be included

Tracing through `normalize.ts:839-858`, the `|:.` measure's volta propagation works correctly:

1. `voltaSeeds[index]` is checked — `|:.` carries no `openVoltaIndices`, so `seed` is undefined
2. If an active volta exists (from a prior `|:N.`), `measure.volta` is set to that active value
3. `voltaTerminators[index]` is checked — `|:.` sets this to `true` — and `activeVolta` is cleared **after** the measure inherits it

So the `|:.` measure itself IS the last measure of the active volta bracket, and the volta clears after it. This is correct. The proposal's statement "No changes needed to the normalization logic" is accurate. However, the proposal could include this trace for reviewer confidence.

---

#### Finding 5 (MEDIUM): Parser regeneration command not specified

The proposal does not document how to regenerate the Lezer parser. After modifying `drum_mark.grammar`, the developer must run:

```
npx lezer-generator --typeScript --output src/dsl/drum_mark.parser.js src/dsl/drum_mark.grammar
```

This generates `drum_mark.parser.js`. With `--typeScript`, it also generates `drum_mark.parser.d.ts`. The `drum_mark.parser.terms.js` file is also regenerated. This command should be documented in the proposal's Grammar Changes section.

**Recommendation**: Add a "Parser Regeneration" subsection to the Grammar Changes section noting the exact command.

---

#### Finding 6 (INFO): `|:1.` disambiguation verified — no false match

Verified: when the tokenizer sees `|:1.`:
1. `VoltaTerminatorRepeatStartBarline` tries `"|:."` → `|:` matches, `.` vs `1` → **FAIL** (third char mismatch)
2. `VoltaBarline` tries `("|:" | ":|" | "|") Integer ("," Integer)* "."` → `|:` matches, `1` matches as Integer, `.` matches → **SUCCESS**

So `|:1.` correctly matches as `VoltaBarline`. No false match risk. The ordering placement before `VoltaBarline` is necessary and correct: without it, `|:.` would fail `VoltaBarline` on the `.`-vs-Integer check but then `RepeatStartBarline` would match `|:` (2 chars), leaving `.` as an orphan syntax error. With the proposed ordering, `|:.` is consumed as a single 3-character compound token.

---

#### Finding 7 (INFO): Edge cases from proposal verified

All six edge cases in the proposal were traced against the source code:
- **#1 (score start)**: Correct — `closeVoltaTerminator` is a no-op (no active volta), `openRepeatStart` fires normally
- **#2 (no active volta)**: Same as #1, correct
- **#3 (followed by `:|` — repeat-both)**: Correct — `|:.` gives `repeatStart`, `:|` gives `repeatEnd`, merge produces `repeat-both`
- **#4 (compound further)**: Correct — further compounds like `|:|:.` would fail grammar matching
- **#5 (plain `|.` unchanged)**: Correct — `|.` matches `VoltaTerminatorBarline` before the new `VoltaTerminatorRepeatStartBarline` tries to match (but `|.` is 2 chars, `|:.` is 3 chars — no conflict since `|.` starts with `|` not `|:`)
- **#6 (navigation markers)**: Correct — `closeBarlineType = "repeatStart"` does not conflict with `@to-coda` (which is permitted on repeat-ending measures per Addendum 2026-04-30E, but `|:.`'s barline wouldn't be "repeat-end" or "repeat-both", so the nav conflict check at `normalize.ts:777-787` wouldn't fire). The `closeVoltaTerminator = true` does not interact with any nav barline forcing rules.

---

#### Summary of Required Changes

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | CRITICAL | `"|:. "` has trailing space | Change to `"|:."` |
| 2 | MEDIUM | Nested repeat risk under-documented | Add explicit documentation to semantics |
| 3 | LOW-MEDIUM | `closeBarlineType` rationale unclear | Clarify that value is a no-op for right-edge processing |
| 5 | MEDIUM | Missing parser regeneration command | Document the `lezer-generator` command |

**STATUS: CHANGES_REQUESTED** — Finding 1 (trailing space) must be fixed before implementation can begin. Findings 2, 3, and 5 should be addressed to strengthen the proposal but are not blockers to APPROVED.

### Author Response

Addressing all findings from Review Round 1:

---

**Finding 1 (CRITICAL):** `"|:. "` trailing space → Fixed to `"|:."`.

The trailing space was an error. `"|:."` is the correct token definition, matching the 3-character literal `|:.` exactly. All other barline tokens use no trailing space — this one should too. Updated in the Grammar Changes section of the proposal.

---

**Finding 2 (MEDIUM):** Nested repeat risk documented.

Agreed. Added an explicit **Sharp Edge** warning in the Semantics section:

> **Sharp Edge**: `|:.` does NOT close any open repeat. Any prior repeat (started by `|:`) MUST be explicitly closed with `:|` before `|:.` appears or a "nested repeat start" error will fire. For example, `|: A |1. B |:. C :|` is an error — the repeat from bar 0 is not closed before `|:.` opens a new one. The correct form is `|: A |1. B :|2. C |:. D :|` where `:|` after bar 1 explicitly closes the first repeat.

Regarding the reviewer's suggestion to consider auto-closing: this is intentionally NOT done. Making `|:.` auto-close a prior repeat would conflate two distinct intents (volta-termination vs repeat-closure) and violate Addendum H's principle that `|.`-family tokens do not carry repeat-end semantics. The user must explicitly write `:|`.

---

**Finding 3 (LOW-MEDIUM):** `closeBarlineType = "repeatStart"` clarified.

The proposal's Semantics section now includes an explicit note:

> `closeBarlineType = "repeatStart"` is a **structural placeholder** — it does not affect right-edge barline assignment (the skeleton builder at `lezer_skeleton.ts:1208` excludes both `"repeatStart"` and `"single"` from setting the previous measure's barline). The value is chosen for consistency with how plain `|:` maps in `parseBarlineBoundaryInfo()`. The actual semantic effects come from `openRepeatStart` and `closeVoltaTerminator`.

---

**Finding 4 (LOW):** Volta propagation trace — noted as verified by reviewer, no action needed.

---

**Finding 5 (MEDIUM):** Parser regeneration command documented.

Added a **Parser Regeneration** subsection to Grammar Changes:

> After modifying `drum_mark.grammar`, regenerate the parser:
> ```
> npx lezer-generator --typeScript --output src/dsl/drum_mark.parser.js src/dsl/drum_mark.grammar
> ```

---

All four actionable findings have been addressed in the proposal text above. The grammar token is corrected to `"|:."`, the nested repeat sharp edge is documented, the `closeBarlineType` rationale is clarified, and the parser regeneration command is specified.

STATUS: Ready for re-review.

### Review Round 2

**STATUS: APPROVED**

**Reviewer**: Verification-only re-review. All four findings from Review Round 1 have been addressed:

| # | Finding | Status |
|---|---------|--------|
| 1 | CRITICAL: Token `"|:."` — trailing space removed | **FIXED.** Grammar block on line 121 reads `{ "|:." }` with no trailing space. |
| 2 | MEDIUM: Sharp Edge nested repeat risk documented | **FIXED.** Semantics section (line 88) contains an explicit warning block with two code examples: the error form (`|: A |1. B |:. C :|`) and the correct form (`|: A |1. B :|2. C |:. D :|`). The risk and required mitigation are unambiguous. |
| 3 | LOW-MEDIUM: `closeBarlineType` rationale clarified | **FIXED.** Rationale paragraph (line 97) explicitly calls the value a "structural placeholder," cites `lezer_skeleton.ts:1208` as the exclusion point, and cross-references the Mapping Code section that was present in previous rounds. |
| 4 | MEDIUM: Parser regeneration command documented | **FIXED.** "Parser Regeneration" subsection in Grammar Changes (lines 128–132) provides the full `npx lezer-generator --typeScript --output src/dsl/drum_mark.parser.js src/dsl/drum_mark.grammar` command. |

No new issues identified. The proposal is ready for consolidation and user stamp approval.

### Consolidated Changes

The final approved design:

| Aspect | Before | After |
|--------|--------|-------|
| Syntax | `|. |:` creates stray empty measure | `|:.` is a single compound barline |
| Grammar | `VoltaTerminatorBarline { "|." }` + `RepeatStartBarline { "|:" }` | + `VoltaTerminatorRepeatStartBarline { "|:." }` |
| Skeleton | No handler for compound | Handler returns `{ openRepeatStart: true, closeVoltaTerminator: true, closeBarlineType: "repeatStart", closeRepeatEnd: false }` |
| Volta propagation | n/a | `|:.` measure inherits active volta, clears it via `voltaTerminator` |
| Implicit repeat-end | n/a | Excluded (closeBarlineType is "repeatStart", not "single") |
| Nested repeat risk | n/a | `|:.` does NOT close prior repeats; explicit `:|` required |

