# DrumMark Spec Test Execution Checklist

Date: 2026-04-29
Source of truth: [docs/DRUMMARK_SPEC.md](/Users/gmao/code/drum_notation/docs/DRUMMARK_SPEC.md)

## Scope

This checklist covers the DSL syntax and syntax-adjacent semantic rules defined in sections 3-15 plus Appendix A/B.
IR-only sections and renderer/exporter internals are out of scope unless a syntax case requires downstream meaning verification.

## Execution Rules

- One case = one independently owned work package.
- Each case gets its own sub-agent.
- The sub-agent adds the missing tests first.
- If the new tests fail, the sub-agent fixes the smallest correct implementation surface needed to make them pass.
- Each case should prefer a disjoint write scope to reduce merge conflicts.
- Findings that clarify parser or DSL behavior should be appended to `LEARNINGS.md`.

## Case Ledger

| Case | Spec Area | Primary Layer | Expected Write Scope | Goal |
|------|-----------|---------------|----------------------|------|
| `C01` | 3.1, 3.2 Headers | parser | `src/dsl/parser.test.ts` | Cover supported headers, required headers, grouping inference, irregular meter requiring explicit grouping. |
| `C02` | 4.1-4.7 Tracks | parser + ast | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts` | Cover full track registry, anonymous lines, routing scopes, summon prefixes, first-seen ordering, auto-fill semantics. |
| `C03` | 5.1, Appendix A Atomic tokens | parser + normalize | `src/dsl/parser.test.ts`, `src/dsl/normalize.test.ts` | Cover the full token table, including context-sensitive `x`, `p`, `g`, `d`, uppercase accent tokens, and sticking tokens. |
| `C04` | 5.2 Resolution priority | normalize | `src/dsl/normalize.test.ts` | Verify explicit override beats magic token beats context fallback. |
| `C05` | 5.3, 5.4 Duration modifiers and rhythmic math | normalize + durations | `src/dsl/durations.test.ts`, `src/dsl/normalize.test.ts` | Cover dots, slashes, mixed dot/slash forms, exact rational duration handling. |
| `C06` | 5.5 Groups | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover shorthand groups, span groups, stretched/compressed forms, tuplet-compatible forms, and hard-error forms. |
| `C07` | 6.1, 6.2 Modifiers | parser + normalize | `src/dsl/parser.test.ts`, `src/dsl/normalize.test.ts` | Cover all supported modifiers and chaining syntax. |
| `C08` | Appendix B Modifier legality matrix | ast + normalize | `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Add legal/illegal combinations for each modifier family and ensure stable hard errors. |
| `C09` | 7 Combined hits | parser + normalize | `src/dsl/parser.test.ts`, `src/dsl/normalize.test.ts` | Cover `+` with plain tokens, summoned hits, and modifier chains at a shared start position. |
| `C10` | 8 Sticking | normalize + musicxml | `src/dsl/normalize.test.ts`, `src/dsl/musicxml.test.ts` | Cover `ST` semantics, shared-position attachment, and ignore-if-no-note export behavior. |
| `C11` | 9.1 Repeat barlines | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover `|`, `|:`, `:|`, `|: :|`, `||`, `|  |`, and `|.` distinctions. |
| `C12` | 9.2, 9.3 Repeat rules and voltas | ast + normalize | `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover repeat scope across tracks/paragraphs, non-nesting, volta start/end rules, and conflict errors. |
| `C13` | 9.4 Measure repeat `%` | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover `%`, `%%`, standalone-only rule, anti-chaining rule, canonical measure-repeat intent. |
| `C14` | 9.5 Markers and jumps | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover all marker/jump spellings, placement, global scope, and conflict rules. |
| `C15` | 10 Multi-measure rest | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover `|--N--|`, spaced form, `N=1`, and malformed/illegal forms. |
| `C16` | 11 Inline repeat `*N` | parser + ast + normalize | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts`, `src/dsl/normalize.test.ts` | Cover total-run semantics, `*1`, invalid non-positive counts, and post-expansion shape. |
| `C17` | 12 Measure validation | ast + normalize | `src/dsl/ast.test.ts`, `src/dsl/durations.test.ts`, `src/dsl/normalize.test.ts` | Cover total-duration mismatch, grouping boundary crossing, and no-cross-boundary group rules. |
| `C18` | 13, 14 Comments, whitespace, paragraphs | preprocess + parser | `src/dsl/preprocess.test.ts`, `src/dsl/parser.test.ts` | Cover comment stripping, comment-only lines, whitespace equivalence, tabs, blank-line paragraph boundaries. |
| `C19` | 15 Error format and hard errors | parser + ast | `src/dsl/parser.test.ts`, `src/dsl/ast.test.ts` | Ensure every hard-error family has at least one line/column/message assertion. |

## Integration Order

1. `C01`, `C18`, `C19`
2. `C02`, `C03`, `C04`, `C07`, `C09`
3. `C05`, `C06`, `C17`
4. `C11`, `C12`, `C13`, `C14`, `C15`, `C16`
5. `C08`, `C10`

## Notes

- Existing test coverage already partially covers `C02`, `C05`, `C07`, `C11`, `C13`, `C14`, `C15`, `C16`, and `C17`; these cases still need gap-focused additions rather than full rewrites.
- Cases should avoid touching VexFlow files because the current worktree has unrelated local changes there.
