import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react";
import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { TRACKS, type MeasureToken, type Modifier, type NormalizedScore, type ScoreMeasure, type ScoreTrackParagraph, type TrackName } from "./dsl";

const seedDsl = `tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|x3
SD |  - - d:cross - g - | D:rim - [2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [2: R L R] - - -     | R - L - R - L - |`;

type PreviewMode = "grid" | "staff" | "xml";

const trackLabel: Record<TrackName, string> = {
  HH: "HH",
  HF: "HF",
  SD: "SD",
  BD: "BD",
  T1: "T1",
  T2: "T2",
  T3: "T3",
  RC: "RC",
  C: "C",
  ST: "ST",
};

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function printStaffMarkup(markup: string) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    return false;
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>Drum Notation PDF Export</title>
    <style>
      body { margin: 24px; font-family: Georgia, serif; background: white; }
      .staff-score-metadata { margin-bottom: 18px; text-align: center; color: #151515; }
      .staff-score-title { margin: 0; font-size: 24px; font-weight: 700; }
      .staff-score-subtitle { margin: 4px 0 0; font-size: 15px; font-style: italic; }
      .staff-score-composer { margin: 8px 0 0; font-size: 13px; text-align: right; }
      svg { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${markup}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.requestAnimationFrame(() => {
    printWindow.focus();
    printWindow.print();
  });
  return true;
}

function parsePreviewMode(value: string | null): PreviewMode {
  return value === "staff" || value === "xml" ? value : "grid";
}

function beautifyXml(xml: string): string {
  const lines = xml
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let depth = 0;

  return lines.map((line) => {
    if (/^<\/.+>$/.test(line)) {
      depth = Math.max(depth - 1, 0);
    }

    const formatted = `${"  ".repeat(depth)}${line}`;

    if (
      /^<[^!?/][^>]*>$/.test(line) &&
      !/^<[^>]+\/>$/.test(line) &&
      !/^<[^>]+>.*<\/[^>]+>$/.test(line)
    ) {
      depth += 1;
    }

    return formatted;
  }).join("\n");
}

function highlightDsl(source: string): ReactNode[] {
  const pattern = /(#[^\n]*|\b(?:title|subtitle|composer|tempo|time|divisions|grouping)\b|\b(?:HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)\b|:\|x\d+|\|:|:\||[|[\]]|\b(?:open|close|choke|rim|cross|bell|flam)\b|[A-Za-z]\w*|\d+(?:\/\d+|\+\d+)*|-|:)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }

    const value = match[0];
    let className = "dsl-token";

    if (value.startsWith("#")) {
      className += " dsl-comment";
    } else if (/^(title|subtitle|composer|tempo|time|divisions|grouping)$/.test(value)) {
      className += " dsl-header";
    } else if (/^(HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)$/.test(value)) {
      className += " dsl-track";
    } else if (/^(:\|x\d+|\|:|:\||\|)$/.test(value)) {
      className += " dsl-barline";
    } else if (/^[[\]]$/.test(value)) {
      className += " dsl-group";
    } else if (/^(open|close|choke|rim|cross|bell|flam)$/.test(value)) {
      className += " dsl-modifier";
    } else if (/^\d/.test(value)) {
      className += " dsl-number";
    } else if (value === "-") {
      className += " dsl-rest";
    } else if (value === ":") {
      className += " dsl-punctuation";
    } else {
      className += " dsl-note";
    }

    nodes.push(
      <span className={className} key={`${match.index}-${value}`}>
        {value}
      </span>,
    );
    cursor = match.index + value.length;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}

function highlightXmlLine(line: string, lineIndex: number): ReactNode[] {
  const pattern = /(<\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?>)|(<\?[^>]*\?>|<![^>]*>)|([^<]+)/g;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match[5]) {
      nodes.push(
        <span className="xml-punctuation" key={`${lineIndex}-${match.index}-decl`}>
          {match[5]}
        </span>,
      );
      continue;
    }

    if (match[6]) {
      nodes.push(
        <span className="xml-text" key={`${lineIndex}-${match.index}-text`}>
          {match[6]}
        </span>,
      );
      continue;
    }

    const [, open, tagName, attrs, close] = match;
    nodes.push(
      <span className="xml-punctuation" key={`${lineIndex}-${match.index}-open`}>
        {open}
      </span>,
      <span className="xml-tag" key={`${lineIndex}-${match.index}-tag`}>
        {tagName}
      </span>,
    );

    const attrPattern = /(\s+)([A-Za-z_:][\w:.-]*)(=)("[^"]*")/g;
    let attrCursor = 0;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      if (attrMatch.index > attrCursor) {
        nodes.push(attrs.slice(attrCursor, attrMatch.index));
      }

      nodes.push(
        attrMatch[1],
        <span className="xml-attr" key={`${lineIndex}-${match.index}-${attrMatch.index}-attr`}>
          {attrMatch[2]}
        </span>,
        <span className="xml-punctuation" key={`${lineIndex}-${match.index}-${attrMatch.index}-eq`}>
          {attrMatch[3]}
        </span>,
        <span className="xml-string" key={`${lineIndex}-${match.index}-${attrMatch.index}-value`}>
          {attrMatch[4]}
        </span>,
      );
      attrCursor = attrMatch.index + attrMatch[0].length;
    }

    if (attrCursor < attrs.length) {
      nodes.push(attrs.slice(attrCursor));
    }

    nodes.push(
      <span className="xml-punctuation" key={`${lineIndex}-${match.index}-close`}>
        {close}
      </span>,
    );
  }

  return nodes;
}

