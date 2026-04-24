import type { Fraction, NormalizedEvent, NormalizedScore, TrackName } from "./types";

type VoiceId = 1 | 2;

type VoiceTrack = {
  voice: VoiceId;
  stem: "up" | "down";
};

type InstrumentSpec = {
  displayStep: string;
  displayOctave: number;
  notehead?: "x";
};

type VoiceEventGroup = {
  start: Fraction;
  duration: Fraction;
  events: NormalizedEvent[];
};

type VoiceEntry =
  | { kind: "rest"; start: Fraction; duration: Fraction }
  | { kind: "notes"; start: Fraction; duration: Fraction; events: NormalizedEvent[] };

type ExportMeasure = {
  measure: NormalizedScore["measures"][number];
  showRepeatStart: boolean;
  showRepeatEnd: boolean;
  outputIndex: number;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }

  return x || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function simplify(fraction: Fraction): Fraction {
  const divisor = gcd(fraction.numerator, fraction.denominator);
  return {
    numerator: fraction.numerator / divisor,
    denominator: fraction.denominator / divisor,
  };
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function subtractFractions(left: Fraction, right: Fraction): Fraction {
  return simplify({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function multiplyFraction(fraction: Fraction, multiplier: number): Fraction {
  return simplify({
    numerator: fraction.numerator * multiplier,
    denominator: fraction.denominator,
  });
}

function divideFraction(fraction: Fraction, divisor: number): Fraction {
  return simplify({
    numerator: fraction.numerator,
    denominator: fraction.denominator * divisor,
  });
}

function fractionsEqual(left: Fraction, right: Fraction): boolean {
  const a = simplify(left);
  const b = simplify(right);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

function compareFractions(left: Fraction, right: Fraction): number {
  const denominator = lcm(left.denominator, right.denominator);
  const leftValue = left.numerator * (denominator / left.denominator);
  const rightValue = right.numerator * (denominator / right.denominator);
  return leftValue - rightValue;
}

function fractionToDivisions(duration: Fraction, divisions: number): number {
  return (duration.numerator * 4 * divisions) / duration.denominator;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function creditXml(type: "title" | "subtitle" | "composer", words: string): string {
  const mixedStack = 'Charter, Bitstream Charter, Sitka Text, Cambria, Georgia, Times New Roman, PingFang SC, Microsoft YaHei, Noto Sans SC, sans-serif';
  const attributes = {
    title: `justify="center" font-size="20" font-family="${mixedStack}" font-weight="bold"`,
    subtitle: `justify="center" font-size="12" font-family="${mixedStack}" font-style="italic"`,
    composer: `justify="right" font-size="10" font-family="${mixedStack}"`,
  }[type];

  return [
    "  <credit page=\"1\">",
    `    <credit-type>${xmlEscape(type)}</credit-type>`,
    `    <credit-words ${attributes}>${xmlEscape(words)}</credit-words>`,
    "  </credit>",
  ].join("\n");
}

function scoreMetadataXml(score: NormalizedScore): string {
  const title = score.ast.headers.title?.value ?? "Drum Notation";
  const subtitle = score.ast.headers.subtitle?.value;
  const composer = score.ast.headers.composer?.value;
  const identification = composer
    ? `  <identification>\n    <creator type="composer">${xmlEscape(composer)}</creator>\n  </identification>`
    : "";
  const credits = [
    creditXml("title", title),
    subtitle ? creditXml("subtitle", subtitle) : "",
    composer ? creditXml("composer", composer) : "",
  ].filter(Boolean).join("\n");

  return [
    "  <work>",
    `    <work-title>${xmlEscape(title)}</work-title>`,
    "  </work>",
    identification,
    credits,
  ].filter(Boolean).join("\n");
}

function noteShapeForFraction(duration: Fraction): { type: string; dots: number } {
  const normalized = simplify(duration);
  const key = `${normalized.numerator}/${normalized.denominator}`;

  switch (key) {
    case "1/1":
      return { type: "whole", dots: 0 };
    case "3/2":
      return { type: "whole", dots: 1 };
    case "1/2":
      return { type: "half", dots: 0 };
    case "3/4":
      return { type: "half", dots: 1 };
    case "1/4":
      return { type: "quarter", dots: 0 };
    case "3/8":
      return { type: "quarter", dots: 1 };
    case "1/8":
      return { type: "eighth", dots: 0 };
    case "3/16":
      return { type: "eighth", dots: 1 };
    case "1/16":
      return { type: "16th", dots: 0 };
    case "3/32":
      return { type: "16th", dots: 1 };
    case "1/32":
      return { type: "32nd", dots: 0 };
    case "3/64":
      return { type: "32nd", dots: 1 };
    case "1/64":
      return { type: "64th", dots: 0 };
    default:
      return { type: "16th", dots: 0 };
  }
}

function visualDurationForEvent(event: NormalizedEvent, duration: Fraction): Fraction {
  if (!event.tuplet || event.tuplet.actual % event.tuplet.normal === 0) {
    return duration;
  }

  return divideFraction(multiplyFraction(duration, event.tuplet.actual), event.tuplet.normal);
}

function voiceForTrack(track: TrackName): VoiceTrack {
  switch (track) {
    case "BD":
    case "HF":
      return { voice: 2, stem: "down" };
    default:
      return { voice: 1, stem: "up" };
  }
}

function instrumentForTrack(track: TrackName, glyph?: string): InstrumentSpec {
  if (track === "HH" && glyph === "c") {
    return { displayStep: "A", displayOctave: 5, notehead: "x" };
  }
  switch (track) {
    case "HH":
      return { displayStep: "G", displayOctave: 5, notehead: "x" };
    case "HF":
      return { displayStep: "D", displayOctave: 4, notehead: "x" };
    case "SD":
      return { displayStep: "C", displayOctave: 5 };
    case "BD":
      return { displayStep: "F", displayOctave: 4 };
    case "T1":
      return { displayStep: "E", displayOctave: 5 };
    case "T2":
      return { displayStep: "D", displayOctave: 5 };
    case "T3":
      return { displayStep: "A", displayOctave: 4 };
    case "RC":
      return { displayStep: "F", displayOctave: 5, notehead: "x" };
    case "C":
      return { displayStep: "A", displayOctave: 5, notehead: "x" };
    case "ST":
      return { displayStep: "B", displayOctave: 5 };
  }
}

function instrumentPitchRank(instrument: InstrumentSpec): number {
  const stepRank: Record<string, number> = {
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4,
    A: 5,
    B: 6,
  };

  return instrument.displayOctave * 7 + (stepRank[instrument.displayStep] ?? 0);
}

function highestEventIndex(events: NormalizedEvent[]): number {
  let highestIndex = 0;
  let highestRank = -Infinity;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const rank = instrumentPitchRank(instrumentForTrack(event.track, event.glyph));

    if (rank > highestRank) {
      highestIndex = index;
      highestRank = rank;
    }
  }

  return highestIndex;
}

function collectDivisions(score: NormalizedScore): number {
  let divisions = 1;

  for (const measure of score.measures) {
    for (const event of measure.events) {
      divisions = lcm(divisions, event.duration.denominator);
      divisions = lcm(divisions, event.start.denominator);
    }
  }

  return divisions;
}

function groupVoiceEvents(events: NormalizedEvent[]): VoiceEventGroup[] {
  const sorted = [...events].sort((left, right) => {
    const startCompare = compareFractions(left.start, right.start);

    if (startCompare !== 0) {
      return startCompare;
    }

    return compareFractions(left.duration, right.duration);
  });

  const groups: VoiceEventGroup[] = [];

  for (const event of sorted) {
    const current = groups[groups.length - 1];

    if (current && fractionsEqual(current.start, event.start) && fractionsEqual(current.duration, event.duration)) {
      current.events.push(event);
      continue;
    }

    groups.push({
      start: event.start,
      duration: event.duration,
      events: [event],
    });
  }

  return groups;
}

function buildVoiceEntries(
  groups: VoiceEventGroup[],
  measureStart: Fraction,
  measureDuration: Fraction,
): VoiceEntry[] {
  const entries: VoiceEntry[] = [];
  let cursor = measureStart;

  for (const group of groups) {
    if (compareFractions(group.start, cursor) > 0) {
      entries.push({
        kind: "rest",
        start: cursor,
        duration: subtractFractions(group.start, cursor),
      });
    }

    entries.push({
      kind: "notes",
      start: group.start,
      duration: group.duration,
      events: group.events,
    });

    cursor = addFractions(group.start, group.duration);
  }

  const measureEnd = addFractions(measureStart, measureDuration);

  if (compareFractions(cursor, measureEnd) < 0) {
    entries.push({
      kind: "rest",
      start: cursor,
      duration: subtractFractions(measureEnd, cursor),
    });
  }

  return entries;
}

function notationsXml(event: NormalizedEvent, sticking?: string): string {
  const bits: string[] = [];

  if (event.modifier === "open") {
    bits.push("<technical><open-string/></technical>");
  }

  if (event.modifier === "close") {
    bits.push("<technical><stopped/></technical>");
  }

  if (event.modifier === "flam") {
    bits.push("<ornaments><tremolo type=\"single\">1</tremolo></ornaments>");
  }

  if (event.modifier === "choke") {
    bits.push("<technical><other-technical>choke</other-technical></technical>");
    bits.push("<articulations><staccatissimo/></articulations>");
  }

  if (event.modifier === "rim") {
    bits.push("<technical><other-technical>rim</other-technical></technical>");
  }

  if (event.modifier === "cross") {
    bits.push("<technical><other-technical>cross-stick</other-technical></technical>");
  }

  if (event.modifier === "bell") {
    bits.push("<technical><other-technical>bell</other-technical></technical>");
  }

  if (event.kind === "accent") {
    bits.push("<articulations><accent/></articulations>");
  }

  if (sticking) {
    bits.push(`<technical><fingering placement="above" font-size="14">${xmlEscape(sticking)}</fingering></technical>`);
  }

  if (bits.length === 0 && !event.tuplet) {
    return "";
  }

  const tuplet = event.tuplet
    ? `<tuplet type="start" bracket="yes" number="1"/>`
    : "";

  return `<notations>${tuplet}${bits.join("")}</notations>`;
}

function noteheadXml(event: NormalizedEvent, instrument: InstrumentSpec): string {
  if (event.kind === "ghost") {
    const notehead = instrument.notehead ?? "normal";
    return `<notehead parentheses="yes">${notehead}</notehead>`;
  }

  return instrument.notehead ? `<notehead>${instrument.notehead}</notehead>` : "";
}

function restXml(duration: Fraction, divisions: number, voice: VoiceTrack): string {
  const shape = noteShapeForFraction(duration);
  const dots = Array.from({ length: shape.dots }, () => "<dot/>").join("");
  return [
    "<note>",
    "<rest/>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${shape.type}</type>`,
    dots,
    `<staff>1</staff>`,
    "</note>",
  ].join("");
}

function forwardXml(duration: Fraction, divisions: number, voice: VoiceTrack): string {
  return [
    "<forward>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<staff>1</staff>`,
    "</forward>",
  ].join("");
}

function isBeamable(duration: Fraction): boolean {
  const normalized = simplify(duration);
  const denominator = normalized.denominator;
  return denominator >= 8;
}

function noteXml(
  event: NormalizedEvent,
  duration: Fraction,
  divisions: number,
  voice: VoiceTrack,
  isChord: boolean,
  closesTuplet: boolean,
  sticking?: string,
  beamState: "begin" | "continue" | "end" | null = null,
): string {
  const instrument = instrumentForTrack(event.track, event.glyph);
  const shape = noteShapeForFraction(visualDurationForEvent(event, duration));
  const timeModification = event.tuplet
    ? `<time-modification><actual-notes>${event.tuplet.actual}</actual-notes><normal-notes>${event.tuplet.normal}</normal-notes></time-modification>`
    : "";
  const notehead = noteheadXml(event, instrument);
  const closingNotation = closesTuplet && !isChord ? `<notations><tuplet type="stop" number="1"/></notations>` : "";
  const beam = beamState ? `<beam number="1">${beamState}</beam>` : "";
  const dots = Array.from({ length: shape.dots }, () => "<dot/>").join("");

  return [
    "<note>",
    isChord ? "<chord/>" : "",
    "<unpitched>",
    `<display-step>${instrument.displayStep}</display-step>`,
    `<display-octave>${instrument.displayOctave}</display-octave>`,
    "</unpitched>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${shape.type}</type>`,
    dots,
    timeModification,
    notehead,
    `<stem>${voice.stem}</stem>`,
    beam,
    `<staff>1</staff>`,
    notationsXml(event, sticking),
    closingNotation,
    "</note>",
  ].join("");
}

function fractionKey(fraction: Fraction): string {
  const normalized = simplify(fraction);
  return `${normalized.numerator}/${normalized.denominator}`;
}

function stickingsByStart(events: NormalizedEvent[]): Map<string, string> {
  const byStart = new Map<string, string[]>();

  for (const event of events) {
    if (event.track !== "ST") {
      continue;
    }

    const key = fractionKey(event.start);
    byStart.set(key, [...(byStart.get(key) ?? []), event.glyph]);
  }

  return new Map([...byStart].map(([key, values]) => [key, values.join(" ")]));
}

function groupingSegmentIndex(score: NormalizedScore, position: Fraction): number {
  const grouping = score.ast.headers.grouping.values;
  const time = score.ast.headers.time;
  
  // Convert position to a value in units of the time signature's denominator
  // Example: in 7/8, position 0/1 -> 0, position 1/8 -> 1, position 1/4 -> 2
  const posInUnits = (position.numerator * time.beatUnit) / position.denominator;
  
  let accumulated = 0;
  for (let i = 0; i < grouping.length; i++) {
    accumulated += grouping[i];
    // If the note starts before this boundary, it belongs to this segment
    if (posInUnits < accumulated - 0.0001) { // small epsilon for float precision
      return i;
    }
  }
  
  return Math.max(0, grouping.length - 1);
}

function measureXml(score: NormalizedScore, exportMeasure: ExportMeasure, divisions: number, forceLineBreak: boolean, hideVoice2Rests: boolean): string {
  const measure = exportMeasure.measure;
  const measureDuration = {
    numerator: score.ast.headers.time.beats,
    denominator: score.ast.headers.time.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);
  const upEvents = measure.events.filter((event) => voiceForTrack(event.track).voice === 1 && event.track !== "ST");
  const downEvents = measure.events.filter((event) => {
    const isVoice2 = voiceForTrack(event.track).voice === 2 && event.track !== "ST";
    if (!isVoice2) return false;
    return true;
  });
  const upEntries = upEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration)
    : [];
  const downEntries = downEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration)
    : [];
  const stickings = stickingsByStart(measure.events);
  const renderedStickings = new Set<string>();
  const attributes =
    exportMeasure.outputIndex === 0
      ? [
          "<attributes>",
          `<divisions>${divisions}</divisions>`,
          "<key><fifths>0</fifths></key>",
          `<time><beats>${score.ast.headers.time.beats}</beats><beat-type>${score.ast.headers.time.beatUnit}</beat-type></time>`,
          "<staves>1</staves>",
          "<clef number=\"1\"><sign>percussion</sign><line>2</line></clef>",
          "</attributes>",
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.ast.headers.tempo.value}</per-minute></metronome></direction-type><sound tempo="${score.ast.headers.tempo.value}"/></direction>`,
        ].join("")
      : "";
  const repeatStart = exportMeasure.showRepeatStart
    ? "<barline location=\"left\"><repeat direction=\"forward\"/></barline>"
    : "";
  const repeatEnd = exportMeasure.showRepeatEnd
    ? "<barline location=\"right\"><repeat direction=\"backward\"/></barline>"
    : "";
  const print = exportMeasure.outputIndex === 0
    ? "<print><measure-numbering>system</measure-numbering></print>"
    : forceLineBreak
      ? "<print new-system=\"yes\"><measure-numbering>system</measure-numbering></print>"
      : "";

  function processVoiceEntries(entries: VoiceEntry[], voice: VoiceTrack): string[] {
    const result: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (entry.kind === "rest") {
        if (hideVoice2Rests && voice.voice === 2) {
          result.push(forwardXml(entry.duration, divisions, voice));
        } else {
          result.push(restXml(entry.duration, divisions, voice));
        }
        continue;
      }

      const stickingKey = fractionKey(entry.start);
      const sticking = stickings.get(stickingKey);
      const stickingForEntry = sticking && !renderedStickings.has(stickingKey) ? sticking : undefined;
      if (stickingForEntry) {
        renderedStickings.add(stickingKey);
      }

      if (!isBeamable(entry.duration)) {
        const stickingTargetIndex = stickingForEntry ? highestEventIndex(entry.events) : -1;
        result.push(
          ...entry.events.map((event, index) =>
            noteXml(
              event,
              entry.duration,
              divisions,
              voice,
              index > 0,
              index === entry.events.length - 1 && Boolean(event.tuplet),
              index === stickingTargetIndex ? stickingForEntry : undefined,
            ),
          ),
        );
        continue;
      }

      const nextEntry = entries[i + 1];
      const prevEntry = entries[i - 1];

      const prevGroup = prevEntry?.kind === "notes" && isBeamable(prevEntry.duration);
      const nextGroup = nextEntry?.kind === "notes" && isBeamable(nextEntry.duration);
      const entryPosition = subtractFractions(entry.start, measureStart);
      const prevPosition = prevEntry?.kind === "notes" ? subtractFractions(prevEntry.start, measureStart) : null;
      const nextPosition = nextEntry?.kind === "notes" ? subtractFractions(nextEntry.start, measureStart) : null;

      const sameGroupingPrev = prevGroup && prevPosition !== null && groupingSegmentIndex(score, prevPosition) === groupingSegmentIndex(score, entryPosition);
      const sameGroupingNext = nextGroup && nextPosition !== null && groupingSegmentIndex(score, entryPosition) === groupingSegmentIndex(score, nextPosition);

      let beamState: "begin" | "continue" | "end" | null = null;
      if (!sameGroupingPrev && sameGroupingNext) {
        beamState = "begin";
      } else if (sameGroupingPrev && sameGroupingNext) {
        beamState = "continue";
      } else if (sameGroupingPrev && !sameGroupingNext) {
        beamState = "end";
      }

      const stickingTargetIndex = stickingForEntry ? highestEventIndex(entry.events) : -1;
      result.push(
        ...entry.events.map((event, index) =>
          noteXml(
            event,
            entry.duration,
            divisions,
            voice,
            index > 0,
            index === entry.events.length - 1 && Boolean(event.tuplet),
            index === stickingTargetIndex ? stickingForEntry : undefined,
            beamState,
          ),
        ),
      );
    }

    return result;
  }

  const upNotes = processVoiceEntries(upEntries, { voice: 1, stem: "up" });
  const downNotes = processVoiceEntries(downEntries, { voice: 2, stem: "down" });

  const voiceContent: string[] = [];
  if (upNotes.length > 0) {
    voiceContent.push(...upNotes);
  }
  if (downNotes.length > 0) {
    if (upNotes.length > 0) {
      voiceContent.push(
        "<backup>",
        `<duration>${fractionToDivisions(measureDuration, divisions)}</duration>`,
        "</backup>",
      );
    }
    voiceContent.push(...downNotes);
  }

  return [
    `<measure number="${exportMeasure.outputIndex + 1}">`,
    print,
    attributes,
    repeatStart,
    ...voiceContent,
    repeatEnd,
    "</measure>",
  ].join("");
}

function buildExportMeasures(score: NormalizedScore): ExportMeasure[] {
  const repeatByStart = new Map(score.ast.repeatSpans.map((span) => [span.startBar, span] as const));
  const expanded: ExportMeasure[] = [];

  for (let index = 0; index < score.measures.length; index += 1) {
    const measure = score.measures[index];
    const repeatSpan = repeatByStart.get(measure.globalIndex);

    if (repeatSpan && repeatSpan.times > 2) {
      for (let repeatIndex = 0; repeatIndex < repeatSpan.times; repeatIndex += 1) {
        for (let bar = repeatSpan.startBar; bar <= repeatSpan.endBar; bar += 1) {
          expanded.push({
            measure: score.measures[bar],
            showRepeatStart: false,
            showRepeatEnd: false,
            outputIndex: expanded.length,
          });
        }
      }

      index = repeatSpan.endBar;
      continue;
    }

    expanded.push({
      measure,
      showRepeatStart: score.ast.repeatSpans.some((span) => span.startBar === measure.globalIndex && span.times <= 2),
      showRepeatEnd: score.ast.repeatSpans.some((span) => span.endBar === measure.globalIndex && span.times <= 2),
      outputIndex: expanded.length,
    });
  }

  return expanded;
}

export function buildMusicXml(score: NormalizedScore, hideVoice2Rests: boolean = false): string {
  const divisions = collectDivisions(score);
  const exportMeasures = buildExportMeasures(score);
  const measures = exportMeasures.map((exportMeasure, index) => {
    const prevExportMeasure = exportMeasures[index - 1];
    const forceLineBreak = index > 0 && prevExportMeasure?.measure.sourceLine !== exportMeasure.measure.sourceLine;
    return measureXml(score, exportMeasure, divisions, forceLineBreak, hideVoice2Rests);
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
${scoreMetadataXml(score)}
  <part-list>
    <score-part id="P1">
      <part-name>Drumset</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    ${measures}
  </part>
</score-partwise>`;
}
