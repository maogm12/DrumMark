# Drum Notation 🥁

<p align="center">
  <img src="public/favicon.svg" width="128" height="128" alt="Drum Notation Logo">
</p>

<p align="center">
  <a href="README_zh.md">中文版</a> | <b>English</b>
</p>

> **Text-first drum notation for the modern drummer.**

**Drum Notation** is a lightweight web application designed for drummers. It features a custom syntax that allows you to write drum scores as quickly as typing code, generating professional-grade sheet music in real-time.

---

## ✨ Features

- ✍️ **Text-Driven:** Forget tedious mouse clicks. Record your ideas using simple characters (`x`, `d`, `p`).
- ⚡ **Live Preview:** Real-time rendering engine based on OSMD.
- 🎼 **Professional Export:** Generate standard MusicXML compatible with MuseScore, Sibelius, or Finale.
- 📏 **Rhythmic Precision:** Supports complex meters (e.g., 7/8), duration modifiers (dots `.` and halves `/`), automatic beaming, and advanced tuplets.
- 🥁 **Full Technique Support:** Covers rimshots, flams, chokes, bells, and more across all major drum kit components.

---

## 🚀 Quick Start

A typical score snippet looks like this:

```text
title Funk Study
time 4/4
divisions 16
grouping 2+2

HH |: x - x - o - x - | x:close - X - x - c - :|x2
SD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |
BD |  p - - - p - - - | p - p - - - p -        |
```

### Supported Tracks:
- `HH`: Hi-Hat
- `SD`: Snare Drum
- `BD`: Bass Drum
- `RC`/`C`: Ride / Crash Cymbal
- `DR`: Drum Sugar (quick entry for Snare and Toms)

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Editor:** CodeMirror 6 (Custom syntax highlighting)
- **Rendering:** OpenSheetMusicDisplay (OSMD)
- **PDF Export:** pdf-lib + SVG Rasterization

---

## 📖 Documentation

Want to dive deeper into the syntax? Check out the [DRUMMARK_SPEC.md](./docs/DRUMMARK_SPEC.md) or click the **Docs** button in the app.

---

## 🤝 Contributing

Suggestions and bug reports are welcome! Feel free to open an issue and help us build the fastest drum notation tool ever.

---

*"Let your notation keep up with your sticks."* 🥁🔥
