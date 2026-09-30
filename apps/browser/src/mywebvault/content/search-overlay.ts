/**
 * Runs inside the web page (isolated from the page's own scripts). Adds or removes a full-page
 * iframe showing the extension's search page. The page can't read the iframe's contents, so
 * bookmarks are never exposed to the site. Must be self-contained: it is serialized and injected.
 */
export function toggleSearchOverlay(pageUrl: string): void {
  const id = "mywebvault-quick-search";
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
    return;
  }
  const frame = document.createElement("iframe");
  frame.id = id;
  frame.src = pageUrl;
  frame.setAttribute("aria-label", "myWebVault search");
  frame.style.cssText = [
    "position: fixed",
    "inset: 0",
    "width: 100vw",
    "height: 100vh",
    "border: 0",
    "margin: 0",
    "padding: 0",
    "background: transparent",
    "color-scheme: normal",
    "display: block",
    "z-index: 2147483647",
  ]
    .map((rule) => `${rule} !important`)
    .join(";");

  const onMessage = (event: MessageEvent) => {
    if (
      event.source === frame.contentWindow &&
      event.data === "mywebvault:close-quick-search" /* CLOSE_OVERLAY_MESSAGE */
    ) {
      window.removeEventListener("message", onMessage);
      frame.remove();
    }
  };
  window.addEventListener("message", onMessage);
  document.documentElement.appendChild(frame);
  frame.focus();
}
