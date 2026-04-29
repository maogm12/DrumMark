import VexFlow from "vexflow";
import type { NormalizedEvent, NormalizedScore } from "../dsl/types";
import type { VexflowRenderOptions } from "./types";
import { 
  buildVoiceEntries, 
  groupingSegmentIndex, 
  groupVoiceEvents, 
  isBeamable, 
  multiplyFraction, 
  subtractFractions, 
  voiceForTrack,
  visualDurationForEvent,
  type Fraction,
  type VoiceEntry 
} from "../dsl/logic";
import {
  durationCode,
  instrumentForTrack,
  makeNoteKey,
} from "./notes";
import {
  annotationTextForEvent,
  graceNoteSlash,
  modifierIsGrace,
  tremoloMarksForEvent,
} from "./articulations";

const { 
  Renderer, 
  Stave, 
  StaveTempo, 
  BarlineType,
  Formatter, 
  Voice, 
  StaveNote, 
  Beam, 
  Articulation, 
  GraceNote, 
  GraceNoteGroup, 
  Annotation, 
  ModifierPosition,
  Modifier,
  Tuplet,
  Tremolo,
  GlyphNote,
  Glyphs,
  VoltaType,
  RendererBackends
} = VexFlow;

export function jumpText(jump?: NormalizedScore["measures"][number]["jump"]): string | null {
  if (!jump) return null;

  return {
    "da-capo": "D.C.",
    "dal-segno": "D.S.",
    "dc-al-fine": "D.C. al Fine",
    "dc-al-coda": "D.C. al Coda",
    "ds-al-fine": "D.S. al Fine",
    "ds-al-coda": "D.S. al Coda",
    "to-coda": "To Coda",
  }[jump];
}

export function markerText(marker?: NormalizedScore["measures"][number]["marker"]): string | null {
  if (!marker) return null;

  return {
    segno: "Segno",
    coda: "Coda",
    fine: "Fine",
  }[marker];
}

export function voltaTypeForMeasure(score: NormalizedScore, measure: NormalizedScore["measures"][number]): number | null {
  const current = measure.volta?.indices.join(",");
  if (!current) return null;

  const previous = score.measures[measure.globalIndex - 1]?.volta?.indices.join(",");
  const next = score.measures[measure.globalIndex + 1]?.volta?.indices.join(",");
  const begins = current !== previous;
  const ends = current !== next;

  if (begins && ends) return VoltaType.BEGIN_END;
  if (begins) return VoltaType.BEGIN;
  if (ends) return VoltaType.END;
  return VoltaType.MID;
}

export function measureRepeatGlyph(slashes: number): string {
  return slashes === 2 ? Glyphs.repeat2Bars : Glyphs.repeat1Bar;
}

function applyStructuralModifiers(stave: any, score: NormalizedScore, measure: NormalizedScore["measures"][number]) {
  switch (measure.barline) {
    case "repeat-start":
      stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      break;
    case "repeat-end":
      stave.setEndBarType(BarlineType.REPEAT_END);
      break;
    case "repeat-both":
      stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      stave.setEndBarType(BarlineType.REPEAT_END);
      break;
    case "double":
      stave.setEndBarType(BarlineType.DOUBLE);
      break;
    case "final":
      stave.setEndBarType(BarlineType.END);
      break;
    default:
      break;
  }

  const voltaType = voltaTypeForMeasure(score, measure);
  if (voltaType !== null) {
    stave.setVoltaType(voltaType, `${measure.volta?.indices.join(",")}.`, -5);
  }

  const marker = markerText(measure.marker);
  if (marker) {
    stave.setStaveText(marker, Modifier.Position.ABOVE, { shiftY: -8 });
  }

  const jump = jumpText(measure.jump);
  if (jump) {
    stave.setStaveText(jump, Modifier.Position.ABOVE, { shiftX: 24, shiftY: -8 });
  }

  if (measure.multiRest) {
    stave.setStaveText(`rest x${measure.multiRest.count}`, Modifier.Position.ABOVE, { shiftY: -8 });
  }
}

async function ensureVexFlowFonts() {
  if (typeof VexFlow.loadFonts === "function") {
    try {
      await VexFlow.loadFonts("Bravura", "Academico");
      // if (typeof VexFlow.setFonts === "function") {
      //   VexFlow.setFonts("Bravura", "Academico");
      // }
    } catch (e) {
      console.error("VexFlow font loading failed:", e);
    }
  }
}

