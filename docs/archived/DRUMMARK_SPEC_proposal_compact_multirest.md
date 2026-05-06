# DRUMMARK_SPEC_proposal_compact_multirest.md

## Addendum v1.10: Compact Multi-Measure Rest Spelling

### Motivation

DrumMark currently treats multi-measure rest as a whole-measure shorthand form, but the surface spelling is still wider than necessary:

```txt
HH | --8-- |
HH | - 4 - |
```

Allowing interior spaces inside the shorthand weakens the grammar in two ways:

- the construct becomes less token-like and more dependent on permissive text matching
- it increases ambiguity with ordinary `-` rest glyphs, because multiple dash runs and optional spaces have to be interpreted after the fact

Multi-measure rest is already constrained to occupy an entire measure body. That makes it a good candidate for a compact, single-shape syntax that the grammar can recognize directly.

This addendum standardizes multi-measure rest as a compact dash-delimited form with no interior whitespace.

### 1. New Canonical Syntax

Multi-measure rest is written as:

```txt
HH | --8-- |
HH | ---8--- |
HH | -----12----- |
```

#### Rules

- The count is written immediately between the left and right dash runs.
- No whitespace is allowed between the dash runs and the integer.
- The left and right dash runs may have any length of two or more dashes.
- The entire construct must occupy the measure body by itself.
- The meaning of the integer remains the existing multi-measure-rest count.

### 2. Removed Spacing Variants

The following forms are no longer valid:

```txt
HH | - 4 - |
HH | -- 8 -- |
HH | --- 12 --- |
```

These forms must be rejected as syntax errors rather than normalized as legacy aliases.

### 3. Measure Exclusivity

This addendum does not change the structural role of multi-measure rest.

Multi-measure rest remains a whole-measure shorthand:

- it must occupy the entire measure body
- it may not be combined with ordinary note content
- it may not be combined with inline repeat suffix syntax

### 4. Grammar Intent

The Lezer grammar should represent multi-measure rest as an explicit local measure form rather than by applying a regex to already-collected measure text.

The important structural properties are:

- a dedicated multi-rest measure-body branch
- a compact dash-delimited shape with no internal whitespace
- dash multiplicity is syntactic sugar and does not change semantics

Exact rule names may vary, but the tree must preserve that this measure body is a multi-rest form rather than ordinary note content.

### 5. Valid Examples

```txt
HH | --8-- |
HH | ---4--- |
HH | -----16----- |
```

### 6. Invalid Examples

```txt
HH | - 4 - |
HH | -- 8 -- |
HH | --8-- *2 |
HH | x --8-- |
```

### 7. Compatibility Note

This is a deliberate surface-syntax tightening.

The previous spaced forms are removed because:

- they make the construct less suitable for direct grammar ownership
- they blur the distinction between a whole-measure shorthand and ordinary dash-based rest content
- they provide no semantic benefit over the compact spelling

The compact form keeps the existing visual metaphor while making the syntax stable enough to belong directly to the grammar.

### Review Round 1

1. The proposal currently presents itself as a surface-syntax tightening, but it actually widens the accepted shape relative to the current spec by allowing arbitrary dash-run lengths such as `---8---` and `-----12-----`. The current spec language and recent grammar-formalization addendum both anchor multi-rest around `--N--`, not "any dash run >= 2". That is a real syntax change, not just a cleanup. The addendum must explicitly say it supersedes the exact-shape `--N--` rule, or else it is internally contradictory.

2. The count constraint is not precise enough. Section 1 says the integer keeps its existing meaning, but it never restates the normative lower bound. In the existing spec, multi-measure rest with `N < 2` is invalid. This proposal must say plainly whether `--1--`, `--0--`, and negative or signed forms are syntax errors, semantic validation errors, or both. If leading zeros such as `--08--` are allowed or disallowed, that also needs to be fixed explicitly.

3. The dash-run rule is under-specified in a way that makes the grammar and formatter unstable. The text says the left and right dash runs "may have any length of two or more dashes", but it never says whether the two sides must match. As written, `--8---` and `----8--` appear legal. If asymmetry is intended, the proposal must explain why the language should preserve multiple equivalent concrete spellings for the same construct. If asymmetry is not intended, symmetry must be stated as a normative rule.

