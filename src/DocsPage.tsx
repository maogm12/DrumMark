import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildMusicXml, buildNormalizedScore } from "./dsl";

type OpenSheetMusicDisplayType = import("opensheetmusicdisplay").OpenSheetMusicDisplay;

interface DocsSection {
  id: string;
  title: string;
  summary: string;
  content: ReactNode;
  example: string;
}

const osmdDefaultFontFamily = "Charter, \"Bitstream Charter\", \"Sitka Text\", Cambria, Georgia, \"Times New Roman\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans SC\", sans-serif";

const docsSections: DocsSection[] = [
  {
    id: "metadata",
    title: "Document Metadata",
    summary: "Set up your score's global information and timing.",
    content: (
      <div className="docs-description">
        <p>Every score begins with a header section. These fields define the technical foundation and metadata of your music:</p>
        <ul>
          <li><code>title</code>, <code>subtitle</code>, <code>composer</code>: Essential credits that appear at the top of the exported PDF and score.</li>
          <li><code>tempo</code>: Sets the BPM (Quarter note). If omitted, it defaults to <strong>120</strong>.</li>
          <li><code>time</code>: Defines the meter (e.g., <code>4/4</code>, <code>6/8</code>, <code>7/8</code>). This is required for rhythmic validation.</li>
          <li><code>divisions</code>: Defines the grid resolution for one measure. For example, setting it to 16 allows you to write 16th-note patterns using a 16-slot grid.</li>
        </ul>
      </div>
    ),
    example: `title Funk Study\nsubtitle Groove A\ncomposer G. Mao\ntempo 100\ntime 4/4\ndivisions 8\n\nHH | x - x x x x x - |`,
  },
  {
    id: "grouping",
    title: "Musical Grouping",
    summary: "Control beat structures and visual beaming.",
    content: (
      <div className="docs-description">
        <p>The <code>grouping</code> field tells the system how to beam notes and where the internal accents fall. <strong>Common meters have smart defaults:</strong></p>
        <ul>
          <li><code>4/4</code> &rarr; <code>2+2</code> (two half-note beats)</li>
          <li><code>6/8</code> &rarr; <code>3+3</code> (two dotted-quarter beats)</li>
          <li><code>2/4</code> &rarr; <code>1+1</code>, <code>3/4</code> &rarr; <code>1+1+1</code></li>
          <li><strong>Irregular meters:</strong> For <code>5/8</code>, <code>7/8</code>, etc., you must specify the grouping (e.g., <code>2+2+3</code>).</li>
        </ul>
      </div>
    ),
    example: `time 7/8\ndivisions 7\ngrouping 2+2+3\n\nHH | x x x x x x x |`,
  },
  {
    id: "instruments",
    title: "Instruments & Tracks",
    summary: "Map your ideas to specific percussion parts using a wide range of supported tracks.",
    content: (
      <div className="docs-description">
        <p>Each instrument is represented by a <strong>track</strong>. Once a track is declared in any paragraph, it remains active throughout the score. If omitted in later sections, it is auto-filled with rests.</p>
        <ul>
          <li><strong>Cymbals:</strong> <code>HH</code> (Hi-Hat), <code>RC</code> (Ride), <code>C</code> (Crash). Use <code>x</code>/<code>X</code>.</li>
          <li><strong>Drums:</strong> <code>SD</code> (Snare), <code>BD</code> (Bass), <code>T1/T2/T3</code> (Toms). Use <code>d</code>/<code>D</code>.</li>
          <li><strong>Foot & Utility:</strong> <code>HF</code> (Hi-Hat Foot) uses <code>p</code>/<code>P</code> for pedal hits. <code>ST</code> is for sticking (<code>R</code>/<code>L</code>).</li>
          <li><strong>Sugar Tracks:</strong> <code>DR</code> expands into <code>SD</code> and <code>T1-T3</code>. It supports accents (<code>S</code>, <code>T1-T3</code>).</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\n\nC  | x - - - - - - - |                 | x - - - - - - - | |\nHH | - x x x x x x x | x x x x x x x x |                 | |\nRC |                 |                 | - x x x x x x x | |\nT1 |                 |                 |                 | - - d d - - - - |\nT2 |                 |                 |                 | - - - - d d - - |\nSD | - - d - - - d - | - - d - - - d - | - - d - - - d - | d d - - - - - - |\nT3 |                 |                 |                 | - - - - - - d d |\nBD | p - p - p - - - | p - - p - p - - |                 | |\nHF |                 |                 | p - - p - p - - | |\n\n# Sugar syntax and Sticking\nHH | c x x x x x x x | |\nDR |                 | s s t1 t1 t2 t2 t3 t3 |\n\nSD | d d d d d d d d |\nST | R L R L R L R L |`,
  },
  {
    id: "techniques",
    title: "Playing Techniques",
    summary: "Add detail to your hits with modifiers.",
    content: (
      <div className="docs-description">
        <p>Refine notes with <code>:modifier</code>. <strong>Strict compatibility rules apply:</strong></p>
        <ul>
          <li><strong>Snare (SD) & Toms (T1-T3):</strong> <code>:rim</code>, <code>:cross</code>, <code>:flam</code>.</li>
          <li><strong>Hi-Hat (HH):</strong> <code>:open</code> (shorthand <code>o</code>/<code>O</code>), <code>:close</code>.</li>
          <li><strong>Cymbals (C, RC):</strong> <code>:choke</code>, <code>:bell</code> (Ride only).</li>
          <li><strong>Foot (HF) & Bass (BD):</strong> <code>:close</code> (HF only).</li>
          <li><strong>Ghost Notes:</strong> Deferred for now because OSMD does not support notehead parentheses reliably yet.</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\ngrouping 1+1+1+1\n\nSD | d:cross - d:rim - d:flam - d - |\nRC | x:bell - x:choke - x:bell - x:choke - |`,
  },
  {
    id: "syntax-details",
    title: "Syntax & Formatting",
    summary: "Writing clean, maintainable notation code.",
    content: (
      <div className="docs-description">
        <p>The notation language is designed to be human-readable and flexible:</p>
        <ul>
          <li><strong>Comments:</strong> Use <code>#</code> to add notes for yourself. Everything after <code>#</code> on a line is ignored.</li>
          <li><strong>Whitespace:</strong> Spaces and tabs are ignored inside measures. Use them freely to align your tracks for better readability.</li>
          <li><strong>Barlines:</strong> You can place multiple measures on one line, or even an empty measure <code>| |</code> which defaults to a full-measure rest.</li>
        </ul>
      </div>
    ),
    example: `# Cleanly aligned code\n# with comments\ntime 4/4\ndivisions 8\n\nHH | x x x x  x x x x | # Verse\nSD | - - d -  - - d - | # Groove\nBD | p - - -  p - - - |`,
  },
  {
    id: "tuplets",
    title: "Rhythmic Groups",
    summary: "Adjust durations and create complex subdivisions using brackets.",
    content: (
      <div className="docs-description">
        <p>Groups allow you to deviate from the base grid defined by <code>divisions</code> in two ways:</p>
        <ul>
          <li><strong>Compression (Subdivisions & Tuplets):</strong> Fit more notes into a span. 
            <ul>
              <li><code>[x x]</code>: Fits two 16th notes into a single 8th-note slot (assuming <code>divisions 8</code>).</li>
              <li><code>[2: d d d]</code>: Fits three notes into the space of two slots, creating a <strong>triplet</strong>.</li>
              <li><code>[4: x x x x x]</code>: A quintuplet (5 notes in 4 slots).</li>
            </ul>
          </li>
          <li><strong>Expansion (Longer Notes):</strong> Stretch a note to occupy multiple slots.
            <ul>
              <li><code>[2: p]</code>: Makes the note last for 2 slots (e.g., a quarter note in an 8th-note grid).</li>
            </ul>
          </li>
          <li><strong>Shorthand:</strong> The syntax is <code>[span: item1 item2 ...]</code>. If the span is exactly 1 slot, you can omit the <code>1:</code> prefix (e.g., <code>[d d d]</code> is the same as <code>[1: d d d]</code>).</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\ngrouping 1+1+1+1\n\n# Compression\nSD | [d d] d [2:d d d d] [2: d d d] [2: d d d d d] |\n\n# Expansion\nSD | [2: d] d d [4: d] | [8: d] |`,
  },
  {
    id: "repeats",
    title: "Structure & Flow",
    summary: "Manage bars, repeats, and sections.",
    content: (
      <div className="docs-description">
        <p>Finalize your score's structure with professional navigation markers:</p>
        <ul>
          <li><strong>Barlines:</strong> Standard <code>|</code>, repeat start <code>|:</code>, and repeat end <code>:|</code>.</li>
          <li><strong>Repeat Counts:</strong> Use <code>:|x3</code> or <code>:|x4</code> to specify the total number of times a section should be played. <strong>Note:</strong> When <code>N &gt; 2</code>, the section is automatically expanded in the generated score for better readability.</li>
          <li><strong>Sections:</strong> Leave a blank line between blocks of text to create paragraphs. This helps organize song parts like Verse or Chorus.</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\n\n# Manual expansion vs. Automatic expansion (x4)\nHH |: x x x x x x x x | x x x x x x x x | x x x x x x x x | x x x x x x x x :|\nSD |  - - d - - - d - | - - d - - - d - | - - d - - - d - | - - d - - - d -  |\nBD |  p - - - p - - - | p - - - p - - - | p - - - p - - - | p - - - p - - -  |\n\nHH |: x x x x x x x x :|x4\nSD |  - - d - - - d -  |\nBD |  p - - - p - - -  |`,
  },
  {
    id: "full-example",
    title: "The Master Class",
    summary: "A complete demonstration using all available features.",
    content: (
      <div className="docs-description">
        <p>This final example showcases the synergy of headers, complex groupings, shortcuts, and multiple paragraphs to create a professional drum sheet. It includes advanced techniques like flams, bell hits, and sticking patterns.</p>
      </div>
    ),
    example: `title Fusion Grooves\nsubtitle Advanced Study\ncomposer G. Mao\ntempo 128\ntime 4/4\ndivisions 16\ngrouping 2+2\n\n# Section A: Main Groove\nHH |: x - x - o - x - | x:close - X - x - c - :|x2\nSD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |\nBD |  p - - - p - - - | p - p - - - p -        |\nHF |  - - - - p - - - | - - - - p:close - -    |\n\n# Section B: Bridge with Subdivisions\nRC |  x:bell - x:bell - x:bell - x:bell - | [4: x:choke] |\nDR |  s - - - [3: s s s] - - - | S - t1 t2 t3 - - -   |\nBD |  p - - - p - - -     | p - - - p - - -      |\nST |  R - - - R L R - - - | R - R L R - - -      |\n\n# Outro: Finale\nC  |  X:choke - - - - - - - | - - - - X - - - |\nBD |  [16: p] |`,
  },
];

let osmdModulePromise: Promise<typeof import("opensheetmusicdisplay")> | null = null;
let staticPreviewRenderChain = Promise.resolve();
let staticPreviewBuffer: HTMLDivElement | null = null;
let staticPreviewOsmd: OpenSheetMusicDisplayType | null = null;

async function loadOsmdModule() {
  osmdModulePromise ??= import("opensheetmusicdisplay");
  return osmdModulePromise;
}

function configureOsmdRules(osmd: OpenSheetMusicDisplayType) {
  const rules = osmd.EngravingRules as OpenSheetMusicDisplayType["EngravingRules"] & {
    RenderTitle?: boolean;
    RenderSubtitle?: boolean;
    RenderComposer?: boolean;
    SheetTitleHeight?: number;
    SheetSubtitleHeight?: number;
    SheetComposerHeight?: number;
    SheetMinimumDistanceBetweenTitleAndSubtitle?: number;
    TitleTopDistance?: number;
    TitleBottomDistance?: number;
  };

  rules.PageTopMargin = 0;
  rules.PageBottomMargin = 0;
  rules.PageLeftMargin = 2;
  rules.PageRightMargin = 2;
  rules.SystemLeftMargin = 0;
  rules.SystemRightMargin = 0;
  rules.RenderTitle = true;
  rules.RenderSubtitle = true;
  rules.RenderComposer = true;
  rules.SheetTitleHeight = 3.2;
  rules.SheetSubtitleHeight = 2.0;
  rules.SheetComposerHeight = 1.6;
  rules.SheetMinimumDistanceBetweenTitleAndSubtitle = 1.0;
  rules.TitleTopDistance = 2.0;
  rules.TitleBottomDistance = 1.8;
  rules.MinimumDistanceBetweenSystems = 1.0;
  rules.MinSkyBottomDistBetweenSystems = 1.0;
  // Use a very large sheet maximum width and let CSS handle scaling
  rules.SheetMaximumWidth = 32767;
}

function getStaffSvgMarkup(markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  const serializer = new XMLSerializer();
  return Array.from(host.querySelectorAll("svg"))
    .filter((svg) => !svg.parentElement?.closest("svg"))
    .map((svg) => {
      // Remove fixed dimensions so it shrinks to content height
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      return serializer.serializeToString(svg);
    });
}

function readMusicXmlCredit(xml: string, type: "title" | "subtitle" | "composer") {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return "";

  const credits = Array.from(document.querySelectorAll("credit"));
  for (const credit of credits) {
    const page = credit.getAttribute("page");
    if (page !== null && page !== "1") continue;

    const creditType = credit.querySelector("credit-type")?.textContent?.trim().toLowerCase();
    if (creditType !== type) continue;

    const words = Array.from(credit.querySelectorAll("credit-words"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
    if (words) return words;
  }

  if (type === "title") return document.querySelector("work > work-title")?.textContent?.trim() ?? "";
  if (type === "composer") return document.querySelector('identification > creator[type="composer"]')?.textContent?.trim() ?? "";
  return "";
}

function applyOsmdHeaderMetadata(osmd: OpenSheetMusicDisplayType, xml: string) {
  const sheet = osmd.Sheet as OpenSheetMusicDisplayType["Sheet"] & {
    TitleString?: string;
    SubtitleString?: string;
    ComposerString?: string;
  };

  const title = readMusicXmlCredit(xml, "title");
  const subtitle = readMusicXmlCredit(xml, "subtitle");
  const composer = readMusicXmlCredit(xml, "composer");
  if (title) sheet.TitleString = title;
  if (subtitle) sheet.SubtitleString = subtitle;
  if (composer) sheet.ComposerString = composer;
}

async function getStaticPreviewRenderer() {
  const { OpenSheetMusicDisplay } = await loadOsmdModule();

  if (!staticPreviewBuffer) {
    staticPreviewBuffer = document.createElement("div");
    staticPreviewBuffer.style.width = "900px";
    staticPreviewBuffer.style.position = "fixed";
    staticPreviewBuffer.style.left = "-9999px";
    staticPreviewBuffer.style.top = "0";
    staticPreviewBuffer.style.visibility = "hidden";
    staticPreviewBuffer.style.pointerEvents = "none";
    document.body.appendChild(staticPreviewBuffer);
  }

  if (!staticPreviewOsmd) {
    staticPreviewOsmd = new OpenSheetMusicDisplay(staticPreviewBuffer, {
      autoResize: false,
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      defaultFontFamily: osmdDefaultFontFamily,
      drawingParameters: "compacttight",
      newSystemFromXML: true,
      pageFormat: "Endless",
      drawTimeSignatures: true,
      drawMeasureNumbers: true,
      percussionOneLineCutoff: 0,
    });
    staticPreviewOsmd.setOptions({ defaultColorTitle: "#111111" });
  }

  return { buffer: staticPreviewBuffer, osmd: staticPreviewOsmd };
}

function highlightDslSnippet(source: string): ReactNode[] {
  const pattern = /(#[^\n]*|\b(?:title|subtitle|composer|tempo|time|divisions|grouping)\b|\b(?:HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)\b|:\|x\d+|\|:|:\||[|[\]]|\b(?:open|close|choke|rim|cross|bell|flam)\b|(?:t1|t2|t3)\b|\d+(?:\/\d+|\+\d+)*|-|:|[RLSXDxopcdbp]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const value = match[0];
    let className = "docs-token";
    if (value.startsWith("#")) className += " dsl-comment";
    else if (/^(title|subtitle|composer|tempo|time|divisions|grouping)$/.test(value)) className += " dsl-header";
    else if (/^(HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)$/.test(value)) className += " dsl-track";
    else if (/^(:\|x\d+|\|:|:\||\|)$/.test(value)) className += " dsl-barline";
    else if (/^[[\]]$/.test(value)) className += " dsl-group";
    else if (/^(open|close|choke|rim|cross|bell|flam)$/.test(value)) className += " dsl-modifier";
    else if (/^\d/.test(value)) className += " dsl-number";
    else if (value === "-") className += " dsl-rest";
    else if (value === ":") className += " dsl-punctuation";
    else className += " dsl-note";
    nodes.push(<span className={className} key={`${match.index}-${value}`}>{value}</span>);
    cursor = match.index + value.length;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function DslDocsSnippet({ source }: { source: string }) {
  const highlighted = useMemo(
    () => source.split("\n").map((line, index) => (
      <span className="docs-code-line" key={`${index}-${line}`}>
        {highlightDslSnippet(line)}
        {"\n"}
      </span>
    )),
    [source],
  );

  return <div className="docs-code-block"><pre>{highlighted}</pre></div>;
}

function StaticScorePreview({ xml }: { xml: string }) {
  const [markup, setMarkup] = useState("");

  useEffect(() => {
    let cancelled = false;

    staticPreviewRenderChain = staticPreviewRenderChain.then(async () => {
      try {
        const { buffer, osmd } = await getStaticPreviewRenderer();
        configureOsmdRules(osmd);

        await osmd.load(xml);
        applyOsmdHeaderMetadata(osmd, xml);
        osmd.render();
        if (cancelled) return;

        const rendered = getStaffSvgMarkup(buffer.innerHTML)
          .map((svg, pageIndex) => `<section class="staff-preview-page" data-page="${pageIndex + 1}">${svg}</section>`)
          .join("");
        setMarkup(rendered);
      } catch {
        if (cancelled) return;
        setMarkup("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [xml]);

  return (
    <div className="docs-preview-shell">
      <div className="docs-preview-frame">
        <div className="staff-preview page-view" dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </div>
  );
}

function DrumIcon() {
  return (
    <svg aria-hidden="true" className="app-logo" width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 22V6C19 6 24 7 24 12" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="22" r="7" stroke="var(--text-main)" strokeWidth="2"/>
      <circle cx="12" cy="22" r="8.5" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.4"/>
      <circle cx="12" cy="13.5" r="1" fill="var(--text-main)"/>
      <circle cx="12" cy="30.5" r="1" fill="var(--text-main)"/>
      <circle cx="3.5" cy="22" r="1" fill="var(--text-main)"/>
      <circle cx="20.5" cy="22" r="1" fill="var(--text-main)"/>
      <line x1="7" y1="20" x2="17" y2="20" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
      <line x1="7" y1="22" x2="17" y2="22" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
      <line x1="7" y1="24" x2="17" y2="24" stroke="var(--text-main)" strokeWidth="0.5" strokeOpacity="0.6"/>
    </svg>
  );
}

function DocsExampleCard({ section }: { section: DocsSection }) {
  const score = useMemo(() => buildNormalizedScore(section.example), [section.example]);
  const xml = useMemo(() => buildMusicXml(score, false), [score]);

  return (
    <article className="docs-section-card" id={section.id}>
      <div className="docs-section-header">
        <h2>{section.title}</h2>
        <p>{section.summary}</p>
      </div>
      {section.content}
      <div className="docs-section-body">
        <div className="docs-section-pane">
          <div className="docs-pane-title">Syntax</div>
          <DslDocsSnippet source={section.example} />
        </div>
        <div className="docs-section-pane">
          <div className="docs-pane-title">Score Result</div>
          <StaticScorePreview xml={xml} />
        </div>
      </div>
    </article>
  );
}

export function DocsPage() {
  const [activeId, setActiveId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    docsSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 760) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const { body, documentElement } = document;

    if (window.innerWidth <= 760) {
      body.style.overflowX = "hidden";
      documentElement.style.overflowX = "hidden";
      body.style.overflowY = menuOpen ? "hidden" : "auto";
    } else {
      body.style.removeProperty("overflow");
      body.style.removeProperty("overflow-x");
      body.style.removeProperty("overflow-y");
      documentElement.style.removeProperty("overflow-x");
    }

    return () => {
      body.style.removeProperty("overflow");
      body.style.removeProperty("overflow-x");
      body.style.removeProperty("overflow-y");
      documentElement.style.removeProperty("overflow-x");
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="docs-layout">
      <div
        className={`docs-mobile-overlay${menuOpen ? " open" : ""}`}
        onClick={closeMenu}
        aria-hidden={menuOpen ? "false" : "true"}
      />

      <aside className={`docs-sidebar${menuOpen ? " open" : ""}`}>
        <div className="docs-sidebar-brand">
          <DrumIcon />
          <h1>Docs</h1>
        </div>
        <nav className="docs-nav">
          <div className="docs-nav-group">
            <span className="docs-nav-group-title">Language</span>
            <a href="./docs_zh.html" className="docs-nav-link" onClick={closeMenu}>中文文档</a>
          </div>
          <div className="docs-nav-group">
            <span className="docs-nav-group-title">Sections</span>
            {docsSections.map((s) => (
              <a 
                key={s.id} 
                href={`#${s.id}`} 
                className={`docs-nav-link${activeId === s.id ? " active" : ""}`}
                onClick={closeMenu}
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>
      </aside>

      <main className="docs-main">
        <div className="docs-mobile-bar">
          <button
            type="button"
            className="docs-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="docs-mobile-title">Docs</div>
        </div>

        <div className="docs-floating-action">
          <a className="export-button primary" href="./">Open Editor</a>
        </div>
        
        <section className="docs-page">
          <div className="docs-hero">
            <span className="docs-kicker">Getting Started</span>
            <h1>Drum Notation Guide</h1>
            <p>
              A text-first way to write professional drum scores. 
              The language is designed to be as fast as typing but as powerful as traditional notation software.
            </p>
          </div>
          
          <div className="docs-sections">
            {docsSections.map((section) => <DocsExampleCard key={section.id} section={section} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
