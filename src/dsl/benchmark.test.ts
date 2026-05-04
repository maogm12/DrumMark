import { describe, it, expect } from "vitest";
import { parseDocumentSkeleton } from "./parser";
import { parser as DrumMarkParser } from "./drum_mark.parser";

const SAMPLE_DOCS = [
  // Simple
  `title Test Song
time 4/4
note 1/16

HH | x - x - |
SD | d - d - |`,

  // Medium with modifiers
  `title Test Song
tempo 120
time 4/4
note 1/16

HH | x:x - s:s - x x |
SD | d:d - d:d - d d |
BD | b - b - b b |`,

  // Complex with groups and combined hits
  `title Complex Study
tempo 96
time 4/4
note 1/16
grouping 2+2

HH | x - x - | x - x - |
SD | [d d] - d - | d - [d d] - |
BD | b - b - [b b] - |`,

  // Full featured
  `title Full Score
subtitle A Drum Notation Test
composer Test Author
tempo 120
time 4/4
note 1/16
grouping 2+2+3

HH | x:x - s:s - x x |
HF | X - X - X X |
SD | d:d - d:d - d d |
BD | b - b - b b |
T1 | t1 - t2 - t3 t4 |
RC | r - r - r r |

HH | x - x - | x - x - |
SD | d - d - | d - d - |
BD | b - b - | b - b - |`,

  // Long measure (100 measures)
  `time 4/4
note 1/16

HH | ${"x - x - x - x - ".repeat(25)}|
SD | ${"d - d - d - d - ".repeat(25)}|
BD | ${"b - b - b - b - ".repeat(25)}|`,
];

const ITERATIONS = 1000;

function runBenchmark(name: string, fn: () => void): number {
  // Warmup
  for (let i = 0; i < 10; i++) fn();

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    fn();
  }
  const end = performance.now();
  return end - start;
}

describe("benchmark: parseDocumentSkeleton (regex parser)", () => {
  it("simple document", () => {
    const elapsed = runBenchmark("simple", () => parseDocumentSkeleton(SAMPLE_DOCS[0]));
    console.log(`  ${ITERATIONS}x simple: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("medium document with modifiers", () => {
    const elapsed = runBenchmark("medium", () => parseDocumentSkeleton(SAMPLE_DOCS[1]));
    console.log(`  ${ITERATIONS}x medium: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("complex document with groups", () => {
    const elapsed = runBenchmark("complex", () => parseDocumentSkeleton(SAMPLE_DOCS[2]));
    console.log(`  ${ITERATIONS}x complex: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("full featured document", () => {
    const elapsed = runBenchmark("full", () => parseDocumentSkeleton(SAMPLE_DOCS[3]));
    console.log(`  ${ITERATIONS}x full: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("long measure (100 measures)", () => {
    const elapsed = runBenchmark("long", () => parseDocumentSkeleton(SAMPLE_DOCS[4]));
    console.log(`  ${ITERATIONS}x long: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });
});

describe("benchmark: lezer parser", () => {
  const parsers = SAMPLE_DOCS.map((source) => ({
    source,
    parser: DrumMarkParser.configure({ strict: false }),
  }));

  it("simple document", () => {
    const { source, parser } = parsers[0];
    const elapsed = runBenchmark("simple", () => parser.parse(source));
    console.log(`  ${ITERATIONS}x simple: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("medium document with modifiers", () => {
    const { source, parser } = parsers[1];
    const elapsed = runBenchmark("medium", () => parser.parse(source));
    console.log(`  ${ITERATIONS}x medium: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("complex document with groups", () => {
    const { source, parser } = parsers[2];
    const elapsed = runBenchmark("complex", () => parser.parse(source));
    console.log(`  ${ITERATIONS}x complex: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("full featured document", () => {
    const { source, parser } = parsers[3];
    const elapsed = runBenchmark("full", () => parser.parse(source));
    console.log(`  ${ITERATIONS}x full: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });

  it("long measure (100 measures)", () => {
    const { source, parser } = parsers[4];
    const elapsed = runBenchmark("long", () => parser.parse(source));
    console.log(`  ${ITERATIONS}x long: ${elapsed.toFixed(2)}ms (${(elapsed / ITERATIONS).toFixed(4)}ms/op)`);
  });
});
