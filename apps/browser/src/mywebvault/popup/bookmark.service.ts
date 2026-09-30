import { inject, Injectable } from "@angular/core";
import { combineLatest, filter, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ImportCiphersRequest } from "@bitwarden/common/models/request/import-ciphers.request";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRequest } from "@bitwarden/common/vault/models/request/cipher.request";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KeyService } from "@bitwarden/key-management";

import {
  Bookmark,
  bookmarkToCipher,
  cipherToBookmark,
  isBookmarkCipher,
  normalizeUrl,
} from "../bookmarks/bookmark";
import {
  BrowserBookmark,
  FOLDER_SEPARATOR,
  folderNameForPath,
} from "../bookmarks/browser-bookmarks";

/** Items per import request; keeps each request well under the server's size limits. */
export const IMPORT_BATCH_SIZE = 250;

export interface ImportSummary {
  imported: number;
  skippedDuplicates: number;
  foldersCreated: number;
}

/**
 * Bookmarks on top of the Bitwarden vault. Encryption, storage and sync are all done by the
 * existing vault services; this class only translates between bookmarks and vault items.
 */
@Injectable({ providedIn: "root" })
export class BookmarkService {
  private accountService = inject(AccountService);
  private apiService = inject(ApiService);
  private cipherService = inject(CipherService);
  private folderApiService = inject(FolderApiServiceAbstraction);
  private folderService = inject(FolderService);
  private keyService = inject(KeyService);
  private syncService = inject(SyncService);

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  /** All bookmarks, sorted by title. */
  readonly bookmarks$: Observable<Bookmark[]> = this.userId$.pipe(
    switchMap((userId) => this.cipherService.cipherViews$(userId)),
    // Emits null while the vault is still decrypting.
    filter((ciphers): ciphers is CipherView[] => ciphers != null),
    map((ciphers) =>
      ciphers
        .filter(isBookmarkCipher)
        .map(cipherToBookmark)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })),
    ),
  );

  /** The user's folders, sorted by name (the vault's "No folder" placeholder is excluded). */
  readonly folders$: Observable<FolderView[]> = this.userId$.pipe(
    switchMap((userId) => this.folderService.folderViews$(userId)),
    map((folders) =>
      (folders ?? [])
        .filter((f) => !!f.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    ),
  );

  /** Every tag in use, sorted. */
  readonly tags$: Observable<string[]> = this.bookmarks$.pipe(
    map((bookmarks) => {
      const byKey = new Map<string, string>();
      for (const tag of bookmarks.flatMap((b) => b.tags)) {
        byKey.set(tag.toLowerCase(), byKey.get(tag.toLowerCase()) ?? tag);
      }
      return [...byKey.values()].sort((a, b) => a.localeCompare(b));
    }),
  );

  readonly bookmarksWithFolders$ = combineLatest([this.bookmarks$, this.folders$]);

  async get(id: string): Promise<Bookmark | undefined> {
    const userId = await firstValueFrom(this.userId$);
    const cipher = await firstValueFrom(this.cipherService.cipherView$(userId, id as CipherId));
    return cipher && isBookmarkCipher(cipher) ? cipherToBookmark(cipher) : undefined;
  }

  async save(bookmark: Bookmark): Promise<void> {
    const userId = await firstValueFrom(this.userId$);
    if (!bookmark.id) {
      await this.cipherService.createWithServer(bookmarkToCipher(bookmark), userId);
      return;
    }
    const original = await firstValueFrom(
      this.cipherService.cipherView$(userId, bookmark.id as CipherId),
    );
    if (!original) {
      throw new Error("Bookmark not found");
    }
    await this.cipherService.updateWithServer(
      bookmarkToCipher(bookmark, original),
      userId,
      original,
    );
  }

  async delete(id: string): Promise<void> {
    const userId = await firstValueFrom(this.userId$);
    await this.cipherService.deleteWithServer(id, userId);
  }

  /** Creates a folder and returns its id. */
  async createFolder(name: string): Promise<string> {
    const userId = await firstValueFrom(this.userId$);
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("Vault is locked");
    }
    const view = new FolderView();
    view.name = name.trim();
    const saved = await this.folderApiService.save(
      await this.folderService.encrypt(view, userKey),
      userId,
    );
    return saved.id;
  }

  /**
   * Imports browser bookmarks. Bookmarks whose URL is already saved are skipped, so importing
   * twice doesn't create duplicates. Folders are matched by name and created when missing.
   */
  async importFromBrowser(
    items: BrowserBookmark[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportSummary> {
    const userId = await firstValueFrom(this.userId$);
    const [existing, folders] = await firstValueFrom(this.bookmarksWithFolders$);

    const savedUrls = new Set(existing.map((b) => normalizeUrl(b.url)));
    const toImport: BrowserBookmark[] = [];
    for (const item of items) {
      const url = normalizeUrl(item.url);
      if (!savedUrls.has(url)) {
        savedUrls.add(url);
        toImport.push(item);
      }
    }

    // Create missing folders, parents first, so nested folders display as a tree.
    const folderIds = new Map(folders.map((f) => [f.name, f.id]));
    let foldersCreated = 0;
    const wanted = new Set<string>();
    for (const item of toImport) {
      for (let depth = 1; depth <= item.folderPath.length; depth++) {
        wanted.add(item.folderPath.slice(0, depth).join(FOLDER_SEPARATOR));
      }
    }
    for (const name of [...wanted].sort()) {
      if (!folderIds.has(name)) {
        folderIds.set(name, await this.createFolder(name));
        foldersCreated++;
      }
    }

    const ciphers = toImport.map((item) => {
      const folderName = folderNameForPath(item.folderPath);
      return bookmarkToCipher({
        title: item.title,
        url: item.url,
        folderId: folderName ? (folderIds.get(folderName) ?? null) : null,
        tags: [],
        notes: "",
        favorite: false,
      });
    });

    for (let start = 0; start < ciphers.length; start += IMPORT_BATCH_SIZE) {
      const batch = ciphers.slice(start, start + IMPORT_BATCH_SIZE);
      const request = new ImportCiphersRequest();
      request.ciphers = (await this.cipherService.encryptMany(batch, userId)).map(
        (context) => new CipherRequest(context),
      );
      await this.apiService.send("POST", "/ciphers/import", request, true, false);
      onProgress?.(Math.min(start + batch.length, ciphers.length), ciphers.length);
    }

    if (ciphers.length > 0) {
      await this.syncService.fullSync(true);
    }
    return {
      imported: ciphers.length,
      skippedDuplicates: items.length - toImport.length,
      foldersCreated,
    };
  }
}
