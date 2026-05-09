import { EditorView } from "@codemirror/view";
import { HighlightStyle, StreamLanguage, syntaxHighlighting, StringStream, type StreamParser } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { TRACKS, MODIFIERS } from "./dsl/types";
import type { AppTheme } from "./theme";

type HeaderField = "title" | "subtitle" | "composer" | "tempo" | "time" | "divisions" | "note" | "grouping";
type LineMode = "unknown" | "header" | "track";
type TrackName = typeof TRACKS[number];

type DslState = {
  lineMode: LineMode;
  lineInitialized: boolean;
  headerField: HeaderField | null;
  trackName: TrackName | null;
  explicitTrack: TrackName | null;
  pendingScopeTrack: TrackName | null;
  scopeTracks: TrackName[];
};

const headerFields: readonly HeaderField[] = ["title", "subtitle", "composer", "tempo", "time", "divisions", "note", "grouping"];
const modifiers = [...MODIFIERS].sort((left, right) => right.length - left.length) as readonly string[];
const sortedTracks = [...TRACKS].sort((left, right) => right.length - left.length) as readonly TrackName[];
const jumpMarkers = [
  "@segno",
  "@coda",
  "@fine",
  "@to-coda",
  "@dc",
  "@ds",
  "@dc-al-fine",
  "@dc-al-coda",
  "@ds-al-fine",
  "@ds-al-coda",
  "@da-capo",
  "@dal-segno",
] as const;

function startState(): DslState {
  return {
    lineMode: "unknown",
    lineInitialized: false,
    headerField: null,
    trackName: null,
    explicitTrack: null,
    pendingScopeTrack: null,
    scopeTracks: [],
  };
}

