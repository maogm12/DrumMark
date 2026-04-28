# DrumMark Specification

## Status

Definitive — the authoritative source of truth for the DrumMark DSL.

IR output is defined by `IR_SPEC.md`. This document defines the text syntax that produces valid IR.

---

## 1. Overview

DrumMark is a plain-text notation language for drum scores. It is designed to be fast to write, human-readable, and directly compilable to a deterministic IR.

**Core design principles**:
- **Human-first**: Readable by musicians without a tool.
- **Deterministic**: Same source always produces the same IR.
- **Validatable**: Compiler reports hard errors for any unsupported construct.
- **Renderer-agnostic**: IR output feeds VexFlow rendering, MusicXML export, and future playback.

---

## 2. Headers

### 2.1 Supported Header Fields

```txt
title <text>
subtitle <text>
composer <text>
tempo <number>
time <beats>/<beatUnit>
divisions <number>
grouping <a+b+c+...>
```

**Rules**:
- `title`, `subtitle`, `composer`: optional, free text.
- `tempo`: optional, positive integer, default `120`, interpreted as quarter-note BPM.
- `time`: required, e.g. `4/4`, `3/4`, `6/8`.
- `divisions`: required, positive integer, defines the grid resolution per measure.
- `grouping`: optional, sum must equal numerator of `time`. Controls beat structure, default accents, beaming. Defaults inferred from `time` if absent.

### 2.2 Grouping Inference

| time | inferred grouping |
|------|-------------------|
| `2/4` | `1+1` |
| `3/4` | `1+1+1` |
| `4/4` | `2+2` |
| `2/2` | `1+1` |
| `3/8` | `1+1+1` |
| `6/8` | `3+3` |
| `9/8` | `3+3+3` |
| `12/8` | `3+3+3+3` |

Irregular meters (`5/8`, `7/8`, `5/4`, etc.) require explicit `grouping`.

---

## 3. Tracks

### 3.1 Supported Track Names

| ID | Family | MIDI Note |
|----|--------|-----------|
| `BD` | drum | 36 |
| `BD2` | drum | 36 |
| `SD` | drum | 38 |
| `T1` | drum | 48 |
| `T2` | drum | 45 |
| `T3` | drum | 41 |
| `T4` | drum | 43 |
| `HH` | cymbal | 42 |
| `HF` | pedal | 44 |
| `RC` | cymbal | 51 |
| `RC2` | cymbal | 59 |
| `C` | cymbal | 49 |
| `C2` | cymbal | 57 |
| `SPL` | cymbal | 55 |
| `CHN` | cymbal | 52 |
| `CB` | percussion | 56 |
| `WB` | percussion | 76 |
| `CL` | percussion | 75 |
| `ST` | auxiliary | — (no MIDI) |

### 3.2 Track Line Syntax

```
<TRACK> | ... |
```

Example:
```
HH | x - x - x - x - |
SD | - - d:cross - d - |
```

### 3.3 Anonymous Track

A line that starts directly with a barline acts as a universal container:

```
| x - s - x - s |
```

The default track for anonymous lines is `HH` for glyph routing.

### 3.4 Track Routing Scopes

Use braces `{}` to route a block of notes to a specific track without affecting timing:

```
| RC { x x x x } |        # A full measure of Ride
SD { [3: d d d] }        # Tuplet group on SD
```

### 3.5 Voice Convention

- Voice 1 (up-stem): `HH`, `RC`, `RC2`, `C`, `C2`, `SPL`, `CHN`, `SD`, `T1`, `T2`, `T3`, `T4`, `CB`, `WB`, `CL`, `ST`
- Voice 2 (down-stem): `BD`, `BD2`, `HF`

---

## 4. Tokens

### 4.1 Atomic Tokens

