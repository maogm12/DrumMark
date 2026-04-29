import { describe, expect, it } from "vitest";

import { buildNormalizedScore } from "./normalize";

describe("DRUMMARK_SPEC C08 modifier legality matrix", () => {
  it("accepts representative legal combinations across modifier families", () => {
    const score = buildNormalizedScore(`time 13/4
divisions 13
grouping 1+1+1+1+1+1+1+1+1+1+1+1+1

| d:accent HH:d:open HH:d:half-open HF:d:close RC:d:bell RC:d:choke SD:d:rim SD:d:cross T1:d:flam HH:d:ghost RC:d:drag BD:d:roll SD:d:dead |`);

    expect(score.errors).toEqual([]);
    expect(score.measures[0].events.map((event) => ({
      track: event.track,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "HH", modifiers: ["accent"] },
      { track: "HH", modifiers: ["open"] },
      { track: "HH", modifiers: ["half-open"] },
      { track: "HF", modifiers: ["close"] },
      { track: "RC", modifiers: ["bell"] },
      { track: "RC", modifiers: ["choke"] },
      { track: "SD", modifiers: ["rim"] },
      { track: "SD", modifiers: ["cross"] },
      { track: "T1", modifiers: ["flam"] },
      { track: "HH", modifiers: ["ghost"] },
      { track: "RC", modifiers: ["drag"] },
      { track: "BD", modifiers: ["roll"] },
      { track: "SD", modifiers: ["dead"] },
    ]);
  });

  it("rejects illegal modifiers on named-track context with stable hard errors", () => {
    const score = buildNormalizedScore(`time 11/4
divisions 11
grouping 1+1+1+1+1+1+1+1+1+1+1

RC | d:open d:half-open d:close d:rim d:cross d:flam d:ghost d:dead |
BD | d:drag d:choke d:bell |`);

    expect(score.errors).toEqual([
      { line: 5, column: 1, message: "Modifier `open` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `half-open` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `close` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `rim` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `cross` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `flam` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `ghost` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `dead` is not allowed on track `RC`" },
      { line: 6, column: 1, message: "Modifier `drag` is not allowed on track `BD`" },
      { line: 6, column: 1, message: "Modifier `choke` is not allowed on track `BD`" },
      { line: 6, column: 1, message: "Modifier `bell` is not allowed on track `BD`" },
    ]);
  });

  it("validates explicit summon overrides against the resolved target track", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

HH | RC:d:open SD:d:bell HF:d:ghost C:d:roll |`);

    expect(score.errors).toEqual([
      { line: 4, column: 1, message: "Modifier `open` is not allowed on track `RC`" },
      { line: 4, column: 1, message: "Modifier `bell` is not allowed on track `SD`" },
      { line: 4, column: 1, message: "Modifier `ghost` is not allowed on track `HF`" },
      { line: 4, column: 1, message: "Modifier `roll` is not allowed on track `C`" },
    ]);
  });

  it("validates static magic tokens after resolution, not by surrounding line context", () => {
    const score = buildNormalizedScore(`time 5/4
divisions 5
grouping 1+1+1+1+1

HH | r:bell r:open b:roll b:ghost o:open |`);

    expect(score.errors).toEqual([
      { line: 5, column: 1, message: "Modifier `open` is not allowed on track `RC`" },
      { line: 5, column: 1, message: "Modifier `ghost` is not allowed on track `BD`" },
    ]);

    expect(score.measures[0].events.map((event) => ({
      track: event.track,
      modifiers: event.modifiers,
    }))).toEqual([
      { track: "RC", modifiers: ["bell"] },
      { track: "RC", modifiers: ["open"] },
      { track: "BD", modifiers: ["roll"] },
      { track: "BD", modifiers: ["ghost"] },
      { track: "HH", modifiers: ["open"] },
    ]);
  });

  it("checks each combined-hit item independently", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| HH:d:open+RC:d:open+BD:d:roll+BD:d:ghost SD:d:flam+RC:d:flam |`);

    expect(score.errors).toEqual([
      { line: 4, column: 1, message: "Modifier `open` is not allowed on track `RC`" },
      { line: 4, column: 1, message: "Modifier `ghost` is not allowed on track `BD`" },
      { line: 4, column: 1, message: "Modifier `flam` is not allowed on track `RC`" },
    ]);
  });
});
