import { describe, expect, it } from "vitest";
import { preprocessSource } from "./preprocess";

describe("preprocessSource", () => {
  it("normalizes line endings and strips comments", () => {
    const lines = preprocessSource("tempo 96\r\ntime 4/4 # meter\r\ndivisions 16\r\n");

    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({
      kind: "content",
      lineNumber: 1,
      content: "tempo 96",
    });
    expect(lines[1]).toMatchObject({
      kind: "content",
      lineNumber: 2,
      content: "time 4/4",
      comment: " meter",
    });
    expect(lines[2]).toMatchObject({
      kind: "content",
      lineNumber: 3,
      content: "divisions 16",
    });
    expect(lines[3]).toMatchObject({
      kind: "blank",
      lineNumber: 4,
      content: "",
    });
  });

  it("distinguishes blank lines from comment-only lines", () => {
    const lines = preprocessSource("\n# hello\n  # indented\nHH | x - x - |");

    expect(lines[0]).toMatchObject({ kind: "blank", lineNumber: 1 });
    expect(lines[1]).toMatchObject({
      kind: "comment",
      lineNumber: 2,
      content: "",
      comment: " hello",
    });
    expect(lines[2]).toMatchObject({
      kind: "comment",
      lineNumber: 3,
      content: "",
      comment: " indented",
    });
    expect(lines[3]).toMatchObject({
      kind: "content",
      lineNumber: 4,
      content: "HH | x - x - |",
    });
  });

  it("trims content but preserves source offsets", () => {
    const lines = preprocessSource("  tempo 96  \n\nHH | x - x - |");

    expect(lines[0]).toMatchObject({
      kind: "content",
      lineNumber: 1,
      content: "tempo 96",
      startOffset: 0,
    });
    expect(lines[1]).toMatchObject({
      kind: "blank",
      lineNumber: 2,
      startOffset: 13,
    });
    expect(lines[2]).toMatchObject({
      kind: "content",
      lineNumber: 3,
      startOffset: 14,
    });
  });
});
