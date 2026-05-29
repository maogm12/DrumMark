# Layout / Parser Magic Number Cleanup

## Status

draft

## Problem

`drummark-layout`（以及边界上的 `LayoutOptions` / TS 映射）里仍有大量裸数字：有的已是 `const` 但未归组，有的与 `scene.rs` 绘制坐标重复，有的写死 `7.5` 而运行时用 `opts.staff_space_pt`，有的应随 `staff_space_pt` 缩放却仍用固定 pt。`drummark-core`（parser/lexer）数字较少，主要是语义常量与 lexer 优先级，风险低。

这导致：

- 改 multirest / 前导区 / 小节线留白时要改多处（如 `SystemStartReservation` vs `margin + 35`）。
- CLI 默认 `staff_space_pt = 7.5`、App 默认 `10.0`、`StaffSpace::default = 8.0` 三套基准不一致。
- 难以判断某个数是否应暴露给用户。

## Goal

建立**单一来源**的数字分层，并分阶段替换 magic number，不改变默认视觉（除非修复明显不一致，如 planning 里写死 `7.5`）。

完成后应满足：

1. 每个 pt 常量有模块级命名、`///` 说明「相对谁、影响什么」。
2. 用户可调项只通过 `LayoutOptions` + `renderOptions.ts` + `useAppSettings` 暴露；其余为 `const` 或由 `staff_space_pt` / glyph metrics 推导。
3. `scene.rs` 前导区 X 与 `planning.rs` 预留宽度由同一 helper 生成。
4. Parser 仅整理语义常量与注释，不引入布局 option。

## Non-goals

- 不修改 DRUMMARK 语法或 RenderScore 字段。
- 不把 Bravura SMuFL bbox 表改成运行时加载（保持 `metrics.rs` 数据 + 注释）。
- 不在本变更中一次性暴露 50+ 个 UI 滑块；先收敛常量与推导，再按需开放 option。
- 不重写 `compat_planning` 整条分页路径（仅顺带对齐明显重复数字）。

## Workflow

- **类型**：Normal Change（内部 refactor，无 spec delta）。
- **建议路径**：分 4 个 PR/task 提交，每 task 后 golden / `npm run drummark` 回归。

## Inventory Summary

| 区域 | 典型裸数字 | 文件 |
|------|-----------|------|
| 小节/系统规划 | `14`, `8`, `18`, `22`, `25`, `35`, `5`, `0.1`, `100`, `7.5` | `planning.rs`, `compat_planning.rs`, `scene.rs` |
| 前导区绘制 | `margin+5`, `margin+35`, `margin+9`, `+8`, `+6` | `scene.rs`（与 reservation 重复） |
| 音符/engraving | `7`, `8`, `12`, `18`, `23`, `STAFF_SPACE_STEP_PT=10` | `engraving/notes.rs`, `beams.rs`, `tuplets.rs` |
| 结构层 | `14`, `28`, `60`, `4`, `6`, `10` | `structural/spans.rs`, `stacking.rs` |
| 字号比例 | `* 3.0`, `* 4.0`, `2.933333` | `lib.rs`（`notation_render_font_pt` 等） |
| 默认值 | `612`, `792`, `7.5` vs UI `10` | `options.rs`, `renderOptions.ts`, `useAppSettings.ts` |
| Parser | `priority = 0`, 支持的分母集合, multi-rest default `2` | `lexer.rs`, `parser.rs` |

## Classification

### A. 应保持为 `LayoutOptions`（已有或建议新增）

已有且应继续走 option（TS 侧已有 ranges 的保持同步）：

| 字段 | 默认 | 说明 |
|------|------|------|
| `staff_space_pt` | 7.5 (Rust) / 10 (App 历史) | **首要基准**；所有 ss 倍率应引用它 |
| `px_per_quarter` | 80 | 小节宽度估算 |
| `stem_len_pt` | 23 | 符干长度 |
| `system_spacing_pt` | 30 | 系统间距（叠加在系统块高度上） |
| `duration_spacing_compression` | 0.6 | 事件密度 |
| `measure_width_compression` | 0.75 | 行宽压缩 |
| 页边距 / header / 各 `*_offset_y` | 见 `options.rs` | 用户已在 Settings 调 |

**建议新增 option（第二批，可选）** — 仅当验证有调参需求再暴露：

