import { beforeAll, describe, expect, it } from "vitest";
import { buildNormalizedScore } from "./dsl/normalize";
import { formatIrJson, formatParserAstJson, type ParserAstOutput } from "./cli_output";
import { initParserWasmNode } from "./wasm/parser_wasm_node";
import { parseWithParserRuntime } from "./wasm/parser_runtime";

describe("formatScoreJson", () => {
  let score: ReturnType<typeof buildNormalizedScore>;
  let ast: ParserAstOutput;

  beforeAll(async () => {
    await initParserWasmNode();
    const source = `title CLI Output
time 4/4
note 1/8
grouping 2+2

HH | x - x - x - x - |
SD | - - d - - - d - |`;
    ast = parseWithParserRuntime(source) as ParserAstOutput;
    score = buildNormalizedScore(`title CLI Output
time 4/4
note 1/8
grouping 2+2

HH | x - x - x - x - |
SD | - - d - - - d - |`);
  });

  it("formats the parser AST envelope for ast output", () => {
    const parsed = JSON.parse(formatParserAstJson(ast));

    expect(parsed.version).toBe("drummark-parser-ast/v1");
    expect(parsed.headers.title).toBe("CLI Output");
    expect(parsed.paragraphs).toHaveLength(1);
    expect(parsed.errors).toEqual([]);
  });

  it("omits the AST envelope for ir output", () => {
    const parsed = JSON.parse(formatIrJson(score));

    expect(parsed.ast).toBeUndefined();
    expect(parsed.header.title).toBe("CLI Output");
    expect(parsed.measures).toHaveLength(1);
  });
});
