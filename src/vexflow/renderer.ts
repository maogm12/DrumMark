import * as VF from "vexflow";
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
  getVexNotehead,
  isVexCode,
} from "./notes";
import { graceNoteSlash, modifierIsGrace } from "./articulations";

async function ensureVexFlowFonts() {
  const vfAny = VF as any;
  const VexFlow = vfAny.VexFlow || VF;

  if (typeof VexFlow.loadFonts === "function") {
    try {
      await VexFlow.loadFonts("Bravura", "Academico");
      if (typeof VexFlow.setFonts === "function") {
        VexFlow.setFonts("Bravura", "Academico");
      }
    } catch (e) {
      console.error("VexFlow font loading failed:", e);
    }
  }
}

export async function renderScoreToSvg(score: NormalizedScore, options: VexflowRenderOptions): Promise<string> {
  await ensureVexFlowFonts();

  const { mode } = options;
  const measureDuration = {
    numerator: score.ast.headers.time.beats,
    denominator: score.ast.headers.time.beatUnit,
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

  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(systemWidth, totalHeight);
  const context = renderer.getContext();
  context.setFillStyle("#333");
  context.setStrokeStyle("#333");

  drawHeader(context, score, systemWidth);

  let yOffset = 150;
  for (let i = 0; i < allSystems.length; i++) {
    renderSystem(context, score, allSystems[i], {
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
  const title = score.ast.headers.title?.value;
  const subtitle = score.ast.headers.subtitle?.value;
  const composer = score.ast.headers.composer?.value;

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
    const stave = new VF.Stave(x + i * measureWidth, y, measureWidth);

    if (i === 0) {
      stave.addClef("percussion");
      if (isFirstSystem) {
        stave.addTimeSignature(`${score.ast.headers.time.beats}/${score.ast.headers.time.beatUnit}`);
        if (score.ast.headers.tempo) {
          // Move slightly to the left (x=-10) and remove vertical shift (y=0)
          const tempo = new VF.StaveTempo({ duration: "q", bpm: score.ast.headers.tempo.value }, -10, 0);
          stave.addModifier(tempo);
        }
      }
    }

    const showRepeatStart = score.ast.repeatSpans.some(s => s.startBar === measure.globalIndex);
    const showRepeatEnd = score.ast.repeatSpans.some(s => s.endBar === measure.globalIndex);
    if (showRepeatStart) stave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
    if (showRepeatEnd) stave.setEndBarType(VF.Barline.type.REPEAT_END);

    stave.setContext(context).draw();
    staves.push(stave);

    const { voices, beams, tuplets } = renderMeasureVoices(score, measure, stave, stickings, options);
    allVoices.push(...voices);
    allBeams.push(...beams);
    allTuplets.push(...tuplets);
  }

  const formatter = new VF.Formatter();
  for (let i = 0; i < staves.length; i++) {
    const staveVoices = allVoices.filter(v => (v as any)._stave === staves[i]);
    if (staveVoices.length > 0) {
      formatter.joinVoices(staveVoices).format(staveVoices, measureWidth - 20);
      staveVoices.forEach(v => (v as any).draw(context, staves[i]));
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
    numerator: score.ast.headers.time.beats,
    denominator: score.ast.headers.time.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);

  const upEvents = measure.events.filter((e: any) => voiceForTrack(e.track) === 1 && e.track !== "ST");
  const downEvents = measure.events.filter((e: any) => voiceForTrack(e.track) === 2 && e.track !== "ST");

  const upEntries = buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration);
  const downEntries = buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration);

  const beams: any[] = [];
  const tuplets: any[] = [];

  const v1Notes = createVexNotes(score, upEntries, 1, measureStart, stickings, beams, tuplets);
  const v2Notes = createVexNotes(score, downEntries, 2, measureStart, stickings, beams, tuplets, options.hideVoice2Rests);

  const voice1 = new VF.Voice({ num_beats: measureDuration.numerator, beat_value: measureDuration.denominator }).setStrict(false).addTickables(v1Notes);
  (voice1 as any)._stave = stave;

  const voice2 = new VF.Voice({ num_beats: measureDuration.numerator, beat_value: measureDuration.denominator }).setStrict(false).addTickables(v2Notes);
  (voice2 as any)._stave = stave;

  return { voices: [voice1, voice2], beams, tuplets };
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
      note = new VF.StaveNote({ keys: [voiceId === 1 ? "B/4" : "F/4"], duration: durationCode(entry.duration) + "r" });
      if (hideRests && voiceId === 2) note.setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
    } else {
      const firstEvent = entry.events[0];
      const instrumentSpecs = entry.events.map(e => ({
        spec: instrumentForTrack(e.track, e.glyph),
        event: e
      }));
      const keys = instrumentSpecs.map(item => makeNoteKey(item.event, item.spec));
      const visualDur = visualDurationForEvent(firstEvent, entry.duration);

      note = new VF.StaveNote({ keys, duration: durationCode(visualDur), auto_stem: false });
      note.setStemDirection(voiceId === 1 ? 1 : -1);

      // Explicitly set notehead for each key in the chord if it's a raw SMuFL ID or ghost
      instrumentSpecs.forEach((item, index) => {
        const head = getVexNotehead(item.event, item.spec);
        const vfAny = VF as any;
        const smufl = vfAny.smufl?.to_code_points || {};
        
        // Use underscore property for consistency with bundle probe
        const heads = note.note_heads || (note as any).noteHeads;
        if (!heads?.[index]) return;

        if (item.event.modifier === "ghost") {
          // Hardcoded Unicode: Parenthesis Left + Black Notehead + Parenthesis Right
          heads[index].text = "\uE0F5\uE0A4\uE0F6";
        } else if (head && !isVexCode(head)) {
          const glyphCode = smufl[head];
          if (glyphCode) {
            heads[index].text = glyphCode;
          }
        }
      });

      entry.events.forEach((e) => {
        if (e.kind === "accent") note.addModifier(new VF.Articulation("a>").setPosition(voiceId === 1 ? 3 : 4), 0);
        else if (e.modifier === "close") note.addModifier(new VF.Articulation("a-").setPosition(voiceId === 1 ? 3 : 4), 0);
        else if (e.modifier === "choke") note.addModifier(new VF.Articulation("a.").setPosition(voiceId === 1 ? 3 : 4), 0);

        if (modifierIsGrace(e)) {
          const slash = graceNoteSlash(e);
          const gn = new VF.GraceNote({ keys: [makeNoteKey(e, instrumentForTrack(e.track, e.glyph))], duration: "16", slash });
          note.addModifier(new VF.GraceNoteGroup([gn], slash), 0);
        }
      });

      if (voiceId === 1) {
        const stick = stickings.get(`${entry.start.numerator}/${entry.start.denominator}`);
        if (stick) note.addModifier(new VF.Annotation(stick).setPosition(VF.Modifier.Position.ABOVE), 0);
      }

      const segment = groupingSegmentIndex(score, subtractFractions(entry.start, measureStart));
      if (isBeamable(visualDur) && segment === currentBeamSegment) {
        currentBeamNotes.push(note);
      } else {
        if (currentBeamNotes.length > 1) allBeams.push(new VF.Beam(currentBeamNotes));
        currentBeamNotes = isBeamable(visualDur) ? [note] : [];
        currentBeamSegment = isBeamable(visualDur) ? segment : -1;
      }

      if (firstEvent.tuplet) {
        if (!activeTuplet || activeTuplet.actual !== firstEvent.tuplet.actual) {
          if (tupletNotes.length > 0) allTuplets.push(new VF.Tuplet(tupletNotes, { num_notes: activeTuplet.actual, notes_occupied: activeTuplet.normal }));
          tupletNotes = [note];
          activeTuplet = firstEvent.tuplet;
        } else {
          tupletNotes.push(note);
          if (tupletNotes.length === activeTuplet.actual) {
            allTuplets.push(new VF.Tuplet(tupletNotes, { num_notes: activeTuplet.actual, notes_occupied: activeTuplet.normal }));
            tupletNotes = [];
            activeTuplet = null;
          }
        }
      } else if (tupletNotes.length > 0) {
        allTuplets.push(new VF.Tuplet(tupletNotes, { num_notes: activeTuplet.actual, notes_occupied: activeTuplet.normal }));
        tupletNotes = [];
        activeTuplet = null;
      }
    }
    notes.push(note);
  }
  if (currentBeamNotes.length > 1) allBeams.push(new VF.Beam(currentBeamNotes));
  if (tupletNotes.length > 0) allTuplets.push(new VF.Tuplet(tupletNotes, { num_notes: activeTuplet.actual, notes_occupied: activeTuplet.normal }));
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
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    const systemsThisPage = Math.min(5, allSystems.length - systemIdx);
    renderer.resize(800, 1100);
    const context = renderer.getContext();
    context.setFillStyle("#333");
    context.setStrokeStyle("#333");
    if (systemIdx === 0) drawHeader(context, score, 800);

    let yOffset = systemIdx === 0 ? 150 : 50;
    for (let s = 0; s < systemsThisPage; s++) {
      renderSystem(context, score, allSystems[systemIdx], {
        x: 50, y: yOffset, width: 700, isFirstSystem: systemIdx === 0,
        measureDuration: { numerator: score.ast.headers.time.beats, denominator: score.ast.headers.time.beatUnit },
        options
      });
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