export async function renderScoreToSvg(score: NormalizedScore, options: VexflowRenderOptions): Promise<string> {
  await ensureVexFlowFonts();

  const { mode } = options;
  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };

  const container = document.createElement('div');
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  const systemWidth = mode === "preview" ? 900 : 800;
  const staffHeight = 100;
  const systemSpacing = options.systemSpacing * 100; 
  
  const allSystems: any[][] = [];
  let currentSystem: any[] = [];
  for (const m of score.measures) {
    if (currentSystem.length > 0) {
      const last = currentSystem[currentSystem.length - 1];
      if (m.paragraphIndex !== last.paragraphIndex || currentSystem.length >= 4) {
        allSystems.push(currentSystem);
        currentSystem = [];
      }
    }
    currentSystem.push(m);
  }
  if (currentSystem.length > 0) allSystems.push(currentSystem);

  const totalHeight = 200 + allSystems.length * (staffHeight + systemSpacing);

  const renderer = new Renderer(container, RendererBackends.SVG);
  renderer.resize(systemWidth, totalHeight);
  const context = renderer.getContext();
  context.setFont("Arial", 10);
  context.setFillStyle("#333");
  context.setStrokeStyle("#333");

  drawHeader(context, score, systemWidth);

  let yOffset = 150;
  for (let i = 0; i < allSystems.length; i++) {
    const system = allSystems[i];
    if (system === undefined) continue;
    renderSystem(context, score, system, {
      x: 50,
      y: yOffset,
      width: systemWidth - 100,
      isFirstSystem: i === 0,
      measureDuration,
      options
    });
    yOffset += staffHeight + systemSpacing;
  }

  let svg: string;
  try {
    svg = container.innerHTML;
  } finally {
    document.body.removeChild(container);
  }
  return svg;
}

function drawHeader(context: any, score: NormalizedScore, width: number) {
  const title = score.header.title;
  const subtitle = score.header.subtitle;
  const composer = score.header.composer;

  context.save();
  if (title) {
    context.setFont("Arial", 24, "bold");
    context.fillText(title, width / 2 - context.measureText(title).width / 2, 40);
  }
  if (subtitle) {
    context.setFont("Arial", 14, "italic");
    context.fillText(subtitle, width / 2 - context.measureText(subtitle).width / 2, 70);
  }
  if (composer) {
    context.setFont("Arial", 12);
    context.fillText(composer, width - context.measureText(composer).width - 50, 40);
  }
  context.restore();
}

interface SystemOptions {
  x: number;
  y: number;
  width: number;
  isFirstSystem: boolean;
  measureDuration: { numerator: number; denominator: number };
  options: VexflowRenderOptions;
}

function renderSystem(context: any, score: NormalizedScore, measures: any[], sysOpts: SystemOptions) {
  const { x, y, width, isFirstSystem, options } = sysOpts;
  const measureWidth = width / measures.length;

  const staves: any[] = [];
  const allVoices: any[] = [];
  const allBeams: any[] = [];
  const allTuplets: any[] = [];

  const stickings = stickingsByStart(measures.flatMap(m => m.events));

  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i];
    const stave = new Stave(x + i * measureWidth, y, measureWidth);

    if (i === 0) {
        stave.addClef("percussion");
      if (isFirstSystem) {
        stave.addTimeSignature(`${score.header.timeSignature.beats}/${score.header.timeSignature.beatUnit}`);
        if (score.header.tempo) {
          // Move slightly to the left (x=-10) and remove vertical shift (y=0)
          const tempo = new StaveTempo({ duration: "q", bpm: score.header.tempo }, -10, 0);
          stave.addModifier(tempo);
        }
      }
    }

    applyStructuralModifiers(stave, score, measure);

    stave.setContext(context).draw();
    staves.push(stave);

    const { voices, beams, tuplets } = renderMeasureVoices(score, measure, stave, stickings, options);
    allVoices.push(...voices);
    allBeams.push(...beams);
    allTuplets.push(...tuplets);
  }

  const formatter = new Formatter();
  for (let i = 0; i < staves.length; i++) {
    const stave = staves[i];
    const staveVoices = allVoices.filter(v => (v as any)._stave === stave);
    if (staveVoices.length > 0) {
      // Calculate real available width for notes: 
      // stave.getNoteStartX() gives the X where notes begin after Clef/TimeSig
      // stave.getX() + stave.getWidth() is the end of the stave
      // We subtract a small padding (10) for the end barline
      const noteStart = stave.getNoteStartX();
      const noteEnd = stave.getX() + stave.getWidth();
      const availableWidth = Math.max(10, noteEnd - noteStart - 10);
      
      formatter.joinVoices(staveVoices).format(staveVoices, availableWidth);
      staveVoices.forEach(v => (v as any).draw(context, stave));
    }
  }

  allBeams.forEach(b => b.setContext(context).draw());
  allTuplets.forEach(t => t.setContext(context).draw());
}

