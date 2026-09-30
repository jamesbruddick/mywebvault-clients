/**
 * Shared between the background and the quick search page (no Angular, no vault code).
 */

/** The keyboard command declared in manifest.v3.json. */
export const OPEN_SEARCH_COMMAND = "open_search";

export const QuickSearchMessage = Object.freeze({
  /** Page -> background: the decrypted bookmark list, if the vault is unlocked. */
  GetData: "mwvQuickSearchData",
  /** Page -> background: open a bookmark. */
  Open: "mwvQuickSearchOpen",
  /** Page -> background: open the popup so the user can unlock. */
  Unlock: "mwvQuickSearchUnlock",
} as const);

/** Page -> the content script that injected it: remove the overlay. */
export const CLOSE_OVERLAY_MESSAGE = "mywebvault:close-quick-search";

export interface QuickSearchBookmark {
  title: string;
  url: string;
  tags: string[];
  folder: string | null;
  notes: string;
  favorite: boolean;
}

export type QuickSearchData =
  | { state: "unlocked"; bookmarks: QuickSearchBookmark[] }
  | { state: "locked" }
  | { state: "loggedOut" };

export type OpenDisposition = "newTab" | "currentTab";

export interface OpenRequest {
  command: typeof QuickSearchMessage.Open;
  url: string;
  disposition: OpenDisposition;
  /** Tab to reuse for "currentTab" when the search runs in its own window. */
  tabId?: number;
}

/** Only web addresses can be opened from search (never javascript:, data:, etc.). */
export function isOpenableUrl(url: string): boolean {
  try {
    return ["http:", "https:", "ftp:", "file:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

const MAX_RESULTS = 50;

/**
 * Filters and orders bookmarks for a query. Every term must match somewhere (title, URL, folder,
 * tags, notes); `#term` matches tags only. Title matches rank above tag, URL and notes matches.
 * With no query, nothing is shown: results appear only once something is typed.
 */
export function rankBookmarks(
  bookmarks: QuickSearchBookmark[],
  query: string,
): QuickSearchBookmark[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  const scored: { bookmark: QuickSearchBookmark; score: number }[] = [];
  for (const bookmark of bookmarks) {
    const title = bookmark.title.toLowerCase();
    const url = bookmark.url.toLowerCase();
    const tags = bookmark.tags.map((t) => t.toLowerCase());
    const other = `${bookmark.folder ?? ""} ${bookmark.notes}`.toLowerCase();
    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      if (term.startsWith("#")) {
        const tag = term.slice(1);
        const exact = tags.includes(tag);
        const prefix = tags.some((t) => t.startsWith(tag));
        if (!prefix) {
          matchedAll = false;
          break;
        }
        score += exact ? 60 : 40;
        continue;
      }
      if (title.startsWith(term)) {
        score += 100;
      } else if (title.split(/\W+/).some((word) => word.startsWith(term))) {
        score += 80;
      } else if (title.includes(term)) {
        score += 60;
      } else if (tags.some((t) => t.startsWith(term))) {
        score += 50;
      } else if (url.includes(term)) {
        score += 30;
      } else if (other.includes(term)) {
        score += 10;
      } else {
        matchedAll = false;
        break;
      }
    }
    if (matchedAll) {
      scored.push({ bookmark, score: score + (bookmark.favorite ? 5 : 0) });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.bookmark.title.localeCompare(b.bookmark.title))
    .slice(0, MAX_RESULTS)
    .map((s) => s.bookmark);
}
