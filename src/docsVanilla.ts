function initDocs() {
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const navLinks = document.querySelectorAll<HTMLElement>(".docs-nav-link[href^='#']");
  const isZh = document.documentElement.lang === "zh";
  const defaultCopyLabel = isZh ? "复制" : "Copy";

  const fallbackCopyText = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    return copied;
  };

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back for insecure contexts such as LAN HTTP access.
    }

    return fallbackCopyText(text);
  };

  const toggleMenu = (open?: boolean) => {
    const isVisible = open !== undefined ? open : !sidebar?.classList.contains("open");
    sidebar?.classList.toggle("open", isVisible);
    overlay?.classList.toggle("open", isVisible);
    document.body.classList.toggle("docs-menu-open", isVisible);
  };

  const ensureCopyButtons = () => {
    const codeBlocks = document.querySelectorAll<HTMLElement>(".docs-code-block");

    codeBlocks.forEach((block) => {
      if (block.querySelector(".docs-copy-button")) return;

      const pre = block.querySelector<HTMLPreElement>("pre");
      if (!pre) return;

      const text = pre.textContent?.trimEnd();
      if (!text) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "docs-copy-button";
      button.dataset["copy"] = encodeURIComponent(text);
      button.dataset["copyLabel"] = defaultCopyLabel;
      button.setAttribute("aria-label", defaultCopyLabel);
      button.textContent = defaultCopyLabel;
      block.insertBefore(button, pre);
    });
  };

  const bindCopyButtons = () => {
    const copyButtons = document.querySelectorAll<HTMLButtonElement>(".docs-copy-button");

    copyButtons.forEach((button) => {
      if (button.dataset["copyBound"] === "true") return;
      button.dataset["copyBound"] = "true";

      const copyLabel = button.dataset["copyLabel"] ?? defaultCopyLabel;
      button.addEventListener("click", async () => {
        const encodedDsl = button.dataset["copy"];
        if (!encodedDsl) return;

        const text = decodeURIComponent(encodedDsl);

        if (await copyText(text)) {
          button.textContent = copyLabel === "复制" ? "已复制" : "Copied";
          button.classList.add("copied");
          window.setTimeout(() => {
            button.textContent = copyLabel;
            button.classList.remove("copied");
          }, 1600);
        } else {
          button.textContent = copyLabel === "复制" ? "失败" : "Failed";
          window.setTimeout(() => {
            button.textContent = copyLabel;
          }, 1600);
        }
      });
    });
  };

  ensureCopyButtons();
  bindCopyButtons();

  menuToggle?.addEventListener("click", () => toggleMenu());
  overlay?.addEventListener("click", () => toggleMenu(false));

  navLinks.forEach((link) => {
    link.addEventListener("click", () => toggleMenu(false));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDocs);
} else {
  initDocs();
}
