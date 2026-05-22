# RENDER_LAYOUT_CONTRACT_proposal_rest_placement.md

## Addendum v1.0: Collision-Aware Rest Placement

### Motivation

当前 `drummark-layout` 的休止符布局存在三个结构性问题：

1. `render_slot_group()` 对休止符使用固定的垂直位置：voice 1 为 `staff_top + 20.0`，voice 2 为 `staff_top + 30.0`。这等价于“按声部写死两条 Y 线”，不是布局算法。
2. 同一节拍槽如果既有音符又有休止符，休止符只会继承该槽的 X 中心，不会检查 notehead、stem、beam、accent 是否与自身碰撞。
3. `render_score` 已经把休止符按分组边界和时值拆成可布局事件；如果 layout 仍然只给固定 Y，那么节奏拆分越精细，碰撞暴露得越明显。

这类问题应由 `RenderScore -> LayoutScene` 链路中的 `drummark-layout` 解决，而不是由 SVG adapter 补丁式挪动。

### Current Findings

- 休止符事件来源于 `crates/drummark-core/src/render_score.rs`：
  - 缺口会按 active voice 自动补休止符。
  - 休止符会按 grouping boundary 切分。
  - 切分后的跨度会进一步按 whole / half / quarter / eighth / sixteenth / thirty-second primitive 分解。
- 休止符绘制位于 `crates/drummark-layout/src/lib.rs` 的 `render_slot_group()`：
  - X 位置已经能与同槽命中共享视觉中心。
  - Y 位置仍是固定值，没有碰撞模型。
- 当前回归只覆盖了“slot center 对齐”，尚未覆盖“休止符与同槽 notehead / stem / accent 的垂直避让”。

### Contract

本 addendum 为 `RenderScore -> LayoutScene` 增加以下休止符布局约束：

- 休止符的水平锚点仍然由节奏槽中心决定。
- 休止符的垂直位置必须由 layout engine 根据同槽可见对象自动求解，而不是 adapter 侧补偿。
- whole-measure rest 仍保持现有语义：如果一个小节整体无声，voice 1 生成一个整小节休止符，并保持与第一拍栅格对齐。
- 当一个槽位同时存在休止符与命中事件时，休止符可以在一组 canonical lane 中上下移动，但不能改变其节奏锚点。
- 当两个声部在同槽都含休止符且未隐藏 voice 2 rests 时，两个休止符必须被当作两个独立对象求解，后放置的休止符要避开先放置的休止符。

### Design

#### 1. Slot-Local Obstacle Model

新增仅由 layout 使用的临时模型：

```rust
struct SlotObstacle {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
    kind: SlotObstacleKind,
}
```

`SlotObstacle` 不进入 `RenderScore` 或 `LayoutScene` 合同，只在 `render_slot_group()` 内部使用。其来源包括：

- notehead bbox
- ledger line bbox
- resolved stem segment bbox
- beam anchor 推导出的 beam bbox
- accent bbox
- 已经放置完成的 rest bbox

该模型保证“休止符是否碰撞”由统一几何判断决定，而不是分散在若干 if/else 中。

#### 2. Canonical Rest Lanes

在 staff-space 坐标上为每个声部定义优先候选位置序列，而不是单一固定 Y：

- voice 1 首选围绕 middle line 上方展开
- voice 2 首选围绕 middle line 下方展开

建议的首版序列：

```text
voice 1: 2.0, 1.5, 2.5, 1.0, 3.0, 0.5, 3.5
voice 2: 3.0, 3.5, 2.5, 4.0, 2.0, 4.5, 1.5
```

这些值表示从 `staff_top` 起算的 staff-space 位置，最终仍转换为现有 pt 坐标体系。

设计目标不是“永远居中”，而是：

- 单声部普通休止符尽量保持传统阅读习惯。
- 与同槽命中冲突时，只在有限、可预测的 lane 中移动。
- 不把休止符推到极端高/低位置，避免新的可读性问题。

#### 3. Candidate Evaluation

新增求解函数：

```rust
fn resolve_rest_lane(
    rest: &SlotEvent<'_>,
    note_center_x: f32,
    obstacles: &[SlotObstacle],
    occupied_rests: &[SlotObstacle],
    staff_top: f32,
) -> ResolvedRestPlacement
```

求解流程：

