# DRUMMARK_SPEC_proposal_lezer_grammar_restructure.md

## Addendum v1.9: Lezer Grammar Formalization and Unquoted Free-Text Headers

### Motivation

The current Lezer migration is functionally complete but architecturally incomplete. Several constructs that are part of the DrumMark surface syntax are still recognized indirectly in `lezer_skeleton.ts` through raw-text rescans, token merging, and gap scanning rather than being represented explicitly in the parse tree.

This creates three concrete problems:

1. **The grammar is under-specified**. It does not fully encode the language described by the specification, so `lezer_skeleton.ts` performs a second parsing pass for several constructs.
2. **Error behavior is fragile**. Features such as summon prefixes, routed brace blocks, inline repeats, and paragraph `note 1/N` overrides depend on string heuristics (`endsWith(":")`, measure-end regexes, source-gap regexes) rather than structural nodes.
3. **Free-text headers are unnecessarily constrained**. Requiring quotes for `title`, `subtitle`, and `composer` is parser-driven ceremony rather than a user-facing design goal.

This addendum has two goals:

- Make the Lezer grammar structurally represent the DrumMark syntax that already exists in the spec.
- Relax free-text headers so `title`, `subtitle`, and `composer` accept either quoted text or unquoted line-tail text.

This proposal does **not** change rhythmic semantics, token resolution semantics, navigation semantics, or rendering semantics. It is a parser-boundary cleanup plus one small syntax expansion for free-text headers.

### Scope

This addendum covers:

- Unquoted `title`, `subtitle`, and `composer` header values.
- Structural grammar support for summon prefixes, routed brace blocks, group internals, inline repeat suffixes, multi-measure rests, paragraph `note 1/N` overrides, and finer barline node classes.

This addendum does **not** change:

- Duration math
- Grouping validation
- Modifier legality by track
- Navigation legality rules
- Cross-measure repeat/volta inference
- Rendering or MusicXML output semantics

### 1. Free-Text Header Syntax

The following header fields may now use either quoted text or unquoted line-tail text:

- `title`
- `subtitle`
- `composer`

#### Valid Forms

```txt
title "Backbeat Study"
title Backbeat Study

subtitle "with ghost notes"
subtitle with ghost notes

composer "G. Mao"
composer G. Mao
```

#### Rules

- After the header keyword, the remainder of the line is the field value.
- Leading whitespace after the keyword is ignored.
- Trailing whitespace before end-of-line is ignored.
- Quoted and unquoted forms are semantically equivalent after normalization.
- Empty values are invalid. `title` with no content is a parse error.
- Line comments still apply. In unquoted form, parsing stops before a `#` comment marker.
- In quoted form, `#` inside the quoted string is part of the value, not a comment.

#### Examples

Valid:

```txt
title Funk Groove
subtitle Lesson 4
composer G. Mao
title "Funk #1"
```

Invalid:

```txt
title
subtitle      # no value
composer
```

### 2. Grammar Structural Formalization

The following syntax forms are already part of DrumMark but must be represented explicitly by the Lezer grammar rather than reconstructed in `lezer_skeleton.ts`.

#### 2.1 Summon Prefix

The explicit routing prefix `TrackName:` is formal syntax:

```txt
SD:d
RC:x
ST:R
```

The grammar must represent this as a routed note expression, not as one token ending in `:` followed by another token that is stitched back together later.

#### 2.2 Routed Brace Block

Track routing scopes such as:

```txt
RC { x x x x }
SD { [3: d d d] }
```

must parse as a single routed block structure whose track is part of the syntax tree, rather than as a plain token followed by an anonymous braced block that is post-merged later.

#### 2.3 Group Internals

Rhythmic groups:

```txt
[3: d d d]
[ d x ]
[2:s]:flam
```

must expose distinct child structure for:

- optional span prefix
- group content
- trailing group modifiers

The parser must not recover span and items by rescanning the raw string inside the brackets.

#### 2.4 Inline Measure Repeat

The measure-end sugar:

```txt
| dddd *2 |
| - *3 |
| *4 |
```

must be represented as explicit measure syntax, not detected by a regex over already-collected `content` text.

#### 2.5 Multi-Measure Rest

The construct:

```txt
| --8-- |
| - 4 - |
```