function resetLineState(state: DslState) {
  state.lineMode = "unknown";
  state.lineInitialized = false;
  state.headerField = null;
  state.trackName = null;
  state.explicitTrack = null;
  state.pendingScopeTrack = null;
  state.scopeTracks = [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchWord<T extends string>(stream: StringStream, words: readonly T[]): T | null {
  for (const word of words) {
    if (stream.match(new RegExp(`^${escapeRegex(word)}(?![A-Za-z0-9-])`))) {
      return word;
    }
  }

  return null;
}

function peekNonSpace(stream: StringStream): string | null {
  for (let index = stream.pos; index < stream.string.length; index += 1) {
    const char = stream.string[index];
    if (char && !/\s/.test(char)) {
      return char;
    }
  }

  return null;
}

function currentScopeTrack(state: DslState): TrackName | null {
  return state.scopeTracks.at(-1) ?? null;
}

function effectiveTrack(state: DslState): TrackName | null {
  return state.explicitTrack ?? currentScopeTrack(state) ?? state.trackName;
}

function consumeGlyph(stream: StringStream, pattern: RegExp, tokenType: string, state: DslState): string | null {
  if (!stream.match(pattern)) {
    return null;
  }

  state.explicitTrack = null;
  return tokenType;
}

function initializeLine(stream: StringStream, state: DslState): string | null {
  if (state.lineInitialized) {
    return null;
  }

  const header = matchWord(stream, headerFields);
  if (header) {
    state.lineInitialized = true;
    state.lineMode = "header";
    state.headerField = header;
    return header === "title" || header === "subtitle" || header === "composer" ? "header-meta" : "header-struct";
  }

  const track = matchWord(stream, TRACKS);
  if (track) {
    const next = peekNonSpace(stream);
    state.lineInitialized = true;
    state.lineMode = "track";
    state.trackName = track;
    if (next === "{") {
      state.pendingScopeTrack = track;
    }
    if (track === "ST") {
      return "track-sticking";
    }
    return "track";
  }

  state.lineInitialized = true;
  if (stream.peek() === "|") {
    state.lineMode = "track";
    state.trackName = "HH";
  }
  return null;
}

function readToLineEnd(stream: StringStream): string {
  const rest = stream.string.slice(stream.pos);
  stream.skipToEnd();
  return rest;
}

function readHeaderValue(stream: StringStream, state: DslState): string | null {
  switch (state.headerField) {
    case "title":
    case "subtitle":
    case "composer":
      readToLineEnd(stream);
      return "header-text";
    case "tempo":
    case "divisions":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      break;
    case "note":
      if (stream.match(/^1\/\d+/)) {
        return "header-number";
      }
      break;
    case "time":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      if (stream.match("/")) {
        return "header-divider";
      }
      break;
    case "grouping":
      if (stream.match(/^\d+/)) {
        return "header-number";
      }
      if (stream.match("+")) {
        return "header-operator";
      }
      break;
    default:
      break;
  }

  if (stream.match(/[^\s#]+/)) {
    return "header-text";
  }

  return null;
}

function readTrackToken(stream: StringStream, state: DslState): string | null {
  const track = effectiveTrack(state);

  if (stream.match("|:")) {
    return "repeat";
  }

  if (stream.match(":|")) {
    return "repeat";
  }

  if (stream.match("||")) {
    return "barline";
  }

  if (stream.match("|.")) {
    return "barline";
  }

  if (stream.match(/^\|\d+(?:,\d+)*\./)) {
    return "repeat-count";
  }

  if (stream.match("|")) {
    return "barline";
  }

  if (stream.match(/^\*[-]?\d+/)) {
    return "repeat-count";
  }

  if (stream.match(/^%+/)) {
    return "measure-repeat";
  }

  if (stream.match(/^-+\s*\d+\s*-+/)) {
    return "repeat-count";
  }

  if (matchWord(stream, jumpMarkers)) {
    return "jump-marker";
  }

  const routedTrack = matchWord(stream, sortedTracks);
  if (routedTrack) {
    const next = peekNonSpace(stream);
    if (next === "{") {
      state.pendingScopeTrack = routedTrack;
      return routedTrack === "ST" ? "track-sticking" : "track";
    }
    if (next === ":") {
      state.explicitTrack = routedTrack;
      return routedTrack === "ST" ? "track-sticking" : "track";
    }
  }

  if (stream.match("[")) {
    return "group-bracket";
  }

  if (stream.match("]")) {
    return "group-bracket";
  }

  // Group count (inside [N: ... ])
  if (stream.match(/^\d+/)) {
    return "group-count";
  }

  if (stream.match("+")) {
    state.explicitTrack = null;
    return "hit-combinator";
  }

  if (stream.match("<") || stream.match(">") || stream.match("!")) {
    return "hairpin-marker";
  }

  if (stream.match("{")) {
    if (state.pendingScopeTrack) {
      state.scopeTracks.push(state.pendingScopeTrack);
      state.pendingScopeTrack = null;
    }
    return "punctuation";
  }

  if (stream.match(/\}/)) {
    state.scopeTracks.pop();
    state.explicitTrack = null;
    return "punctuation";
  }

  // Handle : as punctuation or modifier separator
  // If followed by a modifier name, return null to let modifier handler process it
  // Handle : as punctuation or modifier separator
  // When : appears at the start of a potential token, check if a modifier follows
  // If yes, return null to let modifier handler process :modifier
  // If not (e.g., :*), consume : and return "punctuation"
  if (stream.match(":")) {
    // We consumed :, now check what follows
    // Peek at next char without advancing
    const nextChar = stream.string[stream.pos];
    if (nextChar && /[a-z]/i.test(nextChar)) {
      // Letter follows - likely a modifier, but we've already consumed :
      // Return null so stream advances past : via stream.next() in tokenizer
      // Next call will be at the modifier name, which will be handled correctly
      // However, this means : is NOT highlighted...
      // Actually, let's return "punctuation" anyway since : is punctuation
      // The modifier will be a separate token
    }
    return "punctuation";
  }

  if (stream.match(/^[*./]+/)) {
    return "duration-modifier";
  }

  const mod = matchWord(stream, modifiers);
  if (mod) {
    return "modifier";
  }

  if (stream.match("-")) {
    state.explicitTrack = null;
    return "rest";
  }

  if ((track === "ST") && consumeGlyph(stream, /^[LR](?![A-Za-z0-9])/, "sticking-note", state)) {
    return "sticking-note";
  }

  if (consumeGlyph(stream, /^(?:t[1-4]|T[1-4])/, "tom-note", state)) {
    return "tom-note";
  }

  if (consumeGlyph(stream, /^(?:D|S|B|B2|G)(?![A-Za-z0-9])/, "accent-note", state)) {
    return "accent-note";
  }

  if (stream.match(/^(?:X|x)(?![A-Za-z0-9])/)) {
    state.explicitTrack = null;
    const glyph = stream.current();
    if (glyph === "x") {
      return track === "ST" ? "sticking-note" : "cymbal-note";
    }
    return "accent-note";
  }

  if (consumeGlyph(stream, /^(?:p|P|b|B|b2)(?![A-Za-z0-9])/, "kick-note", state)) {
    return "kick-note";
  }

  if (consumeGlyph(stream, /^(?:o|O|c2|C2|c|C|spl|SPL|chn|CHN|cb|CB|wb|WB|cl|CL)(?![A-Za-z0-9])/, "cymbal-note", state)) {
    return "cymbal-note";
  }

  if (consumeGlyph(stream, /^(?:s|g)(?![A-Za-z0-9])/, "note", state)) {
    return "note";
  }

  if (consumeGlyph(stream, /^(?:r2|R2|r|R)(?![A-Za-z0-9])/, "ride-note", state)) {
    return "ride-note";
  }

  if (consumeGlyph(stream, /^(?:d)(?![A-Za-z0-9])/, "note", state)) {
    return "note";
  }

  if (stream.match(/^[A-Za-z0-9]+/)) {
    state.explicitTrack = null;
    return "identifier";
  }

  return null;
}

export const drumMarkStreamParser: StreamParser<DslState> = {
  name: "drummark",
  startState: () => startState(),
  copyState: (state) => ({ ...state }),
  token(stream, state) {
    if (stream.sol()) {
      resetLineState(state);
    }

    if (stream.eatSpace()) {
      return null;
    }

    if (stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }

    const lineToken = initializeLine(stream, state);
    if (lineToken) {
      return lineToken;
    }

    if (state.lineMode === "header") {
      const headerToken = readHeaderValue(stream, state);
      if (headerToken) {
        return headerToken;
      }
    }

    if (state.lineMode === "track") {
      const trackToken = readTrackToken(stream, state);
      if (trackToken) {
        return trackToken;
      }
    }

    if (stream.match(/[^\s#]+/)) {
      return "identifier";
    }

    stream.next();
    return null;
  },
  tokenTable: {
    comment: tags.lineComment,
    "header-meta": tags.heading,
    "header-struct": tags.keyword,
    "header-text": tags.string,
    "header-number": tags.integer,
    "header-divider": tags.punctuation,
    "header-operator": tags.arithmeticOperator,
    track: tags.labelName,
    "track-sticking": tags.attributeName,
    repeat: [tags.separator, tags.controlOperator],
    "repeat-count": [tags.number, tags.annotation],
    barline: tags.separator,
    "measure-repeat": [tags.controlOperator, tags.annotation],
    "jump-marker": tags.modifier,
    "group-bracket": tags.squareBracket,
    "group-count": tags.integer,
    "hit-combinator": tags.operator,
    "hairpin-marker": tags.special(tags.annotation),
    punctuation: tags.punctuation,
    modifier: tags.modifier,
    "duration-modifier": tags.arithmeticOperator,
    rest: tags.null,
    "tom-note": tags.typeName,
    "sticking-note": tags.attributeValue,
    "accent-note": [tags.atom, tags.strong],
    "drum-accent": [tags.atom, tags.strong],
    note: tags.atom,
    "cymbal-note": tags.tagName,
    "ride-note": tags.tagName,
    "kick-note": tags.bool,
    "foot-note": tags.bool,
    identifier: tags.name,
  },
};

export const drumMarkLanguage = StreamLanguage.define(drumMarkStreamParser);

export const drumMarkHighlightStyle = HighlightStyle.define([
  { tag: tags.lineComment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.heading, color: "var(--syntax-heading)", fontWeight: "700" },
  { tag: tags.keyword, color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.integer, color: "var(--syntax-number)" },
  { tag: tags.arithmeticOperator, color: "var(--syntax-operator-muted)", fontWeight: "600" },
  { tag: tags.punctuation, color: "var(--syntax-punctuation)" },
  { tag: tags.labelName, color: "var(--syntax-label)", fontWeight: "700" },
  { tag: tags.attributeName, color: "var(--syntax-heading)", fontWeight: "700" },
  { tag: tags.attributeValue, color: "var(--syntax-attribute)", fontWeight: "600" },
  { tag: tags.typeName, color: "var(--syntax-type)", fontWeight: "600" },
  { tag: tags.separator, color: "var(--syntax-separator)", fontWeight: "700" },
  { tag: tags.controlOperator, color: "var(--syntax-control)", fontWeight: "700" },
  { tag: tags.operator, color: "var(--syntax-keyword)", fontWeight: "700" },
  { tag: tags.annotation, color: "var(--syntax-annotation)" },
  { tag: tags.squareBracket, color: "var(--syntax-bracket)", fontWeight: "700" },
  { tag: tags.modifier, color: "var(--syntax-type)", fontStyle: "italic" },
  { tag: tags.null, color: "var(--syntax-null)" },
  { tag: tags.atom, color: "var(--syntax-atom)" },
  { tag: tags.tagName, color: "var(--syntax-tag)" },
  { tag: tags.bool, color: "var(--syntax-bool)" },
  { tag: tags.strong, fontWeight: "800" },
  { tag: tags.name, color: "var(--syntax-name)" },
]);

const editorThemeSpec = {
  "&": {
    height: "100%",
    backgroundColor: "var(--editor-bg)",
    color: "var(--text-main)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.7",
  },
  ".cm-content, .cm-gutterElement": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.7",
  },
  ".cm-content": {
    padding: "20px 150px 20px 0",
    minHeight: "100%",
    whiteSpace: "pre",
  },
  ".cm-line": {
    padding: "0 0 0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter-bg)",
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border-subtle)",
  },
  ".cm-lineNumbers": {
    minWidth: "48px",
  },
  ".cm-gutterElement": {
    padding: "0 12px 0 0",
    fontSize: "0.8rem",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    position: "relative",
    backgroundColor: "transparent",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text-main)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "var(--editor-selection) !important",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--text-main)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--text-main)",
    border: "1px solid var(--border-strong)",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-editor.cm-focused": {
    outline: "none",
  },
} as const;

