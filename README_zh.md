# Drum Notation 🥁

<p align="center">
  <img src="public/favicon.svg" width="128" height="128" alt="Drum Notation Logo">
</p>

<p align="center">
  <b>中文版</b> | <a href="README.md">English</a>
</p>

> **为现代鼓手设计的“文本优先”记谱工具。**

**Drum Notation** 是一款轻量级 Web 应用，它通过自研的记谱语法，让你能像写代码一样飞速记录鼓谱灵感，并实时生成专业五线谱，支持导出 MusicXML 和 PDF。

---

## ✨ 核心特性

- ✍️ **文本驱动：** 告别繁琐的鼠标点击。使用简单的字符（如 `x`, `d`, `p`）快速录入节奏。
- ⚡ **实时预览：** 基于 OSMD 的渲染引擎，编辑即所得，提供即时的视觉反馈。
- 🎼 **专业导出：** 生成标准 MusicXML 文件，完美对接 MuseScore, Sibelius 或 Finale。
- 📏 **节奏精准：** 支持复杂拍子（如 7/8）、时长修饰（附点 `.`、半值 `/`）、自动连杠（Beaming）和高级连音符（Tuplets）。
- 🥁 **全技巧覆盖：** 涵盖军鼓、底鼓、踩镲、通通鼓、镲片的所有常规演奏技巧（Rimshot, Flam, Choke, Bell 等）。

---

## 🚀 快速开始

一个典型的记谱片段如下：

```text
title Funk Study
time 4/4
divisions 16
grouping 2+2

HH |: x - x - o - x - | x:close - X - x - c - :|x2
SD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |
BD |  p - - - p - - - | p - p - - - p -        |
```

### 常用轨道说明：
- `HH`: 踩镲 (Hi-Hat)
- `SD`: 军鼓 (Snare Drum)
- `BD`: 底鼓 (Bass Drum)
- `RC`/`C`: 叮叮镲 (Ride) / 吊镲 (Crash)
- `DR`: 综合鼓组（糖语法，可快速录入军鼓和通通鼓）

---

## 🛠️ 技术栈

- **Frontend:** React + TypeScript + Vite
- **Editor:** CodeMirror 6 (定制语法高亮)
- **Rendering:** OpenSheetMusicDisplay (OSMD)
- **PDF Export:** pdf-lib + SVG Rasterization

---

## 📖 详细文档

想要深入了解记谱语法？请查看项目中的 [DRUMMARK_SPEC.md](./docs/DRUMMARK_SPEC.md) 或运行项目后点击右上角的 **Docs** 按钮。

---

## 🤝 贡献与反馈

欢迎任何建议或 Bug 反馈！你可以提交 Issue 帮助我们一起打造最快捷的鼓谱记录工具。

---

*“让记录灵感的速度赶上你的鼓棒。”* 🥁🔥
