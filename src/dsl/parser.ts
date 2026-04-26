import {
  HEADER_FIELDS,
  MODIFIERS,
  TRACKS,
  type DocumentSkeleton,
  type MeasureToken,
  type ParseError,
  type ParsedHeaders,
  type ParsedMeasure,
  type ParsedTrackLine,
  type PreprocessedLine,
  type TrackParagraph,
  type TrackName,
  type SourceTrackName,
  type Modifier,
  type BasicGlyph,
  type MetadataHeader,
} from "./types";
import { preprocessSource } from "./preprocess";

type HeaderAccumulator = Partial<ParsedHeaders>;
type RawMeasure = Omit<ParsedTrackLine["measures"][number], "tokens"> & { tokens?: MeasureToken[] };

const SUPPORTED_BEAT_UNITS = new Set([2, 4, 8, 16]);

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function inferGrouping(beats: number, beatUnit: number): number[] | null {
  const key = `${beats}/${beatUnit}`;

  switch (key) {
    case "2/4":
    case "2/2":
      return [1, 1];
    case "3/4":
    case "3/8":
      return [1, 1, 1];
    case "4/4":
      return [2, 2];
    case "6/8":
      return [3, 3];
    case "9/8":
      return [3, 3, 3];
    case "12/8":
      return [3, 3, 3, 3];
    default:
      return null;
  }
}

function parseGroupingValue(value: string): number[] | null {
  if (!/^\d+(?:\+\d+)*$/.test(value)) {
    return null;
  }

  const values = value.split("+").map(Number);
  return values.every((item) => item > 0) ? values : null;
}

function isMetadataField(field: string): field is MetadataHeader["field"] {
  return field === "title" || field === "subtitle" || field === "composer";
}

function parseHeaderLine(line: PreprocessedLine, headers: HeaderAccumulator, errors: ParseError[]): boolean {
  const match = line.content.match(/^(\S+)(?:\s+(.*))?$/);
  const field = match?.[1] ?? "";
  const value = match?.[2]?.trim() ?? "";

  if (!field || !HEADER_FIELDS.includes(field as (typeof HEADER_FIELDS)[number])) {
    return false;
  }

  if (!value) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: isMetadataField(field)
        ? `Header \`${field}\` expects non-empty text`
        : `Header \`${field}\` expects a single value`,
    });
    return true;
  }

  if (!isMetadataField(field) && /\s/.test(value)) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: `Header \`${field}\` expects a single value`,
    });
    return true;
  }

  switch (field) {
    case "title":
    case "subtitle":
    case "composer": {
      if (headers[field]) {
        errors.push({
          line: line.lineNumber,
          column: 1,
          message: `Duplicate header \`${field}\``,
        });
        return true;
      }

      headers[field] = { field, value, line: line.lineNumber };
      return true;
    }
    case "tempo": {
      const parsed = parsePositiveInteger(value);

      if (parsed === null) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Tempo must be a positive integer",
        });
        return true;
      }

      headers.tempo = { field: "tempo", value: parsed, line: line.lineNumber };
      return true;
    }
    case "time": {
      const match = value.match(/^(\d+)\/(\d+)$/);

      if (!match) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Time must use the form beats/beatUnit",
        });
        return true;
      }

      const beats = Number(match[1]);
      const beatUnit = Number(match[2]);

      if (beats <= 0 || beatUnit <= 0) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Time values must be positive integers",
        });
        return true;
      }

      if (!SUPPORTED_BEAT_UNITS.has(beatUnit)) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Beat unit must be one of 2, 4, 8, or 16",
        });
        return true;
      }

      headers.time = { field: "time", beats, beatUnit, line: line.lineNumber };
      return true;
    }
    case "divisions": {
      const parsed = parsePositiveInteger(value);

      if (parsed === null) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Divisions must be a positive integer",
        });
        return true;
      }

      headers.divisions = {
        field: "divisions",
        value: parsed,
        line: line.lineNumber,
      };
      return true;
    }
    case "grouping": {
      const parsed = parseGroupingValue(value);

      if (!parsed) {
        errors.push({
          line: line.lineNumber,
          column: line.raw.indexOf(value) + 1,
          message: "Grouping must use the form n+n+...",
        });
        return true;
      }

      headers.grouping = {
        field: "grouping",
        values: parsed,
        line: line.lineNumber,
      };
      return true;
    }
  }

  return false;
}

