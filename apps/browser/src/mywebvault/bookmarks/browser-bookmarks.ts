/** A bookmark read from the browser's own bookmarks, ready to import. */
export interface BrowserBookmark {
  title: string;
  url: string;
  /** Folder names from the top level down, e.g. ["Bookmarks bar", "Recipes"]. Empty for none. */
  folderPath: string[];
}

/** Separator for nested folders; the vault shows "A/B" as folder B inside folder A. */
export const FOLDER_SEPARATOR = "/";

// Bookmarklets and inline data can run code when opened; they are not imported.
const UNSAFE_SCHEMES = /^(javascript|data|vbscript):/i;

/**
 * Flattens the tree from chrome.bookmarks.getTree() into a list of bookmarks with their folder
 * path. The invisible root node is skipped; top-level folders ("Bookmarks bar", "Other bookmarks")
 * become top-level vault folders.
 */
export function flattenBookmarkTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): BrowserBookmark[] {
  const result: BrowserBookmark[] = [];

  const visit = (node: chrome.bookmarks.BookmarkTreeNode, path: string[]) => {
    if (node.url) {
      if (!UNSAFE_SCHEMES.test(node.url)) {
        result.push({ title: node.title || node.url, url: node.url, folderPath: path });
      }
      return;
    }
    // A folder. The root node has no parent and no title; don't make it a folder.
    const isRoot = node.parentId === undefined;
    // Vault folder names use "/" for nesting, so a "/" inside a browser folder name is replaced.
    const name = node.title.replaceAll(FOLDER_SEPARATOR, "-").trim();
    const childPath = isRoot || name === "" ? path : [...path, name];
    for (const child of node.children ?? []) {
      visit(child, childPath);
    }
  };

  for (const node of nodes) {
    visit(node, []);
  }
  return result;
}

/** The vault folder name for a path, or null for "no folder". */
export function folderNameForPath(path: string[]): string | null {
  return path.length === 0 ? null : path.join(FOLDER_SEPARATOR);
}
