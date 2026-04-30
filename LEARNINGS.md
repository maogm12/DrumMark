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

## 2026-04-30 Addendum: Multi-Marker Navigation

- Navigation markers are no longer singleton metadata. Canonical score data needs an ordered `markers` array, not a single `marker` field, or inputs like `@coda ... @fine` cannot be represented without loss.
- Cross-track marker merge is set union, not conflict. The canonical ordering is fixed as `segno`, `coda`, `fine`, which keeps renderer snapshots and MusicXML emission deterministic even when source token order differs.
- Jumps remain singleton metadata. The valid matrix is now “any marker set plus at most one jump”, so parser and AST validation must stop rejecting marker-plus-marker while still rejecting jump-plus-jump.
- Marker propagation follows the same left-edge rule as volta starts: when `*N` expands one source measure into multiple logical bars, the full marker set belongs only on the first generated bar, while any jump belongs only on the last generated bar.
- Consumers must preserve the whole marker set. In practice this means MusicXML emits one direction per marker in canonical order, and VexFlow must render multiple start-side labels instead of silently dropping later markers.

## 2026-04-30 Addendum: Positional Navigation Anchors

- The multi-marker model was too loose for engraving semantics. Once navigation placement matters, canonical IR must model at most one `startNav` and at most one `endNav`, with tagged unions that encode which anchor kinds are legal for each token family.
- Position legality has to be evaluated after stripping navigation tokens but before parsing shorthand structure. `%`, `%%`, and `--N--` still count as remaining measure content for begin/end legality, while trailing `*N` behaves as an inline-repeat suffix and should not block end-side navigation.
- Pure navigation measures need an explicit fallback rule. Without it, inputs like `| @segno |` and `| @dc |` become ambiguous because there is no remaining content token to establish “beginning” or “end”; the correct default is start-side forms -> left edge, end-side forms -> right edge.
- Right-edge navigation forcing must be resolved against barlines during normalization, not in the parser. `fine` upgrades the canonical barline to `final`; `dc/ds` families upgrade to `double` unless a `double` or `final` barline is already explicit; repeat-ending bars instead hard-fail for these end-side forms.
- Event-relative anchors are safest when stored as rhythmic positions, not concrete note ids. That keeps `segno`/`to-coda` stable across combined hits, grouped tokens, and cross-track normalization.
- VexFlow `Repetition` is only partially useful for navigation engraving. `SEGNO_LEFT` is symbol-only, but `CODA_LEFT` and `TO_CODA` inject hardcoded text, and all `Repetition` text is top-of-staff only. For position-sensitive navigation, note-anchored `Annotation` modifiers are more reliable.
- Pure navigation measures still need render anchors. If the renderer only records anchor points for sounded events, start/end navigation on rest-only bars disappears; rest entries must seed the same rhythmic anchor map.
- For the current engraving rules, `fine` and the `dc/ds` family belong below the staff, while `to-coda` stays above and should be emitted as separate text-plus-glyph annotations so the coda symbol survives SVG export.