function finalizeHeaders(headers: HeaderAccumulator, errors: ParseError[]): ParsedHeaders {
  const time =
    headers.time ??
    (() => {
      errors.push({
        line: 1,
        column: 1,
        message: "Missing required header `time`",
      });
      return { field: "time", beats: 4, beatUnit: 4, line: 0 } as const;
    })();
  const inferredGrouping = inferGrouping(time.beats, time.beatUnit);

  return {
    ...(headers.title ? { title: headers.title } : {}),
    ...(headers.subtitle ? { subtitle: headers.subtitle } : {}),
    ...(headers.composer ? { composer: headers.composer } : {}),
    tempo: headers.tempo ?? { field: "tempo", value: 120, line: 0 },
    time,
    divisions:
      headers.divisions ??
      (() => {
        errors.push({
          line: 1,
          column: 1,
          message: "Missing required header `divisions`",
        });
        return { field: "divisions", value: 16, line: 0 };
      })(),
    grouping:
      headers.grouping ??
      (() => {
        if (!inferredGrouping) {
          errors.push({
            line: time.line || 1,
            column: 1,
            message: `Missing required header \`grouping\` for time ${time.beats}/${time.beatUnit}`,
          });
          return { field: "grouping", values: [time.beats], line: 0 };
        }

        return { field: "grouping", values: inferredGrouping, line: 0 };
      })(),
  };
}

function isTrackGlyphAllowed(track: SourceTrackName, glyph: BasicGlyph): boolean {
  switch (track) {
    case "HH":
      return glyph === "-" || glyph === "x" || glyph === "X" || glyph === "o" || glyph === "O" || glyph === "c" || glyph === "C";
    case "RC":
    case "C":
      return glyph === "-" || glyph === "x" || glyph === "X";
    case "DR":
      return glyph === "-" || glyph === "s" || glyph === "S" || glyph === "t1" || glyph === "T1" || glyph === "t2" || glyph === "T2" || glyph === "t3" || glyph === "T3";
    case "SD":
    case "T1":
    case "T2":
    case "T3":
    case "BD":
      return glyph === "-" || glyph === "d" || glyph === "D" || glyph === "p" || glyph === "P" || glyph === "x" || glyph === "X";
    case "HF":
      return glyph === "-" || glyph === "p" || glyph === "P";
    case "ST":
      return glyph === "-" || glyph === "R" || glyph === "L";
  }
}

function isModifierAllowed(track: SourceTrackName, glyph: Exclude<BasicGlyph, "-">, modifier: Modifier): boolean {
  switch (modifier) {
    case "open":
      return track === "HH" && (glyph === "x" || glyph === "X");
    case "close":
      return (track === "HH" && (glyph === "x" || glyph === "X")) || (track === "HF" && (glyph === "p" || glyph === "P"));
    case "choke":
      return ((track === "C" || track === "RC") && (glyph === "x" || glyph === "X")) || (track === "HH" && (glyph === "c" || glyph === "C"));
    case "rim":
    case "cross":
      return track === "SD" && (glyph === "d" || glyph === "D");
    case "bell":
      return track === "RC" && (glyph === "x" || glyph === "X");
    case "flam":
    case "ghost":
    case "drag":
      return (track === "SD" || track === "T1" || track === "T2" || track === "T3") && (glyph === "d" || glyph === "D");
  }
}

function isBasicGlyph(value: string): value is BasicGlyph {
  return ["-", "x", "X", "d", "D", "p", "P", "R", "L", "o", "O", "c", "C", "s", "S", "t1", "T1", "t2", "T2", "t3", "T3"].includes(value);
}

function readBasicGlyph(track: SourceTrackName, input: string, cursor: number): { glyph: BasicGlyph; next: number } | null {
  if (track === "DR") {
    const multiChar = ["t1", "T1", "t2", "T2", "t3", "T3"] as const;
    for (const glyph of multiChar) {
      if (input.startsWith(glyph, cursor)) {
        return { glyph, next: cursor + glyph.length };
      }
    }
  }

  const glyph = input[cursor];
  if (glyph === undefined) return null;
  return isBasicGlyph(glyph) ? { glyph, next: cursor + 1 } : null;
}