function renderMeasureVoices(
  score: NormalizedScore,
  measure: any,
  stave: any,
  stickings: Map<string, string>,
  options: VexflowRenderOptions
) {
  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);

  if (measure.measureRepeat) {
    const repeatNote = new GlyphNote(measureRepeatGlyph(measure.measureRepeat.slashes), { duration: "w" }, { line: 4, alignCenter: true });
    const voice = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables([repeatNote]);
    (voice as any)._stave = stave;
    return { voices: [voice], beams: [], tuplets: [] };
  }

  const upEvents = measure.events.filter((e: any) => voiceForTrack(e.track) === 1 && e.track !== "ST");
  const downEvents = measure.events.filter((e: any) => voiceForTrack(e.track) === 2 && e.track !== "ST");

  const upEntries = buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration);
  const downEntries = buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration);

  const beams: any[] = [];
  const tuplets: any[] = [];

  const v1Notes = createVexNotes(score, upEntries, 1, measureStart, stickings, beams, tuplets);
  const voice1 = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables(v1Notes);
  (voice1 as any)._stave = stave;

  const voices = [voice1];

  // Only create voice 2 if there are actual events or if we are not hiding rests
  const hasV2Events = downEvents.length > 0;
  if (hasV2Events || !options.hideVoice2Rests) {
    const v2Notes = createVexNotes(score, downEntries, 2, measureStart, stickings, beams, tuplets, options.hideVoice2Rests);
    const voice2 = new Voice({ numBeats: measureDuration.numerator, beatValue: measureDuration.denominator }).setStrict(false).addTickables(v2Notes);
    (voice2 as any)._stave = stave;
    voices.push(voice2);
  }

  return { voices, beams, tuplets };
}

function createVexNotes(
  score: NormalizedScore,
  entries: VoiceEntry[],
  voiceId: number,
  measureStart: Fraction,
  stickings: Map<string, string>,
  allBeams: any[],
  allTuplets: any[],
  hideRests = false
): any[] {
  const notes: any[] = [];
  let currentBeamNotes: any[] = [];
  let currentBeamSegment = -1;
  let tupletNotes: any[] = [];
  let activeTuplet: any = null;

  for (const entry of entries) {
    let note: any;
    if (entry.kind === "rest") {
      note = new StaveNote({ keys: [voiceId === 1 ? "B/4" : "F/4"], duration: durationCode(entry.duration) + "r" });
      if (hideRests && voiceId === 2) note.setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
      
      // Fix: Encountering a rest should break the current beam
      if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
      currentBeamNotes = [];
      currentBeamSegment = -1;
    } else {
      const firstEvent = entry.events[0];
      if (firstEvent === undefined) continue;
      const instrumentSpecs = entry.events.map(e => ({
        spec: instrumentForTrack(e.track, e.glyph),
        event: e
      }));
      const keys = instrumentSpecs.map(item => makeNoteKey(item.event, item.spec));
      const visualDur = visualDurationForEvent(firstEvent, entry.duration);

      note = new StaveNote({ keys, duration: durationCode(visualDur), autoStem: false });
      note.setStemDirection(voiceId === 1 ? 1 : -1);

      // Explicitly set notehead for each key in the chord if it's a raw SMuFL ID or ghost
      instrumentSpecs.forEach((item, index) => {
        // Use underscore property for consistency with bundle probe
        const heads = note.note_heads || (note as any).noteHeads;
        if (!heads?.[index]) return;

        if (item.event.modifiers.includes("ghost")) {
          // Hardcoded Unicode: Parenthesis Left + Black Notehead + Parenthesis Right
          heads[index].text = "\uE0F5\uE0A4\uE0F6";
        }
      });

      if (entry.events.some((event) => event.modifiers.includes("accent"))) {
        note.addModifier(new Articulation("a>").setPosition(voiceId === 1 ? 3 : 4), 0);
      } else if (entry.events.some((event) => event.modifiers.includes("close"))) {
        note.addModifier(new Articulation("a-").setPosition(voiceId === 1 ? 3 : 4), 0);
      } else if (entry.events.some((event) => event.modifiers.includes("choke"))) {
        note.addModifier(new Articulation("a.").setPosition(voiceId === 1 ? 3 : 4), 0);
      }

      const annotationText = entry.events.map(annotationTextForEvent).find((value) => value !== null);
      if (annotationText) {
        note.addModifier(new Annotation(annotationText).setPosition(ModifierPosition.ABOVE), 0);
      }

      const tremoloMarks = entry.events.map(tremoloMarksForEvent).find((value) => value !== null);
      if (tremoloMarks) {
        note.addModifier(new Tremolo(tremoloMarks), 0);
      }

      entry.events.forEach((e) => {
        if (modifierIsGrace(e)) {
          const slash = graceNoteSlash(e);
          const gn = new GraceNote({ keys: [makeNoteKey(e, instrumentForTrack(e.track, e.glyph))], duration: "16", slash });
          note.addModifier(new GraceNoteGroup([gn], slash), 0);
        }
      });

      if (voiceId === 1) {
        const stick = stickings.get(`${entry.start.numerator}/${entry.start.denominator}`);
        if (stick) note.addModifier(new Annotation(stick).setPosition(ModifierPosition.ABOVE), 0);
      }

      const segment = groupingSegmentIndex(score, subtractFractions(entry.start, measureStart));
      if (isBeamable(visualDur) && segment === currentBeamSegment) {
        currentBeamNotes.push(note);
      } else {
        if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
        currentBeamNotes = isBeamable(visualDur) ? [note] : [];
        currentBeamSegment = isBeamable(visualDur) ? segment : -1;
      }

      if (firstEvent.tuplet) {
        if (!activeTuplet || activeTuplet.actual !== firstEvent.tuplet.actual) {
          if (tupletNotes.length > 0) allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal }));
          tupletNotes = [note];
          activeTuplet = firstEvent.tuplet;
        } else {
          tupletNotes.push(note);
          if (tupletNotes.length === activeTuplet.actual) {
            allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal }));
            tupletNotes = [];
            activeTuplet = null;
          }
        }
      } else if (tupletNotes.length > 0) {
        allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal }));
        tupletNotes = [];
        activeTuplet = null;
      }
    }
    notes.push(note);
  }
  if (currentBeamNotes.length > 1) allBeams.push(new Beam(currentBeamNotes));
  if (tupletNotes.length > 0) allTuplets.push(new Tuplet(tupletNotes, { numNotes: activeTuplet.actual, notesOccupied: activeTuplet.normal }));
  return notes;
}

