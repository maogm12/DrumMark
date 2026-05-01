export type PagePadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type VexflowRenderOptions = {
  mode: "preview" | "pdf";
  pagePadding: PagePadding;
  pageScale: number;
  titleTopPadding: number;
  titleSubtitleGap: number;
  titleStaffGap: number;
  systemSpacing: number;
  stemLength: number;
  voltaGap?: number;
  hideVoice2Rests: boolean;
};

export type ScoreRenderResult = {
  svg: string;
  pages: string[];
};
