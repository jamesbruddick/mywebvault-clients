import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

/**
 * A bookmark as the myWebVault UI sees it.
 *
 * Storage (the brief's "Option 1"): each bookmark is a Bitwarden Login item, so it is encrypted and
 * synced by the existing, unmodified vault code and works with any Bitwarden-compatible server.
 * This file is the only place that knows the mapping, so moving to a dedicated Bookmark item type
 * later only changes these two functions.
 *
 *   title    -> cipher name
 *   url      -> first login URI (match strategy "Never", so nothing can ever autofill from it)
 *   folderId -> cipher folder
 *   tags     -> custom text field named TAGS_FIELD, comma-separated
 *   notes    -> cipher notes
 *   favorite -> cipher favorite
 */
export interface Bookmark {
  id?: string;
  title: string;
  url: string;
  folderId: string | null;
  tags: string[];
  notes: string;
  favorite: boolean;
  created?: Date;
  updated?: Date;
}

export const TAGS_FIELD = "mywebvault:tags";

/** Splits user input ("work, reading,  Recipes") into clean, de-duplicated tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim().replace(/^#/, "");
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

/** Adds a scheme when the user typed a bare domain ("example.com" -> "https://example.com"). */
export function normalizeUrl(input: string): string {
  const url = input.trim();
  if (url === "" || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

export function isBookmarkCipher(cipher: CipherView): boolean {
  return cipher.type === CipherType.Login && !cipher.isDeleted && !cipher.decryptionFailure;
}

export function cipherToBookmark(cipher: CipherView): Bookmark {
  const tagsField = cipher.fields?.find((f) => f.name === TAGS_FIELD);
  return {
    id: cipher.id,
    title: cipher.name ?? "",
    url: cipher.login?.uris?.[0]?.uri ?? "",
    folderId: cipher.folderId ?? null,
    tags: parseTags(tagsField?.value ?? ""),
    notes: cipher.notes ?? "",
    favorite: cipher.favorite,
    created: cipher.creationDate,
    updated: cipher.revisionDate,
  };
}

/**
 * Returns a cipher holding the bookmark. Pass the existing cipher when editing so fields this app
 * doesn't manage (e.g. data saved by another Bitwarden client) are preserved. The existing cipher is
 * copied, never modified: it is the cached original the vault compares against when saving.
 */
export function bookmarkToCipher(bookmark: Bookmark, existing?: CipherView): CipherView {
  const cipher = existing ? Object.assign(new CipherView(), existing) : new CipherView();
  cipher.type = CipherType.Login;
  cipher.name = bookmark.title.trim() || bookmark.url;
  cipher.notes = bookmark.notes.trim() || undefined;
  cipher.folderId = bookmark.folderId || undefined;
  cipher.favorite = bookmark.favorite;

  cipher.login = Object.assign(new LoginView(), existing?.login);
  const uri = new LoginUriView();
  uri.uri = normalizeUrl(bookmark.url);
  uri.match = UriMatchStrategy.Never;
  cipher.login.uris = [uri];

  const otherFields = (cipher.fields ?? []).filter((f) => f.name !== TAGS_FIELD);
  if (bookmark.tags.length > 0) {
    const tagsField = new FieldView();
    tagsField.type = FieldType.Text;
    tagsField.name = TAGS_FIELD;
    tagsField.value = bookmark.tags.join(", ");
    otherFields.push(tagsField);
  }
  cipher.fields = otherFields;
  return cipher;
}

/** Case-insensitive match on title, URL, tags and notes. `#tag` terms only match tags. */
export function matchesSearch(bookmark: Bookmark, query: string, folderName?: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tags = bookmark.tags.map((t) => t.toLowerCase());
  const haystack = [
    bookmark.title,
    bookmark.url,
    bookmark.notes,
    folderName ?? "",
    ...bookmark.tags,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) =>
    term.startsWith("#") ? tags.some((t) => t.startsWith(term.slice(1))) : haystack.includes(term),
  );
}
