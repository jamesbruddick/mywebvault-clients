// Quick search page: shown over a web page (in an iframe) or in its own small window.
// Plain DOM, no Angular, so it opens instantly. Bookmark text is always set with textContent.

import "./search.css";

import {
  CLOSE_OVERLAY_MESSAGE,
  OpenDisposition,
  QuickSearchBookmark,
  QuickSearchData,
  QuickSearchMessage,
  rankBookmarks,
} from "../../search/quick-search";

const params = new URLSearchParams(location.search);
const windowMode = params.get("mode") === "window";
const originTabId = params.has("tab") ? Number(params.get("tab")) : undefined;

const input = document.getElementById("quick-search_input") as HTMLInputElement;
const list = document.getElementById("quick-search_results") as HTMLUListElement;
const status = document.getElementById("quick-search_status") as HTMLDivElement;
const footer = document.getElementById("quick-search_footer") as HTMLDivElement;
const backdrop = document.querySelector(".backdrop") as HTMLDivElement;

const t = (key: string) => chrome.i18n.getMessage(key) || key;

let bookmarks: QuickSearchBookmark[] = [];
let shown: QuickSearchBookmark[] = [];
let selected = 0;

function close() {
  if (windowMode) {
    window.close();
  } else {
    window.parent.postMessage(CLOSE_OVERLAY_MESSAGE, "*");
  }
}

function faviconUrl(url: string): string {
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function render() {
  shown = rankBookmarks(bookmarks, input.value);
  selected = Math.min(selected, Math.max(shown.length - 1, 0));
  list.replaceChildren(
    ...shown.map((bookmark, index) => {
      const item = el("li", "result");
      item.id = `quick-search_result-${index}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === selected));
      item.dataset.testid = "quick-search-result";

      const icon = el("img", "favicon");
      icon.src = faviconUrl(bookmark.url);
      icon.alt = "";

      const text = el("div", "text");
      text.append(
        el("span", "title", bookmark.title),
        el(
          "span",
          "meta",
          bookmark.folder
            ? `${hostname(bookmark.url)} · ${bookmark.folder}`
            : hostname(bookmark.url),
        ),
      );

      const tags = el("div", "tags");
      tags.append(...bookmark.tags.slice(0, 3).map((tag) => el("span", "tag", `#${tag}`)));

      item.append(icon, text, tags);
      item.addEventListener("mousemove", () => select(index, false));
      item.addEventListener("click", (e) =>
        open(index, e.metaKey || e.ctrlKey ? "currentTab" : "newTab"),
      );
      return item;
    }),
  );
  input.setAttribute(
    "aria-activedescendant",
    shown.length ? `quick-search_result-${selected}` : "",
  );
  status.textContent =
    bookmarks.length === 0
      ? t("noBookmarksYet")
      : shown.length === 0
        ? t("quickSearchNoResults")
        : "";
}

function select(index: number, scroll = true) {
  if (index === selected || shown.length === 0) {
    return;
  }
  list.children[selected]?.setAttribute("aria-selected", "false");
  selected = (index + shown.length) % shown.length;
  const item = list.children[selected];
  item?.setAttribute("aria-selected", "true");
  input.setAttribute("aria-activedescendant", `quick-search_result-${selected}`);
  if (scroll) {
    item?.scrollIntoView({ block: "nearest" });
  }
}

async function open(index: number, disposition: OpenDisposition) {
  const bookmark = shown[index];
  if (!bookmark) {
    return;
  }
  await chrome.runtime.sendMessage({
    command: QuickSearchMessage.Open,
    url: bookmark.url,
    disposition,
    tabId: originTabId,
  });
  close();
}

function showLocked(loggedOut: boolean) {
  input.disabled = true;
  footer.hidden = true;
  status.replaceChildren(
    el("div", "", t(loggedOut ? "quickSearchLoggedOut" : "quickSearchLocked")),
  );
  const button = el("button", "", t(loggedOut ? "logIn" : "unlock"));
  button.id = "quick-search_button_unlock";
  button.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ command: QuickSearchMessage.Unlock });
    close();
  });
  status.append(button);
  button.focus();
}

async function load() {
  status.textContent = t("loading");
  const data = (await chrome.runtime.sendMessage({
    command: QuickSearchMessage.GetData,
  })) as QuickSearchData | null;
  if (!data) {
    status.textContent = t("errorOccurred");
    return;
  }
  if (data.state !== "unlocked") {
    showLocked(data.state === "loggedOut");
    return;
  }
  bookmarks = data.bookmarks;
  render();
}

input.placeholder = t("searchBookmarks");
const hint = document.createDocumentFragment();
for (const [keys, label] of [
  ["↑ ↓", "quickSearchNavigate"],
  ["Enter", "quickSearchOpenNewTab"],
  [navigator.platform.startsWith("Mac") ? "⌘ Enter" : "Ctrl Enter", "quickSearchOpenHere"],
  ["Esc", "quickSearchClose"],
] as const) {
  hint.append(el("kbd", "", keys), ` ${t(label)}   `);
}
footer.append(hint);

if (windowMode) {
  document.body.classList.add("window-mode");
  window.addEventListener("blur", () => window.close());
}

input.addEventListener("input", () => {
  selected = 0;
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    select(selected + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    select(selected - 1);
  } else if (e.key === "Enter" && document.activeElement === input) {
    e.preventDefault();
    void open(selected, e.metaKey || e.ctrlKey ? "currentTab" : "newTab");
  }
});

backdrop.addEventListener("mousedown", close);

// Scrolling anywhere in the overlay except the results list would otherwise scroll the page
// underneath (the iframe passes scrolls it can't use on to its parent). The list itself stops at its
// ends via `overscroll-behavior: contain`.
const blockPageScroll = (e: Event) => {
  if (!(e.target instanceof Node && list.contains(e.target))) {
    e.preventDefault();
  }
};
document.addEventListener("wheel", blockPageScroll, { passive: false });
document.addEventListener("touchmove", blockPageScroll, { passive: false });

window.focus();
input.focus();
void load();
