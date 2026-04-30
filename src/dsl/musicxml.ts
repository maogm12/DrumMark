import {
  addFractions,
  compareFractions,
  multiplyFraction,
  simplify,
  subtractFractions,
  type Fraction,
} from "./logic";
import type { NormalizedEvent, NormalizedScore, TrackName } from "./types";
import {
  buildVoiceEntries,
  getGroupingBoundaries,
  visualDurationForEvent,
  voiceForTrack as logicVoiceForTrack,
  groupVoiceEvents,
  isBeamable,
  groupingSegmentIndex,
  type InstrumentSpec,
  type VoiceEntry,
} from "./logic";

type VoiceId = 1 | 2;

type VoiceTrack = {
  voice: VoiceId;
  stem: "up" | "down";
};

type ExportMeasure = {
  measure: NormalizedScore["measures"][number];
  outputIndex: number;
};

function leftEdgeBarline(barline: NormalizedScore["measures"][number]["barline"]) {
  if (barline === "repeat-start" || barline === "repeat-both") return "repeat-start";
  return undefined;
}

function rightEdgeBarline(barline: NormalizedScore["measures"][number]["barline"]) {
  if (barline === "repeat-end" || barline === "repeat-both") return "repeat-end";
  if (barline === "double" || barline === "final") return barline;
  return undefined;
}

function markerDirectionXml(marker?: NormalizedScore["measures"][number]["marker"]): string {
  if (!marker) return "";

  switch (marker) {
    case "segno":
      return '<direction placement="above"><direction-type><segno/></direction-type></direction>';
    case "coda":
      return '<direction placement="above"><direction-type><coda/></direction-type></direction>';
    case "fine":
      return '<direction placement="above"><direction-type><words>Fine</words></direction-type></direction>';
    default:
      return "";
  }
}

function jumpDirectionXml(jump?: NormalizedScore["measures"][number]["jump"]): string {
  if (!jump) return "";

  const label = {
    "da-capo": "D.C.",
    "dal-segno": "D.S.",
    "dc-al-fine": "D.C. al Fine",
    "dc-al-coda": "D.C. al Coda",
    "ds-al-fine": "D.S. al Fine",
    "ds-al-coda": "D.S. al Coda",
    "to-coda": "To Coda",
  }[jump];

  return `<direction placement="above"><direction-type><words>${xmlEscape(label)}</words></direction-type></direction>`;
}

function measureStyleXml(measure: NormalizedScore["measures"][number]): string {
  const styles: string[] = [];

  if (measure.measureRepeat) {
    styles.push(`<measure-repeat type="start">${measure.measureRepeat.slashes}</measure-repeat>`);
  }

  if (measure.multiRest) {
    styles.push(`<multiple-rest>${measure.multiRest.count}</multiple-rest>`);
  }

  return styles.length > 0 ? `<measure-style>${styles.join("")}</measure-style>` : "";
}

function leftBarlineXml(measure: NormalizedScore["measures"][number], previous?: NormalizedScore["measures"][number]): string {
  const parts: string[] = [];
  const currentVolta = measure.volta?.indices.join(",");
  const previousVolta = previous?.volta?.indices.join(",");
  const startsVolta = currentVolta !== undefined && currentVolta !== previousVolta;

  if (startsVolta) {
    parts.push(`<ending number="${xmlEscape(currentVolta)}" type="start"/>`);
  }

  if (measure.barline === "repeat-start" || measure.barline === "repeat-both") {
    parts.push('<repeat direction="forward"/>');
  }

  return parts.length > 0 ? `<barline location="left">${parts.join("")}</barline>` : "";
}

