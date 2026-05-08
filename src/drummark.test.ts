import { describe, expect, it } from "vitest";
import { drumMarkStreamParser } from "./drummark";

class MockStringStream {
  string: string;
  pos = 0;
  start = 0;

  constructor(line: string) {
    this.string = line;
  }

  sol(): boolean {
    return this.pos === 0;
  }

  eatSpace(): boolean {
    const match = this.string.slice(this.pos).match(/^\s+/)?.[0];
    if (!match) {
      return false;
    }

    this.start = this.pos;
    this.pos += match.length;
    return true;
  }

  peek(): string | undefined {
    return this.string[this.pos];
  }

  skipToEnd() {
    this.pos = this.string.length;
  }

  match(pattern: string | RegExp): boolean {
    const chunk = this.string.slice(this.pos);
    if (typeof pattern === "string") {
      if (!chunk.startsWith(pattern)) {
        return false;
      }

      this.pos += pattern.length;
      return true;
    }

    const match = chunk.match(pattern);
    if (!match || match.index !== 0) {
      return false;
    }

    this.pos += match[0].length;
    return true;
  }

  current(): string {
    return this.string.slice(this.start, this.pos);
  }

  next(): string | undefined {
    if (this.pos >= this.string.length) {
      return undefined;
    }

    this.pos += 1;
    return this.string[this.pos - 1];
  }
}

function tokenizeLine(line: string) {
  const stream = new MockStringStream(line);
  const state = drumMarkStreamParser.startState!(0);
  const tokens: Array<{ text: string; style: string | null }> = [];

  while (stream.pos < stream.string.length) {
    stream.start = stream.pos;
    const before = stream.pos;
    const style = drumMarkStreamParser.token(stream as never, state);

    if (stream.pos === before) {
      throw new Error(`Tokenizer stalled on "${line}" at column ${before + 1}`);
    }

    if (style) {
      tokens.push({ text: stream.current(), style });
    }
  }

  return tokens;
}

describe("drumMarkStreamParser", () => {
  it("highlights anonymous lines with combined hits, routed scopes, and summoned sticking", () => {
    const tokens = tokenizeLine("| x+s RC{d:bell d:choke} ST:R SD:d:rim |");

    expect(tokens).toEqual(expect.arrayContaining([
      { text: "|", style: "barline" },
      { text: "x", style: "cymbal-note" },
      { text: "+", style: "hit-combinator" },
      { text: "s", style: "note" },
      { text: "RC", style: "track" },
      { text: "{", style: "punctuation" },
      { text: "bell", style: "modifier" },
      { text: "ST", style: "track-sticking" },
      { text: "R", style: "sticking-note" },
      { text: "SD", style: "track" },
      { text: "rim", style: "modifier" },
      { text: "}", style: "punctuation" },
    ]));
  });

  it("highlights spec repeat and navigation tokens instead of treating them as comments", () => {
    const tokens = tokenizeLine("|: @segno d |1. %% | @ds-al-coda - 4 - *3 :| |.");

    expect(tokens).toEqual(expect.arrayContaining([
      { text: "|:", style: "repeat" },
      { text: "@segno", style: "jump-marker" },
      { text: "|1.", style: "repeat-count" },
      { text: "%%", style: "measure-repeat" },
      { text: "@ds-al-coda", style: "jump-marker" },
      { text: "- 4 -", style: "repeat-count" },
      { text: "*3", style: "repeat-count" },
      { text: ":|", style: "repeat" },
      { text: "|.", style: "barline" },
    ]));
  });

  it("still recognizes hash comments and structural headers", () => {
    expect(tokenizeLine("tempo 112 # click")).toEqual([
      { text: "tempo", style: "header-struct" },
      { text: "112", style: "header-number" },
      { text: "# click", style: "comment" },
    ]);
  });

  it("highlights hairpin markers as distinct structural tokens", () => {
    expect(tokenizeLine("HH | d < d ! |")).toEqual(expect.arrayContaining([
      { text: "<", style: "hairpin-marker" },
      { text: "!", style: "hairpin-marker" },
    ]));
  });
});
