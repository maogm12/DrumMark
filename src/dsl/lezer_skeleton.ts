import { parser } from "./drum_mark.parser";
import { inferGrouping } from "./grouping";
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

function sameVoltaIndices(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

type BarlineBoundaryInfo = {
  openRepeatStart: boolean;
  openVoltaIndices?: number[];
  closeBarlineType: BarlineType | "single" | "repeatStart" | "repeatEnd";
  closeRepeatEnd: boolean;
  closeVoltaTerminator: boolean;
};

function parseBarlineBoundaryInfo(node: NodeInfo, allNodes: NodeInfo[], source: string): BarlineBoundaryInfo {
  const text = nodeText(node, source);
  const childNames = new Set(innerNodes(node, allNodes).map((child) => child.name));
  const indices = innerNodes(node, allNodes)
    .filter((child) => child.name === "Integer")
    .map((child) => parseInt(nodeText(child, source), 10))
    .filter((value) => !isNaN(value));

  if (childNames.has("DoubleVoltaTerminatorBarline")) {
    return {
      openRepeatStart: false,
      closeBarlineType: "double",
      closeRepeatEnd: false,
      closeVoltaTerminator: true,
    };
  }
  if (childNames.has("DoubleBarline")) {
    return {
      openRepeatStart: false,
      closeBarlineType: "double",
      closeRepeatEnd: false,
      closeVoltaTerminator: false,
    };
  }
  if (childNames.has("RepeatStartBarline")) {
    return {
      openRepeatStart: true,
      closeBarlineType: "repeatStart",
      closeRepeatEnd: false,
      closeVoltaTerminator: false,
    };
  }
  if (childNames.has("RepeatEndBarline")) {
    return {
      openRepeatStart: false,
      closeBarlineType: "repeatEnd",
      closeRepeatEnd: true,
      closeVoltaTerminator: false,
    };
  }
  if (childNames.has("VoltaTerminatorBarline")) {
    return {
      openRepeatStart: false,
      closeBarlineType: "single",
      closeRepeatEnd: false,
      closeVoltaTerminator: true,
    };
  }
  if (childNames.has("VoltaBarline")) {
    return {
      openRepeatStart: text.startsWith("|:"),
      openVoltaIndices: indices,
      closeBarlineType: "single",
      closeRepeatEnd: text.startsWith(":|"),
      closeVoltaTerminator: false,
    };
  }
  return {
    openRepeatStart: false,
    closeBarlineType: "single",
    closeRepeatEnd: false,
    closeVoltaTerminator: false,
  };
}

const TRACK_NAMES = new Set([
  "HH", "HF", "SD", "BD", "BD2",
  "T1", "T2", "T3", "T4",
  "RC", "RC2",
  "C", "C2",
  "SPL", "CHN", "CB", "WB", "CL", "ST",
]);

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
  const trackOverride: string | undefined = undefined;
  const rest = text;

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

function innerNodes(node: NodeInfo, allNodes: NodeInfo[]): NodeInfo[] {
  return childNodes(allNodes, node.from, node.to).filter(
    (child) => !(child.name === node.name && child.from === node.from && child.to === node.to),
  );
}

function firstInnerNode(node: NodeInfo, allNodes: NodeInfo[], names: string[]): NodeInfo | undefined {
  return innerNodes(node, allNodes).find((child) => names.includes(child.name));
}

function variantInnerNode(node: NodeInfo, allNodes: NodeInfo[], names: string[]): NodeInfo | undefined {
  return innerNodes(node, allNodes).find(
    (child) => names.includes(child.name) && child.from === node.from,
  );
}

function topLevelNamedChildren(node: NodeInfo, allNodes: NodeInfo[], name: string): NodeInfo[] {
  const children = innerNodes(node, allNodes).filter((child) => child.name === name);
  return children.filter(
    (child) => !children.some(
      (other) =>
        other !== child &&
        other.from <= child.from &&
        child.to <= other.to,
    ),
  );
}

function parseBasicNoteExpr(node: NodeInfo, source: string): TokenGlyph {
  return parseGlyphFromText(nodeText(node, source));
}

function parseSummonExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
): TokenGlyph | null {
  const prefixNode = firstInnerNode(node, allNodes, ["SummonPrefix"]);
  const basicNode = firstInnerNode(node, allNodes, ["BasicNoteExpr"]);
  if (!basicNode || !prefixNode) {
    if (errors) {
      const line = source.slice(0, node.from).split("\n").length;
      errors.push({
        line,
        column: 1,
        message: `Incomplete summon prefix \`${nodeText(node, source)}\``,
      });
    }
    return null;
  }
  const token = parseBasicNoteExpr(basicNode, source);
  if (token.kind !== "basic") return token;
  return {
    ...token,
    trackOverride: nodeText(prefixNode, source).slice(0, -1),
  };
}

function parseHitExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
): TokenGlyph | null {
  const summonNode = firstInnerNode(node, allNodes, ["SummonExpr"]);
  if (summonNode) return parseSummonExpr(summonNode, allNodes, source, errors);
  const basicNode = firstInnerNode(node, allNodes, ["BasicNoteExpr"]);
  if (basicNode) return parseBasicNoteExpr(basicNode, source);
  return parseGlyphFromText(nodeText(node, source));
}

function parseCombinedHitExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
): TokenGlyph | null {
  const hitNodes = topLevelNamedChildren(node, allNodes, "HitExpr");
  const items = hitNodes
    .map((child) => parseHitExpr(child, allNodes, source, errors))
    .filter((item): item is TokenGlyph => item !== null);
  if (items.length === 0) return null;
  return items.length === 1 ? items[0] : { kind: "combined", items };
}

function parseMeasureContentNode(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
): MeasureToken[] {
  return topLevelNamedChildren(node, allNodes, "MeasureExpr")
    .map((expr) => parseMeasureExpr(expr, allNodes, source, errors))
    .filter((expr): expr is MeasureToken => expr !== null);
}

function parseGroupExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
): TokenGlyph {
  const nodeChildren = innerNodes(node, allNodes);
  const spanNode = nodeChildren.find((child) => child.name === "Integer");
  const groupContent = nodeChildren.find((child) => child.name === "GroupContent");
  const items = groupContent
    ? topLevelNamedChildren(groupContent, allNodes, "GroupItem").map((item) => {
        const combinedNode = firstInnerNode(item, allNodes, ["CombinedHitExpr"]);
        if (combinedNode) return parseCombinedHitExpr(combinedNode, allNodes, source, errors);
        const summonNode = firstInnerNode(item, allNodes, ["SummonExpr"]);
        if (summonNode) return parseSummonExpr(summonNode, allNodes, source, errors);
        const basicNode = firstInnerNode(item, allNodes, ["BasicNoteExpr"]);
        if (basicNode) return parseBasicNoteExpr(basicNode, source);
        return parseGlyphFromText(nodeText(item, source));
      }).filter((item): item is TokenGlyph => item !== null)
    : [];
  const groupModifiers: Modifier[] = [];
  for (const child of nodeChildren) {
    if (child.name === "Modifier") {
      const modText = nodeText(child, source);
      const modName = modText.startsWith(":") ? modText.slice(1) : modText;
      if (MODIFIER_NAMES.has(modName)) {
        groupModifiers.push(modName as Modifier);
      }
    }
  }

  return {
    kind: "group",
    count: items.length,
    span: spanNode ? parseInt(nodeText(spanNode, source), 10) : 1,
    items,
    modifiers: groupModifiers,
  };
}