function modifierLabel(modifier: Modifier): string {
  switch (modifier) {
    case "open":
      return "open";
    case "close":
      return "close";
    case "choke":
      return "choke";
    case "rim":
      return "rim";
    case "cross":
      return "cross";
    case "bell":
      return "bell";
    case "flam":
      return "flam";
  }
}

function tokenText(token: MeasureToken): string {
  switch (token.kind) {
    case "basic":
      return token.value;
    case "modified":
      return `${token.value}:${token.modifier}`;
    case "group":
      return `[${token.count}/${token.span}: ${token.items.map(tokenText).join(" ")}]`;
  }
}

function tokenClassName(token: MeasureToken): string {
  if (token.kind === "group") {
    return "grid-token group";
  }

  const base = ["grid-token"];

  if (token.value === "-") {
    base.push("rest");
  }

  if (token.kind === "modified") {
    base.push("modified");
  }

  if (token.value === "X" || token.value === "D") {
    base.push("accent");
  }

  if (token.value === "g") {
    base.push("ghost");
  }

  if (token.value === "R" || token.value === "L") {
    base.push("sticking");
  }

  return base.join(" ");
}

function renderToken(token: MeasureToken, key: string) {
  if (token.kind === "group") {
    return (
      <span className={tokenClassName(token)} key={key}>
        <span className="group-meta">
          {token.count}/{token.span}
        </span>
        <span className="group-items">
          {token.items.map((item, index) => (
            <span className={tokenClassName(item)} key={`${key}-${index}`}>
              {tokenText(item)}
            </span>
          ))}
        </span>
      </span>
    );
  }

  return (
    <span className={tokenClassName(token)} key={key} title={token.kind === "modified" ? modifierLabel(token.modifier) : undefined}>
      {tokenText(token)}
    </span>
  );
}

function DslEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const highlightedDsl = useMemo(() => highlightDsl(value), [value]);

  function syncHighlightScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  return (
    <div className="editor-shell">
      <pre className="editor-highlight" ref={highlightRef} aria-hidden="true">
        {highlightedDsl}
        {"\n"}
      </pre>
      <textarea
        className="editor-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncHighlightScroll}
        spellCheck={false}
      />
    </div>
  );
}