must be represented by an explicit multi-rest node. It is the only legal multi-measure-rest syntax in DrumMark and should not be recognized through a free-form measure-content regex.

#### 2.6 Paragraph `note 1/N` Override

A standalone paragraph-leading line:

```txt
note 1/8
HH | d d d d |
```

must be represented as explicit paragraph-level syntax. It must not be discovered by scanning raw source text gaps between track lines.

#### 2.7 Barline Classes

The grammar must distinguish at least the following structural barline classes:

- regular barline
- double barline
- repeat-start barline
- repeat-end barline
- volta-start barline with one or more indices
- volta terminator barline

This does not mean all downstream repeat semantics move into the grammar. It only means the parse tree should encode the local barline form instead of requiring text reclassification later.

### 3. Boundary Between Grammar and Skeleton

After this refactor, responsibilities are divided as follows.

#### Grammar Responsibilities

- Tokenize and structurally parse all local syntax forms listed above.
- Preserve local shape: routed note, routed brace block, group span, group modifiers, inline repeat suffix, multi-rest, paragraph note override, barline variant.
- Preserve token ordering within a measure.

#### Skeleton Responsibilities

- Convert parse-tree nodes into typed skeleton objects.
- Apply defaulting and normalization that depend on document context.
- Build paragraph grouping from blank lines and explicit paragraph-level markers.
- Perform navigation extraction and anchor derivation.
- Perform semantic validation that depends on musical context rather than local syntax.

#### Explicit Non-Goals

The skeleton still remains responsible for:

- inferring default grouping when omitted
- resolving anonymous-track fallback
- determining whether navigation placement is legal
- inferring implicit repeat-end behavior for intermediate voltas
- validating grouping-boundary crossings and duration totals

### 4. Proposed Parse-Tree Shapes

The exact Lezer rule names may vary, but the tree must carry the following distinctions.

#### 4.1 Free-Text Headers

- `TitleHeader`
- `SubtitleHeader`
- `ComposerHeader`
- each with a child representing either quoted or unquoted line-tail text

#### 4.2 Measure Expressions

- `BasicNoteExpr`
- `SummonExpr`
- `CombinedHitExpr`
- `GroupExpr`
- `RoutedBlockExpr`
- `MeasureRepeatExpr`
- `MultiRestExpr`

#### 4.3 Measure-Level Suffix Constructs

- `InlineRepeatSuffix`

The inline repeat suffix belongs to the measure body, not to a basic note token. This preserves the existing disambiguation rule that `d*` is duration doubling while final `*N` is inline repeat.

#### 4.4 Paragraph-Level Constructs

- `ParagraphNoteOverride`

#### 4.5 Barline Constructs

- `RegularBarline`
- `DoubleBarline`
- `RepeatStartBarline`
- `RepeatEndBarline`
- `VoltaBarline`
- `VoltaTerminatorBarline`

### 5. Disambiguation Rules

#### 5.1 `*` Duration vs. `*N` Inline Repeat

The existing DrumMark rule remains in force:

- `d*`, `d**`, etc. are duration modifiers on a token.
- `*N` at measure end is inline repeat sugar.

Parser strategy:

- Inline repeat is recognized only as a trailing measure-level suffix after normal measure content.
- A `*` directly attached to a basic token remains token-local duration syntax.

Examples:

```txt
| d* *2 |
| d** *3 |
| *4 |
```

#### 5.2 `#` Comment Behavior in Unquoted Headers

- In unquoted free-text headers, `#` starts a comment.
- In quoted free-text headers, `#` is literal text unless the closing quote occurs first.

Examples:

```txt
title Funk Groove # comment
title "Funk # Groove" # comment
```

Normalized values:

- first: `Funk Groove`
- second: `Funk # Groove`

### 6. Migration Plan

Implementation should proceed in the following order:

1. Extend grammar to represent free-text header line-tail text.
2. Add explicit grammar support for summon expressions and routed brace blocks.
3. Split group structure into span/content/modifier nodes.
4. Add explicit multi-rest and inline-repeat measure syntax.
5. Add explicit paragraph `note 1/N` override syntax.
6. Split coarse `Barline` into local structural barline classes.
7. Simplify `lezer_skeleton.ts` by deleting raw-text reconstruction paths once corresponding grammar nodes exist.

The acceptance criterion is not only passing tests, but also measurable deletion of parser reconstruction logic in `lezer_skeleton.ts`.

