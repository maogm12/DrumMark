# Grace Modifier Parity History

## 2026-05-31

### Plan Review Skipped

Skip reason: low-risk Normal Change with a narrow bug-fix scope, no public API or DSL syntax changes, and existing focused Rust tests for the affected layout and MusicXML paths.

Plan file: `docs/changes/active/2026-05-31-grace-modifier-parity/plan.md`

### Implementation Review

Reviewer: self-review
Status: APPROVED

Checks:
- Confirmed layout and MusicXML now use the same `drag`-over-`flam` precedence for combined grace modifiers.
- Confirmed drag MusicXML emits two 16th grace notes with primary and secondary beam begin/end tags.
- Confirmed focused Rust tests cover drag beams and combined `flam:drag` behavior.
- Confirmed generated WASM assets were rebuilt after Rust changes.

Verification:
- `git diff --check`
- `cargo test -p drummark-layout grace -- --nocapture`
- `cargo test -p drummark-core musicxml -- --nocapture`
- `npm run wasm:build`
- `npm run drummark -- /tmp/grace-review.drum --format svg`
- `npm run drummark -- /tmp/grace-review.drum --format xml`
- `npm test -- --run src/wasm/parser_layout_parity.test.ts src/renderer/svgSceneAdapter.test.ts`

### Archived

Archived after approved implementation review.

Archive path: `docs/changes/archive/2026/2026-05-31-grace-modifier-parity/`
