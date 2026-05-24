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

## Addendum 2026-05-13: Rust/WASM Cutover Target

- This document is superseded by the approved Rust/WASM cutover plan for production parser ownership.
- The intended repository end state is:
  - Rust/WASM is the only authoritative production parser
  - there is no production parser toggle or hidden fallback parser path
  - Lezer is removed from the active source tree as a production parser implementation
- The cutover gate is the supported checked-in example corpus:
  - Rust/WASM must parse the corpus successfully
  - normalized IR must match the current Lezer path except for divergences explicitly recorded as Lezer bugs in the divergence ledger
- Parser diagnostics remain part of parser ownership:
  - malformed syntax must still surface parser errors
  - invalid-but-parseable input must still surface validation/normalization errors
  - parser diagnostics must preserve user-visible line/column fidelity
- If Rust/WASM initialization fails in production parse flows, parsing fails closed with an explicit initialization error. No silent fallback parser is permitted.

This addendum defines the target state for the active implementation tasks. The earlier Lezer-authoritative status above remains historical record only.

## Addendum 2026-05-13: Rust/WASM Ownership Activated

- The active production parser path is now Rust/WASM:
  - `buildScoreAst(source)` uses `parseDocumentSkeletonFromWasmSync(...)`
  - `buildNormalizedScore(source)` uses the WASM-backed AST path only
  - worker/browser/CLI entry points initialize WASM before production parsing
- The parser-selection product surface has been removed:
  - no production `parseMode: "lezer"` branch remains
  - no `useWasmParser` setting or UI toggle remains
- The example-corpus cutover gate is now checked in under `docs/parser-cutover/`:
  - `example_corpus_report.json` records the supported corpus and current WASM summaries
  - `divergence_ledger.md` records the accepted Lezer-bug exceptions
- Lezer no longer participates in production parsing or correctness-test ownership. Any remaining Lezer references in the repository are historical proposal/archive material or editor-highlighting dependencies, not parser-runtime ownership.

## Addendum 2026-05-23: Rust/WASM Owns Parser, Normalizer, and DSL Output Contracts

Rust/WASM is the only authoritative implementation for parser and normalizer semantics. TypeScript does not own parser skeletons, AST construction, token resolution, duration math, validation, or normalized score behavior.

The post-cleanup production parser flow is:

```
Source -> Rust parser WASM -> native parser AST JSON
Source -> Rust parser + normalizer WASM -> NormalizedScore JSON
```

`--format ast` is a parser contract, not a normalized-score compatibility dump. It outputs a native Rust parser AST envelope with `version: "drummark-parser-ast/v1"` and `errors: ParseError[]`. It must not require `NormalizedScore.ast`, `src/wasm/skeleton.ts`, old `DocumentSkeleton` types, or TypeScript AST builders.

MusicXML generation is Rust-owned. The exporter consumes Rust normalized semantics and is exposed to TypeScript as source-based WASM output:

```ts
type MusicXmlOutput = {
  xml: string;
  errors: ParseError[];
};
```

TypeScript may contain WASM loaders, app adapters, renderer adapters, CLI glue, and output wrappers only when they consume Rust-owned parser or normalized contracts. It must not reimplement parser, AST, token-resolution, duration, or normalization semantics.

The legacy TypeScript DSL files are removal targets:

- `src/dsl/parser.ts`
- `src/dsl/ast.ts`
- `src/dsl/logic.ts`
- `src/wasm/skeleton.ts`

The public TypeScript DSL surface should expose normalized runtime contracts and WASM-backed functions only. Legacy exports such as `buildScoreAst`, `parseDocumentSkeleton`, `parseDocumentSkeletonFromWasmSync`, regex-backed normalizer parity functions, `DocumentSkeleton`, `TokenGlyph`, `ParsedMeasure`, and `ScoreAst` are not supported production APIs.

Before deleting legacy tests, each old TypeScript parser/AST/logic/parity/benchmark test must be mapped to replacement Rust coverage, TypeScript WASM-boundary coverage, CLI coverage, MusicXML golden coverage, or an explicit obsolete-contract deletion rationale. MusicXML migration must use frozen golden outputs captured before the Rust exporter replacement so behavior drift is visible and reviewable.
