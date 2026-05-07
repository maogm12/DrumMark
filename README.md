# DrumMark 🥁

<p align="center">
  <img src="public/favicon.svg" width="128" height="128" alt="DrumMark Logo">
</p>

<p align="center">
  <a href="README_zh.md">中文版</a> | <b>English</b>
</p>

> **Text-first drum notation for the modern drummer.**

**DrumMark** is a lightweight web application designed for drummers. It features a custom syntax that lets you write drum scores as quickly as typing code, then compile them into professional sheet music in real time.

---

## ✨ Features

- ✍️ **Text-Driven:** Forget tedious mouse clicks. Record your ideas using simple characters (`x`, `d`, `p`).
- ⚡ **Live Preview:** Real-time rendering engine based on VexFlow 5.
- 🎼 **Professional Export:** Generate standard MusicXML compatible with MuseScore, Sibelius, or Finale.
- 📏 **Rhythmic Precision:** Supports complex meters (e.g., 7/8), `note 1/N` grid resolution, duration modifiers (`.`, `/`, `*`), automatic beaming, and advanced tuplets.
- 🥁 **Full Technique Support:** Covers rimshots, flams, chokes, bells, and more across all major drum kit components.
- 🔀 **Score Structure:** Supports repeats, voltas, navigation markers/jumps, multi-measure rests, inline repeats, and crescendo / decrescendo hairpins.

---

## 🚀 Quick Start

A typical score snippet looks like this:

```text
title Funk Study
time 4/4
note 1/16
grouping 2+2

HH |: x - x - o - x - | x:close - X - x - c - :|
SD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |
BD |  p - - - p - - - | p - p - - - p -        |
```

### Supported Input Style:
- `HH`: Hi-Hat
- `SD`: Snare Drum
- `BD`: Bass Drum
- `RC`/`C`: Ride / Crash Cymbal
- `| ... |`: Anonymous track lines with global magic tokens like `s`, `b`, `t1`, `c`
- `@SD { ... }`: Track routing scopes for bulk routing without rewriting each token

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Editor:** CodeMirror 6 (Custom syntax highlighting)
- **Rendering:** VexFlow 5
- **PDF Export:** pdf-lib + SVG Rasterization

---

## 📖 Documentation

Want to dive deeper into the syntax? Check out the [DRUMMARK_SPEC.md](./docs/DRUMMARK_SPEC.md) or click the **Docs** button in the app.

---

## 🤝 Contributing

Suggestions and bug reports are welcome! Feel free to open an issue and help us build the fastest drum notation tool ever.

---

*"Let your notation keep up with your sticks."* 🥁🔥
