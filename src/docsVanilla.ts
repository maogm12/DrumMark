type DocsRenderDeps = {
  buildNormalizedScore: typeof import("./dsl")["buildNormalizedScore"];
  renderScoreToSvg: typeof import("./vexflow")["renderScoreToSvg"];
  highlightDslStatic: typeof import("./drummark")["highlightDslStatic"];
};

let docsRenderDepsPromise: Promise<DocsRenderDeps> | null = null;

async function loadDocsRenderDeps(): Promise<DocsRenderDeps> {
  if (!docsRenderDepsPromise) {
    docsRenderDepsPromise = Promise.all([
      import("./dsl"),
      import("./vexflow"),
      import("./drummark"),
    ]).then(([dsl, vexflow, drummark]) => ({
      buildNormalizedScore: dsl.buildNormalizedScore,
      renderScoreToSvg: vexflow.renderScoreToSvg,
      highlightDslStatic: drummark.highlightDslStatic,
    }));
  }

  return docsRenderDepsPromise;
}

async function initDocs() {
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const navLinks = document.querySelectorAll<HTMLElement>(".docs-nav-link[href^='#']");
  const sections = document.querySelectorAll<HTMLElement>(".docs-section-card");

  // 1. Mobile Menu Toggle
  const toggleMenu = (open?: boolean) => {
    const isVisible = open !== undefined ? open : !sidebar?.classList.contains("open");
    sidebar?.classList.toggle("open", isVisible);
    overlay?.classList.toggle("open", isVisible);
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.removeProperty("overflow");
    }
  };

  menuToggle?.addEventListener("click", () => toggleMenu());
  overlay?.addEventListener("click", () => toggleMenu(false));
  
  // Close menu on link click
  navLinks.forEach(link => {
    link.addEventListener("click", () => toggleMenu(false));
  });

  // 2. Navigation & Scroll Tracking
  const updateActiveNav = () => {
    let currentId = "";
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 200) {
        currentId = section.id;
      }
    });

    navLinks.forEach((link) => {
      const href = link.getAttribute("href")?.replace("#", "");
      link.classList.toggle("active", href === currentId);
    });
  };

  window.addEventListener("scroll", updateActiveNav, { passive: true });
  updateActiveNav();

  // 3. Score Rendering
  const codeBlocks = document.querySelectorAll<HTMLElement>(".dsl-code-block");
  let renderDeps: DocsRenderDeps | null = null;
  
  for (const block of codeBlocks) {
    const dsl = block.textContent ?? "";
    const container = block.closest('.docs-section-card')?.querySelector(".staff-preview-container");
    
    if (dsl && container) {
      // Static docs are already highlighted and pre-rendered at build time.
      // Rewriting them on load causes visible layout jitter.
      if (container.innerHTML.trim() !== "") {
        continue;
      }

      renderDeps ??= await loadDocsRenderDeps();
      const { buildNormalizedScore, renderScoreToSvg, highlightDslStatic } = renderDeps;

      // Apply syntax highlighting
      block.innerHTML = highlightDslStatic(dsl);
      
      try {
        const score = buildNormalizedScore(dsl);
        const svg = await renderScoreToSvg(score, {
          mode: "preview",
          pagePadding: { top: 10, right: 10, bottom: 10, left: 10 },
          pageScale: 0.8,
          titleTopPadding: 0,
          titleSubtitleGap: 0,
          titleStaffGap: 0,
          systemSpacing: 1.0,
          hideVoice2Rests: false,
        });
        
        container.innerHTML = `<div class="staff-preview">${svg}</div>`;
      } catch (e) {
        console.error("Static render failed:", e);
        container.innerHTML = `<div class="staff-error">Render Error</div>`;
      }
    }
  }

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDocs);
} else {
  initDocs();
}
