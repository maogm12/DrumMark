import type { ParseError } from "./dsl";

type EditorDocLine = {
  from: number;
  to: number;
};

type EditorDocLike = {
  lines: number;
  line(lineNumber: number): EditorDocLine;
};

export function diagnosticRange(doc: EditorDocLike, err: ParseError) {
  const lineNum = Math.min(Math.max(1, err.line), doc.lines);
  const line = doc.line(lineNum);
  const pos = Math.min(line.from + Math.max(0, err.column - 1), line.to);
  if (pos < line.to) {
    return { from: pos, to: pos + 1 };
  }
  return { from: Math.max(line.from, pos - 1), to: pos };
}
