import { describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./normalize";

function buildSingleMeasureScore(body: string) {
  const score = buildNormalizedScore(`time 4/4
divisions 4

${body}`);

  expect(score.errors).toEqual([]);
  expect(score.measures).toHaveLength(1);
  return score;
}

describe("spec C04 resolution priority", () => {
  it("prefers explicit overrides over static magic-token targets", () => {
    const score = buildSingleMeasureScore("| SD:r RC:s HF:b HH:o |");

    expect(score.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "SD", glyph: "d", modifiers: [] },
      { track: "RC", glyph: "x", modifiers: [] },
      { track: "HF", glyph: "d", modifiers: [] },
      { track: "HH", glyph: "x", modifiers: ["open"] },
    ]);
  });

  it("prefers explicit overrides over named-line and anonymous context fallback", () => {
    const namedScore = buildSingleMeasureScore("HH | SD:d SD:x RC:p T1:g |");
    const anonymousScore = buildSingleMeasureScore("| RC:d SD:x HF:p T1:g |");

    expect(namedScore.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "SD", glyph: "d", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: ["cross"] },
      { track: "RC", glyph: "x", modifiers: [] },
      { track: "T1", glyph: "d", modifiers: ["ghost"] },
    ]);

    expect(anonymousScore.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "RC", glyph: "x", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: ["cross"] },
      { track: "HF", glyph: "d", modifiers: [] },
      { track: "T1", glyph: "d", modifiers: ["ghost"] },
    ]);
  });

  it("uses static magic-token targets before named-line context", () => {
    const score = buildSingleMeasureScore("HH | s b r c |");

    expect(score.measures[0]?.events.map((event) => event.track)).toEqual([
      "SD",
      "BD",
      "RC",
      "C",
    ]);
  });

  it("uses static magic-token targets before anonymous fallback", () => {
    const score = buildSingleMeasureScore("| t4 o chn wb |");

    expect(score.measures[0]?.events.map((event) => event.track)).toEqual([
      "T4",
      "HH",
      "CHN",
      "WB",
    ]);
  });

  it("falls back to local named-track context only when no override or static target exists", () => {
    const score = buildSingleMeasureScore("SD | d x p g |");

    expect(score.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "SD", glyph: "d", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: ["cross"] },
      { track: "SD", glyph: "d", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: ["ghost"] },
    ]);
  });

  it("falls back to anonymous defaults only when no override or static target exists", () => {
    const score = buildSingleMeasureScore("| d x p g |");

    expect(score.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "HH", glyph: "x", modifiers: [] },
      { track: "HH", glyph: "x", modifiers: [] },
      { track: "HF", glyph: "d", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: ["ghost"] },
    ]);
  });

  it("applies resolution priority independently inside combined hits", () => {
    const score = buildSingleMeasureScore("| x+SD:r+HF:p+T1:g |");

    expect(score.measures[0]?.events.map((event) => ({
      track: event.track,
      glyph: event.glyph,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "HH", glyph: "x", modifiers: [] },
      { track: "SD", glyph: "d", modifiers: [] },
      { track: "HF", glyph: "d", modifiers: [] },
      { track: "T1", glyph: "d", modifiers: ["ghost"] },
    ]);
  });
});