### 7. Compatibility Expectations

- Existing quoted free-text headers remain valid.
- Existing scores using current summon syntax, brace routing syntax, group syntax, `%`, `%%`, voltas, and inline repeat remain valid.
- No user-visible rhythmic or rendering behavior changes are intended.
- Parser error locations should improve or remain stable, but exact wording may change where syntax is now caught earlier.

### 8. Risks

#### 8.1 Over-Tokenizing Header Text

If unquoted free-text header support is implemented using ordinary DSL tokens instead of line-tail text, values like `Backbeat Study No. 2` will fragment or interact badly with existing tokens. The grammar should treat free-text header values as dedicated line-tail text, not as regular measure tokens.

#### 8.2 Group Grammar Coupling

The current grammar reuses `MeasureContent` inside groups and brace blocks. Refactoring this carelessly can introduce accidental syntax expansion or contraction. In particular, the group grammar must preserve the existing rule that a group is a sequence of token expressions, not arbitrary full measures.

#### 8.3 Measure-Level vs. Token-Level Suffix Confusion

Inline repeat must remain a measure-level construct. If parsed at token level, `d*3` would become ambiguous or incorrectly legal. The grammar must encode trailing-position privilege for `*N`.

#### 8.4 Paragraph Structure Drift

The current parser derives paragraphs largely from blank lines. Adding explicit paragraph-level `note` overrides must not change the meaning of blank-line paragraph splits or allow mid-paragraph `note` lines to silently succeed.

### 9. Success Criteria

This refactor is successful when all of the following are true:

- `title`, `subtitle`, and `composer` accept quoted and unquoted values.
- `lezer_skeleton.ts` no longer reparses summon prefixes from raw text.
- `lezer_skeleton.ts` no longer reparses group internals from raw text.
- `lezer_skeleton.ts` no longer detects inline repeat and multi-rest with measure-content regexes.
- `lezer_skeleton.ts` no longer scans source gaps to discover paragraph `note 1/N` overrides.
- Routed brace blocks carry their route structurally from the parse tree.
- Barline interpretation depends on node class first, not raw string classification first.

### 10. Implementation Notes

This addendum is a parser-architecture cleanup. It deliberately does not require a public IR schema change other than accepting unquoted free-text header input. Skeleton types may grow internal helper variants if needed, but no new user-visible score semantics are introduced by this refactor.

### Review Round 1

1. The proposal requires unquoted `title` / `subtitle` / `composer` to consume line-tail text, but it does not specify a Lezer-safe lexical strategy for that text. This is the highest-risk omission in the document. A line-tail token that coexists with ordinary DSL tokens and `#` comments can easily over-consume input or create contextual-token conflicts, especially if the same line-tail token is reachable from positions other than header lines. The addendum needs an explicit constraint such as "unquoted header text is only lexically reachable immediately after these three header keywords at line start" or an equivalent contextual-token plan. Without this, the proposal is architecturally under-specified at the exact place it claims to simplify parsing.

2. Comment handling for unquoted headers is semantically under-defined once escaping is considered. The text says parsing stops before a `#` comment marker, but it does not say whether `composer C# Minor` is legal unquoted input or whether users must quote any literal `#`. That is a user-visible compatibility rule, not an implementation detail. The proposal should either explicitly forbid literal `#` in unquoted header text and require quoting, or define an escape rule. Leaving this implicit will produce surprising breakage for plausible values.

3. Section 2.4 introduces `| *4 |` as a valid inline-repeat example, but the proposal never states whether an inline-repeat suffix may appear on an otherwise empty measure body in the formal grammar. This matters because the parser shape in Section 4.3 describes `InlineRepeatSuffix` as belonging to the measure body "after normal measure content," which conflicts with the empty-body example. The addendum needs to define whether the grammar admits zero content plus suffix, and if so, what skeleton object that produces before semantic lowering.

4. The boundary between `MultiRestExpr` and ordinary measure content is not specified tightly enough. The proposal says multi-rest should be an explicit node and gives `| --8-- |` and `| - 4 - |` as forms, but it does not state whether surrounding whitespace variants, additional measure tokens, or modifiers adjacent to the rest are parse errors or semantic errors. Because the current behavior is regex-based and strict, the addendum should preserve that strictness in grammar terms: a multi-rest measure should be its own measure alternative, mutually exclusive with normal measure content and inline-repeat suffixes. Without that statement, the refactor risks accidentally broadening accepted syntax.