| Token | Meaning |
|-------|---------|
| `d` | Universal hit (standard notehead) |
| `-` | Rest |
| `x` | Cymbal/Crossstick — maps to `HH:d` in cymbal context, `SD:d:cross` in drum context, `HH:d` in anonymous |
| `s` | `SD:d` |
| `S` | `SD:d:accent` |
| `b` | `BD:d` |
| `B` | `BD:d:accent` |
| `b2` | `BD2:d` |
| `B2` | `BD2:d:accent` |
| `r` | `RC:d` |
| `R` | `RC:d:accent` |
| `r2` | `RC2:d` |
| `R2` | `RC2:d:accent` |
| `c` | `C:d` |
| `C` | `C:d:accent` |
| `c2` | `C2:d` |
| `C2` | `C2:d:accent` |
| `t1`, `t2`, `t3`, `t4` | `T1:d`, `T2:d`, `T3:d`, `T4:d` |
| `o` | `HH:d:open` |
| `O` | `HH:d:open:accent` |
| `spl` | `SPL:d` |
| `SPL` | `SPL:d:accent` |
| `chn` | `CHN:d` |
| `CHN` | `CHN:d:accent` |
| `cb` | `CB:d` |
| `CB` | `CB:d:accent` |
| `wb` | `WB:d` |
| `WB` | `WB:d:accent` |
| `cl` | `CL:d` |
| `CL` | `CL:d:accent` |
| `p` | `(Local):d`; in anonymous track, `HF:d` |
| `g` | `(Local):d:ghost`; in anonymous track, `SD:d:ghost` |
| `l`, `L` | Sticking — used in `ST` track or with `ST:` prefix |

### 4.2 Resolution Priority

When parsing a token, the compiler resolves its target in this order:

1. **Explicit override**: `RC:d` forces delivery to `RC` track.
2. **Static Magic Token**: `s`, `b`, `r`, etc. always map to their global physical target (`s` → `SD`) even inside other track lines.
3. **Context fallback**: `d` or `x` in a named track line uses that line's track; in anonymous `|` defaults to `HH`.

### 4.3 Duration Modifiers

| Symbol | Effect |
|--------|--------|
| `.` | Multiplies duration by 1.5. Multiple dots accumulate (`d..` = 1.75×). |
| `/` | Halves duration. Multiple halves accumulate (`d//` = 0.25×). |

Combined: `d./` = 0.75× duration.

### 4.4 Rhythmic Math

Each token's weight is computed as:

```
weight = base × (2 - 0.5^dots) / (2^halves)
```

**Base values**: `d` = 1 slot, `-` = 1 slot.

**Dotting** (left-associative):
- `d.` = 1.5
- `d..` = 1 + 0.5 + 0.25 = 1.75
- `d...` = 1 + 0.5 + 0.25 + 0.125 = 1.875

