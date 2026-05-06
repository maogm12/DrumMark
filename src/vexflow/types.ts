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
  titleStaffGap: number;
  systemSpacing: number;
  stemLength: number;
  voltaGap: number;
  hideVoice2Rests: boolean;
  tempoShiftX: number;
  tempoShiftY: number;
  measureNumberShiftX: number;
  measureNumberShiftY: number;
  measureNumberFontSize: number;
};

export const DEFAULT_RENDER_OPTIONS: VexflowRenderOptions = {
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  pageWidth: 612,
  pageHeight: 792,
  staffScale: 0.75,
  headerHeight: 50,
  titleStaffGap: 60,
  systemSpacing: 30,
  stemLength: 31,
  voltaGap: -15,
  hideVoice2Rests: false,
  tempoShiftX: 0,
  tempoShiftY: 0,
  measureNumberShiftX: 0,
  measureNumberShiftY: 8,
  measureNumberFontSize: 10,
};

export type ScoreRenderResult = {
  svg: string;
  pages: string[];
};