5. The proposal says barlines should be split into local structural classes, but it does not define how ambiguous textual forms map to those classes before semantic inference. In particular, any syntax that currently becomes a generic barline and is later classified by helper logic needs a normative mapping table here, or the grammar rewrite can silently change parse trees for existing scores. "At least the following structural barline classes" is too loose for an implementation-facing addendum; it leaves open whether multiple textual spellings normalize to one node, whether malformed volta labels become generic barlines or parse errors, and which exact node carries volta indices.

6. Paragraph-level `note 1/N` is still under-specified relative to blank-line paragraph formation. The proposal correctly says this must not change blank-line semantics, but it does not define whether the override line is syntactically part of the paragraph it precedes, whether multiple consecutive overrides are legal, or whether a second override before any track line is a parse error. These are not merely semantic validation questions, because the parse tree shape in Section 4.4 introduces a paragraph-level node that affects grouping. The addendum needs explicit syntactic placement rules.

7. The migration plan says acceptance includes deletion of reconstruction logic from `lezer_skeleton.ts`, but it does not require a compatibility audit for diagnostics and incremental parsing behavior. This omission is important because some of the proposed changes move failure earlier into the grammar, which can change recovery paths and tree stability in the editor. A parser-architecture proposal should include a migration checkpoint for error-recovery parity on malformed but common partial inputs such as unfinished groups, unfinished routed blocks, and in-progress unquoted headers. Otherwise the grammar may become structurally cleaner while materially regressing authoring UX.

8. The proposal does not state whether routed brace blocks and summon prefixes are syntactically limited to canonical track names already recognized elsewhere, or whether the grammar should admit a broader identifier and let skeleton validation reject unknown tracks. This choice has direct consequences for grammar reuse, error quality, and future extensibility. The addendum needs to lock this down, because otherwise the implementation can drift between overly strict parsing and overly permissive trees depending on which existing token the author reuses.

STATUS: CHANGES_REQUESTED

### Author Response

The review identified real underspecification. The proposal is revised by the following appended clarifications. These clarifications are normative for implementation and supersede any looser wording earlier in this proposal.

#### Response 1: Unquoted free-text headers require contextual line-tail lexing

The intended design is **not** to let ordinary DSL tokens spell out free-text headers. The grammar support must use a dedicated contextual line-tail token or equivalent contextual rule that is reachable only immediately after the keywords `title`, `subtitle`, and `composer` in header position.

Normative constraints:

- Unquoted free-text header text is lexically reachable only after `title`, `subtitle`, or `composer`.
- It is not reachable in measure content, paragraph override lines, track lines, or any non-header context.
- The token stops at newline or at the beginning of an unquoted `#` comment.

This locks the design to contextual line-tail parsing rather than ordinary token reuse.

#### Response 2: Literal `#` in unquoted headers is forbidden

The review is correct that `composer C# Minor` must be specified explicitly.

Normative rule:

- In unquoted `title` / `subtitle` / `composer` values, `#` always starts a comment.
- Therefore a literal `#` in these header values requires quoted syntax.

Examples:

```txt
composer C Minor          # valid, value = "C Minor"
composer C# Minor         # value = "C"; remainder is comment
composer "C# Minor"       # valid, value = "C# Minor"
```

This is intentionally strict. No escaping rule is introduced.

#### Response 3: Empty-body inline repeat is explicitly legal

The example `| *4 |` is intended to remain valid.

Normative rule:

- Inline repeat may appear either:
  - after non-empty normal measure content, or
  - as the sole content form in an otherwise empty measure body.
- Therefore the grammar must admit both:
  - `MeasureContent InlineRepeatSuffix`
  - `InlineRepeatSuffix`

Skeleton lowering rule:

- A bare `| *N |` produces `N` expanded empty measures, exactly matching current sugar semantics.

This resolves the contradiction with the earlier phrase "after normal measure content." That phrase should be read as "trailing at measure level, not token level."

#### Response 4: Multi-rest is a mutually exclusive measure form

The review is correct that the strictness needs to be preserved formally.

Normative rule:

- A multi-rest measure is its own measure-body alternative.
- It is mutually exclusive with:
  - normal measure token content
  - measure-repeat shorthand (`%`, `%%`, etc.)
  - inline-repeat suffix (`*N`)
  - navigation tokens
- Surrounding internal whitespace within the `- ... N ... -` form remains permitted exactly as today.
- Any additional token, modifier, or suffix adjacent to a multi-rest construct is a parse error.

This preserves the current "only legal syntax" guarantee from the spec.

#### Response 5: Barline mapping is fixed at local textual form

The local grammar-to-node mapping is hereby fixed as follows:

- `|` -> `RegularBarline`
- `||` -> `DoubleBarline`
- `|:` -> `RepeatStartBarline`
- `:|` -> `RepeatEndBarline`
- `|.` -> `VoltaTerminatorBarline`
- `||.` -> `DoubleBarline` plus a terminator flag/node child, or an equivalent dedicated `DoubleVoltaTerminatorBarline` if that is simpler for Lezer implementation
- `|N.` / `|N,M.` -> `VoltaBarline(indices=[...], base="|")`
- `|:N.` / `|:N,M.` -> `VoltaBarline(indices=[...], base="|:")`
- `:|N.` / `:|N,M.` -> `VoltaBarline(indices=[...], base=":|")`

Malformed volta text is a parse error. It is not to be silently downgraded into a generic barline node.

Semantic note:

- The grammar only captures local textual form.
- Downstream logic still decides musical meaning such as inferred repeat-end behavior for intermediate voltas.

#### Response 6: Paragraph `note 1/N` placement is fixed

Normative placement rules:

- A paragraph-level `note 1/N` override is syntactically attached to the paragraph it precedes.
- It may appear only as the first non-comment, non-blank content of that paragraph block.
- At most one paragraph-level override may precede the track content of a paragraph.
- Two consecutive override lines before any track line are a parse error.
- A `note 1/N` line appearing after the first track line of a paragraph is a parse error.
- Blank lines remain the primary paragraph separator. The override does not create a paragraph by itself; it annotates the paragraph that begins immediately after it.

This keeps paragraph formation stable while making override ownership explicit.

#### Response 7: Migration acceptance must include recovery and editor stability

The migration plan is extended with an additional acceptance checkpoint.

Add to acceptance criteria:

- malformed-input recovery must be manually checked for at least:
  - unfinished group input such as `[3: d d`
  - unfinished routed block input such as `RC { x x`
  - unfinished summon input such as `SD:`
  - unfinished unquoted free-text header input at line end
  - incomplete inline repeat suffix such as trailing `*`
- incremental parse stability in the editor must be checked for representative edits involving those forms

The goal is not perfect parity with the old regex parser. The goal is to avoid obvious authoring regressions caused by over-eager grammar failure.

#### Response 8: Routed track names stay grammar-strict

The proposal now fixes the permissiveness choice:

- Summon prefixes and routed brace blocks are syntactically limited to the canonical `TrackName` set already defined by DrumMark.
- Unknown routed prefixes are parse errors, not skeleton-time semantic errors.

Rationale:

- This matches existing named-track syntax.
- It yields earlier, clearer diagnostics.
- It avoids introducing a second "identifier-like" namespace that the language does not otherwise have.

#### Consolidated Clarifications

The revised proposal now commits to these concrete implementation boundaries:

- Unquoted `title` / `subtitle` / `composer` use contextual line-tail parsing only in header position.
- Literal `#` requires quotes in unquoted free-text headers.
- Bare `| *N |` remains valid and is explicitly modeled as empty measure plus inline-repeat suffix.
- Multi-rest is a mutually exclusive measure-body form and cannot mix with other content.
- Barline text-to-node mapping is fixed locally and malformed volta barlines are parse errors.
- Paragraph-level `note 1/N` attaches to the immediately following paragraph and is unique at paragraph start.
- Migration must include malformed-input recovery and incremental-parse checks.
- Routed constructs remain grammar-strict to canonical `TrackName`.

### Review Round 2

