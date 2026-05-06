import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { buildNormalizedScore } from "./normalize";
import { parseDocumentSkeleton } from "./parser";
import { TRACKS } from "./types";

const FULL_REGISTRY_SOURCE = `time 4/4
divisions 4

HH | d - - - |
HF | d - - - |
SD | d - - - |
BD | d - - - |
T1 | d - - - |
T2 | d - - - |
T3 | d - - - |
RC | d - - - |
C | d - - - |
ST | R - - - |
BD2 | d - - - |
T4 | d - - - |
RC2 | d - - - |
C2 | d - - - |
SPL | d - - - |
CHN | d - - - |
CB | d - - - |
WB | d - - - |
CL | d - - - |`;

describe("spec C02 tracks", () => {
  it("parses every canonical track header from the full registry", () => {
    const doc = parseDocumentSkeleton(FULL_REGISTRY_SOURCE);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(1);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(TRACKS);
  });

  it("registers tracks from anonymous fallback, routing scopes, and summon prefixes in first-seen order", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| x @RC { d d } HF:d SD:d |

BD2 | d - - - |`);

    expect(score.errors).toEqual([]);
    expect(score.paragraphs).toHaveLength(2);

    expect(score.paragraphs[0].tracks.map((track) => track.track)).toEqual([
      "ANONYMOUS",
      "HH",
      "RC",
      "HF",
      "SD",
      "BD2",
    ]);
    expect(score.paragraphs[1].tracks.map((track) => track.track)).toEqual([
      "HH",
      "RC",
      "HF",
      "SD",
      "BD2",
    ]);
  });

  it("auto-fills omitted registered tracks with generated full-measure rests across paragraphs", () => {
    const score = buildScoreAst(`time 4/4
divisions 4

| x @RC { d d } HF:d SD:d |

BD2 | d - - - |`);

    expect(score.errors).toEqual([]);

    const firstParagraphNamedTracks = score.paragraphs[0].tracks.slice(1);
    expect(firstParagraphNamedTracks.map((track) => ({
      track: track.track,
      generated: track.generated,
      tokens: track.measures[0]?.tokens.map((token) => token.kind === "basic" ? token.value : token.kind),
    }))).toEqual([
      { track: "HH", generated: true, tokens: ["-", "-", "-", "-"] },
      { track: "RC", generated: true, tokens: ["-", "-", "-", "-"] },
      { track: "HF", generated: true, tokens: ["-", "-", "-", "-"] },
      { track: "SD", generated: true, tokens: ["-", "-", "-", "-"] },
      { track: "BD2", generated: true, tokens: ["-", "-", "-", "-"] },
    ]);

    expect(score.paragraphs[1].tracks.map((track) => ({
      track: track.track,
      generated: track.generated,
    }))).toEqual([
      { track: "HH", generated: true },
      { track: "RC", generated: true },
      { track: "HF", generated: true },
      { track: "SD", generated: true },
      { track: "BD2", generated: false },
    ]);
  });

  it("preserves global first-seen order in the normalized track registry across mixed registration channels", () => {
    const score = buildNormalizedScore(`time 4/4
divisions 4

| @RC { d } BD:d |
T1 | d - - - |

C2 | d - - - |
| ST:R HF:d |`);

    expect(score.errors).toEqual([]);
    expect(score.tracks.map((track) => track.id)).toEqual([
      "RC",
      "BD",
      "T1",
      "C2",
      "ST",
      "HF",
    ]);
  });

  it("classifies the full track registry into the spec families", () => {
    const score = buildNormalizedScore(FULL_REGISTRY_SOURCE);

    expect(score.errors).toEqual([]);
    expect(score.tracks).toEqual([
      { id: "HH", family: "cymbal" },
      { id: "HF", family: "pedal" },
      { id: "SD", family: "drum" },
      { id: "BD", family: "drum" },
      { id: "T1", family: "drum" },
      { id: "T2", family: "drum" },
      { id: "T3", family: "drum" },
      { id: "RC", family: "cymbal" },
      { id: "C", family: "cymbal" },
      { id: "ST", family: "auxiliary" },
      { id: "BD2", family: "drum" },
      { id: "T4", family: "drum" },
      { id: "RC2", family: "cymbal" },
      { id: "C2", family: "cymbal" },
      { id: "SPL", family: "cymbal" },
      { id: "CHN", family: "cymbal" },
      { id: "CB", family: "percussion" },
      { id: "WB", family: "percussion" },
      { id: "CL", family: "percussion" },
    ]);
  });

  it("reports a dedicated migration diagnostic for legacy bare routed blocks", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

| x RC { d d } |`);

    expect(doc.errors).toContainEqual({
      line: 4,
      column: 5,
      message: "Legacy routed block syntax `RC { ... }` has been removed; use `@RC { ... }` instead.",
    });
  });
});