export async function renderScorePagesToSvgs(score: NormalizedScore, options: VexflowRenderOptions): Promise<string[]> {
  if (options.mode === "preview") return [await renderScoreToSvg(score, options)];
  await ensureVexFlowFonts();

  const allSystems: any[][] = [];
  let currentSystem: any[] = [];
  for (const m of score.measures) {
    if (currentSystem.length > 0) {
      const last = currentSystem[currentSystem.length - 1];
      if (m.paragraphIndex !== last.paragraphIndex || currentSystem.length >= 4) {
        allSystems.push(currentSystem);
        currentSystem = [];
      }
    }
    currentSystem.push(m);
  }
  if (currentSystem.length > 0) allSystems.push(currentSystem);

  const svgs: string[] = [];
  let systemIdx = 0;
  while (systemIdx < allSystems.length) {
    const container = document.createElement('div');
    const renderer = new Renderer(container, RendererBackends.SVG);
    const systemsThisPage = Math.min(5, allSystems.length - systemIdx);
    renderer.resize(800, 1100);
    const context = renderer.getContext();
    context.setFillStyle("#333");
    context.setStrokeStyle("#333");
    if (systemIdx === 0) drawHeader(context, score, 800);

    let yOffset = systemIdx === 0 ? 150 : 50;
    for (let s = 0; s < systemsThisPage; s++) {
      const system = allSystems[systemIdx];
      if (system) {
        renderSystem(context, score, system, {
          x: 50, y: yOffset, width: 700, isFirstSystem: systemIdx === 0,
          measureDuration: { numerator: score.header.timeSignature.beats, denominator: score.header.timeSignature.beatUnit },
          options
        });
      }
      yOffset += 100 + options.systemSpacing * 100;
      systemIdx++;
    }
    svgs.push(container.innerHTML);
  }
  return svgs;
}

function stickingsByStart(events: NormalizedEvent[]): Map<string, string> {
  const byStart = new Map<string, string[]>();
  for (const event of events) {
    if (event.track !== "ST") continue;
    const key = `${event.start.numerator}/${event.start.denominator}`;
    byStart.set(key, [...(byStart.get(key) ?? []), event.glyph]);
  }
  return new Map([...byStart].map(([k, v]) => [k, v.join(" ")]));
}