1. 根据休止符时值取得 glyph metric，构造每个候选 lane 对应的 rest bbox。
2. 按候选序列顺序检查 bbox 是否与 `obstacles` 或 `occupied_rests` 相交。
3. 选择第一个“无碰撞”候选。
4. 如果所有候选都碰撞，则选择 overlap 面积最小、且离默认 lane 最近的候选，并向 `LayoutScene.issues` 追加非致命 warning。

这里的“智能”定义为：

- 优先无碰撞
- 其次尽量少偏离规范默认位置
- 在两个同分值候选间，优先远离对向声部命中密集区域

#### 4. Rendering Order Inside a Slot

`render_slot_group()` 的内部顺序调整为：

1. 渲染并记录 hit cluster
2. 预解析 stem / beam / accent 占用框
3. 逐个求解并渲染 rests
4. 再输出 stem 与 accent 图元

注意：休止符求解依赖命中几何，但不要求 stem/beam 图元先发射到 scene。几何求解与 scene emission 解耦。

#### 5. Special Cases

##### Pure-Rest Slot

如果一个槽位只有休止符，没有命中事件：

- 继续使用现有 X 回退逻辑。
- Y 改为 lane solver 的默认首选位置。
- 同槽多个 rests 仍需互相避让。

##### Whole-Measure Rest

整小节休止符继续遵守当前行为：

- X 与第一拍节奏栅格对齐。
- 默认使用 voice 1 canonical lane。
- 仅在该位置与结构元素发生真实碰撞时才允许向相邻 lane 挪动。

##### `hide_voice2_rests`

如果 `hide_voice2_rests` 为 true：

- voice 2 rests 在求解前直接跳过。
- 被隐藏的 rest 不占用 obstacle 空间。
- voice 1 的求解结果不得依赖“本来会被隐藏”的 voice 2 rest。

### Scope

受影响模块：

- `crates/drummark-layout/src/lib.rs`
  - `render_slot_group()`
  - 休止符 bbox / lane / collision helper
  - 相关 scene/layout tests
- `docs/RENDER_LAYOUT_CONTRACT.md`
  - 批准后追加最终 addendum

不在本提案范围内：

- parser / lexer / DSL 语法
- rest 时值分解规则
- SVG adapter 几何补偿
- MusicXML export
- 新的用户设置项

### Acceptance Criteria

1. 同槽 rest + hit 场景下，休止符不与同槽 notehead 相交。
2. 对于带符干和波束的同槽命中，休止符不会落在 stem / beam 占用区内。
3. `hide_voice2_rests` 开启时，不会因为被隐藏的 voice 2 rests 改变可见 rest 的位置。
4. 纯休止符槽与整小节休止符继续保持节奏中心对齐。
5. 现有 `test_silent_measure_rest_aligns_with_first_beat_grid` 与 `test_alternating_two_voice_rests_share_slot_centers_with_opposite_voice_hits` 继续通过。
6. 新增至少一个“同槽 accent + rest”回归测试和一个“双声部同槽 rests”回归测试。
7. `npm run drummark -- docs/examples/basic.drum --format svg` 与相关 Rust/TS test suite 通过。

### Review Status

Sub-agent review is still required by repository policy before implementation begins. This turn prepares the addendum text only.

### Review Round 1

1. **Beam obstacle modeling is not compatible with the current rendering pipeline as written.**  
   The addendum says `render_slot_group()` should pre-resolve a “beam bbox” from beam anchors, but the current code does not know final beam geometry at that point. In `crates/drummark-layout/src/lib.rs`, `render_slot_group()` only collects `BeamAnchor`s; the actual beam slope, final beam path, partial-beam stubs, and non-leading stem-tip adjustments are computed later in `render_beam_groups()`. That means an anchor-derived bbox inside a single slot is only provisional and can disagree with the final beam envelope. The proposal needs to choose one of these explicitly:
   - narrow the contract so rest avoidance is guaranteed only against noteheads, ledger lines, stems, accents, and any **finalized same-slot** geometry, while beamed runs use a weaker provisional rule; or
   - add a real prepass that computes final beam geometry for each beam group before any rest lane solving occurs.
   “Beam anchor 推导出的 beam bbox” is too underspecified to implement safely against the current code.

