import { DrumMarkParser } from "./drum_mark.parser";
import type {
  DocumentSkeleton,
  ParsedHeaders,
  TrackParagraph,
  ParsedTrackLine,
  ParsedMeasure,
  MeasureToken,
  TokenGlyph,
  BasicGlyph,
  Modifier,
  BarlineType,
  SourceTrackName,
  PreprocessedLine,
  ParseError,
} from "./types";

const parser = DrumMarkParser.configure({ strict: false });

const MODIFIER_NAMES = new Set([
  "accent", "open", "half-open", "close", "choke", "bell",
  "rim", "cross", "flam", "ghost", "drag", "roll", "dead",
]);

function nodeText(node: { from: number; to: number }, source: string): string {
  return source.slice(node.from, node.to);
}

function getBarlineType(text: string): BarlineType {
  switch (text) {
    case "||": return "double";
    case "||.": return "final";
    case "|:": return "repeatStart";
    case ":|": return "repeatEnd";
    case "|.": return "end";
    case "|": return "single";
    default:
      if (text.startsWith("|:x")) return "repeatStart";
      if (text.startsWith(":|x")) return "repeatEnd";
      if (text.startsWith("|x")) return "end";
      return "single";
  }
}

function isIgnorable(name: string): boolean {
  return name === "WS" || name === "⚠";
}

function parseGlyphFromText(text: string): TokenGlyph {
  let dots = 0;
  let halves = 0;
  let stars = 0;
  const modifiers: Modifier[] = [];

  const parts = text.split(":");
  const value = parts[0] as BasicGlyph;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === ".") dots++;
    else if (part === "*") stars++;
    else if (part === "/") halves++;
    else if (MODIFIER_NAMES.has(part)) modifiers.push(part as Modifier);
  }

  return { kind: "basic", value, dots, halves, stars, modifiers, trackOverride: undefined };
}

export function parseDocumentSkeletonFromLezer(source: string): DocumentSkeleton {
  const tree = parser.parse(source);
  const errors: ParseError[] = [];

  const headers: ParsedHeaders = {
    tempo: { field: "tempo", value: 120, line: 1 },
    time: { field: "time", beats: 4, beatUnit: 4, line: 1 },
    grouping: { field: "grouping", values: [4], line: 1 },
  };

  const paragraphs: TrackParagraph[] = [];

  // Collect all nodes in a flat list first to avoid cursor issues
  interface NodeInfo {
    name: string;
    from: number;
    to: number;
    parent?: string;
  }

  const allNodes: NodeInfo[] = [];
  const cursor = tree.cursor();

  while (cursor.next()) {
    allNodes.push({
      name: cursor.name,
      from: cursor.from,
      to: cursor.to,
    });
  }

  // Process headers - find all HeaderLine nodes and extract content
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    if (node.name === "HeaderLine") {
      const text = nodeText(node, source);
      const line = source.slice(0, node.from).split("\n").length;

      if (text.startsWith("title ")) {
        headers.title = { field: "title", value: text.slice(6).trim(), line };
      } else if (text.startsWith("subtitle ")) {
        headers.subtitle = { field: "subtitle", value: text.slice(9).trim(), line };
      } else if (text.startsWith("composer ")) {
        headers.composer = { field: "composer", value: text.slice(8).trim(), line };
      } else if (text.startsWith("tempo ")) {
        const val = parseInt(text.slice(6), 10);
        headers.tempo = { field: "tempo", value: isNaN(val) ? 120 : val, line };
      } else if (text.startsWith("time ")) {
        const match = text.match(/time (\d+)\/(\d+)/);
        if (match) {
          headers.time = { field: "time", beats: parseInt(match[1], 10), beatUnit: parseInt(match[2], 10), line };
        }
      } else if (text.startsWith("note ")) {
        const match = text.match(/note (\d+)\/(\d+)/);
        if (match) {
          headers.note = { field: "note", value: parseInt(match[2], 10), line };
        }
      } else if (text.startsWith("grouping ")) {
        const match = text.match(/grouping ([\d+].*)/);
        if (match) {
          headers.grouping = { field: "grouping", values: match[1].split("+").map((s) => parseInt(s.trim(), 10)), line };
        }
      }
    }
  }

  // Process track paragraphs - each TrackParagraph is a group of TrackLines
  for (let i = 0; i < allNodes.length; i++) {
    if (allNodes[i].name === "TrackParagraph") {
      const paraStart = allNodes[i].from;
      const paraEnd = allNodes[i].to;
      const startLine = source.slice(0, paraStart).split("\n").length;

      // Find all TrackLine nodes within this paragraph
      const lines: ParsedTrackLine[] = [];
      let currentLineNumber = startLine;

      for (let j = i + 1; j < allNodes.length; j++) {
        const node = allNodes[j];

        // If we've gone past this paragraph, stop
        if (node.from >= paraEnd) break;

        if (node.name === "TrackLine") {
          // Find all content within this TrackLine
          const trackLineEnd = node.to;
          let track: SourceTrackName | "ANONYMOUS" = "ANONYMOUS";
          const measures: ParsedMeasure[] = [];

          // Look for TrackName within this TrackLine
          for (let k = j + 1; k < allNodes.length; k++) {
            const child = allNodes[k];
            if (child.from >= trackLineEnd) break;

            if (child.name === "TrackName") {
              track = nodeText(child, source) as SourceTrackName;
            } else if (child.name === "MeasureContent") {
              // Find all MeasureToken/GlyphToken/BasicGlyph within this MeasureContent
              const measureEnd = child.to;
              const measureTokens: MeasureToken[] = [];

              for (let m = k + 1; m < allNodes.length; m++) {
                const mc = allNodes[m];
                if (mc.from >= measureEnd) break;

                if (mc.name === "GlyphToken") {
                  const text = nodeText(mc, source);
                  measureTokens.push(parseGlyphFromText(text));
                } else if (mc.name === "BasicGlyph") {
                  // This is just the glyph value itself
                  const text = nodeText(mc, source);
                  measureTokens.push(parseGlyphFromText(text));
                }
              }

              // Check for barline after this measure
              let barline: BarlineType | undefined;
              let repeatStart = false;
              let repeatEnd = false;

              for (let m = k + 1; m < allNodes.length; m++) {
                const mc = allNodes[m];
                if (mc.from >= measureEnd) break;
                if (mc.name === "Barline") {
                  const barlineText = nodeText(mc, source);
                  barline = getBarlineType(barlineText);
                  repeatStart = barlineText.includes("|:");
                  repeatEnd = barlineText.includes(":|");
                  break;
                }
              }

              measures.push({
                content: nodeText(child, source),
                tokens: measureTokens,
                repeatStart,
                repeatEnd,
                barline,
              });
            }
          }

          if (measures.length > 0) {
            lines.push({
              track,
              lineNumber: currentLineNumber,
              measures,
              source: {
                kind: "content",
                lineNumber: currentLineNumber,
                raw: "",
                content: nodeText(node, source),
                startOffset: node.from,
              },
            });
            currentLineNumber++;
          }
        }
      }

      if (lines.length > 0) {
        paragraphs.push({ startLine, lines });
      }
    }
  }

  return { headers, paragraphs, errors };
}
