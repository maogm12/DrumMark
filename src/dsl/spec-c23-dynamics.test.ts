import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildMusicXml } from "./musicxml";
import { buildNormalizedScore } from "./normalize";
import type { MeasureToken } from "./types";

function dynamicLevels(tokens: MeasureToken[]): string[] {
  return tokens.flatMap((token): string[] => {
    if (token.kind === "dynamic") return [token.level];
    if (token.kind === "group" || token.kind === "combined" || token.kind === "braced") {
      return dynamicLevels(token.items);
    }
    return [];
  });
}

describe("spec C23: explicit dynamics", () => {
  it("parses all supported dynamic spellings without shadowing routes or navigation", () => {
    const score = buildScoreAst(`time 4/4
note 1/8

HH | @segno @ppp x @pp x @p x @mp x | @mf x @f x @ff x @fff x @ds |
`);

    expect(score.errors).toEqual([]);
    const first = score.paragraphs[0].tracks[0].measures[0];
    const second = score.paragraphs[0].tracks[0].measures[1];

    expect(first.startNav).toEqual({ kind: "segno", anchor: "left-edge" });
    expect(second.endNav).toEqual({ kind: "ds", anchor: "right-edge" });
    expect(dynamicLevels([...first.tokens, ...second.tokens])).toEqual([
      "ppp",
      "pp",
      "p",
      "mp",
      "mf",
      "f",
      "ff",
      "fff",
    ]);

    const routedScore = buildScoreAst(`time 4/4
note 1/4

| @SD { @p s s } @BD { @p b b } |`);
    expect(routedScore.errors).toEqual([]);
    const routed = routedScore.paragraphs[0].tracks[0].measures[0];
    expect(routed.tokens[0]).toMatchObject({ kind: "braced", track: "SD" });
    expect(dynamicLevels(routed.tokens)).toEqual(["p", "p"]);
  });

  it("rejects unknown dynamic-like directives and preserves explicit empty dynamics arrays", () => {
    const bad = buildScoreAst(`time 4/4
HH | @ffx x x x x |`);
    expect(bad.errors.length).toBeGreaterThan(0);

    const plain = buildNormalizedScore(`time 4/4
HH | x x x x |`);
    expect(plain.errors).toEqual([]);
    expect(plain.measures[0].dynamics).toEqual([]);
  });

  it("normalizes deduplication, conflicts, routed blocks, nested groups, and navigation coexistence", () => {
    const routed = buildNormalizedScore(`time 7/4
divisions 7
grouping 2+2+3

| @segno @SD { @p d d } @BD { @p b b } @mp d [2: @f d d] @ds |`);

    expect(routed.errors).toEqual([]);
    expect(routed.measures[0].startNav).toEqual({ kind: "segno", anchor: "left-edge" });
    expect(routed.measures[0].endNav).toEqual({ kind: "ds", anchor: "right-edge" });
    expect(routed.measures[0].dynamics).toEqual([
      { level: "p", at: { numerator: 0, denominator: 1 } },
      { level: "mp", at: { numerator: 2, denominator: 5 } },
      { level: "f", at: { numerator: 3, denominator: 5 } },
    ]);

    const deduped = buildNormalizedScore(`time 4/4
HH | @p x x x x |
SD | @p d d d d |`);
    expect(deduped.errors).toEqual([]);
    expect(deduped.measures[0].dynamics).toEqual([
      { level: "p", at: { numerator: 0, denominator: 1 } },
    ]);

    const conflict = buildNormalizedScore(`time 4/4
HH | @p x x x x |
SD | @f d d d d |`);
    expect(conflict.errors.some((error) => error.message.includes("Conflicting dynamic marks at bar 1 position 0/1"))).toBe(true);
  });

  it("exports start, middle, end, and two-voice score-level dynamics to MusicXML once", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4
note 1/4

HH | @p x @mp x x x @ff |
SD | @p - @mp s - s @ff |`);

    expect(score.errors).toEqual([]);

    const xml = buildMusicXml(score);
    expect(xml).toContain('<dynamics><p/></dynamics></direction-type><offset>0</offset>');
    expect(xml).toContain('<dynamics><mp/></dynamics></direction-type><offset>4</offset>');
    expect(xml).toContain('<dynamics><ff/></dynamics></direction-type><offset>16</offset>');
    expect(xml.match(/<dynamics><p\/><\/dynamics>/g)).toHaveLength(1);
    expect(xml.match(/<dynamics><mp\/><\/dynamics>/g)).toHaveLength(1);
    expect(xml.match(/<dynamics><ff\/><\/dynamics>/g)).toHaveLength(1);
  });
});
