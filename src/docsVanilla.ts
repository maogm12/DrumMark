import { buildNormalizedScore } from "./dsl";
import { renderScoreToSvg } from "./vexflow";
import { highlightDslStatic } from "./drummark";

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
  
  for (const block of codeBlocks) {
    const dsl = block.textContent?.trim() || "";
    const container = block.closest('.docs-section-card')?.querySelector(".staff-preview-container");
    
    if (dsl && container) {
      // 如果容器里已经有内容了（说明是预渲染的），我们只做语法高亮
      if (container.innerHTML.trim() !== "") {
        block.innerHTML = highlightDslStatic(dsl);
        continue;
      }

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

  // 4. Handle initial hash scroll
  const hash = window.location.hash;
  if (hash) {
    setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView();
    }, 500);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDocs);
} else {
  initDocs();
}
