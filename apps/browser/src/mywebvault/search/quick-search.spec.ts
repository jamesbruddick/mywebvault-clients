import { isOpenableUrl, QuickSearchBookmark, rankBookmarks } from "./quick-search";

function bookmark(overrides: Partial<QuickSearchBookmark>): QuickSearchBookmark {
  return {
    title: "",
    url: "https://example.com",
    tags: [],
    folder: null,
    notes: "",
    favorite: false,
    ...overrides,
  };
}

const soup = bookmark({
  title: "Soup recipes",
  url: "https://soup.test",
  tags: ["cooking"],
});
const news = bookmark({
  title: "Daily news",
  url: "https://news.test",
  tags: ["reading"],
});
const guide = bookmark({
  title: "Guide",
  url: "https://docs.test/soup-kitchen",
  folder: "Work",
  notes: "onboarding",
});
const all = [soup, news, guide];
const titles = (list: QuickSearchBookmark[]) => list.map((b) => b.title);

describe("rankBookmarks", () => {
  it("shows nothing until something is typed", () => {
    expect(rankBookmarks(all, "")).toEqual([]);
    expect(rankBookmarks(all, "  ")).toEqual([]);
  });

  it("ranks title matches above URL matches", () => {
    expect(titles(rankBookmarks(all, "soup"))).toEqual(["Soup recipes", "Guide"]);
  });

  it("requires every term to match", () => {
    expect(titles(rankBookmarks(all, "soup kitchen"))).toEqual(["Guide"]);
    expect(rankBookmarks(all, "soup nothing")).toEqual([]);
  });

  it("matches tags, folders and notes", () => {
    expect(titles(rankBookmarks(all, "cook"))).toEqual(["Soup recipes"]);
    expect(titles(rankBookmarks(all, "work"))).toEqual(["Guide"]);
    expect(titles(rankBookmarks(all, "onboard"))).toEqual(["Guide"]);
  });

  it("treats #terms as tag-only filters", () => {
    expect(titles(rankBookmarks(all, "#read"))).toEqual(["Daily news"]);
    expect(rankBookmarks(all, "#soup")).toEqual([]);
  });

  it("returns at most 50 results", () => {
    const many = Array.from({ length: 80 }, (_, i) => bookmark({ title: `Item ${i}` }));
    expect(rankBookmarks(many, "item")).toHaveLength(50);
  });
});

describe("isOpenableUrl", () => {
  it("allows web addresses only", () => {
    expect(isOpenableUrl("https://example.com")).toBe(true);
    expect(isOpenableUrl("http://example.com")).toBe(true);
    expect(isOpenableUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableUrl("data:text/html,hi")).toBe(false);
    expect(isOpenableUrl("chrome://settings")).toBe(false);
    expect(isOpenableUrl("not a url")).toBe(false);
  });
});