function parseMeasureExpr(
  node: NodeInfo,
  allNodes: NodeInfo[],
  source: string,
  errors?: ParseError[],
) : MeasureToken | null {
  const combinedNode = variantInnerNode(node, allNodes, ["CombinedHitExpr"]);
  if (combinedNode) return parseCombinedHitExpr(combinedNode, allNodes, source, errors);

  const groupNode = variantInnerNode(node, allNodes, ["GroupExpr"]);
  if (groupNode) return parseGroupExpr(groupNode, allNodes, source, errors);

  const summonNode = variantInnerNode(node, allNodes, ["SummonExpr"]);
  if (summonNode) return parseSummonExpr(summonNode, allNodes, source, errors);

  const bracedNode = variantInnerNode(node, allNodes, ["InlineBracedBlock"]);
  if (bracedNode) {
    const innerContent = firstInnerNode(bracedNode, allNodes, ["MeasureContent"]);
    return {
      kind: "braced",
      track: "",
      items: innerContent ? parseMeasureContentNode(innerContent, allNodes, source, errors) : [],
    };
  }

  const basicNode = variantInnerNode(node, allNodes, ["BasicNoteExpr"]);
  if (basicNode) return parseBasicNoteExpr(basicNode, source);

  return parseGlyphFromText(nodeText(node, source));
}

function readNoteOverrideFromGap(
  gapText: string,
  lineNumber: number,
  errors: ParseError[],
): number | undefined {
  const matches = [...gapText.matchAll(/^note\s+1\s*\/\s*(\d+)\s*$/gm)];
  if (matches.length === 0) return undefined;
  if (matches.length > 1) {
    errors.push({
      line: lineNumber,
      column: 1,
      message: "At most one paragraph note override may precede a paragraph",
    });
    return undefined;
  }
  const value = parseInt(matches[0]?.[1] ?? "", 10);
  if (!(value > 0 && (value & (value - 1)) === 0 && value <= 128)) {
    errors.push({
      line: lineNumber,
      column: 1,
      message: "Note must be in the form 1/N where N is a power of 2 (1, 2, 4, 8, 16, 32, 64, 128)",
    });
    return undefined;
  }
  return value;
}

