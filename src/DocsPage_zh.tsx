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
    title: "乐谱元数据",
    summary: "设置乐谱的全局信息和节奏基础。",
    content: (
      <div className="docs-description">
        <p>每一份乐谱都从小节头（Header）开始。这些字段定义了音乐的技术基础和元数据：</p>
        <ul>
          <li><code>title</code>, <code>subtitle</code>, <code>composer</code>: 必填的乐谱信息，将显示在导出的 PDF 和乐谱顶部。</li>
          <li><code>tempo</code>: 设置 BPM（四分音符为准）。如果省略，默认为 <strong>120</strong>。</li>
          <li><code>time</code>: 定义拍号（如 <code>4/4</code>, <code>6/8</code>, <code>7/8</code>）。这是节奏校验的依据。</li>
          <li><code>divisions</code>: 定义每一小节的网格细分数。例如，设置为 16 可以让你在 16 格的网格中编写 16 分音符。</li>
        </ul>
      </div>
    ),
    example: `title 灵魂乐研究\nsubtitle 律动 A\ncomposer G. Mao\ntempo 100\ntime 4/4\ndivisions 8\n\nHH | x - x x x x x - |`,
  },
  {
    id: "grouping",
    title: "乐句分组",
    summary: "控制音符的符杠（Beaming）连接和视觉重音。",
    content: (
      <div className="docs-description">
        <p><code>grouping</code> 字段是提高乐谱可读性的最强工具。它告诉系统如何连接符杠，以及内部重音的分布。<strong>常用拍号拥有智能默认值：</strong></p>
        <ul>
          <li><code>4/4</code> &rarr; <code>2+2</code> (两个二分音符宽度的重音组)</li>
          <li><code>6/8</code> &rarr; <code>3+3</code> (两个附点四分音符重音组)</li>
          <li><code>2/4</code> &rarr; <code>1+1</code>, <code>3/4</code> &rarr; <code>1+1+1</code></li>
          <li><strong>非正规拍号:</strong> 对于 <code>5/8</code>, <code>7/8</code> 等，你必须指定分组（如 <code>2+2+3</code>）。</li>
        </ul>
      </div>
    ),
    example: `time 7/8\ndivisions 7\ngrouping 2+2+3\n\nHH | x x x x x x x |`,
  },
  {
    id: "instruments",
    title: "乐器与轨道",
    summary: "将你的创意映射到具体的打击乐声部。",
    content: (
      <div className="docs-description">
        <p>每种乐器由一个<strong>轨道（Track）</strong>表示。以乐器名称开头，后跟一个竖线 <code>|</code>。一旦轨道在某个段落出现，它将在整个乐谱中持续存在，如果后续省略，系统将自动补齐休止符。</p>
        <ul>
          <li><strong>镲片 (Cymbals):</strong> <code>HH</code> (踩镲), <code>RC</code> (叮叮镲), <code>C</code> (吊镲)。使用 <code>x</code>/<code>X</code> 表示击打。</li>
          <li><strong>鼓组 (Drums):</strong> <code>SD</code> (军鼓), <code>BD</code> (底鼓), <code>T1/T2/T3</code> (通通鼓)。使用 <code>d</code>/<code>D</code>。</li>
          <li><strong>底端与功能:</strong> <code>HF</code> (脚踏踩镲) 使用 <code>p</code>/<code>P</code> 表示踏击。<code>ST</code> 用于粘滞标注 (<code>R</code>/<code>L</code>)。</li>
          <li><strong>糖语法 (Shortcuts):</strong> <code>DR</code> 轨道可以让你在同一行快速编写军鼓和通通鼓，支持重音 (<code>S</code>, <code>T1-T3</code>)。</li>
        </ul>

      </div>
    ),
    example: `time 4/4\ndivisions 8\n\nC  | x - - - - - - - |                 | x - - - - - - - | |\nHH | - x x x x x x x | x x x x x x x x |                 | |\nRC |                 |                 | - x x x x x x x | |\nT1 |                 |                 |                 | - - d d - - - - |\nT2 |                 |                 |                 | - - - - d d - - |\nSD | - - d - - - d - | - - d - - - d - | - - d - - - d - | d d - - - - - - |\nT3 |                 |                 |                 | - - - - - - d d |\nBD | p - p - p - - - | p - - p - p - - |                 | |\nHF |                 |                 | p - - p - p - - | |\n\n# 糖语法与粘滞标注 (Sticking)\nHH | c x x x x x x x | |\nDR |                 | s s t1 t1 t2 t2 t3 t3 |\n\nSD | d d d d d d d d |\nST | R L R L R L R L |`,
  },
  {
    id: "techniques",
    title: "演奏技巧",
    summary: "通过修饰符（Modifiers）丰富打击感。",
    content: (
      <div className="docs-description">
        <p>使用 <code>:修饰符</code> 语法细化音符的演奏方式。<strong>遵循以下兼容性规则：</strong></p>
        <ul>
          <li><strong>军鼓 (SD) 与通通鼓 (T1-T3):</strong> <code>:rim</code> (边击), <code>:cross</code> (横跨), <code>:flam</code> (装饰音)。</li>
          <li><strong>踩镲 (HH):</strong> <code>:open</code> (简写 <code>o</code>/<code>O</code>), <code>:close</code>。</li>
          <li><strong>镲片 (C, RC):</strong> <code>:choke</code> (制音), <code>:bell</code> (镲帽)。</li>
          <li><strong>足部 (HF) 与底鼓 (BD):</strong> <code>:close</code> (仅 HF)。</li>
          <li><strong>鬼音:</strong> 目前暂缓支持，因为 OSMD 还不能稳定渲染带括号的 notehead。</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\ngrouping 1+1+1+1\n\nSD | d:cross - d:rim - d:flam - d - |\nRC | x:bell - x:choke - x:bell - x:choke - |`,
  },
  {
    id: "syntax-details",
    title: "语法与格式细节",
    summary: "编写整洁、可维护的记谱代码。",
    content: (
      <div className="docs-description">
        <p>该记谱语言旨在提供极高的可读性和灵活性：</p>
        <ul>
          <li><strong>注释 (Comments):</strong> 使用 <code>#</code> 添加个人备注。该符号之后的所有内容都会被忽略。</li>
          <li><strong>空格 (Whitespace):</strong> 小节内部的空格和制表符会被忽略。你可以自由使用它们来对齐多个轨道。</li>
          <li><strong>小节线:</strong> 你可以在一行内放置多个小节，甚至使用空小节 <code>| |</code>，它默认代表全小节休止。</li>
        </ul>
      </div>
    ),
    example: `# 整齐对齐的代码\ntime 4/4\ndivisions 8\n\nHH | x x x x  x x x x | # 主歌\nSD | - - d -  - - d - | # 律动\nBD | p - - -  p - - - |`,
  },
  {
    id: "tuplets",
    title: "连音符与分组",
    summary: "利用方括号调整时长或创建复杂的细分。",
    content: (
      <div className="docs-description">
        <p>分组允许你以两种方式偏离 <code>divisions</code> 定义的基础网格：</p>
        <ul>
          <li><strong>压缩 (连音符/细分):</strong> 在一个格子内塞入更多音符。 
            <ul>
              <li><code>[x x]</code>: 在一个格子内塞入两个 16 分音符（假设 <code>divisions 8</code>）。</li>
              <li><code>[2: d d d]</code>: 在两个格子的空间内塞入三个音符，创建<strong>三连音</strong>。</li>
            </ul>
          </li>
          <li><strong>扩展 (长音符):</strong> 让一个音符跨越多个格子。
            <ul>
              <li><code>[2: p]</code>: 让音符持续 2 个格子的时长。</li>
            </ul>
          </li>
          <li><strong>简写:</strong> 语法为 <code>[跨度: 音符列表]</code>。如果跨度正好是 1，可以省略 <code>1:</code> 前缀。</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\ngrouping 1+1+1+1\n\n# 压缩：32分音符、三连音、五连音\nSD | [d d] d [2:d d d d] [2: d d d] [2: d d d d d] |\n\n# 扩展：四分音符、全音符\nSD | [2: d] d d [4: d] | [8: d] |`,
  },
  {
    id: "durations",
    title: "时长修饰符",
    summary: "快速调整音符时长，无需使用括号。",
    content: (
      <div className="docs-description">
        <p>你可以直接在音符后面添加后缀来微调其长度。这对于常见的附点节奏非常高效：</p>
        <ul>
          <li><strong>附点 (<code>.</code>):</strong> 将时长延长为原来的 1.5 倍。
            <ul>
              <li><code>d.</code>: 附点音符。支持多个附点（如 <code>d..</code>）。</li>
            </ul>
          </li>
          <li><strong>减半 (<code>/</code>):</strong> 将时长缩短为原来的一半。
            <ul>
              <li><code>d/</code>: 半值音符。常与附点配合使用，如 <code>d. d/</code> 组成一个完整的节拍。</li>
            </ul>
          </li>
          <li><strong>严格规则:</strong> 
            <ul>
              <li><strong>不得跨越分组边界:</strong> 例如在 4/4 拍 2+2 分组中，第 2 拍的附点音符 <code>d.</code> 会因为跨越第 3 拍的重拍边界而报错。</li>
              <li><strong>必须填满小节:</strong> 所有的附点和减半计算后的总时长必须精确等于 <code>divisions</code> 设定的格子数。</li>
            </ul>
          </li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 4\ngrouping 1+1+1+1\n\n# 附点与半值的完美组合\nHH | x. x/ x. x/ | x. / x. / |\nSD | - - d. d/ | d. / d d/ / |`,
  },
  {
    id: "repeats",
    title: "结构与流程",
    summary: "管理小节、重复和乐段。",
    content: (
      <div className="docs-description">
        <p>使用专业的导航标记完成乐谱结构：</p>
        <ul>
          <li><strong>小节线:</strong> 标准 <code>|</code>，重复开始 <code>|:</code>，以及重复结束 <code>:|</code>。</li>
          <li><strong>多小节休止:</strong> 使用 <code>| --N-- |</code> 语法（例如 <code>| --8-- |</code>）显示带数字 N 的多小节休止条。</li>
          <li><strong>内联重复:</strong> 在小节末尾使用 <code>*N</code> 将该小节重复 N 次（例如 <code>| xxxx *2 |</code> 重复 xxxx 两次，<code>| - *3 |</code> 重复空白小节 3 次）。</li>
          <li><strong>乐段 (Sections):</strong> 在文本块之间留一个空行来创建段落。这有助于组织"主歌（Verse）"或"副歌（Chorus）"等不同部分。</li>
        </ul>
      </div>
    ),
    example: `time 4/4\ndivisions 8\n\n# 重复\nHH |: xx   xx xx    xx :|\nSD |  --   d- --    d- |\nBD | [2:p] -p [2:p] -- |\n\n# 多小节休止\nHH | --8-- | -2- |\n\n# 内联重复\nHH | [2:x]xx xxxx | *2 | xxxo xxxo *2 |`,
  },
  {
    id: "full-example",
    title: "大师级全特性示例",
    summary: "一个综合展示所有可用特性的完整演示。",
    content: (
      <div className="docs-description">
        <p>这个最终示例展示了头部信息、复杂分组、快捷方式和多段落布局的协同作用，涵盖了装饰音（Flam）、镲帽击打和粘滞标记等高级技巧。</p>
      </div>
    ),
    example: `title Fusion Grooves\nsubtitle 高级进阶练习\ncomposer G. Mao\ntempo 128\ntime 4/4\ndivisions 16\ngrouping 2+2\n\n# 乐段 A: 主律动\nHH |: x - x - o - x - | x:close - X - x - c - :|\nSD |  - - d:cross - d - | D:rim - [2: d d:flam] - - -  |\nBD |  p - - - p - - - | p - p - - - p -        |\nHF |  - - - - p - - - | - - - - p:close - -    |\n\n# 乐段 B: 复杂细分桥接\nRC |  x:bell - x:bell - x:bell - x:bell - | [4: x:choke] |\nDR |  s - - - [3: s s s] - - - | S - t1 t2 t3 - - -   |\nBD |  p - - - p - - -     | p - - - p - - -      |\nST |  R - - - R L R - - - | R - R L R - - -      |\n\n# 结尾: Finale\nC  |  X:choke - - - - - - - | - - - - X - - - |\nBD |  [16: p] |`,
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
  rules.SheetMaximumWidth = 32767;
}

function getStaffSvgMarkup(markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  const serializer = new XMLSerializer();
  return Array.from(host.querySelectorAll("svg"))
    .filter((svg) => !svg.parentElement?.closest("svg"))
    .map((svg) => {
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
    staticPreviewOsmd.setOptions({ defaultColorTitle: "#111111", autoGenerateMultipleRestMeasuresFromRestMeasures: false });
  }

  return { buffer: staticPreviewBuffer, osmd: staticPreviewOsmd };
}

function highlightDslSnippet(source: string): ReactNode[] {
  const pattern = /(#[^\n]*|\b(?:title|subtitle|composer|tempo|time|divisions|grouping)\b|\b(?:HH|HF|DR|SD|BD|T1|T2|T3|RC|C|ST)\b|:\|x\d+|\|:|:\||[|[\]]|\b(?:open|close|choke|rim|cross|bell|flam)\b|(?:t1|t2|t3)\b|\d+(?:\/\d+|\+\d+)*|-|:|[./]+|[RLSXDxopcdbp]+)/g;
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
    else if (/^[./]+$/.test(value)) className += " dsl-operator";
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
          <div className="docs-pane-title">示例</div>
          <DslDocsSnippet source={section.example} />
        </div>
        <div className="docs-section-pane">
          <div className="docs-pane-title">生成结果</div>
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
          <h1>文档</h1>
        </div>
        <nav className="docs-nav">
          <div className="docs-nav-group">
            <span className="docs-nav-group-title">语言切换</span>
            <a href="./docs.html" className="docs-nav-link" onClick={closeMenu}>English Docs</a>
          </div>
          <div className="docs-nav-group">
            <span className="docs-nav-group-title">章节</span>
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
            aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="docs-mobile-title">文档</div>
        </div>

        <div className="docs-floating-action">
          <a className="export-button primary" href="./">打开编辑器</a>
        </div>
        
        <section className="docs-page">
          <div className="docs-hero">
            <span className="docs-kicker">快速入门</span>
            <h1>鼓谱记谱指南</h1>
            <p>
              为现代鼓手设计的"文本优先"记谱方式。 
              该语言旨在像打字一样飞快，同时拥有传统打谱软件的强大功能。
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