**Halving**:
- `d/` = 0.5
- `d//` = 0.25
- `d/`/` = 0.125

Fractional validation: each token is converted to an absolute Fraction relative to a whole note before summing. The sum of all token weights in a measure must equal the `timeSignature` fraction. No integer slot counting is used for validation.

### 4.5 Groups

**Syntax**:
```
[span: item1 item2 ...]
[ item1 item2 ... ]     # shorthand for [1: item1 item2 ...]
```

**Semantics**: Each item's duration = `slotDuration × span / itemCount`.

**Supported group forms**:

*Stretched* (`itemCount ≤ span`): Allowed only if each resulting item duration maps to a standard note value, dotted note, or tuplet — and does not require automatic tie splitting.

*Compressed* (`itemCount > span`): Ratios `[2, 1]`, `[4, 1]` → subdivide (no tuplet). All others → tuplet.

*Unsupported*: Any group requiring automatic tie splitting is a hard error.

**Minimum duration**: No guarantees below 64th note.

---

## 5. Modifiers

### 5.1 Supported Modifiers

| Modifier | Allowed on | Visual Effect |
|----------|-----------|--------------|
| `accent` | all tracks | Accent mark (>) above note |
| `open` | `HH` | Open circle on X notehead |
| `half-open` | `HH` | Sizzle; encircled "zz" or half-open circle; CC4 ≈ 64 |
| `close` | `HH`, `HF` | Default hi-hat state |
| `choke` | `C`, `C2`, `RC`, `RC2`, `SPL`, `CHN` | `+` or `×` above note |
| `bell` | `RC`, `RC2` | `B` or dot on ride cymbal |
| `rim` | `SD` | Smaller notehead + "R" optional |
| `cross` | `SD` | X above stem on snare |
| `flam` | `SD`, `T1`, `T2`, `T3`, `T4` | 16th grace note preceding main note |
| `ghost` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4` | Parenthesized notehead |
| `drag` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2` | Two 16th grace notes preceding |
| `roll` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `RC`, `RC2`, `BD` | Slash marks on stem |
| `dead` | `SD`, `HH`, `T1`, `T2`, `T3`, `T4`, `BD` | Small "x" notehead, muted attack |

### 5.2 Modifier Syntax

```
<token>:<modifier>
Track:d:<modifier>
```

Examples:
```
HH | d - d:open - d:close - d - |
SD | - - d:cross - d - d:rim:accent - |
RC | - - d:bell - - - d - |
C  | d:choke:accent - - - - - - - |
SD | - - d:ghost - - - - |
HH | d - d:drag - - - - - |
```

---

## 6. Sticking

### 6.1 Sticking Track

Use the `ST` track for hand sticking annotations:

```
ST | R - L - [2: R L R] - | R - L - R - L - |
```

### 6.2 Sticking Semantics

- Sticking tokens in `ST` track do not create MusicXML `<note>` elements with percussion step/octave. They are attached as `<fingering>` or `<direction>` to notes at the same rhythmic position.
- Sticking at a given `start` position applies to **all notes** at that position across all tracks.
- Sticking without a matching note at the same `start` position is ignored in MusicXML export.

---

## 7. Combined Hits

Use `+` to play multiple instruments simultaneously:

```
x+s          # Hi-hat and Snare
b+x          # Bass drum and Hi-hat
HH:d + SD:d  # Explicit combined hit
```

Combined hits produce multiple events at the same `start` position.

---

## 8. Repeats

### 8.1 Repeat Barlines

| Syntax | Meaning |
|--------|---------|
| `\|` | regular barline |
| `\|:` | repeat start |
| `:\|` | repeat end |
| `\|: :\|` | repeat start + end (same measure) |
| `\|\|` | double barline |
| `\|.` | explicit volta termination |

### 8.2 Repeat Rules

- Repeats are global measure structure, not private to one track.
- Repeat boundaries may be written on any track. A declaration on any track applies to the whole score.
- Nested repeats are not allowed in v1.
- Crossing repeats are not allowed in v1.

### 8.3 Voltas (Alternative Endings)

| Syntax | Meaning |
|--------|---------|
| `\|1.` | Volta for 1st repetition |
| `\|1,2.` | Volta shared by 1st and 2nd repetition |
| `\|.` | Explicit termination of current volta bracket |

**Example**:
```
|: d d d d |1. d d d d :|2. d d d d | d d d d |. d d d d |
```

**Rules**:
- Volta starts at `|N.`` or `|N,M.` barline.
- Volta ends when: (a) a `repeat-end` barline is encountered, (b) a new `volta` with a different index starts, or (c) `|.` is encountered.
- Both `|: :|` and voltas can span multiple paragraphs. Paragraph boundaries (blank lines) only trigger system breaks in the renderer and do not affect the musical logical structure.
- If a volta is followed immediately by `:|`, the bracket ends at that barline.

---

## 9. Multi-Measure Rest

`|--N--|` is the **only** way to specify a multi-measure rest.

```
HH | --8-- |       # 8-measure rest
HH |- 4 - |        # 4-measure rest (spaces allowed)
```

**Rules**:
- `N` must be a positive integer ≥ 2.
- `N` must be surrounded by at least one `-` on each side.
- The entire construct must fit within a single measure boundary `| ... |`.
- `N=1` is not allowed.

---

## 10. Inline Measure Repeat

`*N` at the end of a measure repeats that entire measure N times.

```
HH | dddd *2 |       # 2 measures of dddd
HH | - *3 |           # 3 blank measures
```

This is syntactic sugar. After expansion, there is no record that `*N` was used.

---

## 11. Measure Validation

### 11.1 Total Duration

