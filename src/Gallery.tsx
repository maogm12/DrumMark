import { useEffect, useRef, useState } from "react";

/**
 * 经过源码验证的 SMuFL 符号定义 (VexFlow 5)
 */
const heads = [
  { label: "X (HH/Ride)", code: "X", smufl: "noteheadXBlack" },
  { label: "Circle X (Open HH)", code: "CX", smufl: "noteheadCircleX" },
  { label: "Diamond (Ride Bell)", code: "D2", smufl: "noteheadDiamondBlack" },
  { label: "Slashed 1 (Rim)", code: "SF", smufl: "noteheadSlashedBlack1" },
  { label: "Slashed 2", code: "SB", smufl: "noteheadSlashedBlack2" },
  { label: "Circled (Ghost/Alt)", code: "CI", smufl: "noteheadCircledBlack" },
  // P1-P3 使用源码查到的 Unicode 直接测试
  { label: "P1: noteheadParenthesis", code: "P1", unicode: "\uE0CE" },
  { label: "P2: Paren Left Only", code: "P2", unicode: "\uE0F5" },
  { label: "P3: Paren Right Only", code: "P3", unicode: "\uE0F6" },
  // P4: 组合方案测试
  { label: "P4: Left + Black + Right", code: "P4", unicode: "\uE0F5\uE0A4\uE0F6" },
  { label: "Triangle Up", code: "TU", smufl: "noteheadTriangleUpBlack" },
];

function GalleryItem({ item, VF }: { item: any, VF: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!containerRef.current || !VF) return;
    containerRef.current.innerHTML = "";
    setErr("");

    try {
      const renderer = new VF.Renderer(containerRef.current, VF.Renderer.Backends.SVG);
      renderer.resize(140, 100);
      const context = renderer.getContext();
      
      const stave = new VF.Stave(0, 0, 140);
      stave.addClef("percussion");
      stave.setContext(context).draw();

      // 恢复正确的 shorthand 逻辑
      const isManual = item.unicode !== undefined;
      const note = new VF.StaveNote({
        keys: [isManual ? "C/5" : `C/5/${item.code}`],
        duration: "q",
        clef: "percussion"
      });

      // 如果是手动模式，通过 note_heads 注入 Unicode
      if (isManual && (note as any).note_heads && (note as any).note_heads[0]) {
        (note as any).note_heads[0].text = item.unicode;
      }
      
      const voice = new VF.Voice({ num_beats: 1, beat_value: 4 }).setStrict(false);
      voice.addTickables([note]);
      
      new VF.Formatter().joinVoices([voice]).format([voice], 80);
      voice.draw(context, stave);
    } catch (e: any) {
      setErr(e.message);
    }
  }, [item, VF]);

  return (
    <div className="gallery-item" style={{ border: '1px solid #ddd', margin: '5px', padding: '10px', background: '#fff', textAlign: 'center', minHeight: '140px' }}>
      {err ? (
        <div style={{ color: 'red', fontSize: '10px', padding: '10px' }}>{err}</div>
      ) : (
        <div ref={containerRef} style={{ width: '140px', height: '100px', margin: '0 auto' }}></div>
      )}
      <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{item.label}</div>
      <code style={{ fontSize: '9px', color: '#666' }}>{item.unicode ? 'Unicode' : item.code}</code>
    </div>
  );
}

export function GalleryPreview() {
  const [vfState, setVfState] = useState<any>(null);
  const [fontStatus, setFontStatus] = useState("Loading...");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const VF = await import("vexflow");
        const VexFlow = (VF as any).VexFlow || VF;

        if (typeof VexFlow.loadFonts === "function") {
          setFontStatus("Loading Bravura...");
          await VexFlow.loadFonts("Bravura", "Academico");
        }

        if (typeof VexFlow.setFonts === "function") {
          VexFlow.setFonts("Bravura", "Academico");
        }

        if (cancelled) return;
        setFontStatus(`READY (VF 5)`);
        setVfState(VF);
      } catch (e: any) {
        if (cancelled) return;
        setFontStatus("ERROR: " + e.message);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="gallery-preview-container" style={{ padding: '20px' }}>
      <div style={{ padding: '10px', background: '#1e1e1e', color: '#0f0', marginBottom: '10px', borderRadius: '4px', fontSize: '12px' }}>
        <b>Status:</b> {fontStatus}
      </div>
      
      {vfState && (
        <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {heads.map((item, idx) => <GalleryItem key={idx} item={item} VF={vfState} />)}
        </div>
      )}
    </div>
  );
}
