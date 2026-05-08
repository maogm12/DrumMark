# Parser Ownership

## Status

- The Lezer-based parser is the authoritative parser for normalized semantics.
- The legacy regex/manual parser in `src/dsl/parser.ts` is deprecated.

## Authoritative Path

Production parsing flows through:

- `parseDocumentSkeletonFromLezer(...)`
- `buildScoreAst(...)`
- `buildNormalizedScore(...)`

Changes to supported syntax, diagnostics, and normalized semantics must be implemented against the Lezer path. Manual-parser updates are optional transitional compatibility work only.

## Deprecated Manual Parser

The manual parser may remain temporarily for these uses only:

- migration aid
- comparison harness
- rollback guard
- explicitly documented transitional support

It is not allowed to define new source-of-truth behavior.

## Prohibited Uses

The deprecated manual parser must not:

- be treated as the production parser
- be the sole place where a new syntax feature lands
- be the sole place where a semantic validation rule changes
- block Lezer-authoritative fixes because of historical behavior alone

## Test Contract

- Spec-facing correctness tests target the Lezer production path.
- Transitional comparison tests may still compare the deprecated manual parser against Lezer on selected fixtures only.
- Those comparison tests are drift probes, not parser ownership proofs.
- A drift probe should fail when the deprecated parser diverges on a covered comparison fixture; it should not silently stop comparing.
- Every deprecated-parser comparison fixture must also have direct Lezer-side coverage.
- The comparison fixture set should stay intentionally narrower than the full Lezer production fixture set so the deprecated path can shrink over time instead of remaining coupled to every production-path fixture.
- Comparison fixtures may include selected accepted or expected-error fixtures, as long as the direct Lezer assertion remains the primary semantic oracle for each covered case.
- If the manual parser diverges on a fixture during deprecation, the required action is to decide whether to:
  - update the deprecated parser for short-term comparison continuity
  - narrow or remove that comparison fixture
  - continue the deprecation/removal path

## Retirement Direction

The intended end state is:

- Lezer remains the only authoritative production parser.
- The deprecated manual parser is eventually removed or reduced to non-production historical tooling only.
