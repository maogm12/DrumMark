import { describe, expect, it } from "vitest";
import {
  buildCliOutput,
  CLI_USAGE,
  formatCliWarnings,
  parseCliArgs,
  resolveCliOutputPath,
} from "./cli_runtime";

const SIMPLE_SOURCE = `title CLI Output
time 4/4
note 1/8
grouping 2+2

HH | x - x - x - x - |
SD | - - d - - - d - |`;

describe("cli runtime", () => {
  it("parses input, format, and output flags", () => {
    expect(parseCliArgs(["score.drum", "--format", "svg", "--output", "score.svg"])).toEqual({
      input: "score.drum",
      format: "svg",
      output: "score.svg",
    });
  });

  it("returns null and uses the shared usage string when input is missing", () => {
    expect(parseCliArgs(["--format", "ast"])).toBeNull();
    expect(CLI_USAGE).toContain("npm run drummark");
  });

  it("derives default output paths only for file outputs", () => {
    expect(resolveCliOutputPath({ input: "score.drum", format: "xml", output: null })).toBe("score.xml");
    expect(resolveCliOutputPath({ input: "score.drum", format: "svg", output: null })).toBe("score.svg");
    expect(resolveCliOutputPath({ input: "score.drum", format: "ir", output: null })).toBeNull();
  });

  it("formats warnings from normalized parser errors", async () => {
    const { errors } = await buildCliOutput(`time 4
HH | x |`, "ast");

    expect(formatCliWarnings(errors)).toEqual([
      "Parser warnings/errors:",
      "Line 1, Col 5: invalid time header; expected `time <int>/<int>`",
    ]);
  });

  it("builds AST output", async () => {
    const { result } = await buildCliOutput(SIMPLE_SOURCE, "ast");
    const parsed = JSON.parse(result);

    expect(parsed.version).toBe("drummark-parser-ast/v1");
    expect(parsed.headers.title).toBe("CLI Output");
    expect(parsed.paragraphs).toHaveLength(1);
    expect(parsed.paragraphs[0].lines[0].measures).toHaveLength(1);
  });

  it("builds IR output", async () => {
    const { result } = await buildCliOutput(SIMPLE_SOURCE, "ir");
    const parsed = JSON.parse(result);

    expect(parsed.ast).toBeUndefined();
    expect(parsed.header.title).toBe("CLI Output");
    expect(parsed.measures).toHaveLength(1);
  });

  it("builds MusicXML output", async () => {
    const { result } = await buildCliOutput(SIMPLE_SOURCE, "xml");

    expect(result).toContain("<score-partwise");
    expect(result).toContain("<part-name>Drumset</part-name>");
  });

  it("builds SVG output through the shared render bootstrap", async () => {
    const { result } = await buildCliOutput(SIMPLE_SOURCE, "svg");

    expect(result).toContain("<svg");
    expect(result).toContain('data-role="notehead"');
    expect(result).toContain('data-role="staff-line"');
  });

  it("keeps one paragraph on one system and renders SMuFL flag glyphs on the active CLI path", async () => {
    const singleParagraph = `time 4/4
note 1/8
grouping 2+2

SD | d | d |`;
    const splitParagraphs = `time 4/4
note 1/8
grouping 2+2

SD | d |

SD | d |`;

    const { result: singleSvg } = await buildCliOutput(singleParagraph, "svg");
    const { result: splitSvg } = await buildCliOutput(splitParagraphs, "svg");

    expect((singleSvg.match(/data-role="opening-barline"/g) || []).length).toBe(1);
    expect((singleSvg.match(/data-role="measure-number"/g) || []).length).toBe(0);
    expect((singleSvg.match(/data-role="flag"/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(singleSvg).toContain("\u{E240}");
    expect(singleSvg).not.toContain("<polyline");

    expect((splitSvg.match(/data-role="opening-barline"/g) || []).length).toBe(2);
    expect((splitSvg.match(/data-role="measure-number"/g) || []).length).toBe(1);
  });

  it("renders downward unbeamed flags with the down-flag glyph on the active CLI path", async () => {
    const downwardFlagSource = `time 4/4
note 1/8
grouping 2+2

BD | b |`;

    const { result } = await buildCliOutput(downwardFlagSource, "svg");

    expect(result).toContain("\u{E241}");
    expect(result).not.toContain("<polyline");
  });

  it("renders ledger lines for notes above the staff on the active CLI path", async () => {
    const crashSource = `time 4/4
note 1/4

C | x |`;

    const { result } = await buildCliOutput(crashSource, "svg");

    expect(result).toContain('data-role="ledger-line"');
    expect(result).toContain('data-role="notehead"');
  });
});
