// ── Renderer layout constants ──

export const NAV_TEXT_FONT = "Academico";
export const NAV_GLYPH_FONT = "Bravura";
export const SKYLINE_BUCKET_WIDTH = 4;
export const SKYLINE_GAP = 6;
export const SKYLINE_GAP_BELOW = 6;
export const BEAM_THICKNESS = 3;
export const NOTEHEAD_PADDING = 8;
export const HAIRPIN_FULL_HEIGHT = 16;
export const HAIRPIN_CLIP_Y_PADDING_ABOVE = 40;
export const HAIRPIN_CLIP_HEIGHT = 160;
export const NAV_TEXT_SIZE = 12;
export const NAV_GLYPH_SIZE = 20;
export const VOLTA_TEXT_SIZE = 12;

// ── User-facing setting value ranges ──

export const SETTINGS_RANGES = {
  hairpinOffsetY: { min: 0, max: 20, default: 0 },
  voltaSpacing: { min: -20, max: 20, default: -15 },
  staffScale: { min: 30, max: 150 },
  stemLength: { min: 20, max: 40, default: 31 },
  systemSpacing: { min: 0, max: 100, default: 30 },
  headerHeight: { min: 10, max: 300, default: 50 },
  headerStaffSpacing: { min: 0, max: 100, default: 60 },
  durationSpacingCompression: { min: 0, max: 1.5, default: 0.6 },
  measureWidthCompression: { min: 0, max: 1.5, default: 0.75 },
  tempoOffsetX: { min: -100, max: 100, default: 0 },
  tempoOffsetY: { min: -100, max: 100, default: 0 },
  measureNumberOffsetX: { min: -100, max: 100, default: 0 },
  measureNumberOffsetY: { min: -100, max: 100, default: 8 },
  measureNumberFontSize: { min: 6, max: 20, default: 10 },
} as const;