2. **The lane coordinates are ambiguous because the spec does not define what point of the rest glyph is aligned to the lane.**  
   Current rest emission uses `sink.push_glyph_item(... y: rest_y ...)`, where `y` is the glyph origin, not the bbox center. But the proposal’s lane values (`2.0`, `1.5`, `3.0`, etc.) are described only as “从 `staff_top` 起算的 staff-space 位置”. That is not enough because whole, half, quarter, and flagged rests have different vertical bbox extents in the canonical metrics. The addendum must define whether a lane refers to:
   - glyph origin,
   - glyph bbox center,
   - a specific visual anchor per rest class, or
   - a staff-line attachment rule per duration family.
   Without this invariant, two implementers can satisfy the same lane list and still produce visibly different output.

3. **The proposal introduces rest-vs-rest avoidance but does not define deterministic placement order.**  
   It says “后放置的休止符要避开先放置的休止符”, but does not define who is first. Today, slot events are sorted by start, then voice, then `staff_y_for_track()`. For rests, that means the effective order can still be coupled to the chosen fallback track and current event ordering rather than a musical rule. The addendum should explicitly define a stable solving order for same-slot rests, for example:
   - always solve voice 1 before voice 2 when both are visible, then preserve source order within a voice; or
   - solve by canonical lane priority independent of track metadata.
   If this is left implicit, the same `RenderScore` can drift when unrelated track-selection logic changes in `render_score.rs`.

4. **The proposal assumes warning emission infrastructure that is not actually local to `render_slot_group()`.**  
   Step 4 of `resolve_rest_lane()` says a full-collision fallback should append a non-fatal warning to `LayoutScene.issues`. That is reasonable, but the current slot renderer does not receive an issue sink; `LayoutScene.issues` is assembled at a higher layer and currently populated from parser errors, pagination warnings, and scene validation. The addendum should specify the plumbing contract needed here:
   - either `render_slot_group()` (or its caller) gains a mutable issue collector, or
   - the warning requirement is downgraded from normative contract to implementation suggestion.
   Also define whether the warning text/shape is testable or intentionally non-normative.

5. **The X/Y obstacle model needs to bind to finalized note placement, not the current “first note placement” shortcut.**  
   The proposal correctly identifies noteheads and ledger lines as obstacles, but it does not call out a current coupling that must be broken: `render_slot_group()` derives `slot_hit_center_x` from the first `NotePlacement` it finds. That is only a heuristic. In the existing code, same-voice adjacent noteheads can be horizontally displaced, ledger lines inherit the displaced `note_x`, and stems attach to the displaced chord geometry. The addendum should require that rest solving consume the finalized `NotePlacement` set (plus derived ledger/stem/accent geometry) rather than a single representative center. Otherwise the implementation can “pass” the proposal while still colliding with displaced chords.

6. **Acceptance coverage is missing the hardest cross-slot case created by the current beam pass.**  
   The proposed tests cover same-slot notehead, accent, and dual-rest cases, but not a beamed run where the final beam slope is decided using anchors from neighboring slots. Add at least one regression where:
   - a rest shares a slot with a beamed hit, and
   - the same beam group continues into another slot so the final beam angle is not horizontal by construction.
   That is the case most likely to fail if the implementation relies on provisional beam geometry.

STATUS: CHANGES_REQUESTED

### Review Round 3

The remaining Round 2 blockers are now resolved.

1. **Same-slot rest ordering is now defined in terms of observable layout-time data.**  
   Replacing “source event order” with `voice`, `duration`, `staff_y_for_track(track)`, `track`, and finally existing slot-slice order removes the unrecoverable-source-order problem. Those keys are all available inside the current `drummark-layout` pipeline, and the final fallback to existing slot-slice order is acceptable because it is now explicitly subordinate to deterministic musical/layout keys rather than pretending to recover authorial source order.

2. **The conservative same-slot beam envelope now has a reviewable geometric floor.**  
   The new invariant is narrow, but it is concrete enough: isolated beamable notes must protect the stem tip plus the renderer-equivalent flag reach, and multi-slot beam participants must protect at least the local stem tip plus the beam-thickness budget for that stem direction. That is sufficient to prevent vacuous “tiny envelope” implementations while still respecting the current two-pass beam architecture.

I do not see any remaining critical ambiguity that would block task planning. The proposal now scopes its guarantees honestly against the existing code and defines the key invariants tightly enough to implement and test.

STATUS: APPROVED

### Consolidated Changes

The approved design keeps rest rhythm anchoring unchanged and moves only vertical rest placement into a collision-aware layout algorithm inside `drummark-layout`.

Approved requirements:

- Rest X placement continues to follow the resolved rhythmic slot center.
- Rest Y placement must be solved in layout from slot-local geometry, not adapter nudging.
- Solver inputs come from finalized hit-cluster geometry: displaced noteheads plus derived ledger-line, stem, accent, and previously placed-rest obstacle boxes.
- Beam handling in phase 1 is conservative by contract:
  - same-slot obstacle solving must protect a reviewable local beam/flag envelope floor
  - exact final cross-slot beam polygons are not required before rest solving
  - continued-beam regressions are mandatory because they are the main risk surface
- Canonical rest lanes are defined against the rest glyph bbox center, not glyph origin.
- When more than one visible rest shares a slot, placement order is deterministic and defined entirely in layout-visible fields:
  1. `voice` ascending
  2. `duration` descending
  3. `staff_y_for_track(track)` ascending
  4. `track` string ascending
  5. existing order in the already-sorted slot slice only as the final tie-break
- If all candidate lanes collide, the resolver returns structured fallback/diagnostic metadata; scene issue emission is handled by the caller that already assembles `LayoutScene.issues`.
- Existing semantics for pure-rest slots, whole-measure rests, and `hide_voice2_rests` must remain intact.

### Author Response

1. Accepted. “stable source event order” was too abstract for the current pipeline because `slot_group` is already a derived, sorted structure. The ordering rule is now restated in terms of observable `RenderScore` data available at layout time.
2. Accepted. The conservative same-slot beam envelope needs a minimum geometric floor. The revision adds a reviewable lower bound so implementations cannot claim compliance while protecting arbitrarily small areas.

## Addendum v1.2: Ordering and Beam-Envelope Clarifications

This section further tightens Addendum v1.1.

### Observable Same-Slot Rest Ordering

When more than one visible rest appears in the same slot, solve them in this deterministic order after `hide_voice2_rests` filtering:

1. `voice` ascending
2. `duration` descending
3. `staff_y_for_track(track)` ascending
4. `track` string ascending

If two rests are still identical after these keys, preserve their existing order in the already-sorted slot slice. This rule is defined entirely in terms of data already visible to `drummark-layout`; it does not depend on unrecoverable source text order.

### Minimum Conservative Beam-Envelope Invariant

For phase-1 obstacle solving, the conservative same-slot beam envelope must satisfy these minimum invariants:

- For an isolated beamable note that would render with flags if unbeamed, the protected envelope must fully cover the local stem tip and the flag-side vertical reach that the current renderer would occupy on that side.
- For a note participating in a multi-slot beam group, the protected envelope must at minimum cover the local stem tip plus the beam-side thickness budget used by `render_beam_groups()` for that slot's stem direction.
- The envelope may over-approximate, but it may not under-approximate those local occupied regions.

This addendum still does not require exact final cross-slot beam polygons before rest solving; it requires a conservative local floor that is reviewable and testable.

### Author Response

1. Accepted. The first draft overstated beam avoidance. In the current pipeline `render_slot_group()` only knows same-slot note placements plus provisional beam anchors; final beam geometry is resolved later in `render_beam_groups()`. The proposal is revised so phase 1 guarantees collision avoidance against finalized same-slot noteheads, ledger lines, stems, accents, and a conservative same-slot beam envelope derived from the slot's own beam/stem data. Cross-slot final beam slope remains an explicit regression target, not an unstated guarantee.
2. Accepted. Lane coordinates need a glyph anchor invariant. The revision defines each canonical rest lane in terms of the rest glyph bbox vertical center, not glyph origin.
3. Accepted. The solver now requires deterministic same-slot rest ordering: after `hide_voice2_rests` filtering, solve visible rests by voice number ascending, then by stable source event order within the voice.
4. Accepted. Warning emission must be plumbed explicitly. The revision moves this from an implicit side effect in `render_slot_group()` to an explicit diagnostic result returned by the resolver/integration layer, which the caller may append into `LayoutScene.issues`.
5. Accepted. The obstacle model is now tied to finalized displaced `NotePlacement` geometry and its derived ledger/stem/accent boxes, not a single slot-center proxy.
6. Accepted. The acceptance criteria now include a beamed cross-slot regression where the beam group continues beyond the rest's own slot.

## Addendum v1.1: Clarifications and Superseding Constraints

This section supersedes conflicting details in Addendum v1.0 while preserving its overall direction.

### Beam Avoidance Scope