| 建议名 | 默认 | 理由 |
|--------|------|------|
| `compact_measure_edge_gap_pt` | 8 | multirest / compact 与小节线对称边距（刚修过） |
| `multi_rest_inner_pad_ratio` | 0.1 | multirest 横条内缩比例 |
| `multi_rest_inner_pad_min_pt` | 8 | multirest 最小内缩 |
| `preamble_trailing_gap_pt` | 8 | 普通音符相对拍号后的空隙（`SYSTEM_PREAMBLE_TRAILING_CONTENT_GAP_PT`） |

**不建议暴露为 option（ engraving 微调 ）**：`DOT_PAD_PT`, `BEAM_THICKNESS_PT`, `FLAM_SLASH_*`, hairpin `1.2` stroke 等 — 保持 const，最多随 `staff_space_pt` 缩放。

### B. 应提升为命名 `const`（固定 pt 或比例，非用户调）

集中到 `crates/drummark-layout/src/constants/`（或按域拆分）：

**`planning_constants.rs`（小节几何）**

- 已有：`MEASURE_RIGHT_PAD_PT`, `NON_INITIAL_MEASURE_LEFT_PAD_PT`, `COMPACT_MEASURE_EDGE_GAP_PT`, …
- 待收拢：`SystemStartReservation` 内 `25/18/24` → 见 C 节推导后仍可作为 fallback const
- `finalize_planned_system` 的 `available_width.max(100.0)` → `MIN_SYSTEM_AVAILABLE_WIDTH_PT`
- multirest：`0.1`, `8.0` → `MULTI_REST_INNER_PAD_RATIO`, `MULTI_REST_INNER_PAD_MIN_PT`
- 宽度估算 bonus：`0.15`, `0.1`, `sticking_count >= 3` → `TUPLET_WIDTH_BONUS`, `STICKING_DENSITY_BONUS_THRESHOLD`

**`scene_constants.rs`（页面/前导）**

- 标题区：`18.0`, `12.0`（title/subtitle/composer 垂直间距）
- 系统块：`100.0` → `SYSTEM_BLOCK_BASE_HEIGHT_PT` 或改为 `staff_space_pt * 5.0 + fixed_gap`（五线谱高度 + 余量）
- 速度标记：`tempo_glyph_x = margin + 9`, `+8`, `+6` → `TEMPO_GLYPH_MARGIN_OFFSET_PT` 等
-  staff 线 `stroke_width: 1.0` → `STAFF_LINE_STROKE_PT`

**`engraving_constants.rs`**

- 迁移 `notes.rs` 顶部已有 const 块（`BEAM_THICKNESS_PT`, `NOTE_X_OFFSET_PT`, …）
- `tuplets.rs`：`30.0`, `12.0`, `8.0`, `16.0`, `5.0`
- `barlines.rs`：`4.0`（final/double 左移）→ `FINAL_BARLINE_LEFT_OFFSET_PT`

**`structural_constants.rs`**

- `spans.rs`：`NAV_GAP`, `HAIRPIN_*`, `measure.x + 14` / `width - 28` → `MEASURE_INNER_HORIZONTAL_PAD_PT`（=14）与 `2 * pad`
- `volta`：`60.0`, `+5.0`, `+2.0`

**`compat_planning.rs`**

- `40.0` compact 宽度、`30+40` 光标、`1.15` density → 命名并注释与 `SlotMapper` 关系

### C. 应由 `staff_space_pt` / metrics **推导**

| 当前写法 | 目标 |
|----------|------|
| `planning.rs` 传 `7.5` 给 `measure_left_pad` / `measure_right_pad` | 一律 `opts.staff_space_pt` |
| `STAFF_SPACE_STEP_PT = 10.0` | `staff_space_pt`（或 `staff_space_pt * STAFF_LINE_SPACING_RATIO`） |
| `s_bot = sy + staff_ss * 5.0`, `s_mid = sy + staff_ss * 3.0` | `STAFF_LINE_COUNT`, `STAFF_MIDDLE_LINE_INDEX` const |
| `notation_render_font_pt(ss) = ss * 3.0` 等 | 保留函数，系数收为 `const` 比例（如 `NOTATION_FONT_STAFF_SPACES: f32 = 3.0`） |
| `SystemStartReservation { clef_width: 25, ... }` | 由 `margin + offset` 与 `rendered_glyph_width` / `average_advance_pt` 计算，与 `compact_measure_preamble_end_x` 共用 |
| `scene.rs` `margin + 5`, `margin + 35` | `fn preamble_clef_x(margin) -> f32` 等，宽度来自 metrics |
| `structural/spans.rs` 多处 `font_size_pt / 4.0` | 已有 `glyph_position_pt` / `SVG_POINT_TO_USER_UNIT`，统一调用 |
| `sys_y += 100.0 + system_spacing` | `staff_ss * (STAFF_LINES - 1) + header_clearance + system_spacing` |
| Tuplets `staff_top - 30.0` | `staff_space_pt * TUPLET_BRACKET_OFFSET_SS` |

