export function initNavbar() {
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");
  const overlay = document.getElementById("navOverlay");

  if (!toggle || !menu || !overlay) return;

  const setMenuHeight = () => {
    const height = menu.scrollHeight;
    document.documentElement.style.setProperty(
      "--nav-menu-height",
      `${height}px`
    );
  };

  const clearMenuHeight = () => {
    document.documentElement.style.setProperty("--nav-menu-height", "0px");
  };

  const closeMenu = () => {
    menu.classList.remove("is-open");
    toggle.classList.remove("is-open");
    overlay.classList.remove("is-active");
    document.body.classList.remove("nav-locked");
    clearMenuHeight();
  };

  const openMenu = () => {
    setMenuHeight();
    menu.classList.add("is-open");
    toggle.classList.add("is-open");
    overlay.classList.add("is-active");
    document.body.classList.add("nav-locked");
  };

  toggle.onclick = () => {
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  };

  overlay.onclick = closeMenu;

  menu.querySelectorAll("a, .nav-bar__button").forEach((item) => {
    item.onclick = closeMenu;
  });

  window.onresize = () => {
    if (window.innerWidth > 768) {
      closeMenu();
    } else if (menu.classList.contains("is-open")) {
      setMenuHeight();
    }
  };
}
