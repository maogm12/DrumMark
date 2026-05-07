export type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type VexflowRenderOptions = {
  pagePadding: PagePadding;
  pageWidth: number;
  pageHeight: number;
  staffScale: number;
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

export const DEFAULT_RENDER_OPTIONS: VexflowRenderOptions = {
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  pageWidth: 612,
  pageHeight: 792,
  staffScale: 0.75,
  headerHeight: 50,
  headerStaffSpacing: 60,
  systemSpacing: 30,
  stemLength: 31,
  voltaSpacing: -15,
  hairpinOffsetY: -15,
  hideVoice2Rests: false,
  tempoOffsetX: 0,
  tempoOffsetY: 0,
  measureNumberOffsetX: 0,
  measureNumberOffsetY: 8,
  measureNumberFontSize: 10,
  durationSpacingCompression: 0.6,
  measureWidthCompression: 0.75,
};

export type ScoreRenderResult = {
  svg: string;
  pages: string[];
};
