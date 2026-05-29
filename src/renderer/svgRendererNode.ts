import {
  buildLayoutSceneWithNodeWasm,
  initLayoutWasmNode,
} from "../wasm/layout_wasm_node";
import { renderScenePagesToSvgs, renderSceneToSvg } from "./svgRenderer";
import { DEFAULT_RENDER_OPTIONS, SETTINGS_RANGES } from "./renderOptions";

type RenderOptions = {
  staffSpacePt?: number;
  pageWidth?: number;
  pageHeight?: number;
  showTitle?: boolean;
  topMargin?: number;
  bottomMargin?: number;
  leftMargin?: number;
  rightMargin?: number;
  stemLength?: number;
  systemSpacing?: number;
  headerHeight?: number;
  headerStaffSpacing?: number;
  voltaSpacing?: number;
  hairpinOffsetY?: number;
  hideVoice2Rests?: boolean;
  durationSpacingCompression?: number;
  measureWidthCompression?: number;
  debug?: boolean;
};

type Scene = Parameters<typeof renderSceneToSvg>[0];

function buildLayoutOptions(options?: RenderOptions): Record<string, unknown> {
  return {
    pageWidth: options?.pageWidth ?? 612,
    pageHeight: options?.pageHeight ?? 792,
    topMargin: options?.topMargin ?? 40,
    bottomMargin: options?.bottomMargin ?? 40,
    leftMargin: options?.leftMargin ?? 40,
    rightMargin: options?.rightMargin ?? 40,
    staffSpacePt: options?.staffSpacePt ?? DEFAULT_RENDER_OPTIONS.staffSpacePt,
    pxPerQuarter: 80,
    stemLenOffsetSs: options?.stemLength ?? SETTINGS_RANGES.stemLength.default,
    systemSpacing: options?.systemSpacing ?? SETTINGS_RANGES.systemSpacing.default,
    headerHeight: options?.headerHeight ?? SETTINGS_RANGES.headerHeight.default,
    headerStaffSpacing: options?.headerStaffSpacing ?? SETTINGS_RANGES.headerStaffSpacing.default,
    voltaSpacing: options?.voltaSpacing ?? SETTINGS_RANGES.voltaSpacing.default,
    hairpinOffsetY: options?.hairpinOffsetY ?? SETTINGS_RANGES.hairpinOffsetY.default,
    hideVoice2Rests: options?.hideVoice2Rests ?? false,
    durationSpacingCompression: options?.durationSpacingCompression ?? SETTINGS_RANGES.durationSpacingCompression.default,
    measureWidthCompression: options?.measureWidthCompression ?? SETTINGS_RANGES.measureWidthCompression.default,
    debug: options?.debug ? 1 : 0,
  };
}

export async function buildLayoutSceneFromSourceNode(
  source: string,
  options?: RenderOptions,
): Promise<Scene> {
  await initLayoutWasmNode();
  const scene = buildLayoutSceneWithNodeWasm(source, buildLayoutOptions(options)) as Scene;
  if (!scene || !Array.isArray(scene.pages)) {
    throw new Error("Layout scene export returned an invalid payload.");
  }
  if (scene.pages.length === 0 && scene.issues?.length) {
    throw new Error(scene.issues.join("\n"));
  }
  return scene;
}

export async function renderSourceToSvgNode(source: string, options?: RenderOptions): Promise<string> {
  return renderSceneToSvg(await buildLayoutSceneFromSourceNode(source, options), options);
}

export async function renderSourcePagesToSvgsNode(source: string, options?: RenderOptions): Promise<string[]> {
  return renderScenePagesToSvgs(await buildLayoutSceneFromSourceNode(source, options), options);
}
