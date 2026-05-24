import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMusicXml } from "./musicxml";
import { initParserWasmNode } from "../wasm/parser_wasm_node";

const INPUT_DIR = "docs/musicxml-corpus/inputs";
const GOLDEN_DIR = "docs/musicxml-corpus/goldens";
const EXTRA_CASES = [
  {
    name: "docs-example-musicxml",
    input: "docs/examples/musicxml.drum",
    golden: "docs-example-musicxml.musicxml",
  },
] as const;

function normalizeXml(xml: string): string {
  return xml
    .trim()
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ");
}

describe("MusicXML corpus goldens", () => {
  beforeAll(async () => {
    await initParserWasmNode();
  });

  for (const file of readdirSync(INPUT_DIR).filter((name) => name.endsWith(".drum")).sort()) {
    it(`matches ${file}`, () => {
      const source = readFileSync(join(INPUT_DIR, file), "utf8");
      const actual = buildMusicXml(source);
      const expected = readFileSync(join(GOLDEN_DIR, basename(file, ".drum") + ".musicxml"), "utf8");

      expect(actual.errors).toEqual([]);
      expect(normalizeXml(actual.xml)).toBe(normalizeXml(expected));
    });
  }

  for (const extra of EXTRA_CASES) {
    it(`matches ${extra.name}`, () => {
      const source = readFileSync(extra.input, "utf8");
      const actual = buildMusicXml(source);
      const expected = readFileSync(join(GOLDEN_DIR, extra.golden), "utf8");

      expect(actual.errors).toEqual([]);
      expect(normalizeXml(actual.xml)).toBe(normalizeXml(expected));
    });
  }

  it("reports parser and normalization diagnostics from xml export", () => {
    const actual = buildMusicXml(`time 4/4
grouping 2+3

HH | x - - - |`);

    expect(actual.errors).toContainEqual({
      line: 1,
      column: 1,
      message: "grouping sum 5 must equal time numerator 4",
    });
  });

  it("preserves the secondary voice rest visibility option", () => {
    const visible = buildMusicXml(`time 4/4
divisions 4

HH | x - x - |
BD | - b - b |`, false);
    const hidden = buildMusicXml(`time 4/4
divisions 4

HH | x - x - |
BD | - b - b |`, true);

    expect(visible.xml).toContain("<rest><display-step>F");
    expect(hidden.xml).toContain("<forward><duration>");
    expect(hidden.xml).not.toContain("<rest><display-step>F");
  });
});
