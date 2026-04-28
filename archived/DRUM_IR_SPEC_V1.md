# DrumIR Specification v1.0 (Consolidated)

- **Status**: Definitive (Consolidating v1.3 - v3.0 Addenda)
- **Concept**: A backend-agnostic, semantic, and high-precision intermediate representation for percussion data.
- **Design Philosophy**: DrumIR describes the *intent* of a percussion performance and the logical structure of a score, ensuring that renderers, exporters, and audio engines operate on a single, unambiguous model.

---

## 1. Core Data Primitives

### 1.1 The Fraction
To ensure infinite precision and zero cumulative rounding error, all temporal values MUST use a Fraction structure.
```idl
structure Fraction {
    numerator: BigInt    // Non-negative
    denominator: BigInt  // Positive
}
```
*Rule: All fractions must be simplified via GCD before storage. In intermediate calculations, use 64-bit signed integers for the numerator and denominator to prevent overflow. Throw `ComplexityOverflowError` if denominator > $10^{15}$.*

### 1.2 Time Signature
```idl
structure TimeSignature {
    beats: Integer
    beatUnit: Integer
}
```
*Note: TimeSignature does NOT use the Fraction structure to avoid GCD reduction (e.g., 4/4 vs 2/2).*

---

## 2. The Score Hierarchy

### 2.1 DrumIRScore (Root)
- `header`:
    - `title`: String
    - `subtitle`: String
    - `composer`: String
    - `tempo`: Integer (BPM)
    - `timeSignature`: TimeSignature
    - `grouping`: List<Integer> (Beat structure, e.g., [2, 2])
- `systems`: List<System>
- `playbackStream`: List<Integer> (Global measure indices in playback order)

### 2.2 System Structure
A logical group of measures, representing a horizontal staff line.
- `globalSystemIndex`: Integer
- `measures`: List<Measure>

### 2.3 Measure Structure
- `globalMeasureIndex`: Integer
- `events`: List<Event> (Sorted by `time`)
- `measureContext`: { `tempo`: Integer, `timeSignature`: TimeSignature, `grouping`: List<Integer>, `clickConfig`: ClickConfig }
- `multiRestCount`: Integer (Default: 1. If > 1, visual multi-measure rest. Next `globalMeasureIndex` must be `current + N`)
- `loopDepth`: Integer (Nesting level for stateless playback)
- `barlineType`: Enum(regular, double, final, dashed)
- `repeatStart`: Boolean
- `repeatEnd`: Boolean
- `repeatTimes`: Integer (Default: 1)
- `volta`: List<Integer> (Repetition indices where this bar is active; 1-based)
- `navMarker`: { `type`: Enum(segno, coda, fine, to_coda), `id`: String, `triggerTime`: Fraction }
- `navInstruction`: { `type`: Enum(dc, ds, dc_al_fine, ds_al_coda, to_coda), `targetId`: String, `triggerOnPass`: List<Integer> }
- `rangeAnnotations`: List<RangeAnnotation>

---

## 3. The Event Model

### 3.1 Event Structure
```idl
structure Event {
    kind: Enum(hit, rest, annotation)
    instrument: Instrument    // Required if kind is 'hit'
    time: Fraction            // Measure-relative offset [0, 1)
    duration: Fraction        // Note duration (0, 1]
    intensity: Enum(ghost, normal, accent)
    techniques: List<Technique>
    annotation: String        // Metadata (e.g., sticking)
    voice: Integer            // 1: High (Hands/Up-stem), 2: Low (Feet/Down-stem)
    rhythmicInfo: RhythmicInfo
    isTied: Enum(start, stop, both)
    beam: Enum(begin, continue, end, none)
}
```

### 3.2 RhythmicInfo & Ranges
```idl
structure RhythmicInfo {
    baseType: Enum(long, breve, whole, half, quarter, 8th, 16th, 32nd, 64th)
    dots: Integer (0, 1, 2)
    tuplet: { actualNotes: Integer, normalNotes: Integer } [Optional]
}

structure RangeAnnotation {
    type: Enum(crescendo, decrescendo, slur)
    startTime: Fraction
    endTime: Fraction
    options: Map<String, String>
}
```

