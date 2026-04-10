import type { PreprocessedLine } from "./types";

function splitComment(rawLine: string): { content: string; comment?: string } {
  const commentIndex = rawLine.indexOf("#");

  if (commentIndex === -1) {
    return { content: rawLine };
  }

  return {
    content: rawLine.slice(0, commentIndex),
    comment: rawLine.slice(commentIndex + 1),
  };
}

export function preprocessSource(source: string): PreprocessedLine[] {
  const normalized = source.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  let offset = 0;

  return rawLines.map((raw, index) => {
    const { content, comment } = splitComment(raw);
    const trimmed = content.trim();

    let kind: PreprocessedLine["kind"];

    if (trimmed.length === 0) {
      kind = raw.trimStart().startsWith("#") ? "comment" : "blank";
    } else {
      kind = "content";
    }

    const line: PreprocessedLine = {
      kind,
      lineNumber: index + 1,
      raw,
      content: content.trim(),
      startOffset: offset,
    };

    if (comment !== undefined) {
      line.comment = comment;
    }

    offset += raw.length + 1;

    return line;
  });
}
