import { parser } from "./drum_mark.parser";
import type {
  DocumentSkeleton,
  TrackParagraph,
  ParsedTrackLine,
  ParsedMeasure,
  MeasureToken,
  TokenGlyph,
  BasicGlyph,
  Modifier,
  BarlineType,
  SourceTrackName,
  ParseError,
} from "./types";

const parserInstance = parser.configure({ strict: false });

const MODIFIER_NAMES = new Set([
  "accent", "open", "half-open", "close", "choke", "bell",
  "rim", "cross", "flam", "ghost", "drag", "roll", "dead",
]);

const HEADER_FIELDS = ["title", "subtitle", "composer", "tempo", "time", "grouping", "note", "divisions"] as const;
type HeaderField = (typeof HEADER_FIELDS)[number];

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

interface NodeInfo {
  name: string;
  from: number;
  to: number;
}

function collectNodes(tree: { cursor: () => { next: () => boolean; name: string; from: number; to: number } }): NodeInfo[] {
  const nodes: NodeInfo[] = [];
  const cursor = tree.cursor();
  while (cursor.next()) {
    nodes.push({ name: cursor.name, from: cursor.from, to: cursor.to });
  }
  return nodes;
}

function childNodes(allNodes: NodeInfo[], parentStart: number, parentEnd: number): NodeInfo[] {
  const result: NodeInfo[] = [];
  for (const n of allNodes) {
    if (n.from >= parentEnd) break;
    if (n.from >= parentStart && n.to <= parentEnd && n !== null) {
      result.push(n);
    }
  }
  return result;
}

export function parseDocumentSkeletonFromLezer(source: string): DocumentSkeleton {
  const tree = parserInstance.parse(source);
  const allNodes = collectNodes(tree);

  const errors: ParseError[] = [];

  // Find top-level nodes
  const headerSection = allNodes.find(n => n.name === "HeaderSection");
  const trackBody = allNodes.find(n => n.name === "TrackBody");

  // --- Parse headers ---
  const headers = {} as Record<string, unknown>;
  if (headerSection) {
    const headerChildren = childNodes(allNodes, headerSection.from, headerSection.to);
    for (const hc of headerChildren) {
      if (hc.name !== "HeaderLine") continue;
      const lineChildren = childNodes(allNodes, hc.from, hc.to);
      parseHeaderLine(lineChildren, source, headers, errors);
    }
  }

  // Defaults
  const result: DocumentSkeleton = {
    headers: {
      title: headers.title as DocumentSkeleton["headers"]["title"],
      subtitle: headers.subtitle as DocumentSkeleton["headers"]["subtitle"],
      composer: headers.composer as DocumentSkeleton["headers"]["composer"],
      tempo: (headers.tempo as DocumentSkeleton["headers"]["tempo"]) ?? { field: "tempo", value: 120, line: 0 },
      time: (headers.time as DocumentSkeleton["headers"]["time"]) ?? { field: "time", beats: 4, beatUnit: 4, line: 0 },
      grouping: headers.grouping as DocumentSkeleton["headers"]["grouping"],
      note: headers.note as DocumentSkeleton["headers"]["note"],
      divisions: headers.divisions as DocumentSkeleton["headers"]["divisions"],
    },
    paragraphs: [],
    errors,
  };

  // --- Parse track body ---
  if (!trackBody) return result;

  const bodyChildren = childNodes(allNodes, trackBody.from, trackBody.to);
  const trackLines: { line: NodeInfo; newlineCount: number }[] = [];

  // Walk body children: TrackLine, Newline+, TrackLine, ...
  // Collect TrackLines and count newlines between them
  for (let i = 0; i < bodyChildren.length; i++) {
    const node = bodyChildren[i];
    if (node.name === "TrackLine") {
      let nlCount = 0;
      // Count consecutive Newlines before this TrackLine
      for (let j = i - 1; j >= 0; j--) {
        if (bodyChildren[j].name === "Newline") nlCount++;
        else break;
      }
      trackLines.push({ line: node, newlineCount: nlCount });
    }
  }

  // Group TrackLines into paragraphs
  const paragraphs: TrackParagraph[] = [];
  let currentLines: ParsedTrackLine[] = [];
  let currentStartLine = 0;

  for (const tl of trackLines) {
    const lineNode = tl.line;
    const lineChildren = childNodes(allNodes, lineNode.from, lineNode.to);
    const lineNumber = source.slice(0, lineNode.from).split("\n").length;

    // Count Newline children in this TrackLine to detect line-end newline
    let track: SourceTrackName | "ANONYMOUS" = "ANONYMOUS";
    const measures: ParsedMeasure[] = [];
    let currentMeasureContent: NodeInfo | null = null;
    let currentBarline: NodeInfo | null = null;

    for (const child of lineChildren) {
      if (child.name === "TrackName") {
        track = nodeText(child, source) as SourceTrackName;
      } else if (child.name === "Barline") {
        currentBarline = child;
      } else if (child.name === "MeasureContent") {
        currentMeasureContent = child;
      }
      // When we have both a barline and measure content, create a measure
      if (currentBarline && currentMeasureContent) {
        const barlineText = nodeText(currentBarline, source);
        const barline = getBarlineType(barlineText);
        const repeatStart = barlineText.includes("|:");
        const repeatEnd = barlineText.includes(":|");

        const mcChildren = childNodes(allNodes, currentMeasureContent.from, currentMeasureContent.to);
        const tokens: MeasureToken[] = [];
        for (const mc of mcChildren) {
          if (mc.name === "MeasureToken") {
            const tokChildren = childNodes(allNodes, mc.from, mc.to);
            for (const tc of tokChildren) {
              if (tc.name === "GlyphToken") {
                tokens.push(parseGlyphFromText(nodeText(tc, source)));
              }
              // TODO: CombinedHit, GroupExpr, NavMarker, NavJump, MeasureRepeat, InlineBracedBlock
            }
          }
        }

        measures.push({
          content: nodeText(currentMeasureContent, source),
          tokens,
          repeatStart,
          repeatEnd,
          barline,
        });

        currentBarline = null;
        currentMeasureContent = null;
      }
    }

    // Trailing barline without content → skip (ghost measure)
    // Only add the line if it has measures
    if (measures.length === 0) continue;

    // If newlineCount > 1 (blank line before), start new paragraph
    if (tl.newlineCount > 1 && currentLines.length > 0) {
      paragraphs.push({ startLine: currentStartLine, lines: currentLines });
      currentLines = [];
      currentStartLine = lineNumber;
    }

    if (currentLines.length === 0) {
      currentStartLine = lineNumber;
    }

    currentLines.push({
      track,
      lineNumber,
      measures,
      source: {
        kind: "content",
        lineNumber,
        raw: "",
        content: nodeText(lineNode, source),
        startOffset: lineNode.from,
      },
    });
  }

  if (currentLines.length > 0) {
    paragraphs.push({ startLine: currentStartLine, lines: currentLines });
  }

  result.paragraphs = paragraphs;
  return result;
}

