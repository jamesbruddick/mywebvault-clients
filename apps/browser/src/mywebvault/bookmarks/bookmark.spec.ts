import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import {
  Bookmark,
  bookmarkToCipher,
  cipherToBookmark,
  isBookmarkCipher,
  matchesSearch,
  normalizeUrl,
  parseTags,
  TAGS_FIELD,
} from "./bookmark";

const bookmark: Bookmark = {
  title: "Example",
  url: "https://example.com/page",
  folderId: "folder-1",
  tags: ["work", "reading"],
  notes: "Read later",
  favorite: true,
};

describe("bookmark mapping", () => {
  it("stores a bookmark as a login item that can never autofill", () => {
    const cipher = bookmarkToCipher(bookmark);
    expect(cipher.type).toBe(CipherType.Login);
    expect(cipher.name).toBe("Example");
    expect(cipher.login.uris).toHaveLength(1);
    expect(cipher.login.uris[0].uri).toBe("https://example.com/page");
    expect(cipher.login.uris[0].match).toBe(UriMatchStrategy.Never);
    expect(cipher.login.username).toBeUndefined();
    expect(cipher.login.password).toBeUndefined();
    expect(cipher.folderId).toBe("folder-1");
    expect(cipher.notes).toBe("Read later");
    expect(cipher.favorite).toBe(true);
    expect(cipher.fields).toHaveLength(1);
    expect(cipher.fields[0]).toMatchObject({
      name: TAGS_FIELD,
      value: "work, reading",
      type: FieldType.Text,
    });
  });

  it("round-trips through a cipher", () => {
    expect(cipherToBookmark(bookmarkToCipher(bookmark))).toMatchObject(bookmark);
  });

  it("omits empty notes, folder and tags", () => {
    const cipher = bookmarkToCipher({ ...bookmark, notes: " ", folderId: null, tags: [] });
    expect(cipher.notes).toBeUndefined();
    expect(cipher.folderId).toBeUndefined();
    expect(cipher.fields).toEqual([]);
  });

  it("uses the URL as the title when the title is blank", () => {
    expect(bookmarkToCipher({ ...bookmark, title: "  " }).name).toBe(bookmark.url);
  });

  it("keeps unrelated data on an existing item and never modifies the original", () => {
    const existing = bookmarkToCipher(bookmark);
    existing.id = "cipher-1";
    const other = new FieldView();
    other.name = "added elsewhere";
    other.value = "keep me";
    existing.fields = [...existing.fields, other];

    const updated = bookmarkToCipher({ ...bookmark, title: "Renamed", tags: ["new"] }, existing);

    expect(updated.id).toBe("cipher-1");
    expect(updated.name).toBe("Renamed");
    expect(updated.fields.map((f) => f.name)).toEqual(["added elsewhere", TAGS_FIELD]);
    expect(existing.name).toBe("Example");
    expect(existing.fields.find((f) => f.name === TAGS_FIELD)?.value).toBe("work, reading");
    expect(existing.login).not.toBe(updated.login);
  });

  it("only treats live, readable login items as bookmarks", () => {
    const login = bookmarkToCipher(bookmark);
    expect(isBookmarkCipher(login)).toBe(true);

    const note = new CipherView();
    note.type = CipherType.SecureNote;
    expect(isBookmarkCipher(note)).toBe(false);

    const trashed = bookmarkToCipher(bookmark);
    trashed.deletedDate = new Date();
    expect(isBookmarkCipher(trashed)).toBe(false);

    const unreadable = bookmarkToCipher(bookmark);
    unreadable.decryptionFailure = true;
    expect(isBookmarkCipher(unreadable)).toBe(false);
  });
});

describe("parseTags", () => {
  it("trims, drops empties and '#', and de-duplicates ignoring case", () => {
    expect(parseTags(" work, #Reading,, reading , Work,x ")).toEqual(["work", "Reading", "x"]);
  });
});

describe("normalizeUrl", () => {
  it("adds https to bare domains and leaves full URLs alone", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl(" http://example.com ")).toBe("http://example.com");
    expect(normalizeUrl("chrome://settings")).toBe("chrome://settings");
    expect(normalizeUrl("")).toBe("");
  });
});

describe("matchesSearch", () => {
  it("matches every term against title, URL, notes, folder and tags", () => {
    expect(matchesSearch(bookmark, "")).toBe(true);
    expect(matchesSearch(bookmark, "EXAMPLE later")).toBe(true);
    expect(matchesSearch(bookmark, "recipes", "Recipes")).toBe(true);
    expect(matchesSearch(bookmark, "example missing")).toBe(false);
  });

  it("treats #terms as tag filters", () => {
    expect(matchesSearch(bookmark, "#read")).toBe(true);
    expect(matchesSearch(bookmark, "#example")).toBe(false);
  });
});
