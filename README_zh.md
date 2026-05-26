# DrumMark 🥁

<p align="center">
  <img src="public/favicon.svg" width="128" height="128" alt="DrumMark Logo">
</p>

<p align="center">
  <b>中文版</b> | <a href="README.md">English</a>
</p>

> **为现代鼓手打造的文本优先记谱工具。**

**DrumMark** 是一款轻量级 Web 应用，它通过自研的记谱语法，让你能像写代码一样飞速记录鼓谱灵感，并实时生成专业五线谱，支持导出 MusicXML 和 PDF。

---

## ✨ 核心特性

- ✍️ **文本驱动：** 告别繁琐的鼠标点击。使用简单的字符（如 `x`, `d`, `p`）快速录入节奏。
- ⚡ **实时预览：** 基于 VexFlow 5 的渲染引擎，编辑即所得，提供即时的视觉反馈。
- 🎼 **专业导出：** 生成标准 MusicXML 文件，完美对接 MuseScore, Sibelius 或 Finale。
- 📏 **节奏精准：** 支持复杂拍子（如 7/8）、`note 1/N` 网格分辨率、时长修饰（附点 `.`、半值 `/`、倍增 `*`）、自动连杠（Beaming）和高级连音符（Tuplets）。
- 🥁 **全技巧覆盖：** 涵盖军鼓、底鼓、踩镲、通通鼓、镲片的所有常规演奏技巧（Rimshot, Flam, Choke, Bell 等）。
- 🔀 **结构控制：** 支持反复、房子、导航标记/跳转、多小节休止、内联重复，以及渐强 / 渐弱 hairpin。

---

## 🚀 快速开始

一个典型的记谱片段如下：

```text
title Funk Study
time 4/4
note 1/16
grouping 2+2

HH |: x - x - o - x - | x:close - X - x - c - :|
SD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |
BD |  p - - - p - - - | p - p - - - p -        |
```

### 常用输入方式：
- `HH`: 踩镲 (Hi-Hat)
- `SD`: 军鼓 (Snare Drum)
- `BD`: 底鼓 (Bass Drum)
- `RC`/`C`: 叮叮镲 (Ride) / 吊镲 (Crash)
- `| ... |`: 匿名轨道，可直接使用 `s`、`b`、`t1`、`c` 这类全局 magic token
- `@SD { ... }`: 轨道路由作用域，适合整段批量路由

---

## 🛠️ 技术栈

- **Frontend:** React + TypeScript + Vite
- **Editor:** CodeMirror 6 (定制语法高亮)
- **Rendering:** Rust layout engine (`RenderScore -> LayoutScene`) + SVG adapter
- **Native CLI:** Rust binary，可导出 MusicXML、SVG、PDF 和调试 JSON
- **PDF Export:** 原生 PDF 生成，带 Bravura/fallback 字体覆盖检查和 font subset

### Native CLI

```bash
npm run drummark:native -- docs/examples/overview.drum --format musicxml
npm run drummark:native -- docs/examples/overview.drum --format svg --output /tmp/overview.svg
npm run drummark:native -- docs/examples/overview.drum --format pdf --output /tmp/overview.pdf
```

支持格式：`musicxml`, `svg`, `pdf`, `ast`, `ir`, `scene`。其中 `ast`、`ir`、`scene` 是开发/调试用 JSON，schema 不承诺稳定。Native CLI 不支持 `--format xml`，也没有 page 参数；SVG/PDF 一律导出完整乐谱。

PDF 默认使用 `public/fonts/bravura.otf`，也可以用 `--font <PATH>` 指定。Bravura 覆盖的字符使用 Bravura；缺失字符使用 `--fallback-font <PATH>` 或已记录的平台 fallback。显式传入的字体路径是严格模式：路径无效会直接失败，不静默替换。

---

## 📖 详细文档

想要深入了解记谱语法？请查看项目中的 [DRUMMARK_SPEC.md](./docs/DRUMMARK_SPEC.md) 或运行项目后点击右上角的 **Docs** 按钮。

---

## 🤝 贡献与反馈

欢迎任何建议或 Bug 反馈！你可以提交 Issue 帮助我们一起打造最快捷的鼓谱记录工具。

---

*“让记录灵感的速度赶上你的鼓棒。”* 🥁🔥