4. The shorthand exclusivity section is incomplete relative to the current multi-rest semantics. It forbids ordinary note content and inline repeat, but it does not say whether multi-rest may coexist with `%` / `%%`, navigation markers/jumps, or other shorthand-bearing local syntax. The current spec treats shorthand measures as structurally special, and the recent parser work already had to police conflicts such as multi-rest plus inline repeat. This proposal should restate the full exclusivity boundary, not only two examples, otherwise implementations will drift.

5. The invalid-form policy is too coarse for grammar ownership. Section 2 says spaced forms "must be rejected as syntax errors", but Section 6 does not cover malformed compact forms such as `--8---`, `---8--`, `--08--`, `----`, or `--x--`. The proposal needs to define whether malformed would-be compact multi-rest forms are hard syntax errors or fall back to ordinary measure content. That distinction matters directly to Lezer recovery behavior and to whether downstream skeleton code is allowed to reinterpret malformed dash-heavy measures.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The contradiction is resolved in favor of the broader symmetric family already stated above.

- Any symmetric dash run of length two or more on both sides of the integer is valid multi-rest syntax.
- Therefore `----8----` is valid and must not appear in an invalid-example list.
- The intended invalid examples remain asymmetric dash runs, spaced forms, malformed integers, and compact-looking forms that do not satisfy the symmetric `2+ / unsigned-decimal / N>=2 / no-leading-zero` rule set.

### Author Response

Accepted. The addendum text remains append-only above; the following clarifications define the intended normative revision for the next review round.

1. Shape change:

- This addendum intentionally supersedes the earlier exact-shape `--N--` rule.
- The new syntax is a family of compact forms with symmetric dash runs of length two or more on both sides of the integer.
- Examples: `--8--`, `---8---`, `-----12-----`.

2. Symmetry:

- The left and right dash runs must have equal length.
- Asymmetric forms such as `--8---` and `----8--` are invalid syntax.

3. Integer form:

- `N` is an unsigned decimal integer with no sign character.
- `N` must be at least `2`.
- Leading zeros are not allowed.
- Therefore `--0--`, `--1--`, `--08--`, `---01---`, `--+8--`, and `----8----` are invalid syntax forms for multi-rest.

4. Exclusivity boundary:

- Multi-rest occupies the entire non-navigation rhythmic content of the measure.
- It may not be combined with ordinary note tokens, groups, combined hits, summon prefixes, braced blocks, `%`, `%%`, another multi-rest, or inline repeat suffix syntax.
- Existing navigation directives may still coexist with a multi-rest measure, subject to the existing navigation-placement rules elsewhere in the spec.

5. Malformed compact candidates:

- A malformed would-be compact multi-rest form is a syntax error.
- It must not be silently reinterpreted as ordinary dash-based measure content.
- This applies to malformed forms including `--8---`, `---8--`, `----`, `--x--`, `--08--`, and `-- 8 --`.

6. Grammar intent refinement:

- The grammar should own multi-rest as a dedicated measure-body branch with explicit local shape.
- Error recovery may continue after reporting a malformed multi-rest candidate, but downstream skeleton logic must not recover that malformed candidate into a valid multi-rest semantic node.

### Review Round 2

Most of the Round 1 issues are now resolved. The response explicitly fixes supersession, symmetry, unsigned integer form, `N >= 2`, leading-zero rejection, malformed-candidate handling, and the exclusivity boundary relative to other shorthand forms.

One remaining issue is a direct contradiction inside the response itself:

1. Section 1 says the new syntax allows symmetric dash runs of length two or more on both sides, and Section 2 confirms symmetry as the governing constraint. Under those rules, `----8----` is valid. But Section 3 then lists `----8----` among the invalid forms. That example cannot stand as written. Either:
   - the proposal really intends to allow any symmetric run length `>= 2`, in which case `----8----` must be removed from the invalid list, or
   - the proposal intends a narrower canonical family than "any symmetric run length >= 2", in which case the actual dash-length constraint must be stated normatively.

Until that contradiction is resolved, the syntax is still not precise enough to hand to grammar implementation without guesswork.

STATUS: CHANGES_REQUESTED

### Review Round 3

The latest appended author response resolves the only remaining blocker from Round 2 by making the precedence explicit: the intended rule is the broader symmetric family, and `----8----` is valid.

At this point the syntax is precise enough for implementation:

- supersession of the older exact-shape `--N--` rule is explicit
- the concrete shape is defined as symmetric dash runs of equal length, each length `>= 2`
- the numeric form is fixed as unsigned decimal, `N >= 2`, with no leading zeros
- malformed compact-looking candidates are defined as syntax errors rather than fallback ordinary content
- exclusivity against other rhythmic shorthand/content is stated, while navigation coexistence remains delegated to existing navigation rules

