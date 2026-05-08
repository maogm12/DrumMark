import { describe, expect, it } from "vitest";
import { parseDocumentSkeleton } from "./parser";
import { parseDocumentSkeletonFromLezer } from "./lezer_skeleton";

function normalizeSkeletonForCompare(
  skeleton: ReturnType<typeof parseDocumentSkeleton>,
) {
  return JSON.parse(
    JSON.stringify(skeleton, (key, value) => {
      if (
        key === "line" ||
        key === "lineNumber" ||
        key === "startLine" ||
        key === "source" ||
        key === "raw" ||
        key === "startOffset"
      ) {
        return undefined;
      }
      return value;
    }),
  );
}

describe("lezer parser drift fixtures", () => {
  it("keeps duration suffix handling aligned for uncapped stars", () => {
    const source = `time 4/4
note 1/16
grouping 4

HH | x**** |`;

    const manual = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(manual.errors).toEqual([]);
    expect(lezer.errors).toEqual([]);
    expect(lezer.paragraphs[0]?.lines[0]?.measures[0]?.tokens).toEqual(
      manual.paragraphs[0]?.lines[0]?.measures[0]?.tokens,
    );
  });

  it("keeps inline repeat suffix expansion aligned", () => {
    const source = `time 4/4
divisions 4

| d - - - *1 | d - - - *3 |`;

    const manual = normalizeSkeletonForCompare(parseDocumentSkeleton(source));
    const lezer = normalizeSkeletonForCompare(parseDocumentSkeletonFromLezer(source));

    expect(lezer).toEqual(manual);
  });

  it("keeps navigation diagnostic columns aligned", () => {
    const cases = [
      {
        source: `title "Multi Start Nav"
time 4/4
note 1/16

HH | @segno @coda x x |`,
        message: "Measure contains multiple start-side navigation markers",
        column: 13,
      },
      {
        source: `title "ToCoda at Start"
time 4/4
note 1/16

HH | @to-coda x x x |`,
        message: "`@to-coda` may not appear at the beginning of a measure",
        column: 6,
      },
      {
        source: `title "Segno at End"
time 4/4
note 1/16

HH | x x x @segno |`,
        message: "`@segno` may not appear at the end of a measure",
        column: 12,
      },
      {
        source: `title "Spaced ToCoda"
time 4/4
divisions 4

HH |   @to-coda %% |`,
        message: "`@to-coda` may not appear at the beginning of a measure",
        column: 8,
      },
    ];

    for (const testCase of cases) {
      const manual = parseDocumentSkeleton(testCase.source);
      const lezer = parseDocumentSkeletonFromLezer(testCase.source);

      expect(manual.errors).toContainEqual({
        line: 5,
        column: testCase.column,
        message: testCase.message,
      });
      expect(lezer.errors).toContainEqual({
        line: 5,
        column: testCase.column,
        message: testCase.message,
      });
    }
  });

  it("keeps shorthand fallback aligned for long navigation jump names", () => {
    const source = `time 4/4
divisions 4

HH | %% @dc-al-coda |`;

    const manual = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(manual.errors).toEqual([]);
    expect(lezer.errors).toEqual([]);
    expect(lezer.paragraphs[0]?.lines[0]?.measures[0]).toMatchObject({
      endNav: { kind: "dc-al-coda", anchor: "right-edge" },
      measureRepeatSlashes: 2,
    });
    expect(lezer.paragraphs[0]?.lines[0]?.measures[0]).toEqual(
      manual.paragraphs[0]?.lines[0]?.measures[0],
    );
  });

  it("keeps first-paragraph note overrides aligned after a blank line", () => {
    const source = `time 4/4
note 1/8
tempo 120

note 1/16
HH | d d d d d d d d d d d d d d d d |

note 1/8
SD | d d d d d d d d |`;

    const manual = parseDocumentSkeleton(source);
    const lezer = parseDocumentSkeletonFromLezer(source);

    expect(manual.errors).toEqual([]);
    expect(lezer.errors).toEqual([]);
    expect(lezer.headers.note?.value).toBe(manual.headers.note?.value);
    expect(lezer.paragraphs.map((paragraph) => paragraph.noteValue)).toEqual(
      manual.paragraphs.map((paragraph) => paragraph.noteValue),
    );
  });
});
