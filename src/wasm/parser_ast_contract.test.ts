import { beforeAll, describe, expect, it } from "vitest";
import { initParserWasmNode } from "./parser_wasm_node";
import { parseWithParserRuntime } from "./parser_runtime";
import type { ParserAstOutput } from "../cli_output";

type AstMeasure = {
  barline?: { type: string };
  tokens: Array<{ kind: string; glyph: string }>;
};

type AstParagraph = {
  lines: Array<{
    measures: AstMeasure[];
  }>;
};

describe("native parser AST WASM contract", () => {
  beforeAll(async () => {
    await initParserWasmNode();
  });

  it("returns a stable top-level AST envelope", () => {
    const ast = parseWithParserRuntime(`title Contract
time 4/4
divisions 4

HH | x - - - |`) as ParserAstOutput;

    expect(ast.version).toBe("drummark-parser-ast/v1");
    expect(ast.errors).toEqual([]);
    expect(ast.headers).toMatchObject({ title: "Contract", divisions: 4 });
    expect(ast.paragraphs).toHaveLength(1);
    const paragraph = ast.paragraphs[0] as AstParagraph | undefined;
    const measure = paragraph?.lines[0]?.measures[0];
    expect(measure).toMatchObject({ barline: { type: "|" } });
    expect(measure?.tokens.slice(0, 2)).toEqual([
      { kind: "basic", glyph: "x" },
      { kind: "basic", glyph: "-" },
    ]);
  });

  it("returns recoverable parser diagnostics without normalizing", () => {
    const ast = parseWithParserRuntime(`time 4
HH | x |`) as ParserAstOutput;

    expect(ast.version).toBe("drummark-parser-ast/v1");
    expect(ast.errors).toContainEqual({
      line: 1,
      column: 5,
      message: "invalid time header; expected `time <int>/<int>`",
    });
    expect(ast.paragraphs).toEqual([]);
  });
});
