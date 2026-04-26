# Plan: Replace OSMD with VexFlow for Drum Notation Rendering

## Context

The current pipeline is `DSL → NormalizedScore → MusicXML → OSMD → SVG`. OSMD (OpenSheetMusicDisplay) has limited support for standard MusicXML features — many valid MusicXML files don't render correctly. The user wants to skip the OSMD step entirely and render directly from `NormalizedScore` to SVG using VexFlow, which is already a transitive dependency (v1.2.93).

Goal: Cover all DSL design features (tracks, modifiers, tuplets, repeats, beaming, sticking, etc.) in the new VexFlow renderer.

---

## Critical Files

| File | Role |
|------|------|
| `src/App.tsx` | UI — replaces OSMD calls with VexFlow renderer calls |
| `src/dsl/musicxml.ts` | Reference for track→note mapping, beam logic, tuplet logic |
| `src/dsl/types.ts` | `NormalizedScore`, `NormalizedEvent`, `TrackName` types |
| `src/dsl/normalize.ts` | `buildNormalizedScore` function |

---

## Implementation

### Step 1: Add VexFlow as Direct Dependency

VexFlow is already available as a transitive dependency. Add it as a direct dependency so we can import it directly.

```json
// package.json
"vexflow": "^1.2.93"
```

### Step 2: Create `src/vexflow/renderer.ts`

Also add `ghost` and `drag` to the DSL `MODIFIERS` list in `src/dsl/types.ts` as new modifiers.

New module with:

```typescript
export type VexflowRenderOptions = {
  mode: "preview" | "pdf";
  pagePadding: PagePadding;
  pageScale: number;
  titleTopPadding: number;
  titleSubtitleGap: number;
  titleStaffGap: number;
  systemSpacing: number;
};

export function renderScoreToSvg(score: NormalizedScore, options: VexflowRenderOptions): string;
export function renderScorePagesToSvgs(score: NormalizedScore, options: VexflowRenderOptions): string[];
```

### Step 3: Track-to-Note Mapping (from `musicxml.ts`)

Reuse the mapping from `instrumentForTrack()` in musicxml.ts:

| Track | Display Step | Octave | Notehead | Voice |
|-------|-------------|--------|----------|--------|
| HH (normal) | G | 5 | x | 1 (up) |
| HH (crash `c`) | A | 5 | x | 1 (up) |
| HF | D | 4 | x | 2 (down) |
| SD | C | 5 | default | 1 (up) |
| BD | F | 4 | default | 2 (down) |
| T1 | E | 5 | default | 1 (up) |
| T2 | D | 5 | default | 1 (up) |
| T3 | A | 4 | default | 1 (up) |
| RC | F | 5 | diamond for bell, x for normal | 1 (up) |
| C | A | 5 | x | 1 (up) |

Voice assignment (from `voiceForTrack` in musicxml.ts):
- Voice 1 (stem up): HH, SD, T1, T2, T3, RC, C
- Voice 2 (stem down): BD, HF

### Step 4: Note Rendering

Use `Vex.Flow.StaveNote` with `clef: 'percussion'`:

```typescript
const note = new Vex.Flow.StaveNote({
  keys: [`${step}/${octave}`],
  duration: durationCode,  // 'q', '8', '16', etc.
  clef: 'percussion',
  auto_stem: true,
});
```

Duration mapping (from `noteShapeForFraction` in musicxml.ts):
| Fraction | VexFlow Duration |
|----------|-----------------|
| 1/1 | "w" |
| 3/2 | "w" + dot |
| 1/2 | "h" |
| 3/4 | "h" + dot |
| 1/4 | "q" |
| 3/8 | "q" + dot |
| 1/8 | "8" |
| 3/16 | "8" + dot |
| 1/16 | "16" |
| 1/32 | "32" |
| 1/64 | "64" |

Notehead modifiers:
- `open` (HH): `circle-x` notehead
- `cross` (SD): `x` notehead (cross-stick notation)
- `rim` (SD): `slashed` notehead
- `bell` (RC): `diamond` notehead
- `ghost`: parenthesized `circled` notehead — ghost note standard notation

### Step 5: Repeat Barlines

VexFlow `Stave` supports repeat barlines:

```typescript
stave.setBegBarType(Vex.Flow.Barline.type.REPEAT_BEGIN);
stave.setEndBarType(Vex.Flow.Barline.type.REPEAT_END);
```

For `:|xN` with N > 2, the repeat is already expanded in `buildExportMeasures()` — the renderer just sees normal measures with repeat begin/end flags.