function Preview({ score }: { score: NormalizedScore }) {
  return (
    <div className="preview-content">
      <section className="score-summary" aria-label="Score summary">
        <span>{score.ast.headers.tempo.value} bpm</span>
        <span>
          {score.ast.headers.time.beats}/{score.ast.headers.time.beatUnit}
        </span>
        <span>{score.ast.headers.divisions.value} divisions</span>
        <span>{score.ast.repeatSpans.length} repeat span{score.ast.repeatSpans.length === 1 ? "" : "s"}</span>
      </section>
      {score.ast.paragraphs.map((paragraph, paragraphIndex) => {
        const tracks = TRACKS.filter((track) => paragraph.tracks.some((entry) => entry.track === track))
          .map((track) => paragraph.tracks.find((entry) => entry.track === track))
          .filter((entry): entry is ScoreTrackParagraph => entry !== undefined);

        return (
          <section className="grid-system" key={`paragraph-${paragraphIndex}`}>
            <header className="system-header">
              <span>Line {paragraphIndex + 1}</span>
              <span>{paragraph.measureCount} bar{paragraph.measureCount === 1 ? "" : "s"}</span>
            </header>
            <div className="system-body">
              {tracks.map((track) => {
                const groups: ScoreMeasure[][] = [];
                let currentGroup: ScoreMeasure[] = [];
                let lastLine: number | undefined;

                for (const measure of track.measures) {
                  if (lastLine !== undefined && measure.sourceLine !== lastLine) {
                    groups.push(currentGroup);
                    currentGroup = [];
                  }
                  currentGroup.push(measure);
                  lastLine = measure.sourceLine;
                }
                if (currentGroup.length > 0) {
                  groups.push(currentGroup);
                }

                return (
                  <div className="track-row" key={`${paragraphIndex}-${track.track}`}>
                    <div className="track-label">{trackLabel[track.track]}</div>
                    <div className="track-measures">
                      {groups.flatMap((group, gi) => {
                        const groupKey = `${track.track}-group-${gi}`;
                        return [
                          <div key={groupKey} className="measure-group">
                            {group.map((measure) => (
                              <div className={`measure-card${measure.generated ? " generated" : ""}`} key={`${track.track}-${measure.globalIndex}`}>
                                <div className="measure-boundary">
                                  {measure.repeatStart ? <span className="repeat-flag">|:</span> : <span className="repeat-flag subtle">|</span>}
                                  {measure.repeatEnd ? (
                                    <span className="repeat-flag">
                                      :|{measure.repeatTimes && measure.repeatTimes > 2 ? `x${measure.repeatTimes}` : ""}
                                    </span>
                                  ) : (
                                    <span className="repeat-flag subtle">|</span>
                                  )}
                                </div>
                                <div className="measure-tokens">
                                  {measure.tokens.map((token, index) => renderToken(token, `${track.track}-${measure.globalIndex}-${index}`))}
                                </div>
                              </div>
                            ))}
                          </div>,
                          gi < groups.length - 1 ? <div key={`${groupKey}-break`} className="line-break" /> : null,
                        ];
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StaffScoreMetadata({ score }: { score: NormalizedScore }) {
  const title = score.ast.headers.title?.value ?? "Drum Notation Preview";
  const subtitle = score.ast.headers.subtitle?.value;
  const composer = score.ast.headers.composer?.value;

  return (
    <header className="staff-score-metadata">
      <h2 className="staff-score-title">{title}</h2>
      {subtitle ? <p className="staff-score-subtitle">{subtitle}</p> : null}
      {composer ? <p className="staff-score-composer">{composer}</p> : null}
    </header>
  );
}

function StaffPreview({ score, xml, onRendered }: { score: NormalizedScore; xml: string; onRendered: (markup: string | null, error: string | null) => void }) {
  const printableRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) {
        return;
      }

      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");

        if (cancelled || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = "";

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,
          drawingParameters: "compacttight",
          newSystemFromXML: true,
        });

        await osmd.load(xml);
        osmd.render();
        setError(null);
        onRendered(printableRef.current?.innerHTML ?? containerRef.current.innerHTML, null);
      } catch (renderError) {
        if (!cancelled) {
          const message = renderError instanceof Error ? renderError.message : "Could not render staff preview.";
          setError(message);
          onRendered(null, message);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [onRendered, score, xml]);

  return (
    <div className="staff-preview-shell">
      {error ? <div className="staff-error">{error}</div> : null}
      <div className="staff-printable" ref={printableRef}>
        <StaffScoreMetadata score={score} />
        <div className="staff-preview" ref={containerRef} />
      </div>
    </div>
  );
}

function MusicXmlPreview({ xml }: { xml: string }) {
  const formattedXml = useMemo(() => beautifyXml(xml), [xml]);
  const highlightedXml = useMemo(
    () => formattedXml.split("\n").map((line, index) => (
      <span className="xml-line" key={`${index}-${line}`}>
        {highlightXmlLine(line, index)}
        {"\n"}
      </span>
    )),
    [formattedXml],
  );

  return (
    <div className="xml-preview" aria-label="MusicXML preview">
      <pre>{highlightedXml}</pre>
    </div>
  );
}

export function App() {
  const [dsl, setDsl] = useState(() => localStorage.getItem("drum-notation-dsl") ?? seedDsl);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(() => parsePreviewMode(localStorage.getItem("drum-notation-preview-mode")));
  const [staffMarkup, setStaffMarkup] = useState<string | null>(null);
  const [staffRenderError, setStaffRenderError] = useState<string | null>(null);
  const [pendingPdfExport, setPendingPdfExport] = useState(false);
  const [hideVoice2Rests, setHideVoice2Rests] = useState(() => localStorage.getItem("drum-notation-hide-voice2-rests") === "true");
  const score = useMemo(() => buildNormalizedScore(dsl), [dsl]);
  const staffXml = useMemo(() => buildMusicXml(score, hideVoice2Rests), [hideVoice2Rests, score]);
  const canExport = score.errors.length === 0;

  useEffect(() => {
    localStorage.setItem("drum-notation-dsl", dsl);
  }, [dsl]);

  useEffect(() => {
    localStorage.setItem("drum-notation-preview-mode", previewMode);
  }, [previewMode]);

  useEffect(() => {
    localStorage.setItem("drum-notation-hide-voice2-rests", String(hideVoice2Rests));
  }, [hideVoice2Rests]);

  useEffect(() => {
    if (pendingPdfExport && staffRenderError) {
      setPendingPdfExport(false);
      return;
    }

    if (!pendingPdfExport || !staffMarkup || staffRenderError) {
      return;
    }

    if (printStaffMarkup(staffMarkup)) {
      setPendingPdfExport(false);
    }
  }, [pendingPdfExport, staffMarkup, staffRenderError]);

  function handleMusicXmlExport() {
    downloadTextFile("drum-notation.musicxml", staffXml, "application/vnd.recordare.musicxml+xml");
  }

  function handlePdfExport() {
    if (!canExport) {
      return;
    }

    setPendingPdfExport(true);
    setPreviewMode("staff");
  }

  const handleStaffRendered = useCallback((markup: string | null, error: string | null) => {
    setStaffMarkup(markup);
    setStaffRenderError(error);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Drum Notation</h1>
        <p>Text-first drum notation editor</p>
      </header>
      <section className="workspace">
        <label className="pane">
          <span className="pane-title">DSL</span>
          <DslEditor value={dsl} onChange={setDsl} />
        </label>
        <section className="pane preview-pane" aria-label="Preview">
          <div className="preview-header">
            <span className="pane-title">Preview</span>
            <div className="preview-actions">
              <div className="preview-tabs" role="tablist" aria-label="Preview mode">
                <button
                  className={`preview-tab${previewMode === "grid" ? " active" : ""}`}
                  onClick={() => setPreviewMode("grid")}
                  type="button"
                >
                  Grid
                </button>
                <button
                  className={`preview-tab${previewMode === "staff" ? " active" : ""}`}
                  onClick={() => setPreviewMode("staff")}
                  type="button"
                >
                  Staff
                </button>
                <button
                  className={`preview-tab${previewMode === "xml" ? " active" : ""}`}
                  onClick={() => setPreviewMode("xml")}
                  type="button"
                >
                  MusicXML
                </button>
              </div>
              <label className="preview-setting">
                <input
                  type="checkbox"
                  checked={hideVoice2Rests}
                  onChange={(e) => setHideVoice2Rests(e.target.checked)}
                />
                Hide voice 2 rests
              </label>
              <div className="export-actions">
                <button className="export-button" disabled={!canExport} onClick={handleMusicXmlExport} type="button">
                  Export MusicXML
                </button>
                <button className="export-button" disabled={!canExport} onClick={handlePdfExport} type="button">
                  Export PDF
                </button>
              </div>
            </div>
          </div>
          {previewMode === "grid" ? (
            <Preview score={score} />
          ) : previewMode === "staff" ? (
            <StaffPreview
              score={score}
              xml={staffXml}
              onRendered={handleStaffRendered}
            />
          ) : (
            <MusicXmlPreview xml={staffXml} />
          )}
        </section>
      </section>
      <section className="error-panel" aria-label="Errors">
        <div className="error-panel-inner">
          <h2>Diagnostics</h2>
          {score.errors.length === 0 ? (
            <p className="error-empty">No parser or validation errors.</p>
          ) : (
            <ul className="error-list">
              {score.errors.map((error, index) => (
                <li key={`${error.line}-${error.column}-${index}`}>
                  <span className="error-location">
                    Line {error.line}, Col {error.column}
                  </span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
