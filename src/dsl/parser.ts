import {
  HEADER_FIELDS,
  MODIFIERS,
  TRACKS,
  type DocumentSkeleton,
  type MeasureToken,
  type ParseError,
  type ParsedHeaders,
  type ParsedTrackLine,
  type PreprocessedLine,
  type TrackParagraph,
  type TrackName,
  type Modifier,
  type BasicGlyph,
} from "./types";
import { preprocessSource } from "./preprocess";

type HeaderAccumulator = Partial<ParsedHeaders>;
type RawMeasure = Omit<ParsedTrackLine["measures"][number], "tokens">;

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function parseHeaderLine(line: PreprocessedLine, headers: HeaderAccumulator, errors: ParseError[]): boolean {
  const parts = line.content.split(/\s+/);
  const [field, value] = parts;

  if (!field || !HEADER_FIELDS.includes(field as (typeof HEADER_FIELDS)[number])) {
    return false;
  }

  if (parts.length !== 2 || !value) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: `Header \`${field}\` expects a single value`,
    });
    return true;
  }

  switch (field) {
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
  }

  return false;
}

function finalizeHeaders(headers: HeaderAccumulator, errors: ParseError[]): ParsedHeaders {
  return {
    tempo: headers.tempo ?? { field: "tempo", value: 120, line: 0 },
    time:
      headers.time ??
      (() => {
        errors.push({
          line: 1,
          column: 1,
          message: "Missing required header `time`",
        });
        return { field: "time", beats: 4, beatUnit: 4, line: 0 };
      })(),
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
  };
}

function isTrackGlyphAllowed(track: TrackName, glyph: BasicGlyph): boolean {
  switch (track) {
    case "HH":
    case "RC":
    case "C":
      return glyph === "-" || glyph === "x" || glyph === "X" || glyph === "o" || glyph === "c";
    case "SD":
    case "T1":
    case "T2":
    case "T3":
      return glyph === "-" || glyph === "d" || glyph === "D" || glyph === "g";
    case "BD":
      return glyph === "-" || glyph === "p" || glyph === "g";
    case "HF":
      return glyph === "-" || glyph === "p";
    case "ST":
      return glyph === "-" || glyph === "R" || glyph === "L";
  }
}

function isModifierAllowed(track: TrackName, glyph: Exclude<BasicGlyph, "-">, modifier: Modifier): boolean {
  switch (modifier) {
    case "open":
      return track === "HH" && (glyph === "x" || glyph === "X");
    case "close":
      return (track === "HH" && (glyph === "x" || glyph === "X")) || (track === "HF" && glyph === "p");
    case "choke":
      return (track === "C" || track === "RC") && (glyph === "x" || glyph === "X");
    case "rim":
    case "cross":
      return track === "SD" && (glyph === "d" || glyph === "D");
    case "bell":
      return track === "RC" && (glyph === "x" || glyph === "X");
    case "flam":
      return (track === "SD" || track === "T1" || track === "T2" || track === "T3") && (glyph === "d" || glyph === "D");
  }
}

function isBasicGlyph(value: string): value is BasicGlyph {
  return ["-", "x", "X", "d", "D", "g", "p", "R", "L", "o", "c"].includes(value);
}

function readModifier(input: string, start: number): { modifier: Modifier; next: number } | null {
  let end = start;

  while (end < input.length && /[a-z]/.test(input[end])) {
    end += 1;
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
  track: TrackName,
  lineNumber: number,
  columnOffset: number,
  errors: ParseError[],
  allowGroups: boolean,
): MeasureToken[] {
  const tokens: MeasureToken[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    if (/\s/.test(content[cursor])) {
      cursor += 1;
      continue;
    }

    if (content[cursor] === "[") {
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
        inner = colonMatch[2];
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

    const glyph = content[cursor];

    if (!isBasicGlyph(glyph)) {
      errors.push({
        line: lineNumber,
        column: columnOffset + cursor,
        message: `Unknown token \`${glyph}\` on track ${track}`,
      });
      cursor += 1;
      continue;
    }

    if (!isTrackGlyphAllowed(track, glyph)) {
      errors.push({
        line: lineNumber,
        column: columnOffset + cursor,
        message: `Token \`${glyph}\` is invalid on track ${track}`,
      });
      cursor += 1;
      continue;
    }

    if (glyph === "o") {
      tokens.push({
        kind: "modified",
        value: "x",
        modifier: "open",
      });
      cursor += 1;
      continue;
    }

    if (content[cursor + 1] === ":") {
      if (glyph === "-") {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: "Rests cannot have modifiers",
        });
        cursor += 2;
        continue;
      }

      const parsedModifier = readModifier(content, cursor + 2);

      if (!parsedModifier) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor + 2,
          message: "Unknown modifier",
        });
        cursor += 2;
        continue;
      }

      if (!isModifierAllowed(track, glyph, parsedModifier.modifier)) {
        errors.push({
          line: lineNumber,
          column: columnOffset + cursor,
          message: `Token \`${glyph}:${parsedModifier.modifier}\` is invalid on track ${track}`,
        });
      }

      tokens.push({
        kind: "modified",
        value: glyph,
        modifier: parsedModifier.modifier,
      });
      cursor = parsedModifier.next;
      continue;
    }

    tokens.push({
      kind: "basic",
      value: glyph,
    });
    cursor += 1;
  }

  return tokens;
}

function parseTrackName(line: PreprocessedLine, errors: ParseError[]): { track: TrackName; rest: string } | null {
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

  if (!TRACKS.includes(track as TrackName)) {
    errors.push({
      line: line.lineNumber,
      column: 1,
      message: `Unknown track \`${track}\``,
    });
    return null;
  }

  return {
    track: track as TrackName,
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

    if (remainder.startsWith(":|x", index)) {
      const match = remainder.slice(index).match(/^:\|x(\d+)/);

      if (!match) {
        return null;
      }

      return { length: match[0].length, kind: "repeat_end", times: Number(match[1]) };
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
    while (cursor < remainder.length && /\s/.test(remainder[cursor])) {
      cursor += 1;
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

    const endBoundaryMatch = remainder.slice(cursor).match(/(?:\|:|:\|x\d+|:\||\|)/);

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
    measures: measures.map((measure) => {
      const measureStart = line.content.indexOf(measure.content);
      return {
        ...measure,
        tokens: parseMeasureTokens(
          measure.content,
          parsed.track,
          line.lineNumber,
          (measureStart === -1 ? 1 : measureStart + 1),
          errors,
          true,
        ),
      };
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

      return {
        startLine: paragraphLines[0].lineNumber,
        lines: parsedLines,
      };
    })
    .filter((paragraph) => paragraph.lines.length > 0);
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

    if (line.kind !== "content") {
      continue;
    }

    const isHeader = parseHeaderLine(line, headers, errors);

    if (!isHeader) {
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