That is sufficient to implement a dedicated grammar branch and consistent skeleton behavior without guesswork.

STATUS: APPROVED

### Consolidated Changes

- Multi-rest uses a compact no-whitespace surface form with an unsigned decimal integer directly between the dash runs.
- This addendum intentionally supersedes the earlier exact-shape `--N--` rule with a broader family of symmetric forms.
- Valid forms require:
  - equal-length left and right dash runs
  - dash-run length of two or more on each side
  - unsigned decimal integer `N`
  - `N >= 2`
  - no leading zeros
- Examples of valid forms include `--8--`, `---8---`, and `----8----`.
- Spaced forms, asymmetric dash runs, malformed integers, and compact-looking malformed candidates are syntax errors.
- Multi-rest remains a whole-measure shorthand occupying the entire non-navigation rhythmic content of the measure.
- It may coexist with navigation directives under existing navigation rules, but not with ordinary note content, `%`, `%%`, another multi-rest, braced/grouped content, summon syntax, or inline repeat suffixes.
- Grammar ownership is explicit: malformed compact multi-rest candidates must not be lowered into valid multi-rest semantic nodes during recovery.

## Addendum v1.11: Relaxed Multi-Measure Rest Spelling

### Motivation

The previously approved compact multi-rest proposal tightened the surface form too far in two ways:

- it required left/right dash-run symmetry
- it rejected whitespace around the integer

Those constraints are not semantically meaningful. They help formatter output look uniform, but they do not improve the musical model, and they make the syntax less natural to type by hand.

The actual structural property that matters is simpler:

- a multi-rest is a whole-measure shorthand
- it has a left dash run, an integer count, and a right dash run
- each dash run must be visually substantial enough that the construct is not confused with ordinary single-rest content

This addendum relaxes multi-rest spelling accordingly while keeping grammar ownership explicit and keeping the whole-measure exclusivity rule unchanged.

### 1. New Surface Syntax

Multi-rest is written as a left dash run, an integer count, and a right dash run:

```txt
HH | --8-- |
HH | -- 8 -- |
HH | ---8---- |
HH | ---- 12 -- |
```

#### Rules

- The left dash run must contain at least two `-` characters.
- The right dash run must contain at least two `-` characters.
- The left and right dash runs do not need to have equal length.
- Optional horizontal whitespace may appear between the left dash run and the integer.
- Optional horizontal whitespace may appear between the integer and the right dash run.
- `N` is an unsigned decimal integer.
- `N` must be at least `2`.
- Leading zeros are not allowed.

### 2. Whole-Measure Exclusivity

Multi-rest remains a whole-measure shorthand:

- it occupies the entire non-navigation rhythmic content of the measure
- it may not be combined with ordinary note tokens
- it may not be combined with groups, combined hits, summon prefixes, or braced blocks
- it may not be combined with `%`, `%%`, another multi-rest, or inline repeat suffix syntax

Existing navigation directives may still coexist with a multi-rest measure, subject to the navigation-placement rules elsewhere in the spec.

### 3. Grammar Intent

The Lezer grammar should represent legal multi-rest directly as a dedicated measure-body form.

The important local shape is:

- dash run of length `>= 2`
- optional horizontal whitespace
- unsigned decimal integer `N >= 2` without leading zeros
- optional horizontal whitespace
- dash run of length `>= 2`

This addendum does **not** require special malformed-candidate recovery.

Only legal forms are multi-rest syntax. If an input does not match the multi-rest rule, it is simply not a multi-rest. The implementation does not need to guess whether the user intended to write one.

### 4. Valid Examples

```txt
HH | --8-- |
HH | -- 8 -- |
HH | ---8---- |
HH | ---- 12 -- |
```

### 5. Invalid Examples

```txt
HH | - 8 - |
HH | --1-- |
HH | --01-- |
HH | -- +8 -- |
HH | --8-- *2 |
HH | x --8-- |
```

### 6. Supersession

This addendum supersedes the previously approved compact multi-rest spelling that required symmetric dash runs and disallowed whitespace around the integer.

After this addendum:

- symmetry is not required
- optional horizontal whitespace around the integer is allowed
- multi-rest is still a grammar-owned whole-measure shorthand
- non-matching inputs do not receive special multi-rest intent recovery

### Review Round 1