function hasParagraphBreakBeforeOverride(gapText: string): boolean {
  const lines = gapText.split("\n");
  let blankLikeCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      blankLikeCount++;
      continue;
    }
    if (trimmed.startsWith("#")) {
      continue;
    }
    return blankLikeCount >= 2;
  }
  return false;
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
  // Match regex parser behavior: trim leading/trailing whitespace so
  // test sources with leading \n don't prevent header parsing.
  source = source.trim();
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
  let currentNoteValue: number | undefined;

  for (const tl of trackLines) {
    const lineNode = tl.line;
    const lineChildren = childNodes(allNodes, lineNode.from, lineNode.to);
    const lineNumber = source.slice(0, lineNode.from).split("\n").length;

    let track: SourceTrackName | "ANONYMOUS" = "ANONYMOUS";
    const lineTrack = lineChildren.find((child) => child.name === "TrackName");
    if (lineTrack) {
      track = nodeText(lineTrack, source) as SourceTrackName;
    }

    const measures: ParsedMeasure[] = [];
    const measureSections = lineChildren.filter((child) => child.name === "MeasureSection");
    const measureIndexBySection: number[] = [];

    const pushMeasure = (opts: {
      content: string;
      tokens: MeasureToken[];
      repeatStart: boolean;
      repeatEnd: boolean;
      repeatTimes?: number;
      barline?: BarlineType;
      startNav?: ParsedStartNav;
      endNav?: ParsedEndNav;
      voltaIndices?: number[];
      voltaTerminator?: boolean;
      measureRepeatSlashes?: number;
      multiRestCount?: number;
    }) => {
      measures.push({
        content: opts.content,
        tokens: opts.tokens,
        repeatStart: opts.repeatStart,
        repeatEnd: opts.repeatEnd,
        ...(opts.repeatTimes ? { repeatTimes: opts.repeatTimes } : {}),
        ...(opts.barline ? { barline: opts.barline } : {}),
        ...(opts.startNav ? { startNav: opts.startNav } : {}),
        ...(opts.endNav ? { endNav: opts.endNav } : {}),
        ...(opts.voltaIndices ? { voltaIndices: opts.voltaIndices } : {}),
        ...(opts.voltaTerminator ? { voltaTerminator: true } : {}),
        ...(opts.measureRepeatSlashes ? { measureRepeatSlashes: opts.measureRepeatSlashes } : {}),
        ...(opts.multiRestCount ? { multiRestCount: opts.multiRestCount } : {}),
      });
    };

    for (let sectionIndex = 0; sectionIndex < measureSections.length; sectionIndex++) {
      const section = measureSections[sectionIndex];
      const barlineNode = firstInnerNode(section, allNodes, ["BarlineNode"]);
      const bodyNode = firstInnerNode(section, allNodes, ["MeasureBody"]);
      const boundary = barlineNode
        ? parseBarlineBoundaryInfo(barlineNode, allNodes, source)
        : {
            openRepeatStart: false,
            closeBarlineType: "single" as const,
            closeRepeatEnd: false,
            closeVoltaTerminator: false,
          };

      if (!bodyNode) {
        if (sectionIndex < measureSections.length - 1) {
          measureIndexBySection[sectionIndex] = measures.length;
          pushMeasure({
            content: "",
            tokens: [],
            repeatStart: boundary.openRepeatStart,
            repeatEnd: false,
            voltaIndices: boundary.openVoltaIndices,
          });
        }
        continue;
      }

      const contentNode = firstInnerNode(bodyNode, allNodes, ["NonEmptyMeasureContent"]);
      const repeatNode = firstInnerNode(bodyNode, allNodes, ["MeasureRepeatExpr"]);
      const inlineRepeatNode = firstInnerNode(bodyNode, allNodes, ["InlineRepeatSuffix"]);

      const measureExprNodes = contentNode ? topLevelNamedChildren(contentNode, allNodes, "MeasureExpr") : [];
      const mtNodes = measureExprNodes.map((expr) => ({
        from: expr.from,
        to: expr.to,
        rawText: nodeText(expr, source),
      }));

      const { nonNavNodes, startNav, endNav } = extractNavFromMeasureTokens(
        mtNodes,
        allNodes,
        source,
        errors,
      );

      let measureRepeatSlashes = repeatNode ? nodeText(repeatNode, source).length : undefined;
      let tokens = measureRepeatSlashes
        ? []
        : nonNavNodes.map((span) => {
      const exprNode = measureExprNodes.find(
        (expr) => expr.from === span.from && expr.to === span.to,
      );
      return exprNode
        ? parseMeasureExpr(exprNode, allNodes, source, errors)
        : parseGlyphFromText(span.rawText);
          }).filter((token): token is MeasureToken => token !== null);

      for (let ti = 0; ti < tokens.length; ti++) {
        const token = tokens[ti];
        if (
          token.kind === "basic" &&
          token.dots === 0 &&
          token.halves === 0 &&
          token.stars === 0 &&
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
        }
      }

      let content = repeatNode
        ? nodeText(repeatNode, source).trim()
        : contentNode
          ? nodeText(contentNode, source).trim()
          : "";
      const navTexts: string[] = [];
      for (const mt of mtNodes) {
        const navNode = childNodes(allNodes, mt.from, mt.to).find(
          (child) => child.name === "NavMarker" || child.name === "NavJump",
        );
        if (navNode) navTexts.push(nodeText(navNode, source));
      }
      for (const navText of navTexts) {
        content = content.replace(navText, "").replace(/\s{2,}/g, " ").trim();
      }

      let malformedMeasureRepeat = false;
      if (measureRepeatSlashes !== undefined && !/^%+$/.test(content)) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: "Measure repeat shorthand must occupy the entire measure",
        });
        measureRepeatSlashes = undefined;
        malformedMeasureRepeat = true;
      }

      if (measureRepeatSlashes === undefined) {
        if (/^%+$/.test(content)) {
          measureRepeatSlashes = content.length;
          tokens = [];
        } else if (content.includes("%") && !malformedMeasureRepeat) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "Measure repeat shorthand must occupy the entire measure",
          });
        }
      }

      let multiRestCount: number | undefined;
      const multiRestMatch = content.match(/^-+\s*(\d+)\s*-+$/);
      if (multiRestMatch?.[1] !== undefined) {
        const count = parseInt(multiRestMatch[1], 10);
        if (count < 2) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "Multi-measure rest count must be at least 2",
          });
        } else {
          multiRestCount = count;
          tokens = [];
        }
      }

      let inlineRepeatCount: number | undefined;
      if (inlineRepeatNode) {
        const count = parseInt(nodeText(inlineRepeatNode, source).slice(1), 10);
        if (count < 1) {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "Repeat count must be at least 1",
          });
        } else {
          inlineRepeatCount = count;
        }
      }

      if (multiRestCount !== undefined && inlineRepeatCount !== undefined) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: "Multi-measure rest cannot be combined with inline repeat",
        });
        multiRestCount = undefined;
        inlineRepeatCount = undefined;
      }

      const startIndex = measures.length;
      if (inlineRepeatCount !== undefined) {
        for (let i = 0; i < inlineRepeatCount; i++) {
          pushMeasure({
            content,
            tokens,
            repeatStart: i === 0 ? boundary.openRepeatStart : false,
            repeatEnd: false,
            startNav: i === 0 ? startNav : undefined,
            endNav: i === inlineRepeatCount - 1 ? endNav : undefined,
            voltaIndices: i === 0 ? boundary.openVoltaIndices : undefined,
            measureRepeatSlashes,
            multiRestCount,
          });
        }
      } else {
        pushMeasure({
          content,
          tokens,
          repeatStart: boundary.openRepeatStart,
          repeatEnd: false,
          startNav,
          endNav,
          voltaIndices: boundary.openVoltaIndices,
          measureRepeatSlashes,
          multiRestCount,
        });
      }
      measureIndexBySection[sectionIndex] = startIndex;
    }

    for (let i = 0; i < measureSections.length - 1; i++) {
      const startIndex = measureIndexBySection[i];
      if (startIndex === undefined) continue;
      const nextSection = measureSections[i + 1];
      const nextBarlineNode = firstInnerNode(nextSection, allNodes, ["BarlineNode"]);
      if (!nextBarlineNode) continue;
      const nextBoundary = parseBarlineBoundaryInfo(nextBarlineNode, allNodes, source);
      const nextStartIndex = measureIndexBySection[i + 1];
      const endIndex = (nextStartIndex ?? measures.length) - 1;
      if (endIndex < 0 || !measures[endIndex]) continue;

      const lastMeasure = measures[endIndex];
      if (
        nextBoundary.closeBarlineType !== "single" &&
        nextBoundary.closeBarlineType !== "repeatStart" &&
        nextBoundary.closeBarlineType !== "repeatEnd"
      ) {
        lastMeasure.barline = nextBoundary.closeBarlineType;
      }
      if (nextBoundary.closeRepeatEnd) {
        lastMeasure.repeatEnd = true;
        lastMeasure.repeatTimes = 2;
      }
      if (nextBoundary.closeVoltaTerminator) {
        lastMeasure.voltaTerminator = true;
      }
      if (
        !lastMeasure.repeatEnd &&
        lastMeasure.voltaIndices !== undefined &&
        nextBoundary.openVoltaIndices !== undefined &&
        nextBoundary.closeBarlineType === "single" &&
        !sameVoltaIndices(lastMeasure.voltaIndices, nextBoundary.openVoltaIndices)
      ) {
        lastMeasure.repeatEnd = true;
        lastMeasure.repeatTimes = 2;
      }
    }

    // Trailing barline without content → skip (ghost measure)
    // Only add the line if it has measures
    if (measures.length === 0) continue;

    // Detect note 1/N override between this track line and the previous one
    // (or between header section and first track line).
    let noteOverride: number | undefined;
    if (currentLines.length > 0) {
      const prevLine = currentLines[currentLines.length - 1];
      const gapStart = (prevLine.source?.startOffset ?? 0) + (prevLine.source?.content.length ?? 0);
      const gapEnd = lineNode.from;
      const gapText = source.slice(gapStart, gapEnd);
      const candidate = readNoteOverrideFromGap(gapText, lineNumber, errors);
      if (candidate !== undefined) {
        if (hasParagraphBreakBeforeOverride(gapText)) {
          noteOverride = candidate;
        } else {
          errors.push({
            line: lineNumber,
            column: 1,
            message: "Paragraph note override must appear at the beginning of a new paragraph",
          });
        }
      }
    } else if (paragraphs.length === 0 && trackBody) {
      // First paragraph: check between header section end and first track line
      const gapStart = headerSection?.to ?? 0;
      const gapEnd = lineNode.from;
      const gapText = source.slice(gapStart, gapEnd);
      noteOverride = readNoteOverrideFromGap(gapText, lineNumber, errors);
    }

    // If newlineCount > 1 (blank line before) or a note 1/N override was found,
    // start a new paragraph.
    if ((tl.newlineCount > 1 || noteOverride !== undefined) && currentLines.length > 0) {
      paragraphs.push({ startLine: currentStartLine, lines: currentLines, noteValue: currentNoteValue });
      currentNoteValue = undefined;
      currentLines = [];
      currentStartLine = lineNumber;
    }

    if (currentLines.length === 0) {
      currentStartLine = lineNumber;
      currentNoteValue = noteOverride !== undefined ? noteOverride : currentNoteValue;
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
    paragraphs.push({ startLine: currentStartLine, lines: currentLines, noteValue: currentNoteValue });
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

  const headerTypes = ["TitleHeader", "SubtitleHeader", "ComposerHeader", "TempoHeader", "TimeHeader", "GroupingHeader", "NoteHeader", "DivisionsHeader"];
  const headerNode = contentChildren.find(c => headerTypes.includes(c.name));
  if (!headerNode) return;

  const lineNumber = source.slice(0, headerNode.from).split("\n").length;
  const newlineNode = newlineIdx >= 0 ? children[newlineIdx] : undefined;
  const rawLine = source.slice(headerNode.from, newlineNode?.from ?? headerNode.to);

  if (headerNode.name === "TitleHeader" || headerNode.name === "SubtitleHeader" || headerNode.name === "ComposerHeader") {
    const spaceIdx = rawLine.indexOf(" ");
    const field = (spaceIdx > 0 ? rawLine.slice(0, spaceIdx) : rawLine) as HeaderField;
    const remainder = spaceIdx > 0 ? rawLine.slice(spaceIdx + 1).trimStart() : "";
    let value = "";
    if (remainder.startsWith("\"") || remainder.startsWith("'")) {
      const quote = remainder[0];
      const closingIdx = remainder.indexOf(quote, 1);
      if (closingIdx <= 0) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: `${field} header has an unterminated quoted value`,
        });
        return;
      }
      value = remainder.slice(1, closingIdx);
    } else {
      value = remainder.split("#", 1)[0]?.trim() ?? "";
    }
    if (!value) {
      errors.push({
        line: lineNumber,
        column: 1,
        message: `${field} header requires a non-empty value`,
      });
    } else {
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
      const value = den / num;
      // Validate: N must be a power of 2 (matching regex parser behavior)
      if (num !== 1 || value < 1 || value > 128 || (value & (value - 1)) !== 0) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: "Note must be in the form 1/N where N is a power of 2 (1, 2, 4, 8, 16, 32, 64, 128)",
        });
      } else {
        headers["note"] = {
          field: "note" as const,
          value,
          line: lineNumber,
        };
      }
    }
  } else if (headerNode.name === "DivisionsHeader") {
    const intNode = contentChildren.find(c => c.name === "Integer");
    if (intNode) {
      headers["divisions"] = { field: "divisions" as const, value: parseInt(nodeText(intNode, source), 10), line: lineNumber };
    }
  }
}