---

## 4. Semantic Catalogs

### 4.1 Instruments & MIDI Registry

| Family | Type | Index | MIDI Note | Technique Dependency |
| :--- | :--- | :--- | :--- | :--- |
| **Drum** | `Bass` | 1 | 36 | - |
| **Drum** | `Bass` | 2 | 35 | - |
| **Drum** | `Snare` | 1 | 38 | - |
| **Drum** | `Tom` | 1 (High) | 48 | - |
| **Drum** | `Tom` | 2 (Mid) | 45 | - |
| **Drum** | `Tom` | 3 (Floor) | 41 | - |
| **Cymbal** | `HiHat` | 1 | 42 | CC4 (0:Closed, 64:Half, 127:Open) |
| **Cymbal** | `Ride` | 1 | 51 / 53 | 53 if `tech:bell`, else 51 |
| **Cymbal** | `Crash` | 1 | 49 | - |
| **Cymbal** | `Crash` | 2 | 57 | - |
| **Cymbal** | `Splash` | 1 | 55 | - |
| **Cymbal** | `China` | 1 | 52 | - |
| **Pedal** | `HiHatFoot` | 1 | 44 | - |
| **Percussion**| `Cowbell` | 1 | 56 | - |
| **Percussion**| `Woodblock`| 1 | 76 | - |
| **Sticking** | `Sticking` | 1 | - | Visual only (No MIDI) |

---

## 5. Playback & Logic

### 5.1 Nested Repeat Stack Algorithm (V2.1)
1. **Repeat Stack Push**: If `M.repeatStart == true` AND entering from the *previous* measure sequentially (not via jump) -> Push current index to stack.
2. **Volta Filter**: If `PassCount` is NOT in `M.volta`, skip processing of `M.events`.
3. **Event Processing**: Process `M.events`.
4. **Repeat Logic**:
    - If `M.repeatEnd == true`:
        - If `PassCount < M.repeatTimes`: `PassCount++`, jump to stack top (skip Push logic at target).
        - If `PassCount == M.repeatTimes`: `PassCount = 1`, pop stack.
5. **Step**: Increment `globalMeasureIndex`.

### 5.2 Unrolled Playback Model
For random access, a pre-computed `playbackStream` linearizes the global measure indices. This is the authoritative source for playback engines.

### 5.3 Click Configuration
```idl
structure ClickConfig {
    active: Boolean
    accentMidiNote: Integer
    subdivisionMode: Enum(auto_grouping, fixed_8th, fixed_16th)
}
```
*`auto_grouping` fallback: If `grouping` missing, 4/4 -> [1,0,1,0]; irregular meters -> fixed 4th pulse.*

---

## 6. Engraving & Layout Rules

### 6.1 Beaming
- **`begin/continue/end/none`** assigned by position. Half notes and longer MUST be `none`.
- **Ties/Beams** are orthogonal.

### 6.2 Sticking
Attached to `hit` events at same `time`. `Sticking` instrument is visual-only.

---

## 7. Validation & Safety

- **Technique Mutex**: HiHat (open/closed/half), Snare (rim/cross). `PhysicalConflictError` on violation.
- **Static Check**: 
    - `UnclosedRepeatError` if stack non-empty at end.
    - Volta validity: $1 \le V \le repeatTimes$.
    - Nav anchor: In `multiRestCount > 1`, `triggerTime` must be `0/1`.

---

## 8. Canonical Textual Format (.dir)
- `HIT`: `@<time> DUR:<dur> RYM:[type,dots,tuplet] <INST> INT:<int> TECH:[...] VOICE:<1|2> BEAM:<b|c|e|n> TIE:<s|p|b>`
- `REST`: `@<time> DUR:<dur> REST VOICE:<1|2>`
- `ANNOTATION`: `@<time> ANNOT:"<text>" VOICE:<1|2>`
- `BAR`: `BAR <idx> REPEAT_START REPEAT_END:<times> VOLTA:[...] STATUS:<s|c|e>`
