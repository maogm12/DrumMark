import { describe, expect, it } from "vitest";
import { diagnosticRange } from "./editorDiagnostics";
import type { ParseError } from "./dsl";

function docWithLine(from: number, to: number) {
  return {
    lines: 1,
    line: () => ({ from, to }),
  };
}

function errorAt(column: number): ParseError {
  return {
    line: 1,
    column,
    message: "unclosed group bracket",
  };
}

describe("editor diagnostic ranges", () => {
  it("marks the reported character when the diagnostic is inside the line", () => {
    expect(diagnosticRange(docWithLine(10, 16), errorAt(3))).toEqual({
      from: 12,
      to: 13,
    });
  });

  it("marks the previous character for end-of-line diagnostics", () => {
    expect(diagnosticRange(docWithLine(10, 16), errorAt(7))).toEqual({
      from: 15,
      to: 16,
    });
  });

  it("keeps empty-line diagnostics within the line boundary", () => {
    expect(diagnosticRange(docWithLine(10, 10), errorAt(1))).toEqual({
      from: 10,
      to: 10,
    });
  });
});