**`StaffSpace` 结构**：`pt_per_ss: 8.0` 与 `LayoutOptions.staff_space_pt: 7.5` 冲突 — 二选一作为真源，或 `StaffSpace::from_layout(opts)` 废弃独立 default。

### D. 仅加注释（不改值）

| 位置 | 说明 |
|------|------|
| `metrics.rs` glyph bbox 数组 | SMuFL/Bravura 归一化 bbox，非 magic |
| `planning.rs` `4.0 / beat_unit`, `log2` 压缩 | 节奏宽度算法；注明对标 VexFlow |
| `segment_offsets` 用 `0.5` | 段内居中锚点 |
| `lexer.rs` `priority = 0` | 消解 token/regex 冲突，附链接到 logos 规则 |
| `parser.rs` `is_supported_note_denominator` | MusicXML/记谱惯例集合 |
| `SVG_POINT_TO_USER_UNIT` | SVG user unit 与 pt 换算 |
| `CHORD_DISPLACE_EPSILON` | 碰撞检测浮点容差 |

### E. Parser（`drummark-core`）— 小范围

| 项 | 分类 |
|----|------|
| `try_scan_multi_rest` default count `2` | `const MULTI_REST_MIN_COUNT` 或文档说明语法 |
| `priority = 0` on regex | 注释 |
| 测试里的 `120`, column 号 | 不动 |

**不把 parser 数字并入 `LayoutOptions`。**

### F. 跨层 / WASM / TS 对齐任务

| 问题 | 行动 |
|------|------|
| Rust `LayoutOptions::default().staff_space_pt = 7.5` vs App `10.0` | 文档化差异原因；长期统一默认或通过 WASM 传参单一化 |
| `buildLayoutOptions` / `renderOptions.ts` | 映射表与 Rust 字段一一对应，避免 TS-only magic |
| 改 const 后 | 更新 layout corpus golden、`docs/examples/*.svg` |

## Current Plan（分阶段）

### Phase 1 — 基准与明显 bug（低风险）

1. 新增 `layout/constants/mod.rs` 骨架，先迁入 `planning.rs` 已有 pub const。
2. `finalize_planned_system` / `plan_scene_systems`：所有 `7.5` → `opts.staff_space_pt`。
3. multirest 的 `0.1` / `8.0` 命名 const。
4. 统一 `StaffSpace` 与 `staff_space_pt` 文档说明。

**验收**：`cargo test -p drummark-layout`；`staff_space_pt=10` 时 multirest/反复号位置仍合理。

### Phase 2 — 前导区单一来源（中风险，高价值）

1. 实现 `PreambleLayout { clef_x, time_sig_x, clef_end_x, time_sig_end_x, reservation_width }` 由 metrics + margin 算出。
2. `SystemStartReservation::width()` 改为使用 `PreambleLayout`（消除 `25/18/24` 与 `5/35` 双轨）。
3. `scene.rs` 绘制 clef/ts/tempo 调用同一 helper。
4. `compact_measure_inner_left` 已用 glyph end — 改为调用 `preamble_end_x()`。

**验收**：multirest / `docs/examples/multi-rest.drum` / 用户行 `| -- 8 -- | % | ...` SVG 无回归；`test_header_height_and_gap_match_ts_system_start_semantics` 更新断言。

### Phase 3 — Engraving & structural 常量化 + ss 缩放（中风险）

1. `engraving/constants.rs` 收拢 `notes.rs` const；`STAFF_SPACE_STEP_PT` → `staff_space_pt`。
2. `structural/constants.rs`：`MEASURE_INNER_HORIZONTAL_PAD_PT = 14` 替换 `14`/`28` 散布。
3. Tuplets / beams / hairpin 偏移改为 `staff_space_pt` 倍率（保留比例 const）。
4. `compat_planning` 魔法数命名 + 注释。

