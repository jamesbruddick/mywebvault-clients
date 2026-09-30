import { flattenBookmarkTree, folderNameForPath } from "./browser-bookmarks";

type Node = chrome.bookmarks.BookmarkTreeNode;

function folder(
  id: string,
  title: string,
  children: Node[],
  parentId: string | undefined = "0",
): Node {
  return { id, title, children, parentId } as Node;
}

function link(id: string, title: string, url: string): Node {
  return { id, title, url, parentId: "x" } as Node;
}

describe("flattenBookmarkTree", () => {
  const tree: Node[] = [
    folder(
      "0",
      "",
      [
        folder("1", "Bookmarks bar", [
          link("10", "Example", "https://example.com"),
          folder("11", "Recipes", [link("12", "Soup", "https://soup.test")]),
          folder("13", "Work/Home", [link("14", "", "https://untitled.test")]),
        ]),
        folder("2", "Other bookmarks", [
          link("20", "Bookmarklet", "javascript:alert(1)"),
          link("21", "Data", "data:text/html,hi"),
        ]),
      ],
      undefined,
    ),
  ];

  it("keeps folder paths from the top level down, skipping the root", () => {
    expect(flattenBookmarkTree(tree)).toEqual([
      { title: "Example", url: "https://example.com", folderPath: ["Bookmarks bar"] },
      { title: "Soup", url: "https://soup.test", folderPath: ["Bookmarks bar", "Recipes"] },
      {
        title: "https://untitled.test",
        url: "https://untitled.test",
        folderPath: ["Bookmarks bar", "Work-Home"],
      },
    ]);
  });

  it("skips bookmarklets and data URLs", () => {
    expect(flattenBookmarkTree(tree).some((b) => /^(javascript|data):/.test(b.url))).toBe(false);
  });
});

describe("folderNameForPath", () => {
  it("joins nested folders with a slash", () => {
    expect(folderNameForPath([])).toBeNull();
    expect(folderNameForPath(["Bookmarks bar", "Recipes"])).toBe("Bookmarks bar/Recipes");
  });
});
