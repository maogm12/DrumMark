# DSL Design Review — 2026-04-25

## 概述

本次 review 对标 `DSL_DESIGN.md` 与当前代码实现（VexFlow renderer, `src/dsl/`, `src/vexflow/`），发现 11 处脱节或问题，按严重程度分三类：

| # | 类别 | 问题 |
|---|------|------|
| 1 | ~~**过时引用**~~ | ~~OSMD 相关描述已不适用~~ ✅ DONE — 替换为 VexFlow 5 |
| 2 | **字段缺失** | `ghost`/`drag` modifier 未入文档 ✅ DONE — 已在文档补全 |
| 3 | ~~**架构缺失**~~ | ~~VexFlow renderer 模块未描述~~ ✅ DONE — Architecture 部分已更新为双后端描述 |
| 4 | **一致性** | `DR` track 与 `x`/`X` sugar 规则重叠冲突 |
| 5 | ~~**语义不清**~~ | ~~Repeat expansion (`:|xN`) 的展开行为定义模糊~~ ✅ DONE — `:|xN` 语法从未实现，设计文档也无此描述，无需修改 |
| 6 | ~~**规则矛盾**~~ | ~~`grouping` 与 `divisions` 耦合太紧，且规则描述冗余~~ ✅ DONE — 已删除 "Compatibility with `divisions`" 段落 |
| 7 | ~~**边界不清**~~ | ~~Multi-measure rest `N=1` 的行为未定义~~ ✅ DONE — 文档已更新：`N` 必须 >= 2，`N=1` 是 error |
| 8 | ~~**规则缺失**~~ | ~~Sticking 匹配逻辑（start Fraction vs track）未定义~~ ✅ DONE — 已明确 Matching is based on start position (Fraction)，不依赖 track |
| 9 | ~~**功能缺失**~~ | ~~PDF / page-breaking layout 策略未描述~~ ✅ DONE — 新增 "Rendering Modes" 小节描述连续滚动预览和分页 PDF |
| 10 | ~~**渲染语义**~~ | ~~`flam`/`drag` 在 VexFlow 和 MusicXML 中的具体渲染方式不清~~ ✅ DONE — 已在 Modifier Rules 和 MusicXML Export 部分补全 |
| 11 | ~~**过时 non-goal**~~ | ~~ghost-note parentheses 的 non-goal 状态已改变~~ ✅ DONE — 已从 non-goals 列表删除 |

---

## 问题详述

### 1. OSMD 引用已过时 ✅ DONE

**位置**: Architecture 小节，multiple references

已将 "All score rendering goes through OSMD" 替换为 "All score rendering goes through VexFlow 5"。删除了 OSMD limitations 相关段落。

---

### 2. `ghost` 和 `drag` modifier 未入文档 ✅ DONE

**位置**: "Supported Modifiers" 列表

已在 Modifier Rules 部分补全：
- `flam`: slashed 16th grace note, allowed on SD, T1, T2, T3
- `ghost`: parenthesized circled notehead, allowed on SD, HH, T1, T2, T3
- `drag`: two unsynced 16th grace notes, allowed on SD, HH, T1, T2, T3, RC

MusicXML Export 部分也已将 `ghost` 和 `drag` 加入 export priorities。

---

### 3. VexFlow renderer 模块未描述 ✅ DONE

Architecture 部分已更新：Normalized Events → Renderers，分出 MusicXML Export 和 VexFlow Renderer (preview + PDF) 两个后端。

---

### 4. `DR` track 规则与 `x`/`X` sugar 规则重叠

**位置**: "DR Input Sugar" 和 "Base Tokens" 两处

**问题**:
- "DR Input Sugar" 说 DR 只扩展为 `SD, T1, T2, T3` 的 hit
- "Base Tokens" 又说 `SD, T1, T2, T3, BD` 允许 `x`/`X` 作为 `d:cross`/`D:cross` 的 sugar

两套机制在语义上有重叠，用户容易困惑：什么时候用 DR 的 `s`，什么时候用 SD 的 `x`？两者是否等价？

**修复方向**: 明确 `x`/`X` sugar 是独立的、track-level 的等效写法，不依赖 DR。说明 DR 是"快速录入多轨道鼓组的糖语法"，而 `x`/`X` 是"单轨道内的字符糖"。

---

### 5. Repeat expansion (`:|xN`) 展开行为定义模糊 ✅ DONE

设计文档中不存在 `:|xN` 语法，代码实现中也没有此形式。无需修改。

---

### 6. `grouping` 与 `divisions` 耦合过紧 ✅ DONE

已删除 "Compatibility with `divisions`" 段落。`grouping` 的语义描述已聚焦在 musical grouping 本身。

---

### 7. Multi-measure rest `N=1` 行为未定义 ✅ DONE

文档已更新：`N` 必须 >= 2，`N=1` 是 error，不允许。

---

### 8. Sticking 匹配逻辑未定义 ✅ DONE

已明确：Matching is based on start position (Fraction)，不依赖 track。ST track 上的 `R`/`L` 出现在哪个 Fraction，就给该 Fraction 位置的所有音符加 annotation。

---

### 9. PDF / page-breaking layout 策略未描述 ✅ DONE

已在 Architecture 部分新增 "Rendering Modes" 小节，描述连续滚动预览（单页无限 SVG）和分页 PDF（每页最多 5 系统，header 仅首页）两种模式。

---

### 10. `flam`/`drag` 渲染语义描述不清 ✅ DONE

已补全 Modifier Rules 中 `flam` 和 `drag` 的渲染描述，并在 MusicXML Export 部分加入两者的 export 说明。

---

### 11. ghost-note parentheses 的 non-goal 已过时 ✅ DONE

已从 non-goals 列表中删除此条。`ghost` modifier 已实现并加入文档。

---

## 修复进度

已完成: #1, #2, #3, #5, #6, #7, #8, #9, #10, #11

待处理:
- #4 DR track 与 x/X sugar 规则冲突（跳过）