import { beforeAll, describe, expect, it } from "vitest";
import { buildLayoutSceneWithNodeWasm, initLayoutWasmNode } from "./layout_wasm_node";

describe("layout node wasm legacy divisions guard", () => {
  beforeAll(async () => {
    await initLayoutWasmNode();
  });

  it("returns an issue-only scene for legacy divisions input", () => {
    const scene = buildLayoutSceneWithNodeWasm(`time 4/4
divisions 4

HH | x x x x |
`, {
      pageWidth: 612,
      pageHeight: 792,
      topMargin: 40,
      bottomMargin: 40,
      leftMargin: 40,
      rightMargin: 40,
      staffSpacePt: 10,
      pxPerQuarter: 80,
      stemLenOffsetPt: 0,
      systemSpacingOffsetPt: 0,
      headerHeight: 50,
      headerStaffSpacing: 60,
      voltaSpacing: 18,
      hairpinOffsetY: 0,
      hideVoice2Rests: false,
      hideTitle: false,
      hideSubtitle: false,
      hideComposer: false,
      hideTempo: false,
      hideTimeSignature: false,
      hideClef: false,
      hideMeasureNumber: false,
      durationSpacingCompression: 0,
      measureWidthCompression: 0,
      debug: 0,
    }) as {
      pages?: unknown[];
      issues?: string[];
    };

    expect(scene.pages ?? []).toEqual([]);
    expect(scene.issues).toContain(
      "Line 2, Col 1: legacy `divisions` header has been removed; use `note 1/N` instead",
    );
  });
});