For each measure, the sum of all token weights must equal `divisions`. Any mismatch is a hard error.

### 11.2 Grouping Boundary Alignment

No token or group may cross a boundary defined by `grouping`. A hard error is reported if a token's duration overlaps a grouping boundary.

**Example** (error):
```
HH | d. d/ d d |    # 'd.' crosses boundary at slot 2
```

**Correct**:
```
HH | d. / d d |     # 'd.' ends at 1.5, followed by half-rest '/' at 1.5-2.0
```

---

## 12. Future Improvements

The following features are defined in the spec but not yet implemented or not storable in IR:

| Feature | Description | IR Status |
|---------|-------------|-----------|
| `@tempo:<N>` | Inline tempo change mid-score | Not stored in IR |
| `@time:<N/M>` | Inline time signature change mid-score | Not stored in IR |
| `@partial:<N>` | Pickup/anacrusis measure with N slots | Not stored in IR |
| `@divisions:<N>` | Inline divisions change | Rejected — mid-score divisions change is not supported |

---

## 13. Comments

```
# comment
```

`#` starts a comment that runs to end of line. Comments are ignored by the parser.

---

## 14. Complete Example

```
title Funk Study No. 1
subtitle Verse groove
composer G. Mao
tempo 96
time 4/4
divisions 16
grouping 2+2

HH |: d - d - o - d - | d - d:close - d:accent - d - :|
SD |  - - d:cross - d - | d:rim:accent - [2: d d:flam d] - - -  |
BD |  d - - - d - - - | d - d - - - d -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC | - - d:bell - - - d - | - - - - - - - - |
C  | d:choke:accent - - - - - - - | - - - - d:accent - - - |
ST | R - L - [2: R L R] - | R - L - R - L - |
```

---

## Appendix A: Complete Token Reference

| Token | Track | Modifiers | Notes |
|-------|-------|-----------|-------|
| `d` | local | — | |
| `x` | HH/SD | cross in drum ctx | context-aware |
| `s` | SD | — | |
| `S` | SD | accent | |
| `b` | BD | — | |
| `B` | BD | accent | |
| `b2` | BD2 | — | |
| `B2` | BD2 | accent | |
| `r` | RC | — | |
| `R` | RC | accent | |
| `r2` | RC2 | — | |
| `R2` | RC2 | accent | |
| `c` | C | — | |
| `C` | C | accent | |
| `c2` | C2 | — | |
| `C2` | C2 | accent | |
| `t1`–`t4` | T1–T4 | — | |
| `o` | HH | open | |
| `O` | HH | open, accent | |
| `spl` | SPL | — | |
| `SPL` | SPL | accent | |
| `chn` | CHN | — | |
| `CHN` | CHN | accent | |
| `cb` | CB | — | |
| `CB` | CB | accent | |
| `wb` | WB | — | |
| `WB` | WB | accent | |
| `cl` | CL | — | |
| `CL` | CL | accent | |
| `p` | HF (local fallback) | — | |
| `g` | local | ghost | |
| `l/L` | ST | — | sticking |
| `-` | — | — | rest |

---

## Appendix B: Modifier Legality Matrix

| Modifier | BD | BD2 | SD | T1 | T2 | T3 | T4 | HH | HF | RC | RC2 | C | C2 | SPL | CHN | CB | WB | CL |
|----------|----|----|----|----|----|----|----|----|----|----|----|----|----|-----|-----|----|----|----|----|----|----|
| accent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| open | | | | | | | | ✓ | | | | | | | | | | | | |
| half-open | | | | | | | | ✓ | | | | | | | | | | | |
| close | | | | | | | | ✓ | ✓ | | | | | | | | | | |
| choke | | | | | | | | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| bell | | | | | | | | | | ✓ | ✓ | | | | | | | | |
| rim | | | ✓ | | | | | | | | | | | | | | | | |
| cross | | | ✓ | | | | | | | | | | | | | | | | | |
| flam | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | | |
| ghost | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | |
| drag | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | ✓ | ✓ | | | | | | | |
| roll | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ | | | | | | | | |
| dead | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | | | | | | |
