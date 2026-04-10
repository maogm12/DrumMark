import { useEffect, useMemo, useRef, useState } from "react";
import { buildMusicXml, buildNormalizedScore } from "./dsl";
import { TRACKS, type MeasureToken, type Modifier, type NormalizedScore, type ScoreMeasure, type ScoreTrackParagraph, type TrackName } from "./dsl";

const seedDsl = `tempo 96
time 4/4
divisions 16

HH |: x - x - o - x - | x - x:close - X - x - :|x3
SD |  - - d:cross - g - | D:rim - [3/2: d d:flam d] - - -  |
BD |  p - - - p - - - | p - p - - - p -                     |
HF |  - - - - p - - - | - - - - p:close - -                |

RC |  - - x:bell - - - - - | - - - - x - - - |
ST |  [3/2: R L R] - - -     | R - L - R - L - |`;

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

function StaffPreview({ xml }: { xml: string }) {
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

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,
          drawingParameters: "compacttight",
        });

        await osmd.load(xml);
        osmd.render();
        setError(null);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Could not render staff preview.");
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [xml]);

  return (
    <div className="staff-preview-shell">
      {error ? <div className="staff-error">{error}</div> : null}
      <div className="staff-preview" ref={containerRef} />
    </div>
  );
}

export function App() {
  const [dsl, setDsl] = useState(seedDsl);
  const [previewMode, setPreviewMode] = useState<"grid" | "staff">("grid");
  const score = useMemo(() => buildNormalizedScore(dsl), [dsl]);
  const staffXml = useMemo(() => buildMusicXml(score), [score]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Drum Notation</h1>
        <p>Text-first drum notation editor</p>
      </header>
      <section className="workspace">
        <label className="pane">
          <span className="pane-title">DSL</span>
          <textarea className="editor" value={dsl} onChange={(event) => setDsl(event.target.value)} spellCheck={false} />
        </label>
        <section className="pane preview-pane" aria-label="Preview">
          <div className="preview-header">
            <span className="pane-title">Preview</span>
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
            </div>
          </div>
          {previewMode === "grid" ? <Preview score={score} /> : <StaffPreview xml={staffXml} />}
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