function parseHeaderLine(
  children: NodeInfo[],
  source: string,
  headers: Record<string, unknown>,
  errors: ParseError[],
): void {
  const newlineIdx = children.findIndex(c => c.name === "Newline");
  const contentChildren = children.slice(0, newlineIdx);

  const headerTypes = ["FreeTextHeader", "TempoHeader", "TimeHeader", "GroupingHeader", "NoteHeader", "DivisionsHeader"];
  const headerNode = contentChildren.find(c => headerTypes.includes(c.name));
  if (!headerNode) return;

  const lineNumber = source.slice(0, headerNode.from).split("\n").length;

  if (headerNode.name === "FreeTextHeader") {
    // Literal keywords (title, subtitle, composer) don't appear as child nodes.
    // Extract the field name from the node text: "title \"...\"" → field="title"
    const headerText = nodeText(headerNode, source);
    const spaceIdx = headerText.indexOf(" ");
    const field = (spaceIdx > 0 ? headerText.slice(0, spaceIdx) : headerText) as HeaderField;
    const strNode = contentChildren.find(c => c.name === "String");
    if (field && strNode) {
      const value = source.slice(strNode.from + 1, strNode.to - 1); // strip quotes
      headers[field] = { field, value, line: lineNumber };
    }
  } else if (headerNode.name === "TempoHeader") {
    const intNode = contentChildren.find(c => c.name === "Integer");
    if (intNode) {
      headers["tempo"] = { field: "tempo" as const, value: parseInt(nodeText(intNode, source), 10), line: lineNumber };
    }
  } else if (headerNode.name === "TimeHeader") {
    const ints = contentChildren.filter(c => c.name === "Integer");
    if (ints.length === 2) {
      headers["time"] = {
        field: "time" as const,
        beats: parseInt(nodeText(ints[0], source), 10),
        beatUnit: parseInt(nodeText(ints[1], source), 10),
        line: lineNumber,
      };
    }
  } else if (headerNode.name === "GroupingHeader") {
    const ints = contentChildren.filter(c => c.name === "Integer");
    const values = ints.map(i => parseInt(nodeText(i, source), 10));
    headers["grouping"] = { field: "grouping" as const, values, line: lineNumber };
  } else if (headerNode.name === "NoteHeader") {
    const ints = contentChildren.filter(c => c.name === "Integer");
    if (ints.length === 2) {
      headers["note"] = {
        field: "note" as const,
        value: { numerator: parseInt(nodeText(ints[0], source), 10), denominator: parseInt(nodeText(ints[1], source), 10) },
        line: lineNumber,
      };
    }
  } else if (headerNode.name === "DivisionsHeader") {
    const intNode = contentChildren.find(c => c.name === "Integer");
    if (intNode) {
      headers["divisions"] = { field: "divisions" as const, value: parseInt(nodeText(intNode, source), 10), line: lineNumber };
    }
  }
}