function readModifier(input: string, start: number): { modifier: Modifier; next: number } | null {
  let end = start;

  while (end < input.length) {
    const char = input[end];
    if (char !== undefined && /[a-z]/.test(char)) {
      end += 1;
    } else {
      break;
    }
  }

  const value = input.slice(start, end);

  if (!MODIFIERS.includes(value as Modifier)) {
    return null;
  }

  return {
    modifier: value as Modifier,
    next: end,
  };
}

function parseMeasureTokens(
  content: string,
  track: SourceTrackName,
  lineNumber: number,
  columnOffset: number,
  errors: ParseError[],
  allowGroups: boolean,
): MeasureToken[] {
  const tokens: MeasureToken[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const char = content[cursor];
    if (char !== undefined && /\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (char === "[") {
      if (!allowGroups) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Nested groups are not allowed",
        });
        break;
      }

      const closeIndex = content.indexOf("]", cursor);

      if (closeIndex === -1) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Unterminated group",
        });
        break;
      }

      const body = content.slice(cursor + 1, closeIndex);
      const colonMatch = body.match(/^(\d+)\s*:\s*(.*)$/);

      let span: number;
      let inner: string;

      if (colonMatch) {
        span = Number(colonMatch[1]);
        const m2 = colonMatch[2];
        inner = m2 !== undefined ? m2 : "";
      } else if (body.trim()) {
        span = 1;
        inner = body.trim();
      } else {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Empty group",
        });
        cursor = closeIndex + 1;
        continue;
      }

      const items = parseMeasureTokens(inner, track, lineNumber, columnOffset + cursor + body.indexOf(inner), errors, false);

      tokens.push({
        kind: "group",
        count: items.length,
        span,
        items,
      });
      cursor = closeIndex + 1;
      continue;
    }

    const parsedGlyph = readBasicGlyph(track, content, cursor);

    if (!parsedGlyph) {
      errors.push({
        line: lineNumber,
        column: columnOffset + cursor,
        message: `Unknown token \`${content[cursor]}\` on track ${track}`,
      });
      cursor += 1;
      continue;
    }

    const glyph = parsedGlyph.glyph;
    let cursorAfterGlyph = parsedGlyph.next;

    if (glyph === "o" || glyph === "O") {
      if (!isTrackGlyphAllowed(track, glyph)) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: `Token \`${glyph}\` is invalid on track ${track}`,
        });
      }

      let dots = 0;
      let halves = 0;
      while (cursorAfterGlyph < content.length) {
        if (content[cursorAfterGlyph] === ".") {
          dots += 1;
          cursorAfterGlyph += 1;
        } else if (content[cursorAfterGlyph] === "/") {
          halves += 1;
          cursorAfterGlyph += 1;
        } else {
          break;
        }
      }

      tokens.push({
        kind: "modified",
        value: glyph === "o" ? "x" : "X",
        modifier: "open",
        dots,
        halves,
      });
      cursor = cursorAfterGlyph;
      continue;
    }

    // DR combined glyph: s+t3 means play s and t3 simultaneously
    if (track === "DR" && content[cursorAfterGlyph] === "+") {
      const combinedItems: { value: BasicGlyph; dots: number; halves: number }[] = [];
      let cursorAfterPlus = cursorAfterGlyph + 1;

      while (cursorAfterPlus < content.length) {
        const cap = content[cursorAfterPlus];
        if (cap !== undefined && /\s/.test(cap)) {
          cursorAfterPlus += 1;
          continue;
        }

        if (cap === "+") {
          cursorAfterPlus += 1;
          continue;
        }

        const parsedPart = readBasicGlyph(track, content, cursorAfterPlus);
        if (!parsedPart) {
          errors.push({
            line: lineNumber,
            column: columnOffset + cursorAfterPlus,
            message: `Unknown token \`${content[cursorAfterPlus]}\` in combined glyph`,
          });
          break;
        }

        let dots = 0;
        let halves = 0;
        let dotCursor = parsedPart.next;
        while (dotCursor < content.length) {
          if (content[dotCursor] === ".") {
            dots += 1;
            dotCursor += 1;
          } else if (content[dotCursor] === "/") {
            halves += 1;
            dotCursor += 1;
          } else {
            break;
          }
        }

        combinedItems.push({ value: parsedPart.glyph, dots, halves });
        cursorAfterPlus = dotCursor;

        // Check if there's another + or if we're done
        if (content[cursorAfterPlus] !== "+") {
          break;
        }
        cursorAfterPlus += 1;
      }

      if (combinedItems.length >= 2) {
        tokens.push({
          kind: "combined",
          items: combinedItems as { value: BasicGlyph; dots: number; halves: number }[],
        });
        cursor = cursorAfterPlus;
        continue;
      }

      // If combinedItems.length < 2, consume the + and fall through
      // (fallthrough without advancing cursor would cause the + to be re-parsed as unknown token)
      cursor = cursorAfterPlus;
    }

    // x/X on SD/T1/T2/T3/BD is sugar for d:cross/D:cross
    if ((track === "SD" || track === "T1" || track === "T2" || track === "T3" || track === "BD") && (glyph === "x" || glyph === "X")) {
      let dots = 0;
      let halves = 0;
      while (cursorAfterGlyph < content.length) {
        if (content[cursorAfterGlyph] === ".") {
          dots += 1;
          cursorAfterGlyph += 1;
        } else if (content[cursorAfterGlyph] === "/") {
          halves += 1;
          cursorAfterGlyph += 1;
        } else {
          break;
        }
      }

      tokens.push({
        kind: "modified",
        value: glyph === "x" ? "d" : "D",
        modifier: "cross",
        dots,
        halves,
      });
      cursor = cursorAfterGlyph;
      continue;
    }

    if (content[cursorAfterGlyph] === ":") {
      if (track === "DR") {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Track `DR` does not support modifiers",
        });
        cursor = cursorAfterGlyph + 1;
        continue;
      }

      if (glyph === "-") {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Rests cannot have modifiers",
        });
        cursor = cursorAfterGlyph + 1;
        continue;
      }

      const parsedModifier = readModifier(content, cursorAfterGlyph + 1);

      if (!parsedModifier) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursorAfterGlyph + 1,
          message: "Unknown modifier",
        });
        cursor = cursorAfterGlyph + 1;
        continue;
      }

      if (!isTrackGlyphAllowed(track, glyph)) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: `Token \`${glyph}\` is invalid on track ${track}`,
        });
      } else if (!isModifierAllowed(track, glyph, parsedModifier.modifier)) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: `Token \`${glyph}:${parsedModifier.modifier}\` is invalid on track ${track}`,
        });
      }

      let dots = 0;
      let halves = 0;
      let suffixCursor = parsedModifier.next;
      while (suffixCursor < content.length) {
        if (content[suffixCursor] === ".") {
          dots += 1;
          suffixCursor += 1;
        } else if (content[suffixCursor] === "/") {
          halves += 1;
          suffixCursor += 1;
        } else {
          break;
        }
      }

      tokens.push({
        kind: "modified",
        value: glyph,
        modifier: parsedModifier.modifier,
        dots,
        halves,
      });
      cursor = suffixCursor;
      continue;
    }

    if (!isTrackGlyphAllowed(track, glyph)) {
      errors.push({
        line: lineNumber,
        column: columnOffset + cursor,
        message: `Token \`${glyph}\` is invalid on track ${track}`,
      });
    }

    let dots = 0;
    let halves = 0;
    let suffixCursor = cursorAfterGlyph;
    while (suffixCursor < content.length) {
      if (content[suffixCursor] === ".") {
        dots += 1;
        suffixCursor += 1;
      } else if (content[suffixCursor] === "/") {
        halves += 1;
        suffixCursor += 1;
      } else {
        break;
      }
    }

    tokens.push({
      kind: "basic",
      value: glyph,
      dots,
      halves,
    });
    cursor = suffixCursor;
  }

  return tokens;
}