### Step 6: Tuplet Rendering

When `event.tuplet` exists with `actual > normal` (compression):

```typescript
const tuplet = new Vex.Flow.Tuplet(notes, {
  num_notes: tuplet.actual,
  beats_occupied: tuplet.normal,
});
tuplet.setContext(context);
tuplet.draw();
```

### Step 7: Beaming

Use `Vex.Flow.Beam` with grouping boundary logic from `groupingSegmentIndex()` in musicxml.ts.

Beaming rules (from design doc):
- Default beaming must stay inside `grouping` boundaries
- Default beaming should not cross `grouping` boundaries

### Step 8: Articulations / Modifiers

| DSL Modifier | VexFlow Rendering |
|-------------|------------------|
| Accent (X/D/P glyphs) | `Vex.Flow.Articulation("a>")` above note |
| `open` (HH) | `circle-x` notehead |
| `close` (HH, HF) | stopped articulation |
| `choke` (C, RC) | staccato dot |
| `rim` (SD) | `slashed` notehead |
| `cross` (SD) | `x` notehead (cross-stick) |
| `bell` (RC) | `diamond` notehead |
| `ghost` | parenthesized `circled` notehead |
| `flam` (SD, T1, T2, T3) | slashed 16th grace note preceding main note |
| `drag` (SD, T1, T2, T3) | two unsynced 16th grace notes (no slash) preceding main note |

Note: `ghost` is a new modifier for ghost notes — parentheses around the note plus a `circled` notehead. This is the standard drum notation form. `drag` is a drag (ruff) — two grace notes without the slash, as per standard drum notation.

### Step 9: Sticking Text

Render `ST` track events as `Vex.Flow.Annotation` above the corresponding note:

```typescript
const annotation = new Vex.Flow.Annotation("R")
  .setPosition(Vex.Flow.Annotation.Position.ABOVE);
note.addAnnotation(0, annotation);
```

Attach to the highest-pitched note at that start position (same logic as `highestEventIndex` in musicxml.ts).

### Step 10: Page Breaking / PDF Layout

VexFlow doesn't have built-in page layout. For preview mode, render full score to SVG. For PDF mode:
- Calculate system breaks based on content width
- Or render to one large SVG and slice by page height

Key layout values from current code:
- `pdfPageWidth = 612`, `pdfPageHeight = 792`
- `pdfMargin = 36`
- `pdfOsmdHeaderReservePx = 150` (for PDF mode top margin)

### Step 11: App.tsx Integration

Replace OSMD calls in `StaffPreview` and `renderPdfPageSvgs`:

**Before (OSMD):**
```typescript
const osmd = new OpenSheetMusicDisplay(buffer, { ... });
await osmd.load(xml);
osmd.render();
const pageSvgs = getStaffSvgMarkup(buffer.innerHTML);
```

**After (VexFlow):**
```typescript
import { renderScorePagesToSvgs } from "./vexflow/renderer";
const pageSvgs = await renderScorePagesToSvgs(score, { mode: "pdf", ...layout });
```

Remove:
- `loadOsmdModule()`
- `configureOsmdRules()`
- `applyOsmdHeaderMetadata()`
- `isRecoverablePreviewError()`
- OSMD module imports

Update `buildPdf()` to accept `NormalizedScore` directly instead of `xml: string`.

---

## Module Structure

```
src/vexflow/
  renderer.ts      # Main entry: renderScoreToSvg, renderScorePagesToSvgs
  notes.ts         # Track→StaveNote mapping, duration codes, noteheads
  voices.ts        # Voice creation, grouping, beaming
  tuplets.ts      # Tuplet grouping and rendering
  articulations.ts # Modifier→Articulation mapping
  barlines.ts     # Repeat barline handling
  sticking.ts     # Sticking annotation attachment
  layout.ts       # System/page layout, page breaking
```

This modular structure mirrors the existing DSL pipeline organization.

---

## Verification

1. Run `npm install` to add VexFlow dependency
2. Create `src/vexflow/` module with renderer.ts
3. Render the seed DSL from App.tsx and verify SVG output
4. Test all track types: HH, HF, SD, BD, T1, T2, T3, RC, C, ST
5. Test modifiers: open, close, choke, rim, cross, bell, ghost, flam, drag
6. Test tuplets: `[3: d d d]`
7. Test repeats: `|:`, `:|`, `:|x3`
8. Test beaming with `grouping` header
9. Test sticking: `R`, `L` annotations
10. Verify PDF export produces valid PDF pages
11. Run existing tests: `npm test`
