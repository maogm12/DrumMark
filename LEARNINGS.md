# Learnings

## 2026-04-30

- Volta boundaries in the parser are measure-boundary syntax, not regular measure content. The parser must recognize them before token parsing on anonymous tracks, or inputs like `:|2.` degrade into a valid repeat-end followed by an invalid content token `2`.
- Anonymous-track alternate endings need the same boundary grammar as named tracks. In practice this includes both compact forms like `|2.` and musician-style spaced forms like `| 3.`.
- A repeat end may immediately introduce the next volta with no intervening barline token. `:|2.` should close the previous repeated measure and seed the next measure's left boundary with volta indices `[2]`.
- `|.` should be treated as a pure volta terminator. Final barlines belong to score normalization on the actual last measure, not to the `|.` token itself.
- Cross-system volta rendering depends on normalized canonical metadata spanning the whole ending, not just the first measure that declared `|1.` or `|2.`. Once the active volta is propagated until `|.`, a new volta, or a repeat end, existing VexFlow `BEGIN/MID/END` rendering continues the bracket across systems correctly.

## 2026-04-30 Addendum: Chained Measure Repeat

- Change: chained measure-repeat shorthand is allowed. A measure-repeat bar may reference preceding bars even if one or more of those preceding bars are themselves measure-repeat bars.
- Semantics: `%` copies the immediately preceding canonical musical result. `%%` copies the previous two canonical musical results as heard/read after normalization, not merely the previous two source measures by syntax class.
- Example: `| A | % | %% |` is valid and yields canonical playback/notation equivalent to `| A | A | A |`.
- Non-change: `%` and `%%` still must occupy the entire measure, and `%%` still requires two preceding canonical measures to exist.
- Metadata rule: measure-repeat expands musical content only. Structural metadata such as the current barline, volta, marker, and jump remain attached to the current bar and are not inherited from the referenced bars.