function parseTrackName(line: PreprocessedLine, errors: ParseError[]): { track: SourceTrackName; rest: string } | null {
  const match = line.content.match(/^([A-Z0-9]+)\s*(.*)$/);

  if (!match) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: "Expected a track line",
    });
    return null;
  }

  const track = match[1];

  if (track !== "DR" && !TRACKS.includes(track as TrackName)) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: `Unknown track \`${track}\``,
    });
    return null;
  }

  return {
    track: track as SourceTrackName,
    rest: match[2] ?? "",
  };
}

function parseMeasureTail(remainder: string, line: PreprocessedLine, errors: ParseError[]): RawMeasure[] {
  const measures: RawMeasure[] = [];
  let cursor = 0;
  let currentLeftBoundary: "barline" | "repeat_start" | null = null;

  const parseBoundary = (
    index: number,
  ): { length: number; kind: "barline" | "repeat_start" | "repeat_end"; times?: number } | null => {
    if (remainder.startsWith("|:", index)) {
      return { length: 2, kind: "repeat_start" };
    }

    if (remainder.startsWith(":|", index)) {
      return { length: 2, kind: "repeat_end", times: 2 };
    }

    if (remainder.startsWith("|", index)) {
      return { length: 1, kind: "barline" };
    }

    return null;
  };

  while (cursor < remainder.length) {
    while (cursor < remainder.length) {
      const char = remainder[cursor];
      if (char !== undefined && /\s/.test(char)) {
        cursor += 1;
      } else {
        break;
      }
    }

    if (cursor >= remainder.length) {
      break;
    }

    if (currentLeftBoundary === null) {
      const startBoundary = parseBoundary(cursor);

      if (!startBoundary || (startBoundary.kind !== "barline" && startBoundary.kind !== "repeat_start")) {
        errors.push({
          line: line.lineNumber,
          column: line.content.indexOf(remainder.slice(cursor)) + 1,
          message: "Expected `|` or `|:` to start a measure",
        });
        break;
      }

      currentLeftBoundary = startBoundary.kind;
      cursor += startBoundary.length;
    }

    const endBoundaryMatch = remainder.slice(cursor).match(/\|:|:\|x\d+|:\||\|/);

    if (!endBoundaryMatch || endBoundaryMatch.index === undefined) {
      errors.push({
        line: line.lineNumber,
        column: line.content.indexOf(remainder.slice(cursor)) + 1,
        message: "Unterminated measure",
      });
      break;
    }

    const endIndex = cursor + endBoundaryMatch.index;
    const endBoundary = parseBoundary(endIndex);

    if (!endBoundary) {
      errors.push({
        line: line.lineNumber,
        column: endIndex + 1,
        message: "Invalid measure boundary",
      });
      break;
    }

    const content = remainder.slice(cursor, endIndex).trim();

    // Check for inline repeat: "xxxx *3" (content with *N)
    const inlineRepeatMatch = content.match(/^(.*?)\s*\*\s*(\d+)\s*$/);
    const m1 = inlineRepeatMatch?.[1];
    const m2 = inlineRepeatMatch?.[2];
    if (inlineRepeatMatch && m1 !== undefined && m2 !== undefined) {
      const measureContent = m1.trim();
      const repeatCount = parseInt(m2, 10);
      if (repeatCount >= 2 && measureContent !== "") {
        // Valid inline repeat: content *N
        measures.push({
          content: measureContent,
          repeatStart: currentLeftBoundary === "repeat_start",
          repeatEnd: endBoundary.kind === "repeat_end",
          repeatTimes: endBoundary.kind === "repeat_end" ? endBoundary.times : undefined,
          repeatCount,
        });
        currentLeftBoundary = endBoundary.kind === "repeat_start" ? "repeat_start" : "barline";
        cursor = endIndex + endBoundary.length;
        continue;
      }
      // repeatCount < 2 or empty content - invalid, fall through to error
    }

    // Check for bare *N macro: "*2" expands to 2 empty measures
    // Only matches when content is EXACTLY *N (whitespace allowed around N)
    const bareStarMatch = content.match(/^\s*\*\s*(\d+)\s*$/);
    const bsm1 = bareStarMatch?.[1];
    if (bareStarMatch && bsm1 !== undefined) {
      const count = parseInt(bsm1, 10);
      if (count >= 1) {
        for (let i = 0; i < count; i++) {
          measures.push({
            content: "",
            repeatStart: i === 0 ? currentLeftBoundary === "repeat_start" : false,
            repeatEnd: i === count - 1 ? endBoundary.kind === "repeat_end" : false,
            repeatTimes: i === count - 1 && endBoundary.kind === "repeat_end" ? endBoundary.times : undefined,
          });
        }
        currentLeftBoundary = endBoundary.kind === "repeat_start" ? "repeat_start" : "barline";
        cursor = endIndex + endBoundary.length;
        continue;
      }
      errors.push({
        line: line.lineNumber,
        column: line.content.indexOf(content) + 1,
        message: "Macro expansion count must be at least 1",
      });
      currentLeftBoundary = endBoundary.kind === "repeat_start" ? "repeat_start" : "barline";
      cursor = endIndex + endBoundary.length;
      continue;
    }

    // Check for multi-rest visual shorthand: |- 8 -| or |-8-
    // Dashes on both sides required, spaces around number allowed.
    const multiRestMatch = content.match(/^-+ *(\d+) *-+$/);
    const mrm1 = multiRestMatch?.[1];
    if (multiRestMatch && mrm1 !== undefined) {
      const count = parseInt(mrm1, 10);
      if (count < 1) {
        errors.push({
          line: line.lineNumber,
          column: line.content.indexOf(content) + 1,
          message: "Multi-rest count must be at least 1",
        });
        currentLeftBoundary = endBoundary.kind === "repeat_start" ? "repeat_start" : "barline";
        cursor = endIndex + endBoundary.length;
        continue;
      }
      measures.push({
        content: "",
        tokens: [],
        repeatStart: false,
        repeatEnd: false,
        multiRestCount: count,
      });
      currentLeftBoundary = "barline";
      cursor = endIndex + endBoundary.length;
      continue;
    }

    // Regular measure (no special shorthand)
    measures.push({
      content,
      repeatStart: currentLeftBoundary === "repeat_start",
      repeatEnd: endBoundary.kind === "repeat_end",
      repeatTimes: endBoundary.kind === "repeat_end" ? endBoundary.times : undefined,
    });

    currentLeftBoundary = endBoundary.kind === "repeat_start" ? "repeat_start" : "barline";
    cursor = endIndex + endBoundary.length;
  }

  return measures;
}