1. The proposal leaves a direct ambiguity at the grammar/diagnostic boundary. Section 3 says "Only legal forms are multi-rest syntax. If an input does not match the multi-rest rule, it is simply not a multi-rest." But Section 5 simultaneously lists several examples as invalid. Those two statements are not equivalent. For inputs such as `--1--`, `--01--`, `-- +8 --`, or `- 8 -`, the proposal must choose one behavior explicitly:
   - they are hard syntax errors as malformed multi-rest candidates, or
   - they are ordinary measure content that merely fail to produce multi-rest intent.
   Right now the addendum says both things at once. That is the biggest blocker because it determines whether Lezer should own these forms as a failed dedicated branch or leave them to ordinary token parsing.

2. Whole-measure exclusivity is still underspecified for malformed candidates. The proposal clearly defines exclusivity for legal multi-rest, but it does not state what happens when a multi-rest-looking form appears alongside other rhythmic content and the candidate itself is malformed. Example: `x -- 8 --`, `--1-- *2`, or `@segno -- +8 --`. If malformed candidates are "simply not a multi-rest", the implementation may fall back to ordinary tokenization and silently accept content that visually reads as broken shorthand. If malformed candidates are errors, that needs to be stated normatively and tied to exclusivity so downstream code does not reinterpret them as valid mixed-content measures.

3. The explicit decision to avoid special malformed-candidate recovery leaves a spec hole around candidate detection. The addendum never defines which non-matching shapes are close enough to count as malformed multi-rest attempts rather than unrelated ordinary content. That matters because the relaxed spelling now admits optional whitespace and asymmetric dash runs, which greatly increases overlap with ordinary dash-based measure text. Without a declared malformed-candidate boundary, implementations will diverge on cases like `-- x --`, `--- 8 x --`, `--8-`, or `-- 8 -- d`.

4. Grammar viability needs one more precision point: "optional horizontal whitespace" should be tied to the actual lexical set. If the intent is spaces only, say spaces only. If tabs are also legal, say horizontal whitespace explicitly includes tabs. Lezer implementation and formatter behavior will differ depending on that choice, and this proposal currently leaves it implicit.

5. The proposal says each dash run must be "visually substantial enough" and then operationalizes that as length `>= 2`, which is good, but it does not restate whether dash multiplicity beyond that threshold is semantically irrelevant. The prior proposal did. That should be preserved here so implementations do not accidentally leak dash-run length into semantics or formatting decisions.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The intended rule is narrower and simpler than the review correctly observed from the current wording.

1. No malformed-candidate class:

- This addendum does not define a malformed multi-rest candidate category.
- An input is multi-rest if and only if it matches the legal multi-rest rule.
- If an input does not match that rule, it is not a multi-rest.

2. Why some examples are still invalid:

- An input that is not a multi-rest may still be an invalid measure for ordinary reasons.
- The invalid examples in Section 5 are intended to mean: these whole-measure inputs are not legal multi-rest, and they are also not legal ordinary measure content under the rest of the language.
- They are not invalid because the implementation is guessing multi-rest intent; they are invalid because the full measure body does not parse as any legal construct.

3. Exclusivity boundary:

- Whole-measure exclusivity applies only to legal multi-rest.
- If a measure contains other rhythmic content alongside text that does not match legal multi-rest, the measure is evaluated under the ordinary grammar.
- No special multi-rest recovery or special multi-rest error priority is required for such cases.

4. Lexical whitespace:

- "Optional horizontal whitespace" means zero or more spaces or tab characters.
- Newlines are not part of this whitespace allowance.

5. Semantic irrelevance of dash multiplicity:

- Dash-run length beyond the minimum threshold of two per side is semantically irrelevant.
- Different legal dash-run lengths are alternate spellings of the same multi-rest construct.

### Review Round 2

The revised wording is now precise enough for implementation.

The key boundary is clean:

- multi-rest exists if and only if the measure body matches the legal multi-rest rule
- there is no separate malformed-candidate category
- non-matching text is handled by the ordinary grammar, not by multi-rest-specific recovery
- an example may still be invalid overall if, after ordinary parsing, the measure body does not form any legal construct

That resolves the main ambiguity from Round 1 without reintroducing intent-guessing. The whitespace set is now explicit (`space` or `tab` only, never newline), and dash multiplicity is explicitly semantically irrelevant beyond the `>= 2` threshold.

Whole-measure exclusivity is also implementable as written: it applies to legal multi-rest only, while mixed-content non-matches fall back to ordinary grammar with no special multi-rest error priority.

STATUS: APPROVED
