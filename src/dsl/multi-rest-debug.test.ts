import { describe, expect, it } from "vitest";
import { buildScoreAst } from "./ast";
import { normalizeScoreAst } from "./normalize";
import { buildMusicXml } from "./musicxml";

describe("multi-rest debug", () => {
  it("checks measure 2 and 3 in MusicXML", () => {
    const source = `tempo 96
time 4/4
divisions 4

HH | --8-- |

HH | -2- | xxxx | *3 | -2- |

HH | xxxx |

HH | xxxx |`;
    const ast = buildScoreAst(source);
    const score = normalizeScoreAst(ast);
    const xml = buildMusicXml(score);
    
    // Find measure 3 (number="3")
    const m3Start = xml.indexOf('<measure number="3"');
    const m3End = xml.indexOf('</measure>', m3Start) + 10;
    console.log("Measure 3 XML:");
    console.log(xml.slice(m3Start, m3End));
    
    // Find measure 4 (number="4")
    const m4Start = xml.indexOf('<measure number="4"');
    const m4End = xml.indexOf('</measure>', m4Start) + 10;
    console.log("\nMeasure 4 XML:");
    console.log(xml.slice(m4Start, m4End));
  });
});
