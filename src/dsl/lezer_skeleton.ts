import { parser } from "./drum_mark.parser";
import { inferGrouping } from "./parser";
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
  ParsedStartNav,
  ParsedEndNav,
  StartNavKind,
  EndNavKind,
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

const TRACK_NAMES = new Set([
  "HH", "HF", "SD", "BD", "BD2",
  "T1", "T2", "T3", "T4",
  "RC", "RC2",
  "C", "C2",
  "SPL", "CHN", "CB", "WB", "CL", "ST",
]);

const TRACK_NAMES_SORTED = [...TRACK_NAMES].sort((a, b) => b.length - a.length);

// All tokens that can appear as BasicGlyph in the grammar, sorted longest-first
// so multi-char tokens match before their single-char prefixes
const ALL_GLYPHS = [
  "BD2", "RC2",
  "HH", "HF", "SD", "BD", "RC", "ST",
  "spl", "SPL", "chn", "CHN",
  "cb", "CB", "wb", "WB", "cl", "CL",
  "c2", "C2", "b2", "B2", "r2", "R2",
  "t1", "T1", "t2", "T2", "t3", "T3", "t4", "T4",
  "x", "X", "d", "D", "s", "S", "b", "B", "r", "R",
  "c", "C", "o", "O", "g", "G", "p", "P", "L",
  "-",
];

