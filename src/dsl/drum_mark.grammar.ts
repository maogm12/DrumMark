import { LRGrammar } from "@lezer/lr";

// Grammar for DrumMark DSL
// This grammar is designed to be incremental and fault-tolerant for CodeMirror integration

export const DrumMarkGrammar = LRGrammar.define({
  // Start symbol
  start: "Document",

  // Token definitions
  token: {
    // Whitespace - ignored by parser but needed as separator
    "WS": //[ \t]+/,

    // End of line (comment or newline)
    "EOL": //(?:\n|$)|(?:#[^\n]*\n)/,

    // Track names (sorted longest first)
    "TrackName": {
      match: /HH|HF|SD|BD|BD2|T1|T2|T3|T4|RC|RC2|C|C2|SPL|CHN|CB|WB|CL|ST/,
      fallback: /[A-Z][A-Z0-9]*/,
    },

    // Basic glyphs - order matters, longer matches first
    "BasicGlyph": {
      match: /c2|b2|r2|t[1-4]|spl|chn|cb|wb|cl|x|d|s|b|r|c|o|g|p|X|D|S|B|R|C|O|G|L|-/,
    },

    // Note value for headers
    "NoteValue": /1\/\d+/,

    // Integer
    "Integer": /\d+/,

    // Modifiers
    "Modifier": /:accent|:open|:half-open|:close|:choke|:bell|:rim|:cross|:flam|:ghost|:drag|:roll|:dead/,

    // Duration modifiers
    "Dot": /\.\.+/,
    "Star": /\*+/,
    "Slash": /\/\/+/,

    // Barline patterns
    "Barline": /\|:|\||:\||\|:|\|\||\|\.:|\|x\d+|:\|x\d+/,

    // Navigation markers
    "NavMarker": /@segno|@coda/,
    "NavJump": /@fine|@dc|@ds|@dc-al-fine|@dc-al-coda|@ds-al-fine|@ds-al-coda|@to-coda/,

    // Group start
    "GroupStart": /\[/,
    "GroupEnd": /\]/,

    // Brace
    "BraceOpen": /\{/,
    "BraceClose": /\}/,

    // Plus for combined hits
    "Plus": /\+/,

    // Colon for track override
    "Colon": /:/,

    // Dash for multi-rest
    "Dash": /-+/,
  },

  // Grammar rules
  prod: [
    // Document = headers + paragraphs
    ["Document", "HeaderSection EOL TrackParagraphs"],
    ["HeaderSection", "HeaderSection HeaderLine EOL", "HeaderSection", ""],

    // Header lines
    ["HeaderLine", "Key WS Value"],
    ["HeaderLine", "time WS Integer WS '/' WS Integer"],
    ["HeaderLine", "grouping WS IntegerPlus"],
    ["HeaderLine", "note WS NoteValue"],

    ["Key", /title|subtitle|composer|tempo|time|grouping|note/],
    ["Value", /.+/],

    ["IntegerPlus", "Integer WS '+' WS Integer", "IntegerPlus WS '+' WS Integer", "Integer"],

    // Track paragraphs
    ["TrackParagraphs", "TrackParagraphs ParagraphSep", "TrackParagraphs TrackParagraph", "TrackParagraphs", ""],

    ["ParagraphSep", "EOL EOL"],

    ["TrackParagraph", "TrackLine", "TrackParagraph TrackLine"],

    ["TrackLine", "TrackName Barline MeasureContent EOL"],
    ["TrackLine", "Barline MeasureContent EOL"],  // Anonymous track

    ["MeasureContent", "MeasureContent MeasureToken WS", "MeasureContent WS", ""],

    ["MeasureToken", "GlyphToken", "CombinedHit", "BracedBlock", "GroupExpr", "MultiRest", "NavMarker", "NavJump", "MeasureRepeat", "InlineRepeatSuffix", "InlineRepeatBare"],

    // Glyph token with suffixes
    ["GlyphToken", "BasicGlyph SuffixChain", "BasicGlyph"],

    // Suffix chain - interleaved modifiers and duration suffixes
    // Left-recursive so that modifiers bind tighter
    ["SuffixChain", "SuffixItem SuffixChain", "SuffixItem"],

    ["SuffixItem", "DurationSuffix", "DurationSuffix ModifierSuffix", "ModifierSuffix"],

    ["DurationSuffix", "Dot", "Star", "Slash"],

    ["ModifierSuffix", "Modifier"],

    // Combined hits: a + b + c
    ["CombinedHit", "CombinedItem WS '+' WS CombinedItem", "CombinedHit WS '+' WS CombinedItem"],

    ["CombinedItem", "GlyphToken", "GlyphToken ':' TrackName"],

    // Braced block with optional track prefix
    ["BracedBlock", "'{' WS MeasureContent WS '}'", "TrackName WS '{' WS MeasureContent WS '}'"],

    // Group expression
    ["GroupExpr", "'[' WS Integer? ':'? WS MeasureContent WS ']'"],
    ["GroupExpr", "'[' WS MeasureContent WS ']' SuffixChain"],

    // Multi-measure rest
    ["MultiRest", "Dash WS Integer WS Dash"],

    // Navigation
    ["NavMarker", "NavMarker"],
    ["NavJump", "NavJump"],

    // Measure repeat
    ["MeasureRepeat", "'%'", "'%%'"],

    // Inline repeat suffix: content * N
    ["InlineRepeatSuffix", "WS '*' WS Integer"],

    // Inline repeat bare: * N (creates N empty measures)
    ["InlineRepeatBare", "'*' WS Integer"],

    // Barline
    ["Barline", "Barline"],
  ],

  // Special handling for whitespace
  ws: "WS",
});

// Configure the parser with error recovery
export function createParser() {
  return DrumMarkGrammar.configure({
    strict: false,  // Allow error recovery
  });
}
