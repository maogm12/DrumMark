# Example Corpus Divergence Ledger

This ledger records the final checked-in example-corpus divergences that were accepted during the Lezer cutover.

## 2026-05-13

### 1. `docs/examples/groups.drum`
- Observed difference: the Rust/WASM path parses the nested tuplet line `SD | - - [3: d [2: d d d] d] - - - |` structurally and reports only semantic grouping/timing errors. The Lezer path emits extra `Unknown token` diagnostics on the same line and fails to represent the nested group correctly.
- Spec/rationale: nested groups are part of the grammar-owned surface syntax; they should be parsed structurally before timing validation. Emitting tokenization-style unknown-token errors for `[3:` / `[2:` is not spec-correct behavior.
- Disposition: `Lezer bug; WASM kept`

### 2. `docs/examples/repeats.drum`
- Observed difference: the Rust/WASM path preserves the third ending opened by `| 3.` in the second paragraph. The Lezer path drops the `volta.indices = [3]` marking from that measure in normalized IR.
- Spec/rationale: `| N.` opens an alternate ending on the immediately following measure. The third ending in the example is explicit source syntax, so the measure must retain `volta.indices = [3]`.
- Disposition: `Lezer bug; WASM kept`

### 3. `examples/李白-李荣浩.drum`
- Observed difference: after correcting the obvious example typo `d*+d3*` -> `d*+t3*`, the remaining WASM-vs-Lezer IR difference is the same ending-boundary issue as `docs/examples/repeats.drum`: Lezer drops a later `|3.` alternate-ending marker while Rust/WASM preserves it.
- Spec/rationale: the compact `:|3.` form still starts a new third ending on the following measure. Losing that `volta.indices = [3]` state is a parser ownership bug on the Lezer side, not a valid semantic alternative.
- Disposition: `Lezer bug; WASM kept`

### 4. `docs/examples/hairpins.drum`
- Observed difference: the Rust/WASM path extracts the hairpin embedded in `HH | < x x x x ! - - - |` into normalized `hairpins` intent and emits no errors. The legacy regex/Lezer-owned path drops that hairpin intent and instead reports three semantic errors against the same example.
- Spec/rationale: hairpin markers are measure-level musical intent, not illegal duration-bearing tokens. The example is part of the supported docs corpus and should normalize without fabricated validation failures.
- Disposition: `Lezer bug; WASM kept`

### 5. `docs/examples/full-example.drum`
- Observed difference: both parsers agree on normalized measures and on the presence of the paragraph measure-count mismatch in the coda section, but the legacy regex/Lezer-owned path reports that mismatch on line 38 while Rust/WASM reports line 39.
- Spec/rationale: line 38 is a comment-only line (`# Coda — breakdown with measure repeats`); the actual offending paragraph starts on line 39 with `HH | @coda x - x - x - x - |`. Rust/WASM keeps the diagnostic anchored to the first real track line in the mismatched paragraph, which is the user-visible location that matches the source.
- Disposition: `Lezer bug; WASM kept`