function parseTrackLine(line: PreprocessedLine, errors: ParseError[]): ParsedTrackLine | null {
  const parsed = parseTrackName(line, errors);

  if (!parsed) {
    return null;
  }

  const measures = parseMeasureTail(parsed.rest, line, errors);

  if (measures.length === 0) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: `Track \`${parsed.track}\` does not contain any measures`,
    });
    return null;
  }

  return {
    track: parsed.track,
    lineNumber: line.lineNumber,
    measures: measures.flatMap((measure, _measureIndex) => {
      // Check for *N inline repeat: "xxxx *3" means repeat "xxxx" 3 times
      const inlineRepeatMatch = measure.content.match(/^(.*?)\s*\*\s*(\d+)\s*$/);
      const m1 = inlineRepeatMatch?.[1];
      const m2 = inlineRepeatMatch?.[2];
      if (inlineRepeatMatch && m1 !== undefined && m2 !== undefined && m1.trim() !== "") {
        const repeatCount = parseInt(m2, 10);
        if (repeatCount >= 2) {
          const measureContent = m1.trim();
          const parsedTokens = parseMeasureTokens(
            measureContent,
            parsed.track,
            line.lineNumber,
            1,
            errors,
            true,
          );
          const expanded: ParsedMeasure[] = [];
          for (let i = 0; i < repeatCount; i++) {
            expanded.push({
              content: measureContent,
              tokens: parsedTokens,
              repeatStart: i === 0 ? measure.repeatStart : false,
              repeatEnd: i === repeatCount - 1 ? measure.repeatEnd : false,
              repeatTimes: i === repeatCount - 1 ? measure.repeatTimes : undefined,
            });
          }
          return expanded;
        }
      }

      // Check for bare *N repeat marker - repeat this measure N times
      // | *2 | means repeat this (blank) measure 2 times = 2 blank measures
      const bareRepeatMatch = measure.content.match(/^\*(\d+)$/);
      const bm1 = bareRepeatMatch?.[1];
      if (bareRepeatMatch && bm1 !== undefined) {
        const count = parseInt(bm1, 10);
        if (count < 1) {
          errors.push({
            line: line.lineNumber,
            column: 1,
            message: "Repeat count must be at least 1",
          });
          return [];
        }
        const expanded: ParsedMeasure[] = [];
        for (let i = 0; i < count; i++) {
          expanded.push({
            content: "",
            tokens: [],
            repeatStart: i === 0 ? measure.repeatStart : false,
            repeatEnd: i === count - 1 ? measure.repeatEnd : false,
            repeatTimes: i === count - 1 ? measure.repeatTimes : undefined,
          });
        }
        return expanded;
      }

      const measureStart = line.content.indexOf(measure.content);
      const parsedTokens = parseMeasureTokens(
        measure.content,
        parsed.track,
        line.lineNumber,
        measureStart === -1 ? 1 : measureStart + 1,
        errors,
        true,
      );

      // Inline repeat: replicate this measure N times (e.g., "xxxx *3" → 3 measures with same notes)
      if (measure.repeatCount !== undefined && measure.repeatCount > 1) {
        const expanded: ParsedMeasure[] = [];
        for (let i = 0; i < measure.repeatCount; i++) {
          expanded.push({
            content: measure.content,
            tokens: parsedTokens,
            repeatStart: i === 0 ? measure.repeatStart : false,
            repeatEnd: i === measure.repeatCount - 1 ? measure.repeatEnd : false,
            repeatTimes: i === measure.repeatCount - 1 ? measure.repeatTimes : undefined,
          });
        }
        return expanded;
      }

      return [{
        content: measure.content,
        tokens: parsedTokens,
        repeatStart: measure.repeatStart,
        repeatEnd: measure.repeatEnd,
        repeatTimes: measure.repeatTimes,
        multiRestCount: measure.multiRestCount,
      }];
    }),
    source: line,
  };
}

