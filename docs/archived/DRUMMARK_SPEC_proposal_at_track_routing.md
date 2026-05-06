# DRUMMARK_SPEC_proposal_at_track_routing.md

## Addendum v1.10: Explicit `@TRACK { ... }` Routed Block Syntax

### Motivation

Long-span track routing is currently written as a bare track prefix followed by a braced block:

```txt
RC { x x x x }
SD { [3: d d d] }
```

This notation is compact, but it creates an avoidable parser boundary problem:

- the track prefix is visually indistinguishable from an ordinary token at the beginning of a measure expression
- the parser must distinguish `C { ... }` from nearby local forms such as `C`, `C2`, and `C:x`
- the routed-block intent is implicit rather than marked as directive syntax

DrumMark already uses `@` for explicit control-level syntax such as navigation markers (`@segno`, `@coda`, `@fine`, `@to-coda`). A routed block is also control syntax: it changes where a block is routed without contributing its own rhythmic content. Marking it with `@` makes the notation easier to read and easier to represent structurally in the grammar.

This addendum replaces bare routed brace blocks with an explicit `@TRACK { ... }` directive form.

### 1. New Routed Block Syntax

Long-span routing is written as:

```txt
@RC { x x x x }
@SD { [3: d d d] }
@BD { - d - d }
```

#### Rules

- `@` immediately introduces a routed block directive.
- The token after `@` must be a valid `TrackName`.
- The directive applies only to the immediately following braced block.
- The braced block preserves the same timing behavior and inner content rules as the previous routed-block syntax.
- The routed block may appear anywhere a measure expression may appear.

### 2. Removed Syntax

The following bare routed-block form is no longer valid:

```txt
RC { x x x x }
SD { [3: d d d] }
```

These forms must be rejected as syntax errors rather than accepted as legacy aliases.

### 3. Relationship to Summon Prefix

Short routed-note summon syntax is unchanged:

```txt
SD:d
RC:x
```

The distinction is now explicit in the surface language:

- `TrackName:` routes one note token
- `@TrackName { ... }` routes one braced block

This separation is intentional and should remain stable.

### 4. Track Registry

Track registration rules are updated accordingly.

Any track mentioned via:

- line header, e.g. `SD | ... |`
- routed block directive, e.g. `@RC { x x x x }`
- summon prefix, e.g. `SD:d`

is automatically registered in the score.

### 5. Grammar Intent

The Lezer grammar should represent this construct structurally as an explicit routed-block directive, not as a plain token followed by a braced block that is merged later in lowering.

The important parse-tree distinction is:

- ordinary braced block
- routed braced block introduced by `@TrackName`

Exact rule names may vary, but the tree must retain the routed-block track name directly.

### 6. Valid Examples

```txt
HH | @RC { x x x x } |
HH | x x @SD { [3: d d d] } x |
| @BD { d - d - } |
```

### 7. Invalid Examples

```txt
HH | RC { x x x x } |
HH | @segno { x x x x } |
HH | @RC x x x x |
HH | @RC |
```

### 8. Compatibility Note

This is a deliberate surface-syntax breaking change.

The old bare routed-block syntax is removed because:

- it collides with local token parsing in ways that are avoidable
- it is less visually explicit than directive-prefixed syntax
- it forces grammar and lowering to recover intent from adjacency rather than from a dedicated syntactic marker

No rhythmic or rendering semantics change. Only the surface spelling of long-span routed blocks changes.

### Review Round 1

1. The proposal understates the semantic cost of reusing `@`. In the current language, `@...` is not just "control-level syntax"; it is specifically the namespace for navigation markers and jumps with placement rules and anchor semantics. Adding `@TRACK { ... }` introduces a second, non-navigation sublanguage under the same sigil, but the addendum does not define the lexical partition explicitly. It needs a normative statement that `@TrackName` is a distinct routed-block directive class, not a navigation token, and that unknown `@...` forms are parse errors rather than candidates for navigation recovery. Without that, grammar and diagnostics can drift badly around typo cases and partial input.

2. The proposal does not define how `@TRACK { ... }` interacts with the existing navigation-position logic that already scans `@segno`, `@coda`, `@fine`, and `@to-coda` inside measures. This is not a minor implementation detail. Today those tokens participate in "beginning of measure", "end of measure", and anchor derivation rules. The addendum must say explicitly that routed-block directives are excluded from navigation placement classification and do not contribute navigation anchors. Otherwise inputs such as `| @RC { x x } @fine |` or `| @segno @RC { x x } d |` are grammatically readable but semantically under-specified.

3. "The directive applies only to the immediately following braced block" is too vague for a grammar-facing change. The addendum needs to pin down adjacency rules: whether whitespace is allowed between `@RC` and `{`, whether a newline is allowed, whether comments may intervene, and whether `@RC` followed by anything other than a braced block is an immediate parse error. These details matter because the whole point of the syntax change is to reduce ambiguity. If adjacency remains soft, the parser still has to speculate about whether `@RC` starts a routed block or is just malformed input.

4. The proposal removes `RC { ... }` / `SD { ... }` outright, but it does not provide a migration policy proportionate to the breakage. This is not just a note-level compatibility concern: the current spec explicitly documents routing scope with bare `TrackName { ... }`, and existing scores are likely to rely on it. At minimum, the addendum should require a compatibility audit and define whether the implementation will provide a dedicated diagnostic with a fix-it style message for legacy routed blocks. A hard syntax break without an explicit migration path is avoidable user-hostility.