const drumMarkEditorThemeLight = EditorView.theme(editorThemeSpec, { dark: false });
const drumMarkEditorThemeDark = EditorView.theme(editorThemeSpec, { dark: true });

export const drumMarkSyntaxHighlighting = syntaxHighlighting(drumMarkHighlightStyle);

export function getDrumMarkEditorTheme(theme: AppTheme) {
  return theme === "dark" ? drumMarkEditorThemeDark : drumMarkEditorThemeLight;
}

export function highlightDslStatic(code: string): string {
  const state = drumMarkStreamParser.startState!(2);
  const lines = code.split("\n");
  let html = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const stream = new StringStream(line, 2, {
      tabSize: 2,
      lineSeparator: undefined
    } as any);
    
    while (!stream.eol()) {
      const pos = stream.pos;
      if (stream.eatSpace()) {
        html += escapeHtml(line.slice(pos, stream.pos));
        continue;
      }

      const token = drumMarkStreamParser.token(stream, state);
      const content = line.slice(pos, stream.pos);

      if (token) {
        // 将 token 转换为 CSS 类，支持空格分隔的多个 token
        const classes = token.split(" ").map(t => `dsl-${t}`).join(" ");
        html += `<span class="${classes}">${escapeHtml(content)}</span>`;
      } else {
        html += escapeHtml(content);
      }
    }
    if (i < lines.length - 1) html += "\n";
  }

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