**验收**：corpus gate + 关键 layout tests；视觉 diff 审查 3–5 个代表例。

### Phase 4 — Options 扩展（可选，需产品确认）

1. 评估是否将 `compact_measure_edge_gap_pt` 等 3 项加入 `LayoutOptions` + Settings。
2. 若加入：i18n 标签、WASM 序列化、`SETTINGS_RANGES`。

**验收**：Settings 调节后 multirest 边距变化可观察。

### Phase 5 — Parser 注释与语义 const（低风险）

1. `drummark-core/src/parser_constants.rs`（或 `lexer.rs` 顶部）收拢。
2. 补充 lexer priority / multi-rest 注释。

## Tasks

### Task 1: Constants module + 7.5 elimination

Status: Pending

Scope: `planning.rs`, `options.rs`, `lib.rs` (`StaffSpace`), new `constants/`

Action:
- 建 `constants/mod.rs`，导出 planning + multirest 命名常量。
- 替换 `finalize_planned_system` 中 `7.5` 为 `opts.staff_space_pt`。

Acceptance:
- 全量 `drummark-layout` 测试通过；无新增 public API。

Verification:
- `cargo test -p drummark-layout`

### Task 2: Preamble single source of truth

Status: Pending

Scope: `planning.rs`, `scene.rs`, tests in `lib.rs`

Action:
- 实现 `PreambleLayout` helper；统一 reservation 与 `margin+N` 坐标。

Acceptance:
- clef/ts X 与 `measure_left_pad` 一致；multirest 第一小节位置不变（golden）。

Verification:
- `npm run drummark -- docs/examples/multi-rest.drum --format svg`
- 相关 unit tests

### Task 3: Engraving/structural const + staff-space scaling

Status: Pending

Scope: `engraving/*`, `structural/spans.rs`, `notes.rs` `STAFF_SPACE_STEP_PT`

Action:
- 迁移 const；ss 缩放；替换 `14`/`28` 为命名 pad。

Acceptance:
- corpus gate 通过或 intentional golden 更新记录在 task commit。

Verification:
- `npm test` layout/corpus tests

### Task 4: (Optional) LayoutOptions + UI for compact/multirest gaps

Status: Pending

Scope: `options.rs`, `renderOptions.ts`, Settings, WASM

Dependencies: Task 2

Action:
- 仅当产品确认后暴露 2–4 个新 option。

Acceptance:
- TS/Rust 默认值一致；Settings 可调。

### Task 5: Parser documentation pass

Status: Pending

Scope: `drummark-core/src/lexer.rs`, `parser.rs`

Action:
- 语义 const + 注释；无行为变更。

Acceptance:
- `cargo test -p drummark-core`

## Risks

- **Preamble 对齐**：metrics `average_advance_pt` 与视觉 bbox 可能有 1–2pt 误差，需 golden 容差。
- **默认 staff space 不一致**：Phase 1 不应擅自改 App 默认 10；单独 ADR/产品决策。
- **compat_planning**：老路径仍被部分测试使用，改动需双路径验证。

## Linked Items

N/A

## Decisions (2026-05-29)

1. **Staff space 默认与范围**：Rust `LayoutOptions`、TS `DEFAULT_RENDER_OPTIONS`、App `defaultSettings` 统一为 **5.0 pt**；Settings / CLI 范围为 **1–10**（App 步进控件 `min=10 max=100` 表示 ×0.1）。
2. **系统纵向步进**：`sys_y += 100.0` 改为 `staff_bounding_height_pt(staff_ss) + system_spacing_pt`（`STAFF_LINE_COUNT = 5`）。
3. **Compact / multirest 边距**：保持 **const**（`COMPACT_MEASURE_EDGE_GAP_PT` 等），**不**新增 Settings；Phase 4（UI option）取消。

### Phase 1 已落地（本批）

- [x] `staff_space_pt` 默认 5.0 + TS/App/CLI 对齐
- [x] `staff_bounding_height_pt` + `sys_y` 修正
- [x] `finalize_planned_system` 使用 `opts.staff_space_pt` 替代硬编码 `7.5`
- [ ] constants 模块骨架（待做）
- [ ] Preamble 单一来源（待做）