function rightBarlineXml(measure: NormalizedScore["measures"][number], next?: NormalizedScore["measures"][number]): string {
  const parts: string[] = [];
  const currentVolta = measure.volta?.indices.join(",");
  const nextVolta = next?.volta?.indices.join(",");
  const endsVolta = currentVolta !== undefined && currentVolta !== nextVolta;

  if (measure.barline === "double") {
    parts.push("<bar-style>light-light</bar-style>");
  }
  if (measure.barline === "final") {
    parts.push("<bar-style>light-heavy</bar-style>");
  }
  if (endsVolta) {
    parts.push(`<ending number="${xmlEscape(currentVolta)}" type="stop"/>`);
  }
  if (measure.barline === "repeat-end" || measure.barline === "repeat-both") {
    parts.push('<repeat direction="backward"/>');
  }

  return parts.length > 0 ? `<barline location="right">${parts.join("")}</barline>` : "";
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
    case "7/4":
      return { type: "whole", dots: 2 };
    case "1/2":
      return { type: "half", dots: 0 };
    case "3/4":
      return { type: "half", dots: 1 };
    case "7/8":
      return { type: "half", dots: 2 };
    case "1/4":
      return { type: "quarter", dots: 0 };
    case "3/8":
      return { type: "quarter", dots: 1 };
    case "7/16":
      return { type: "quarter", dots: 2 };
    case "1/8":
      return { type: "eighth", dots: 0 };
    case "3/16":
      return { type: "eighth", dots: 1 };
    case "7/32":
      return { type: "eighth", dots: 2 };
    case "1/16":
      return { type: "16th", dots: 0 };
    case "3/32":
      return { type: "16th", dots: 1 };
    case "7/64":
      return { type: "16th", dots: 2 };
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

function instrumentForTrack(track: TrackName, _glyph?: string): InstrumentSpec {
  switch (track) {
    case "HH":
      return { displayStep: "G", displayOctave: 5, notehead: "x" };
    case "HF":
      return { displayStep: "D", displayOctave: 4, notehead: "x" };
    case "SD":
      return { displayStep: "C", displayOctave: 5 };
    case "BD":
      return { displayStep: "F", displayOctave: 4 };
    case "BD2":
      return { displayStep: "E", displayOctave: 4 };
    case "T1":
      return { displayStep: "E", displayOctave: 5 };
    case "T2":
      return { displayStep: "D", displayOctave: 5 };
    case "T3":
      return { displayStep: "A", displayOctave: 4 };
    case "T4":
      return { displayStep: "G", displayOctave: 4 };
    case "RC":
      return { displayStep: "F", displayOctave: 5, notehead: "x" };
    case "RC2":
      return { displayStep: "E", displayOctave: 5, notehead: "x" };
    case "C":
      return { displayStep: "A", displayOctave: 5, notehead: "x" };
    case "C2":
      return { displayStep: "B", displayOctave: 5, notehead: "x" };
    case "SPL":
      return { displayStep: "D", displayOctave: 6, notehead: "x" };
    case "CHN":
      return { displayStep: "C", displayOctave: 6, notehead: "x" };
    case "CB":
      return { displayStep: "B", displayOctave: 4 };
    case "WB":
      return { displayStep: "A", displayOctave: 3 };
    case "CL":
      return { displayStep: "G", displayOctave: 4 };
    case "ST":
      return { displayStep: "B", displayOctave: 5 };
    default:
      return { displayStep: "B", displayOctave: 5 };
  }
}

function collectDivisions(score: NormalizedScore): number {
  const lcm = (a: number, b: number) => (a * b) / (gcd(a, b) || 1);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  let divisions = 1;

  for (const measure of score.measures) {
    for (const event of measure.events) {
      divisions = lcm(divisions, event.duration.denominator);
      divisions = lcm(divisions, event.start.denominator);
    }
  }

  return divisions;
}

function noteheadValueForEvent(event: NormalizedEvent, instrument: InstrumentSpec): InstrumentSpec["notehead"] | undefined {
  if (event.modifiers.includes("ghost")) {
    return undefined; // Ghost notes use default notehead, renderer adds parentheses
  }

  if (event.modifiers.includes("dead")) {
    return "x";
  }

  if (event.track === "SD") {
    if (event.modifiers.includes("cross")) {
      return "x";
    }
  }

  if (event.track === "RC" && event.modifiers.includes("bell")) {
    return "diamond";
  }

  if (event.track === "HH" && event.modifiers.includes("open")) {
    return "circle-x";
  }

  return instrument.notehead;
}

function noteheadXml(event: NormalizedEvent, instrument: InstrumentSpec): string {
  const notehead = noteheadValueForEvent(event, instrument);
  return notehead ? `<notehead>${notehead}</notehead>` : "";
}

function restXml(duration: Fraction, divisions: number, voice: VoiceTrack): string {
  const shape = noteShapeForFraction(duration);
  const dots = Array.from({ length: shape.dots }, () => "<dot/>").join("");
  const displayStep = voice.voice === 1 ? "B" : "F";
  const displayOctave = "4";
  
  return [
    "<note>",
    `<rest><display-step>${displayStep}</display-step><display-octave>${displayOctave}</display-octave></rest>`,
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${shape.type}</type>`,
    dots,
    `<staff>1</staff>`,
    "</note>",
  ].join("");
}

function wholeMeasureRestXml(divisions: number, voice: VoiceTrack): string {
  const displayStep = voice.voice === 1 ? "B" : "F";
  const displayOctave = "4";
  return [
    "<note>",
    `<rest measure="yes"><display-step>${displayStep}</display-step><display-octave>${displayOctave}</display-octave></rest>`,
    `<duration>${divisions}</duration>`,
    `<voice>${voice.voice}</voice>`,
    "<type>whole</type>",
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

function graceNoteXml(event: NormalizedEvent, voice: VoiceTrack, slash?: boolean): string {
  const instrument = instrumentForTrack(event.track, event.glyph);
  const slashAttr = slash ? ' slash="yes"' : "";
  const notehead = noteheadXml(event, instrument);

  return [
    "<note>",
    `<grace${slashAttr}/>`,
    "<unpitched>",
    `<display-step>${instrument.displayStep}</display-step>`,
    `<display-octave>${instrument.displayOctave}</display-octave>`,
    "</unpitched>",
    `<instrument id="P1-I1"/>`,
    `<voice>${voice.voice}</voice>`,
    "<type>16th</type>",
    `<stem>${voice.stem}</stem>`,
    notehead,
    `<staff>1</staff>`,
    "</note>",
  ].join("");
}

function noteXml(
  event: NormalizedEvent,
  duration: Fraction,
  divisions: number,
  voice: VoiceTrack,
  isChord: boolean,
  startsTuplet: boolean,
  closesTuplet: boolean,
  sticking?: string,
  beamState: "begin" | "continue" | "end" | null = null,
): string {
  const instrument = instrumentForTrack(event.track, event.glyph);
  const shape = noteShapeForFraction(visualDurationForEvent(event, duration));
  const timeModification = event.tuplet
    ? `<time-modification><actual-notes>${event.tuplet.actual}</actual-notes><normal-notes>${event.tuplet.normal}</normal-notes></time-modification>`
    : "";
  const nhValue = noteheadValueForEvent(event, instrument);
  const notehead = nhValue ? `<notehead>${nhValue}</notehead>` : "";
  const beam = beamState ? `<beam number="1">${beamState}</beam>` : "";
  const dots = Array.from({ length: shape.dots }, () => "<dot/>").join("");

  // Consolidate all notations into one tag
  const technical: string[] = [];
  const articulations: string[] = [];
  const ornaments: string[] = [];
  const notationsContent: string[] = [];

  // Tuplet start/stop
  if (event.tuplet) {
    if (startsTuplet) {
      const showNumber = (event.tuplet.actual === 3 || event.tuplet.actual === 5) ? ' show-number="actual"' : ' show-number="none"';
      const tupletActual = `<tuplet-actual><number-of-notes>${event.tuplet.actual}</number-of-notes><tuple-type>${shape.type}</tuple-type></tuplet-actual>`;
      const tupletNormal = `<tuplet-normal><number-of-notes>${event.tuplet.normal}</number-of-notes><tuple-type>${shape.type}</tuple-type></tuplet-normal>`;
      notationsContent.push(`<tuplet type="start" number="1"${showNumber}>${tupletActual}${tupletNormal}</tuplet>`);
    }
    if (closesTuplet) {
      notationsContent.push('<tuplet type="stop" number="1"/>');
    }
  }

  // Technical/Articulations from notationsXml logic
  if (event.modifiers.includes("open") && nhValue !== "circle-x") {
    technical.push("<open-string/>");
  }
  if (event.modifiers.includes("close")) {
    technical.push("<stopped/>");
  }
  if (event.modifiers.includes("half-open")) {
    technical.push("<other-technical>half-open</other-technical>");
  }
  if (event.modifiers.includes("rim")) {
    technical.push("<other-technical>rim</other-technical>");
  }
  if (event.modifiers.includes("cross")) {
    technical.push("<other-technical>cross-stick</other-technical>");
  }
  if (event.modifiers.includes("choke")) {
    articulations.push('<staccato placement="above"/>');
  }
  if (event.modifiers.includes("bell")) {
    technical.push("<other-technical>bell</other-technical>");
  }
  if (event.modifiers.includes("accent")) {
    articulations.push('<accent placement="above"/>');
  }
  if (event.modifiers.includes("roll")) {
    ornaments.push('<tremolo type="single">3</tremolo>');
  }
  if (sticking) {
    technical.push(`<fingering placement="above" font-size="14">${xmlEscape(sticking)}</fingering>`);
  }

  if (technical.length > 0) {
    notationsContent.push(`<technical>${technical.join("")}</technical>`);
  }
  if (articulations.length > 0) {
    notationsContent.push(`<articulations>${articulations.join("")}</articulations>`);
  }
  if (ornaments.length > 0) {
    notationsContent.push(`<ornaments>${ornaments.join("")}</ornaments>`);
  }

  const notationsTag = notationsContent.length > 0 ? `<notations>${notationsContent.join("")}</notations>` : "";

  return [
    "<note>",
    isChord ? "<chord/>" : "",
    "<unpitched>",
    `<display-step>${instrument.displayStep}</display-step>`,
    `<display-octave>${instrument.displayOctave}</display-octave>`,
    "</unpitched>",
    `<duration>${fractionToDivisions(duration, divisions)}</duration>`,
    `<instrument id="P1-I1"/>`,
    `<voice>${voice.voice}</voice>`,
    `<type>${shape.type}</type>`,
    dots,
    timeModification,
    `<stem>${voice.stem}</stem>`,
    notehead,
    `<staff>1</staff>`,
    beam,
    notationsTag,
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

function measureXml(score: NormalizedScore, exportMeasure: ExportMeasure, divisions: number, forceLineBreak: boolean, hideVoice2Rests: boolean): string {
  const measure = exportMeasure.measure;
  const measureDuration = {
    numerator: score.header.timeSignature.beats,
    denominator: score.header.timeSignature.beatUnit,
  };
  const measureStart = multiplyFraction(measureDuration, measure.globalIndex);
  const previousMeasure = score.measures[measure.globalIndex - 1];
  const nextMeasure = score.measures[measure.globalIndex + 1];
  const upEvents = measure.events.filter((event) => logicVoiceForTrack(event.track) === 1 && event.track !== "ST");
  const downEvents = measure.events.filter((event) => logicVoiceForTrack(event.track) === 2 && event.track !== "ST");
  
  const upEntries = upEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(upEvents), measureStart, measureDuration, score.header.grouping)
    : [];
  const downEntries = downEvents.length > 0
    ? buildVoiceEntries(groupVoiceEvents(downEvents), measureStart, measureDuration, score.header.grouping)
    : [];
    
  const stickings = stickingsByStart(measure.events);
  const styleXml = measureStyleXml(measure);
  const showAttributes = exportMeasure.outputIndex === 0 || styleXml.length > 0;
  const attributes = showAttributes
      ? [
          "<attributes>",
          exportMeasure.outputIndex === 0 ? `<divisions>${divisions}</divisions>` : "",
          exportMeasure.outputIndex === 0 ? "<key><fifths>0</fifths></key>" : "",
          exportMeasure.outputIndex === 0 ? `<time><beats>${score.header.timeSignature.beats}</beats><beat-type>${score.header.timeSignature.beatUnit}</beat-type></time>` : "",
          exportMeasure.outputIndex === 0 ? "<staves>1</staves>" : "",
          exportMeasure.outputIndex === 0 ? '<clef number="1"><sign>percussion</sign><line>2</line></clef>' : "",
          styleXml,
          "</attributes>",
          exportMeasure.outputIndex === 0
            ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.header.tempo}</per-minute></metronome></direction-type><sound tempo="${score.header.tempo}"/></direction>`
            : "",
        ].filter(Boolean).join("")
      : "";
  const markerDirection = markerDirectionXml(measure.marker);
  const jumpDirection = jumpDirectionXml(measure.jump);
  const repeatStart = leftBarlineXml(measure, previousMeasure);
  const repeatEnd = rightBarlineXml(measure, nextMeasure);
  const print = exportMeasure.outputIndex === 0
    ? "<print><measure-numbering>system</measure-numbering></print>"
      : forceLineBreak
      ? '<print new-system="yes"><measure-numbering>system</measure-numbering></print>'
      : "";

  function processVoiceEntries(entries: VoiceEntry[], voice: VoiceTrack): string[] {
    const result: string[] = [];

    // Whole-measure rest optimization: if all entries are rests and their total
    // duration equals the full measure, emit one <rest measure="yes"/> instead of
    // splitting at grouping boundaries. Applies to both voice 1 and voice 2.
    if (
      entries.length > 0 &&
      entries.every((e) => e.kind === "rest")
    ) {
      const totalDuration = entries.reduce(
        (sum, e) => addFractions(sum, e.duration),
        { numerator: 0, denominator: 1 },
      );
      if (compareFractions(totalDuration, measureDuration) === 0) {
        return [wholeMeasureRestXml(fractionToDivisions(measureDuration, divisions), voice)];
      }
    }

    for (const [i, entry] of entries.entries()) {
      if (entry.kind === "rest") {
        if (hideVoice2Rests && voice.voice === 2) {
          const boundaries = getGroupingBoundaries(measureStart, measureDuration, score.header.grouping, score.header.timeSignature);
          let cursor = entry.start;
          const end = addFractions(entry.start, entry.duration);
          for (const boundary of boundaries) {
            if (compareFractions(cursor, boundary) >= 0) continue;
            if (compareFractions(end, boundary) <= 0) {
              result.push(forwardXml(subtractFractions(end, cursor), divisions, voice));
              cursor = end;
              break;
            }
            result.push(forwardXml(subtractFractions(boundary, cursor), divisions, voice));
            cursor = boundary;
          }
          if (compareFractions(cursor, end) < 0) {
            result.push(forwardXml(subtractFractions(end, cursor), divisions, voice));
          }
        } else {
          result.push(restXml(entry.duration, divisions, voice));
        }
        continue;
      }

      const stickingForEntry = stickings.get(fractionKey(entry.start));

      const nextEntry = entries[i + 1];
      const prevEntry = entries[i - 1];

      const currentTuplet = entry.events[0]?.tuplet;
      const prevTuplet = prevEntry?.kind === "notes" ? prevEntry.events[0]?.tuplet : undefined;
      const nextTuplet = nextEntry?.kind === "notes" ? nextEntry.events[0]?.tuplet : undefined;

      // A tuplet starts if the current event has a tuplet and the previous one doesn't (or it's a different tuplet)
      const startsTuplet = currentTuplet !== undefined && currentTuplet !== prevTuplet;
      // A tuplet closes if the current event has a tuplet and the next one doesn't (or it's a different tuplet)
      const closesTuplet = currentTuplet !== undefined && currentTuplet !== nextTuplet;

      if (!isBeamable(entry.duration)) {
        result.push(
          ...entry.events.flatMap((event, index) => {
            const note = noteXml(
              event,
              entry.duration,
              divisions,
              voice,
              index > 0,
              startsTuplet && index === 0,
              closesTuplet && index === entry.events.length - 1,
              stickingForEntry,
            );

            return event.modifiers.includes("flam")
              ? [graceNoteXml(event, voice, true), note]
              : [note];
          }),
        );
        continue;
      }

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

      result.push(
        ...entry.events.flatMap((event, index) => {
          const note = noteXml(
            event,
            entry.duration,
            divisions,
            voice,
            index > 0,
            startsTuplet && index === 0,
            closesTuplet && index === entry.events.length - 1,
            stickingForEntry,
            beamState,
          );

          return event.modifiers.includes("flam")
            ? [graceNoteXml(event, voice, true), note]
            : [note];
        }),
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

  // If a measure is entirely empty, output a 'Whole Measure Rest'.
  // This is required for OSMD's auto-merge logic.
  const isPurelyEmpty = measure.generated || measure.measureRepeat !== undefined || measure.multiRest !== undefined || (
    upEntries.every(e => e.kind === "rest") &&
    downEntries.every(e => e.kind === "rest")
  );

  const emptyMeasureContent = [
    "<note>",
    '<rest measure="yes"/>',
    `<duration>${fractionToDivisions(measureDuration, divisions)}</duration>`,
    "<voice>1</voice>",
    "<type>whole</type>",
    "<staff>1</staff>",
    "</note>",
  ].join("");

  const content = isPurelyEmpty ? [emptyMeasureContent] : voiceContent;

  return [
    `<measure number="${exportMeasure.outputIndex + 1}">`,
    print,
    attributes,
    repeatStart,
    markerDirection,
    jumpDirection,
    ...content,
    repeatEnd,
    "</measure>",
  ].join("");
}

function buildExportMeasures(score: NormalizedScore): ExportMeasure[] {
  const expanded: ExportMeasure[] = [];

  for (const measure of score.measures) {
    if (measure.multiRest && measure.multiRest.count > 1) {
      for (let i = 0; i < measure.multiRest.count; i++) {
        const isFirst = i === 0;
        const isLast = i === measure.multiRest.count - 1;
        expanded.push({
          measure: {
            ...measure,
            multiRest: isFirst ? measure.multiRest : undefined,
            marker: isFirst ? measure.marker : undefined,
            jump: isLast ? measure.jump : undefined,
            barline: isFirst
              ? leftEdgeBarline(measure.barline)
              : isLast
                ? rightEdgeBarline(measure.barline)
                : undefined,
          },
          outputIndex: expanded.length,
        });
      }
      continue;
    }

    expanded.push({
      measure,
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
      <score-instrument id="P1-I1">
        <instrument-name>Drumset</instrument-name>
      </score-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    ${measures}
  </part>
</score-partwise>`;
}