Phase 1 of smart rest placement guarantees avoidance against finalized same-slot geometry:

- notehead bbox
- ledger line bbox
- stem bbox
- accent bbox
- previously placed rest bbox
- conservative same-slot beam envelope inferred from the slot's own beam/stem context

It does not claim exact avoidance against the final cross-slot beam polygon until the implementation proves that a prepass can derive that geometry before rest solving. Cross-slot beamed runs remain a mandatory regression test because they are the highest-risk implementation trap in the current pipeline.

### Rest Lane Anchor Invariant

Each canonical rest lane value is defined as the vertical position of the rest glyph bbox center in staff-space units, measured from `staff_top`.

That means:

- lane selection is duration-agnostic at the semantic level
- conversion to scene `y` coordinates must offset by the chosen rest glyph's canonical bbox center
- implementations may not interpret the lane as glyph origin or top edge

### Deterministic Same-Slot Rest Ordering

When more than one visible rest appears in the same slot:

1. apply `hide_voice2_rests` filtering first
2. solve visible rests by `voice` ascending
3. within a voice, preserve stable source event order from the slot group

The solver must not derive ordering from fallback track-family heuristics or arbitrary hash / map iteration.

### Finalized Geometry Requirement

Rest obstacle solving must consume finalized displaced note placement data from the hit-cluster planning step:

- actual `NotePlacement` positions after same-voice displacement
- ledger line boxes derived from those final note positions
- stem boxes derived from resolved stem attachment geometry
- accent boxes derived from resolved accent anchors

Using only a representative slot center is insufficient and does not satisfy this contract.

### Diagnostic Plumbing

If every candidate lane collides, the resolver must return structured fallback metadata indicating:

- chosen fallback lane
- whether the fallback was collision-free or best-effort
- whether a non-fatal layout diagnostic should be emitted

The emission of that diagnostic into `LayoutScene.issues` is owned by the caller that already assembles scene issues. `render_slot_group()` itself does not need to mutate the scene issue list directly.

### Additional Acceptance Coverage

In addition to the original acceptance criteria, the implementation must add at least one regression where:

- a rest shares a slot with a beamed hit, and
- that beam group continues into another slot so the final beam slope is not determined by the local slot alone

The test may validate either exact avoidance or the conservative no-overlap envelope promised by the implemented phase, but it must make the beam-handling contract explicit.

### Review Round 2

Most of Round 1 is now resolved. The revision correctly narrows the beam guarantee to same-slot finalized geometry plus a conservative local envelope, defines the lane anchor against the rest glyph bbox center, moves warning emission onto an explicit caller-owned path, and requires the solver to consume finalized displaced note/stem/accent geometry rather than a slot-center proxy. That is materially better and much closer to something implementable against the current `drummark-layout` pipeline.

Two issues still need tightening before I would approve:

1. **“Stable source event order from the slot group” is still not a reliable invariant in the current codebase.**  
   The proposal now says same-slot rests are solved by voice, then by “stable source event order from the slot group.” But `slot_group` is not a source-order structure. In the current layout code it is built from `measure.events`, then re-sorted by start, voice, and `staff_y_for_track()`. Upstream, `render_score.rs` also sorts events by start, kind, duration, and voice. So unless the proposal defines a dedicated tie-breaker that survives those transforms, “source event order” is not a contract the implementation can actually observe. The fix is straightforward: replace this with an order that exists in `RenderScore`, for example “voice ascending, then duration descending, then existing event order within the sorted slot slice,” or add an explicit rest-order field earlier in the pipeline if true source order matters.

2. **The conservative same-slot beam envelope still lacks a minimum geometric definition.**  
   Narrowing the guarantee was the right move, but “conservative same-slot beam envelope inferred from the slot's own beam/stem context” remains too open-ended for review and testing. In this codebase, a single-anchor case becomes a flag, multi-anchor cases become a beam path later, and secondary beams/partial stubs live in a separate pass. The addendum does not need to lock down the full algorithm, but it should define at least one invariant the envelope must satisfy, such as:
   - it must fully cover the local stem tip and any flag geometry for isolated beamable notes, and
   - for a slot participating in a multi-slot beam group, it must over-approximate the vertical span reachable by that slot’s stem tip plus the local beam thickness used by `render_beam_groups()`.
   Without some floor like that, “conservative envelope” is still loose enough that two implementations could both claim compliance while protecting very different areas.

STATUS: CHANGES_REQUESTED
