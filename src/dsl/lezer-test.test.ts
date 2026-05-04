import { describe, it, expect } from "vitest";
import { parser as DrumMarkParser } from "./drum_mark.parser.js";

describe("lezer parser", () => {
  it("parses simple document", () => {
    const parser = DrumMarkParser.configure({ strict: false });
    const source = `title Test Song
time 4/4
note 1/16

HH | x - x - |
`;
    const tree = parser.parse(source);
    expect(tree).toBeDefined();
    expect(tree.length).toBe(source.length);
  });
});
