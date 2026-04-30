function initDocs() {
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const navLinks = document.querySelectorAll<HTMLElement>(".docs-nav-link[href^='#']");

  const toggleMenu = (open?: boolean) => {
    const isVisible = open !== undefined ? open : !sidebar?.classList.contains("open");
    sidebar?.classList.toggle("open", isVisible);
    overlay?.classList.toggle("open", isVisible);
    document.body.classList.toggle("docs-menu-open", isVisible);
  };

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