5. Section 6 says the routed block may appear anywhere a measure expression may appear, but the proposal does not verify that this is actually compatible with group and block subgrammars. If `@SD { ... }` is legal wherever a measure expression is legal, is it also legal inside groups, inside other braced blocks, and adjacent to inline-repeat sugar? If not, the addendum needs to narrow the claim. If yes, it needs to state that explicitly and account for how this coexists with the existing grammar split between local token expressions, grouped expressions, and measure-level suffix forms.

6. The interaction with automatic track registration is specified only for the happy path. The proposal says any track mentioned via `@RC { ... }` is automatically registered, but it does not say whether registration happens only after successful parse of the full directive or as soon as `@RC` is seen. This matters for malformed input and editor behavior. If the grammar now treats `@RC` as a dedicated directive head, the addendum should state that track registration occurs only for syntactically complete routed-block directives, or explicitly justify an earlier registration rule.

7. The invalid example `@segno { x x x x }` is useful, but it also exposes a missing forward-compatibility rule: the proposal assumes track names and navigation directive names live in disjoint namespaces forever. That assumption should be made explicit. Otherwise future expansion of either namespace can create collisions under the shared `@` prefix and force another syntax break. The addendum should say routed-block directives are limited to the canonical `TrackName` set and navigation directives are limited to the enumerated navigation keywords, with no fallback identifier category.

STATUS: CHANGES_REQUESTED

### Author Response

Accepted. The addendum text remains append-only above; the following clarifications define the intended normative revision for the next review round.

1. `@` namespace partition:

- `@TrackName` followed by a routed block is a routed-block directive class.
- `@segno`, `@coda`, `@fine`, `@dc`, `@ds`, `@dc-al-fine`, `@dc-al-coda`, `@ds-al-fine`, `@ds-al-coda`, and `@to-coda` remain the full navigation directive class.
- There is no generic `@Identifier` category.
- Any other `@...` form is a parse error.

2. Navigation interaction:

- Routed-block directives are not navigation markers or jumps.
- They do not participate in navigation placement legality.
- They do not produce navigation anchors.
- Existing navigation rules continue to apply only to the enumerated navigation directives above.

3. Adjacency rule:

- Canonical spelling is `@TRACK { ... }`.
- Horizontal whitespace between `@TRACK` and `{` is allowed.
- A newline or comment between `@TRACK` and the following `{ ... }` block is not allowed.
- If `@TRACK` is not followed by a braced block on the same logical line, it is an immediate parse error.

4. Scope rule:

- A routed-block directive is a measure-expression form.
- It is legal anywhere an inline braced block measure expression is legal.
- It is legal in measure content and nested braced measure content.
- It is not a valid group item inside `[ ... ]`, unless a future addendum explicitly extends group-item syntax.
- Measure-level suffix forms such as `*N` still apply only at measure-body level and are unaffected by the routed-block syntax itself.

5. Track registration:

- Automatic registration occurs only for syntactically complete routed-block directives.
- A malformed head such as bare `@RC` does not register the track.

6. Migration policy:

- The break from `TRACK { ... }` to `@TRACK { ... }` is intentional.
- Implementations should emit a dedicated diagnostic for legacy bare routed blocks, with wording equivalent to: `Legacy routed block syntax \`RC { ... }\` has been removed; use \`@RC { ... }\` instead.`
- Existing examples and user-facing docs must be updated atomically when the syntax change is adopted.

### Review Round 2

1. The Author Response closes the material gaps from Review Round 1. The `@` namespace is now explicitly partitioned into a closed routed-block class and a closed navigation-directive class, with no fallback `@Identifier` category. That resolves the largest grammar and diagnostic ambiguity around typo handling and future drift.

2. The navigation conflict is also resolved at the right layer. The response makes routed-block directives explicitly non-navigation syntax, excluded from placement legality and anchor derivation, so existing `@segno` / `@coda` / `@fine` / `@to-coda` semantics remain scoped to the enumerated navigation directives only.

3. The adjacency and scope rules are now concrete enough for implementation: same logical line, horizontal whitespace allowed, no comment or newline barrier, and an immediate parse error when the braced block does not follow. That removes the remaining parser-speculation problem the new syntax was meant to avoid.

4. The migration risk is handled adequately for a deliberate breaking change. Requiring a dedicated legacy-syntax diagnostic and atomic docs/example updates is the minimum needed to make the break operationally defensible.

STATUS: APPROVED

### Consolidated Changes

- Long-span routed blocks use explicit directive syntax: `@TRACK { ... }`.
- Legacy bare routed blocks such as `RC { ... }` and `SD { ... }` are removed.
- Implementations should emit a dedicated migration diagnostic for legacy bare routed blocks, with wording equivalent to: `Legacy routed block syntax \`RC { ... }\` has been removed; use \`@RC { ... }\` instead.`
- The `@` namespace is partitioned into two closed classes:
  - routed-block directives: `@TrackName { ... }`
  - navigation directives: the enumerated navigation keywords defined elsewhere in the spec
- There is no fallback `@Identifier` category; unknown `@...` forms are parse errors.
- Routed-block directives are not navigation syntax, do not participate in navigation placement legality, and do not produce navigation anchors.
- Canonical adjacency is same logical line with optional horizontal whitespace before `{`; newline or comment separation is not allowed.
- Routed-block directives are measure-expression forms, legal where inline braced block measure expressions are legal, including nested braced measure content but excluding group-item syntax unless extended by a future addendum.
- Automatic track registration occurs only for syntactically complete routed-block directives.