function parseGlyphFromText(text: string): TokenGlyph {
  let trackOverride: string | undefined;
  let rest = text;

  // Detect summon prefix: TrackName:rest
  for (const name of TRACK_NAMES_SORTED) {
    if (text.startsWith(name + ":")) {
      const afterPrefix = text.slice(name.length + 1);
      // Only treat as summon prefix if there's a valid glyph after the colon
      const hasGlyph = ALL_GLYPHS.some(g => afterPrefix.startsWith(g));
      if (hasGlyph) {
        trackOverride = name;
        rest = afterPrefix;
      }
      break;
    }
  }

  // Extract basic glyph from beginning of rest (longest match first)
  let value: BasicGlyph = "-";
  let pos = 0;
  for (const glyph of ALL_GLYPHS) {
    if (rest.startsWith(glyph)) {
      value = glyph as BasicGlyph;
      pos = glyph.length;
      break;
    }
  }

  // Parse remaining characters: . / * :modifier
  let dots = 0;
  let halves = 0;
  let stars = 0;
  const modifiers: Modifier[] = [];

  while (pos < rest.length) {
    const ch = rest[pos];
    if (ch === ".") { dots++; pos++; }
    else if (ch === "*") { stars++; pos++; }
    else if (ch === "/") { halves++; pos++; }
    else if (ch === ":") {
      const nextColon = rest.indexOf(":", pos + 1);
      const modName = nextColon > pos ? rest.slice(pos + 1, nextColon) : rest.slice(pos + 1);
      if (modName && MODIFIER_NAMES.has(modName)) {
        modifiers.push(modName as Modifier);
        pos += 1 + modName.length;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return { kind: "basic", value, dots, halves, stars, modifiers, trackOverride };
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

function parseMeasureTokensFromNodes(
  nodes: NodeInfo[],
  allNodes: NodeInfo[],
  source: string,
): MeasureToken[] {
  // Collect structural container nodes to detect nesting
  const combinedHits = nodes.filter(n => n.name === "CombinedHit");
  const groupExprs = nodes.filter(n => n.name === "GroupExpr");
  const bracedBlocks = nodes.filter(n => n.name === "InlineBracedBlock");

  function isInsideContainer(node: NodeInfo): boolean {
    return combinedHits.some(ch => ch.from < node.from && node.to <= ch.to) ||
           groupExprs.some(ge => ge.from < node.from && node.to <= ge.to) ||
           bracedBlocks.some(bb => bb.from < node.from && node.to <= bb.to);
  }

  // Collect token-like nodes, skipping those nested inside CombinedHit/GroupExpr/InlineBracedBlock
  const raw: { token: MeasureToken; rawText: string }[] = [];

  for (const node of nodes) {
    if (node.name === "GroupExpr") {
      raw.push({ token: parseGroupExpr(node, allNodes, source), rawText: nodeText(node, source) });
    } else if (node.name === "CombinedHit" && !isInsideContainer(node)) {
      const chChildren = childNodes(allNodes, node.from, node.to);
      const items: TokenGlyph[] = [];
      for (const ch of chChildren) {
        if (ch.name === "GlyphToken") {
          items.push(parseGlyphFromText(nodeText(ch, source)));
        }
      }
      raw.push({ token: { kind: "combined", items }, rawText: nodeText(node, source) });
    } else if (node.name === "GlyphToken" && !isInsideContainer(node)) {
      const rawText = nodeText(node, source);
      raw.push({ token: parseGlyphFromText(rawText), rawText });
    } else if (node.name === "InlineBracedBlock" && !isInsideContainer(node)) {
      const innerChildren = childNodes(allNodes, node.from, node.to);
      const innerMC = innerChildren.find(n => n.name === "MeasureContent");
      const items: TokenGlyph[] = [];
      if (innerMC) {
        const innerMCNodes = childNodes(allNodes, innerMC.from, innerMC.to);
        const innerMTs = innerMCNodes.filter(n => n.name === "MeasureToken");
        for (const imt of innerMTs) {
          const imtChildren = childNodes(allNodes, imt.from, imt.to);
          // Handle structural nodes inside braced block
          if (imtChildren.some(c => c.name === "GroupExpr" || c.name === "CombinedHit" || c.name === "InlineBracedBlock")) {
            const innerTokens = parseMeasureTokensFromNodes(imtChildren, allNodes, source);
            items.push(...innerTokens);
          } else {
            const imtText = nodeText(imt, source);
            const parts = imtText.split("+");
            const partTokens = parts.map(p => parseGlyphFromText(p.trim()));
            if (partTokens.length === 1) {
              items.push(partTokens[0]);
            } else {
              items.push({ kind: "combined", items: partTokens });
            }
          }
        }
      }
      raw.push({ token: { kind: "braced", track: "", items }, rawText: nodeText(node, source) });
    }
  }

  // Summon prefix merge pass (for cases inside structural spans)
  const tokens: MeasureToken[] = [];
  for (let ti = 0; ti < raw.length; ti++) {
    const { token, rawText } = raw[ti];

    // Handle summon prefix from a CombinedHit's last item
    if (token.kind === "combined") {
      const lastItem = token.items[token.items.length - 1];
      if (
        lastItem.kind === "basic" &&
        lastItem.trackOverride === undefined &&
        lastItem.dots === 0 && lastItem.halves === 0 && lastItem.stars === 0 &&
        lastItem.modifiers.length === 0 &&
        TRACK_NAMES.has(lastItem.value) &&
        lastItem.value !== "-" &&
        rawText.endsWith(":") &&
        ti + 1 < raw.length
      ) {
        const next = raw[ti + 1];
        const chItems = token.items.slice(0, -1);
        if (next.token.kind === "basic" && next.token.trackOverride === undefined) {
          if (chItems.length === 1) tokens.push(chItems[0]);
          else if (chItems.length > 1) tokens.push({ kind: "combined", items: chItems });
          tokens.push({ ...next.token, trackOverride: lastItem.value });
          ti++;
          continue;
        }
        if (next.token.kind === "combined" && next.token.items.length > 0) {
          if (chItems.length === 1) tokens.push(chItems[0]);
          else if (chItems.length > 1) tokens.push({ kind: "combined", items: chItems });
          const nextFirst = next.token.items[0];
          if (nextFirst.kind === "basic") {
            tokens.push({ kind: "combined", items: [{ ...nextFirst, trackOverride: lastItem.value }, ...next.token.items.slice(1)] });
          }
          ti++;
          continue;
        }
      }
      tokens.push(token);
      continue;
    }

    // Handle summon prefix from a basic token (TrackName:)
    if (
      token.kind === "basic" &&
      token.trackOverride === undefined &&
      token.dots === 0 && token.halves === 0 && token.stars === 0 &&
      token.modifiers.length === 0 &&
      TRACK_NAMES.has(token.value) &&
      token.value !== "-" &&
      rawText.endsWith(":") &&
      ti + 1 < raw.length
    ) {
      const next = raw[ti + 1];
      if (next.token.kind === "basic" && next.token.trackOverride === undefined) {
        tokens.push({ ...next.token, trackOverride: token.value });
        ti++;
        continue;
      }
      if (next.token.kind === "combined" && next.token.items.length > 0) {
        const nextFirst = next.token.items[0];
        if (nextFirst.kind === "basic") {
          tokens.push({ kind: "combined", items: [{ ...nextFirst, trackOverride: token.value }, ...next.token.items.slice(1)] });
          ti++;
          continue;
        }
      }
    }
    tokens.push(token);
  }

  return tokens;
}

function parseGroupExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
): TokenGlyph {
  const rawText = nodeText(node, source);
  // rawText is like "[xxxx]", "[3: d p g]", "[ d x ]"
  const inner = rawText.slice(1, -1); // strip [ and ]

  let span: number;
  let items: TokenGlyph[];

  // Only treat ":" as a span separator if the text before it is a valid integer.
  // Otherwise ":" belongs to a summon prefix or modifier inside the group.
  const colonIdx = inner.indexOf(":");
  const spanStr = colonIdx >= 0 ? inner.slice(0, colonIdx).trim() : "";
  const explicitSpan = spanStr ? parseInt(spanStr, 10) : NaN;

  if (colonIdx >= 0 && !isNaN(explicitSpan) && spanStr === String(explicitSpan)) {
    span = explicitSpan;
    items = parseGroupItems(inner.slice(colonIdx + 1).trim());
  } else {
    items = parseGroupItems(inner.trim());
    span = 1;
  }

  const count = items.length;

  return { kind: "group", count, span, items, modifiers: [] };
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function parseGroupItems(text: string): TokenGlyph[] {
  const items: TokenGlyph[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Skip whitespace
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos >= text.length) break;

    const remaining = text.slice(pos);
    const token = parseGlyphFromText(remaining);

    // Calculate how many characters of `remaining` were consumed
    let consumed = 0;

    // Summon prefix: TrackName:
    if (token.trackOverride) {
      consumed += token.trackOverride.length + 1;
    }

    // Basic glyph value
    if (token.kind === "basic") {
      if (token.value === "-") {
        consumed = Math.max(consumed + 1, 1);
      } else {
        consumed += token.value.length;
      }
    }

    // Duration chars
    consumed += (token as TokenGlyph).dots ?? 0;
    consumed += (token as TokenGlyph).halves ?? 0;
    consumed += (token as TokenGlyph).stars ?? 0;

    // Modifiers
    if ("modifiers" in token) {
      for (const mod of (token as TokenGlyph).modifiers ?? []) {
        consumed += 1 + mod.length;
      }
    }

    if (consumed > 0) {
      items.push(token);
      pos += consumed;
    } else {
      pos++; // Skip unrecognized character
    }
  }

  return items;
}

const START_NAV_KINDS: StartNavKind[] = ["segno", "coda"];
const END_NAV_KINDS: EndNavKind[] = ["fine", "dc", "ds", "dc-al-fine", "dc-al-coda", "ds-al-fine", "ds-al-coda", "to-coda"];

interface NavNode {
  name: string;
  kind: string;
  from: number;
  to: number;
}

function extractNavFromMeasureTokens(
  mtNodes: { from: number; to: number; rawText: string }[],
  allNodes: NodeInfo[],
  source: string,
  errors: ParseError[],
): {
  nonNavNodes: { from: number; to: number; rawText: string }[];
  startNav?: ParsedStartNav;
  endNav?: ParsedEndNav;
} {
  const navNodes: NavNode[] = [];
  const nonNavNodes: { from: number; to: number; rawText: string }[] = [];

  for (const mt of mtNodes) {
    const mtChildren = childNodes(allNodes, mt.from, mt.to);
    const navNode = mtChildren.find(
      c => c.name === "NavMarker" || c.name === "NavJump",
    );
    if (navNode) {
      const text = nodeText(navNode, source);
      navNodes.push({
        name: navNode.name,
        kind: text.slice(1), // strip @
        from: navNode.from,
        to: navNode.to,
      });
    } else {
      nonNavNodes.push(mt);
    }
  }

  if (navNodes.length === 0) return { nonNavNodes };

  const lineNumber = source.slice(0, navNodes[0].from).split("\n").length;
  const pureNavigationMeasure = nonNavNodes.length === 0;

  let startNav: ParsedStartNav | undefined;
  let endNav: ParsedEndNav | undefined;
  let anchorSeen = 0;

  for (const nav of navNodes) {
    // Count non-nav tokens that appear before this nav node
    anchorSeen = nonNavNodes.filter(n => n.to <= nav.from).length;
    const nonNavAfter = nonNavNodes.length - anchorSeen;

    if (nav.name === "NavMarker") {
      if (startNav !== undefined) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: "Measure contains multiple start-side navigation markers",
        });
        continue;
      }

      if (nav.kind === "coda") {
        if (!pureNavigationMeasure && anchorSeen !== 0) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "`@coda` may appear only at the beginning of a measure",
          });
          continue;
        }
        startNav = { kind: "coda", anchor: "left-edge" };
      } else {
        // @segno
        if (!pureNavigationMeasure && nonNavAfter === 0) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "`@segno` may not appear at the end of a measure",
          });
          continue;
        }
        startNav =
          pureNavigationMeasure || anchorSeen === 0
            ? { kind: "segno", anchor: "left-edge" }
            : { kind: "segno", anchor: { tokenAfter: anchorSeen } };
      }
    } else {
      // NavJump
      if (endNav !== undefined) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: "Measure contains multiple end-side navigation instructions",
        });
        continue;
      }

      if (nav.kind === "to-coda") {
        if (!pureNavigationMeasure && anchorSeen === 0) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "`@to-coda` may not appear at the beginning of a measure",
          });
          continue;
        }
        endNav =
          pureNavigationMeasure || nonNavAfter === 0
            ? { kind: "to-coda", anchor: "right-edge" }
            : { kind: "to-coda", anchor: { tokenBefore: anchorSeen - 1 } };
      } else {
        if (!pureNavigationMeasure && nonNavAfter !== 0) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: `\`@${nav.kind}\` may appear only at the end of a measure`,
          });
          continue;
        }
        endNav = { kind: nav.kind as EndNavKind, anchor: "right-edge" };
      }
    }
  }

  return { nonNavNodes, startNav, endNav };
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
  const time = (headers.time as DocumentSkeleton["headers"]["time"]) ?? { field: "time" as const, beats: 4, beatUnit: 4, line: 0 };
  const result: DocumentSkeleton = {
    headers: {
      title: headers.title as DocumentSkeleton["headers"]["title"],
      subtitle: headers.subtitle as DocumentSkeleton["headers"]["subtitle"],
      composer: headers.composer as DocumentSkeleton["headers"]["composer"],
      tempo: (headers.tempo as DocumentSkeleton["headers"]["tempo"]) ?? { field: "tempo", value: 120, line: 0 },
      time,
      grouping: headers.grouping as DocumentSkeleton["headers"]["grouping"],
      note: headers.note as DocumentSkeleton["headers"]["note"],
      divisions: headers.divisions as DocumentSkeleton["headers"]["divisions"],
    },
    paragraphs: [],
    errors,
  };

  // Infer grouping when not explicitly provided, matching the regex parser behavior
  if (!result.headers.grouping) {
    const inferred = inferGrouping(time.beats, time.beatUnit);
    if (inferred) {
      result.headers.grouping = { field: "grouping", values: inferred, line: 0 };
    }
  }

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

    let track: SourceTrackName | "ANONYMOUS" = "ANONYMOUS";
    const measures: ParsedMeasure[] = [];
    let currentMeasureContent: NodeInfo | null = null;
    let currentBarline: NodeInfo | null = null;
    let currentVolta: string | null = null;

    for (const child of lineChildren) {
      if (child.name === "TrackName") {
        track = nodeText(child, source) as SourceTrackName;
      } else if (child.name === "Barline") {
        // Finalize the previous measure with barline type info from THIS barline.
        // In regex parser semantics, barline type and repeatEnd come from the
        // barline that CLOSES the measure, not the one that opens it.
        if (measures.length > 0) {
          const endBarlineText = nodeText(child, source);
          const endBarlineType = getBarlineType(endBarlineText);
          if (endBarlineType !== "single" && endBarlineType !== "repeatStart" && endBarlineType !== "repeatEnd") {
            measures[measures.length - 1].barline = endBarlineType;
          }
          if (endBarlineText.includes(":|")) {
            measures[measures.length - 1].repeatEnd = true;
            measures[measures.length - 1].repeatTimes = 2;
          }
        }
        currentBarline = child;
        currentVolta = null;
      } else if (child.name === "MeasureContent") {
        // Skip nested MeasureContent inside GroupExpr or InlineBracedBlock
        const isNested = lineChildren.some(
          n => (n.name === "GroupExpr" || n.name === "InlineBracedBlock") &&
               n.from < child.from && child.to <= n.to,
        );
        if (!isNested) {
          currentMeasureContent = child;
        }
      } else if (child.name === "⚠") {
        // Detect volta markers: error node containing Integer followed by "."
        const errText = nodeText(child, source);
        const errChildren = childNodes(allNodes, child.from, child.to);
        if (errChildren.some(c => c.name === "Integer") && errText.endsWith(".")) {
          const intNode = errChildren.find(c => c.name === "Integer");
          if (intNode) currentVolta = nodeText(intNode, source);
        }
      }
      // When we have both a barline and measure content, create a measure
      if (currentBarline && currentMeasureContent) {
        const barlineText = nodeText(currentBarline, source);
        const repeatStart = barlineText.includes("|:");

        const mcChildren = childNodes(allNodes, currentMeasureContent.from, currentMeasureContent.to);

        // Collect MeasureToken nodes with their raw text,
        // skipping those nested inside GroupExpr or InlineBracedBlock
        const mtNodes: { from: number; to: number; rawText: string }[] = [];
        for (const mc of mcChildren) {
          if (mc.name === "MeasureToken") {
            const isNested = mcChildren.some(
              n => (n.name === "GroupExpr" || n.name === "InlineBracedBlock") &&
                   n.from < mc.from && mc.to <= n.to,
            );
            if (!isNested) {
              mtNodes.push({ from: mc.from, to: mc.to, rawText: nodeText(mc, source) });
            }
          }
        }

        // Separate navigation markers from regular tokens
        const { nonNavNodes, startNav, endNav } = extractNavFromMeasureTokens(
          mtNodes, allNodes, source, errors,
        );

        // Detect measure-repeat: all non-nav tokens are MeasureRepeat
        let measureRepeatSlashes: number | undefined;
        if (nonNavNodes.length > 0) {
          const repeatNodes = nonNavNodes.filter(n => {
            const children = childNodes(allNodes, n.from, n.to);
            return children.some(c => c.name === "MeasureRepeat");
          });
          if (repeatNodes.length === nonNavNodes.length) {
            // All tokens are MeasureRepeat — count % characters
            measureRepeatSlashes = nonNavNodes.reduce(
              (sum, n) => sum + n.rawText.length,
              0,
            );
          } else if (repeatNodes.length > 0) {
            errors.push({
              line: lineNumber,
              column: 1,
              message: "Measure repeat shorthand must occupy the entire measure",
            });
          }
        }

        // Merge consecutive MeasureTokens split by summon prefix boundaries.
        // Grammar splits "HH:d" → "HH:" + "d", and CombinedHit "b+SD:d" → "b+SD:" + "d"
        const mergedSpans: { from: number; to: number }[] = [];
        for (let i = 0; i < nonNavNodes.length; i++) {
          let from = nonNavNodes[i].from;
          let to = nonNavNodes[i].to;
          let rawText = nonNavNodes[i].rawText;
          while (rawText.endsWith(":") && i + 1 < nonNavNodes.length) {
            i++;
            to = nonNavNodes[i].to;
            rawText += nonNavNodes[i].rawText;
          }
          mergedSpans.push({ from, to });
        }

        // Parse each merged span into tokens (skip for measure-repeats)
        const tokens: MeasureToken[] = [];
        if (!measureRepeatSlashes) {
          for (const span of mergedSpans) {
            const spanText = source.slice(span.from, span.to);
            const spanChildren = childNodes(allNodes, span.from, span.to);

            // Use node-based parsing only for spans containing structural nodes
            const hasStructuralNodes = spanChildren.some(
              n => n.name === "GroupExpr" || n.name === "InlineBracedBlock" || n.name === "MeasureRepeat",
            );

            if (hasStructuralNodes) {
              const spanTokens = parseMeasureTokensFromNodes(spanChildren, allNodes, source);
              tokens.push(...spanTokens);
            } else {
              // Text-based parsing: split by + and parse each part with parseGlyphFromText
              const parts = spanText.split("+");
              const items = parts.map(p => parseGlyphFromText(p.trim()));
              if (items.length === 1) {
                tokens.push(items[0]);
              } else {
                tokens.push({ kind: "combined", items });
              }
            }
          }

          // Post-processing: merge TrackName + braced-block pattern (e.g. HH{x o})
          for (let ti = 0; ti < tokens.length; ti++) {
            const token = tokens[ti];
            if (
              token.kind === "basic" &&
              token.dots === 0 && token.halves === 0 && token.stars === 0 &&
              token.modifiers.length === 0 &&
              token.trackOverride === undefined &&
              TRACK_NAMES.has(token.value) &&
              token.value !== "-" &&
              ti + 1 < tokens.length &&
              tokens[ti + 1].kind === "braced" &&
              tokens[ti + 1].track === ""
            ) {
              const braced = tokens[ti + 1] as { kind: "braced"; track: string; items: TokenGlyph[] };
              braced.track = token.value;
              tokens.splice(ti, 1);
              // Don't increment ti — the braced token shifts into current position
            }
          }
        }

        const voltaIndices = currentVolta ? currentVolta.split(",").map(Number).filter(n => !isNaN(n)) : undefined;

        // Build content by stripping nav marker text from the original measure content
        let content = nodeText(currentMeasureContent, source).trim();
        if (startNav || endNav) {
          // Remove @-prefixed tokens that were extracted as nav markers
          const navTexts: string[] = [];
          for (const mt of mtNodes) {
            const mtChildren = childNodes(allNodes, mt.from, mt.to);
            const navNode = mtChildren.find(
              c => c.name === "NavMarker" || c.name === "NavJump",
            );
            if (navNode) navTexts.push(nodeText(navNode, source));
          }
          for (const nt of navTexts) {
            content = content.replace(nt, "").replace(/\s{2,}/g, " ").trim();
          }
        }

        // Skip empty measures caused by trailing barlines with no content,
        // but keep measures that have navigation markers or measure-repeat
        if (tokens.length > 0 || startNav || endNav || measureRepeatSlashes) {
          measures.push({
            content,
            tokens,
            repeatStart,
            repeatEnd: false,
            ...(voltaIndices ? { voltaIndices } : {}),
            ...(startNav ? { startNav } : {}),
            ...(endNav ? { endNav } : {}),
            ...(measureRepeatSlashes ? { measureRepeatSlashes } : {}),
          });
        }

        currentBarline = null;
        currentMeasureContent = null;
        currentVolta = null;
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
      const num = parseInt(nodeText(ints[0], source), 10);
      const den = parseInt(nodeText(ints[1], source), 10);
      headers["note"] = {
        field: "note" as const,
        value: den / num,
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