1. The Author Response closes the majority of the original concerns, but one remaining specification leak prevents approval. Response 5 still permits two different parse-tree shapes for `||.`: either `DoubleBarline` plus a terminator flag/node child, or a dedicated `DoubleVoltaTerminatorBarline`. That is still implementation freedom at the parse-tree-shape level, which this proposal otherwise tries to eliminate. Because downstream skeleton logic and tests may depend on node identity, the proposal should pick exactly one structural representation for `||.` and make it normative. Leaving both allowed reintroduces divergence risk between implementations and weakens the success criterion that barline interpretation should depend on node class first.

STATUS: CHANGES_REQUESTED

### Author Response

Review Round 2 is correct. The proposal should not leave `||.` structurally ambiguous.

Normative correction to Response 5:

- `||.` maps to exactly one parse-tree class: `DoubleVoltaTerminatorBarline`.

Updated local barline mapping:

- `|` -> `RegularBarline`
- `||` -> `DoubleBarline`
- `|:` -> `RepeatStartBarline`
- `:|` -> `RepeatEndBarline`
- `|.` -> `VoltaTerminatorBarline`
- `||.` -> `DoubleVoltaTerminatorBarline`
- `|N.` / `|N,M.` -> `VoltaBarline(indices=[...], base="|")`
- `|:N.` / `|:N,M.` -> `VoltaBarline(indices=[...], base="|:")`
- `:|N.` / `:|N,M.` -> `VoltaBarline(indices=[...], base=":|")`

There is no alternative parse-tree encoding for `||.`.

### Review Round 2

1. Most of the prior underspecification has been closed, but the `||.` barline mapping remains too loose to approve. The response allows either `DoubleBarline` plus a terminator flag/node child or a dedicated `DoubleVoltaTerminatorBarline`, which means the same source text may produce materially different parse-tree shapes depending on implementation choice. That is exactly the kind of drift this addendum is supposed to eliminate. The proposal needs to pick one normative tree shape for `||.` so downstream skeleton logic, diagnostics, and future tooling are not forced to support multiple incompatible representations for the same syntax.

STATUS: CHANGES_REQUESTED

### Review Round 3

1. The final remaining structural ambiguity is resolved. The latest Author Response now maps `||.` to exactly one parse-tree class, `DoubleVoltaTerminatorBarline`, which closes the prior implementation-divergence risk around barline node identity and makes the local barline mapping fully normative.

2. The new correction does not introduce a fresh grammar-boundary conflict with the rest of the proposal. It stays consistent with the stated architecture split: the grammar captures local textual barline form, while downstream logic retains responsibility for higher-level repeat and volta semantics.

STATUS: APPROVED

### Consolidated Changes

This proposal is approved with the following consolidated design decisions:

- `title`, `subtitle`, and `composer` accept both quoted and unquoted values.
- Unquoted free-text header parsing is contextual and only available immediately after those three header keywords in header position.
- In unquoted free-text headers, `#` always starts a comment. Literal `#` requires quoted syntax.
- Summon prefixes such as `SD:d` and routed brace blocks such as `RC { x x x x }` are formal grammar constructs and must not be reconstructed from raw text in `lezer_skeleton.ts`.
- Rhythmic groups must expose structural children for span, content, and trailing modifiers rather than being reparsed from bracket text.
- Inline repeat `*N` is a measure-level trailing construct, not a token-level construct, and bare `| *N |` remains valid as empty-measure repeat sugar.
- Multi-rest is a mutually exclusive measure-body form and cannot mix with ordinary measure content, measure-repeat shorthand, inline repeat, or navigation tokens.
- Paragraph `note 1/N` override is a paragraph-leading construct attached to the immediately following paragraph, unique at paragraph start, and invalid elsewhere.
- Local barline grammar is structurally explicit and fixed:
  - `|` -> `RegularBarline`
  - `||` -> `DoubleBarline`
  - `|:` -> `RepeatStartBarline`
  - `:|` -> `RepeatEndBarline`
  - `|.` -> `VoltaTerminatorBarline`
  - `||.` -> `DoubleVoltaTerminatorBarline`
  - `|N.` / `|N,M.` / `|:N.` / `:|N.` forms -> `VoltaBarline` with indices and base form
- Malformed volta barlines are parse errors rather than generic barlines.
- Grammar owns local syntax shape; skeleton owns contextual lowering, navigation legality, repeat/volta inference, defaulting, and semantic validation.
- Migration acceptance includes deletion of reconstruction logic from `lezer_skeleton.ts` plus malformed-input recovery and incremental-parse checks for representative in-progress edits.
