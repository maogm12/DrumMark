import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";
import { preprocessSource } from "./preprocess";

describe("spec C18: comments, whitespace, and paragraphs", () => {
  it("strips full-line and trailing # comments during preprocessing", () => {
    const lines = preprocessSource(`# title note
tempo 96 # bpm
  # indented note
HH | x - x - | # groove`);

    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({
      kind: "comment",
      lineNumber: 1,
      content: "",
      comment: " title note",
    });
    expect(lines[1]).toMatchObject({
      kind: "content",
      lineNumber: 2,
      content: "tempo 96",
      comment: " bpm",
    });
    expect(lines[2]).toMatchObject({
      kind: "comment",
      lineNumber: 3,
      content: "",
      comment: " indented note",
    });
    expect(lines[3]).toMatchObject({
      kind: "content",
      lineNumber: 4,
      content: "HH | x - x - |",
      comment: " groove",
    });
  });

  it("ignores comment-only lines while parsing headers and body", () => {
    const doc = parseDocumentSkeleton(`# score heading
tempo 96
# meter note
time 4/4
divisions 4

# groove note
HH | x - x - | # hats
# snare note
SD | - d - d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.headers.tempo.value).toBe(96);
    expect(doc.headers.time).toMatchObject({ beats: 4, beatUnit: 4 });
    expect(doc.headers.divisions.value).toBe(4);
    expect(doc.paragraphs).toHaveLength(1);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
  });

  it("treats tabs and extra spaces as whitespace-equivalent token separators", () => {
    const compact = parseDocumentSkeleton(`time 4/4
divisions 4

HH|x-d-x-|`);
    const aligned = parseDocumentSkeleton(`time 4/4
divisions 4

HH\t|\tx\t-\td\t-\tx\t-\t|`);

    expect(compact.errors).toEqual([]);
    expect(aligned.errors).toEqual([]);
    expect(aligned.paragraphs[0].lines[0].measures[0].tokens).toEqual(
      compact.paragraphs[0].lines[0].measures[0].tokens,
    );
  });

  it("allows freely aligned whitespace around track prefixes and measure bars", () => {
    const compact = parseDocumentSkeleton(`time 4/4
divisions 4

SD|d---|`);
    const aligned = parseDocumentSkeleton(`time 4/4
divisions 4

SD   |   d   -   -   -   |`);

    expect(compact.errors).toEqual([]);
    expect(aligned.errors).toEqual([]);
    expect(aligned.paragraphs[0].lines[0].measures[0].tokens).toEqual(
      compact.paragraphs[0].lines[0].measures[0].tokens,
    );
    expect(aligned.paragraphs[0].lines[0].measures[0].repeatStart).toBe(
      compact.paragraphs[0].lines[0].measures[0].repeatStart,
    );
    expect(aligned.paragraphs[0].lines[0].measures[0].repeatEnd).toBe(
      compact.paragraphs[0].lines[0].measures[0].repeatEnd,
    );
    expect(aligned.paragraphs[0].lines[0].measures[0].barline).toBe(
      compact.paragraphs[0].lines[0].measures[0].barline,
    );
    expect(aligned.paragraphs[0].lines[0].measures[0].startNav).toEqual(
      compact.paragraphs[0].lines[0].measures[0].startNav,
    );
    expect(aligned.paragraphs[0].lines[0].measures[0].endNav).toEqual(
      compact.paragraphs[0].lines[0].measures[0].endNav,
    );
  });

  it("splits paragraphs on blank lines", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x - x - |
SD | - d - d |

HH | x x x x |
SD | d - d - |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0].startLine).toBe(4);
    expect(doc.paragraphs[1].startLine).toBe(7);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
    expect(doc.paragraphs[1].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
  });

  it("treats multiple blank lines as a single paragraph boundary", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x - x - |


SD | - d - d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0].startLine).toBe(4);
    expect(doc.paragraphs[1].startLine).toBe(7);
  });

  it("does not create paragraph breaks for comment-only lines", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x - x - |
# same paragraph note
SD | - d - d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(1);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH", "SD"]);
  });

  it("preserves paragraph breaks when comments surround a blank separator", () => {
    const doc = parseDocumentSkeleton(`time 4/4
divisions 4

HH | x - x - |
# end of first system

# start of second system
SD | - d - d |`);

    expect(doc.errors).toEqual([]);
    expect(doc.paragraphs).toHaveLength(2);
    expect(doc.paragraphs[0].lines.map((line) => line.track)).toEqual(["HH"]);
    expect(doc.paragraphs[1].lines.map((line) => line.track)).toEqual(["SD"]);
  });
});