function splitParagraphs(lines: PreprocessedLine[], errors: ParseError[]): TrackParagraph[] {
  const rawParagraphs: PreprocessedLine[][] = [];
  let current: PreprocessedLine[] = [];

  for (const line of lines) {
    if (line.kind === "blank") {
      if (current.length > 0) {
        rawParagraphs.push(current);
        current = [];
      }

      continue;
    }

    if (line.kind === "content") {
      current.push(line);
    }
  }

  if (current.length > 0) {
    rawParagraphs.push(current);
  }

  return rawParagraphs
    .map((paragraphLines) => {
      const parsedLines = paragraphLines
        .filter((line) => {
          const first = line.content.split(/\s+/)[0];
          return !HEADER_FIELDS.includes(first as (typeof HEADER_FIELDS)[number]);
        })
        .map((line) => parseTrackLine(line, errors))
        .filter((line): line is ParsedTrackLine => line !== null);

      const firstLine = paragraphLines[0];
      if (firstLine === undefined) return null;
      return {
        startLine: firstLine.lineNumber,
        lines: parsedLines,
      };
    })
    .filter((paragraph): paragraph is TrackParagraph => paragraph !== null && paragraph.lines.length > 0);
}

export function parseDocumentSkeleton(source: string): DocumentSkeleton {
  const lines = preprocessSource(source);
  const errors: ParseError[] = [];
  const headers: HeaderAccumulator = {};
  let bodyStartIndex = lines.findIndex((line) => line.kind === "content");

  if (bodyStartIndex === -1) {
    bodyStartIndex = lines.length;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;

    if (line.kind !== "content") {
      continue;
    }

    const isHeader = parseHeaderLine(line, headers, errors);

    if (!isHeader) {
      const firstToken = line.content.split(/\s+/)[0];
      if (firstToken && /^[a-z][a-z0-9-]*$/i.test(firstToken) && /^[a-z]/.test(firstToken) && !HEADER_FIELDS.includes(firstToken as (typeof HEADER_FIELDS)[number])) {
        errors.push({
          line: line.lineNumber,
          column: 1,
          message: `Unknown header \`${firstToken}\``,
        });
        bodyStartIndex = index + 1;
        continue;
      }

      bodyStartIndex = index;
      break;
    }

    bodyStartIndex = index + 1;
  }

  const bodyLines = lines.slice(bodyStartIndex);
  const unexpectedHeader = bodyLines.find((line) => line.kind === "content" && line.content.split(/\s+/)[0] && HEADER_FIELDS.includes(line.content.split(/\s+/)[0] as (typeof HEADER_FIELDS)[number]));

  if (unexpectedHeader) {
    errors.push({
      line: unexpectedHeader.lineNumber,
      column: 1,
      message: "Headers must appear before track content",
    });
  }

  return {
    headers: finalizeHeaders(headers, errors),
    paragraphs: splitParagraphs(bodyLines, errors),
    errors,
  };
}
