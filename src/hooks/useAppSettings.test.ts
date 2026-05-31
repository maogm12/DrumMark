import { describe, expect, it } from "vitest";
import { resolveAppSettings } from "./useAppSettings";

describe("resolveAppSettings", () => {
  it("does not expose a renderer selector for new users", () => {
    expect(resolveAppSettings(null)).not.toHaveProperty("useLayoutEngine");
  });

  it("preserves old saved settings without renderer preference", () => {
    const settings = resolveAppSettings(JSON.stringify({ staffScale: 0.9 }));

    expect(settings.staffSpacePt).toBe(6.0);
    expect(settings).not.toHaveProperty("useLayoutEngine");
  });

  it("drops saved legacy renderer preferences", () => {
    expect(resolveAppSettings(JSON.stringify({ useLayoutEngine: false }))).not.toHaveProperty("useLayoutEngine");
    expect(resolveAppSettings(JSON.stringify({ useLayoutEngine: true }))).not.toHaveProperty("useLayoutEngine");
  });

  it("falls back to layout engine defaults for corrupt settings", () => {
    expect(resolveAppSettings("{")).not.toHaveProperty("useLayoutEngine");
  });

  it("resets legacy absolute stem length settings to offset default", () => {
    expect(resolveAppSettings(JSON.stringify({ stemLength: 23 })).stemLength).toBe(0);
  });

  it("converts legacy staff-space stem offset to pt", () => {
    expect(resolveAppSettings(JSON.stringify({ stemLength: 1, staffSpacePt: 5 })).stemLength).toBe(5);
  });

  it("drops removed debug and experimental settings from saved settings", () => {
    const settings = resolveAppSettings(JSON.stringify({
      tempoOffsetX: 20,
      tempoOffsetY: -10,
      measureNumberOffsetX: 5,
      measureNumberOffsetY: 12,
      measureNumberFontSize: 18,
      durationSpacingCompression: 1.2,
      measureWidthCompression: 1.1,
    }));

    expect(settings).not.toHaveProperty("tempoOffsetX");
    expect(settings).not.toHaveProperty("tempoOffsetY");
    expect(settings).not.toHaveProperty("measureNumberOffsetX");
    expect(settings).not.toHaveProperty("measureNumberOffsetY");
    expect(settings).not.toHaveProperty("measureNumberFontSize");
    expect(settings).not.toHaveProperty("durationSpacingCompression");
    expect(settings).not.toHaveProperty("measureWidthCompression");
  });
});
