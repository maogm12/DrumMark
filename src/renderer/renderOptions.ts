export type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ScoreRenderOptions = {
  pagePadding: PagePadding;
  pageWidth: number;
  pageHeight: number;
  staffSpacePt: number;
  headerHeight: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY?: number;
  hideVoice2Rests: boolean;
  tempoOffsetX: number;
  tempoOffsetY: number;
  measureNumberOffsetX: number;
  measureNumberOffsetY: number;
  measureNumberFontSize: number;
  durationSpacingCompression: number;
  measureWidthCompression: number;
};

export const DEFAULT_RENDER_OPTIONS: ScoreRenderOptions = {
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  pageWidth: 612,
  pageHeight: 792,
  staffSpacePt: 5.0,
  headerHeight: 50,
  headerStaffSpacing: 60,
  systemSpacing: 30,
  stemLength: 0,
  voltaSpacing: 0,
  hairpinOffsetY: 0,
  hideVoice2Rests: false,
  tempoOffsetX: 0,
  tempoOffsetY: 0,
  measureNumberOffsetX: 0,
  measureNumberOffsetY: 8,
  measureNumberFontSize: 10,
  durationSpacingCompression: 0.6,
  measureWidthCompression: 0.75,
};

export const SETTINGS_RANGES = {
  hairpinOffsetY: { min: -20, max: 20, default: 0 },
  voltaSpacing: { min: -20, max: 20, default: 0 },
  staffSpacePt: { min: 1, max: 10, default: 5 },
  /** Fine adjustment in pt added to the default stem span (4 × staff space). */
  stemLength: { min: -12, max: 12, default: 0 },
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

export type ScoreRenderResult = {
  svg: string;
  pages: string[];
};
