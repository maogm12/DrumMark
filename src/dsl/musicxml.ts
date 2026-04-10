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

function noteTypeForFraction(duration: Fraction): string {
  const normalized = simplify(duration);
  const key = `${normalized.numerator}/${normalized.denominator}`;

  switch (key) {
    case "1/1":
      return "whole";
    case "1/2":
      return "half";
    case "1/4":
      return "quarter";
    case "1/8":
      return "eighth";
    case "1/16":
      return "16th";
    case "1/32":
      return "32nd";
    case "1/64":
      return "64th";
    default:
      return "16th";
  }
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

function notationsXml(event: NormalizedEvent): string {
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
    bits.push("<articulations><staccatissimo/></articulations>");
  }

  if (event.kind === "accent") {
    bits.push("<articulations><accent/></articulations>");
  }

  if (bits.length === 0 && !event.tuplet) {
    return "";
  }

  const tuplet = event.tuplet
    ? `<tuplet type="start" bracket="yes" number="1"/>`
    : "";

  return `<notations>${tuplet}${bits.join("")}</notations>`;
}

function restXml(duration: Fraction, divisions: number, voice: VoiceTrack): string {
  const type = noteTypeForFraction(duration);
  return [
    "<note>",
    "<rest/>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${type}</type>`,
    `<staff>1</staff>`,
    "</note>",
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
  beamState: "begin" | "continue" | "end" | null = null,
): string {
  const instrument = instrumentForTrack(event.track, event.glyph);
  const baseDuration = event.tuplet
    ? multiplyFraction(duration, event.tuplet.normal / event.tuplet.actual)
    : duration;
  const noteType = noteTypeForFraction(baseDuration);
  const timeModification = event.tuplet
    ? `<time-modification><actual-notes>${event.tuplet.actual}</actual-notes><normal-notes>${event.tuplet.normal}</normal-notes></time-modification>`
    : "";
  const notehead = instrument.notehead ? `<notehead>${instrument.notehead}</notehead>` : "";
  const closingNotation = closesTuplet ? `<notations><tuplet type="stop" number="1"/></notations>` : "";
  const beam = beamState ? `<beam number="1">${beamState}</beam>` : "";

  return [
    "<note>",
    isChord ? "<chord/>" : "",
    "<unpitched>",
    `<display-step>${instrument.displayStep}</display-step>`,
    `<display-octave>${instrument.displayOctave}</display-octave>`,
    "</unpitched>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${noteType}</type>`,
    timeModification,
    notehead,
    `<stem>${voice.stem}</stem>`,
    beam,
    `<staff>1</staff>`,
    notationsXml(event),
    closingNotation,
    "</note>",
  ].join("");
}

function measureXml(score: NormalizedScore, measureIndex: number, divisions: number, forceLineBreak: boolean): string {
  const measure = score.measures[measureIndex];
  const measureDuration = {
    numerator: score.ast.headers.time.beats,
    denominator: score.ast.headers.time.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);
  const upEvents = measure.events.filter((event) => voiceForTrack(event.track).voice === 1 && event.track !== "ST");
  const downEvents = measure.events.filter((event) => voiceForTrack(event.track).voice === 2 && event.track !== "ST");
  const upEntries = upEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration)
    : [];
  const downEntries = downEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration)
    : [];
  const attributes =
    measureIndex === 0
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
  const repeatStart = score.ast.repeatSpans.some((span) => span.startBar === measure.globalIndex)
    ? "<barline location=\"left\"><repeat direction=\"forward\"/></barline>"
    : "";
  const repeatEndSpan = score.ast.repeatSpans.find((span) => span.endBar === measure.globalIndex);
  const repeatEnd = repeatEndSpan
    ? `<barline location="right"><repeat direction="backward"/>${
        repeatEndSpan.times > 2 ? `<ending number="1" type="stop"/>` : ""
      }</barline>`
    : "";

  function processVoiceEntries(entries: VoiceEntry[], voice: VoiceTrack): string[] {
    const result: string[] = [];
    const { beatUnit } = score.ast.headers.time;
    const slotsPerMeasure = (divisions * 4) / beatUnit;
    const slotsPerHalfMeasure = slotsPerMeasure / 2;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (entry.kind === "rest") {
        result.push(restXml(entry.duration, divisions, voice));
        continue;
      }

      if (!isBeamable(entry.duration)) {
        result.push(
          ...entry.events.map((event, index) =>
            noteXml(event, entry.duration, divisions, voice, index > 0, index === entry.events.length - 1 && Boolean(event.tuplet)),
          ),
        );
        continue;
      }

      const nextEntry = entries[i + 1];
      const prevEntry = entries[i - 1];

      const prevGroup = prevEntry?.kind === "notes" && isBeamable(prevEntry.duration);
      const nextGroup = nextEntry?.kind === "notes" && isBeamable(nextEntry.duration);

      const entrySlotInMeasure = entry.start.numerator * divisions * 2 / entry.start.denominator;
      const prevSlotInMeasure = prevEntry?.kind === "notes" ? prevEntry.start.numerator * divisions * 2 / prevEntry.start.denominator : -1;
      const nextSlotInMeasure = nextEntry?.kind === "notes" ? nextEntry.start.numerator * divisions * 2 / nextEntry.start.denominator : -1;

      const sameHalfPrev = prevGroup && Math.floor(prevSlotInMeasure / slotsPerHalfMeasure) === Math.floor(entrySlotInMeasure / slotsPerHalfMeasure);
      const sameHalfNext = nextGroup && Math.floor(entrySlotInMeasure / slotsPerHalfMeasure) === Math.floor(nextSlotInMeasure / slotsPerHalfMeasure);

      let beamState: "begin" | "continue" | "end" | null = null;
      if (!sameHalfPrev && sameHalfNext) {
        beamState = "begin";
      } else if (sameHalfPrev && sameHalfNext) {
        beamState = "continue";
      } else if (sameHalfPrev && !sameHalfNext) {
        beamState = "end";
      }

      result.push(
        ...entry.events.map((event, index) =>
          noteXml(event, entry.duration, divisions, voice, index > 0, index === entry.events.length - 1 && Boolean(event.tuplet), beamState),
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
    `<measure number="${measure.globalIndex + 1}">`,
    forceLineBreak ? "<print new-system=\"yes\"/>" : "",
    attributes,
    repeatStart,
    ...voiceContent,
    repeatEnd,
    "</measure>",
  ].join("");
}

export function buildMusicXml(score: NormalizedScore): string {
  const divisions = collectDivisions(score);
  const measures = score.measures.map((_, index) => {
    const prevMeasure = index > 0 ? score.measures[index - 1] : undefined;
    const currMeasure = score.measures[index];
    const sourceLineChanged = currMeasure.sourceLine !== undefined &&
      prevMeasure?.sourceLine !== undefined &&
      currMeasure.sourceLine !== prevMeasure.sourceLine;
    const forceLineBreak = prevMeasure !== undefined &&
      (sourceLineChanged || (currMeasure.sourceLine === undefined && currMeasure.globalIndex !== prevMeasure.globalIndex));
    return measureXml(score, index, divisions, forceLineBreak);
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${xmlEscape("Drum Notation Preview")}</work-title>
  </work>
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
