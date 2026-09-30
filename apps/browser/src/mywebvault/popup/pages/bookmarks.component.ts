import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { combineLatest, map, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BadgeModule,
  ButtonModule,
  IconButtonModule,
  ItemModule,
  SearchModule,
  SelectModule,
  StatusLockupComponent,
} from "@bitwarden/components";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { Bookmark, matchesSearch } from "../../bookmarks/bookmark";
import { takePendingSave } from "../../pending-save";
import { BookmarkService } from "../bookmark.service";

/** Folder filter values besides a folder id. */
const ALL = "all";
const NO_FOLDER = "none";

@Component({
  selector: "mwv-bookmarks",
  templateUrl: "./bookmarks.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    ItemModule,
    ButtonModule,
    IconButtonModule,
    BadgeModule,
    SearchModule,
    SelectModule,
    StatusLockupComponent,
  ],
})
export class BookmarksComponent implements OnInit {
  private readonly bookmarkService = inject(BookmarkService);
  private readonly router = inject(Router);

  protected readonly ALL = ALL;
  protected readonly NO_FOLDER = NO_FOLDER;

  protected readonly search = new FormControl("", { nonNullable: true });
  protected readonly folderFilter = new FormControl<string>(ALL, { nonNullable: true });

  protected readonly folders$ = this.bookmarkService.folders$;

  protected readonly view$ = combineLatest([
    this.bookmarkService.bookmarksWithFolders$,
    this.search.valueChanges.pipe(startWith(this.search.value)),
    this.folderFilter.valueChanges.pipe(startWith(this.folderFilter.value)),
  ]).pipe(
    map(([[bookmarks, folders], query, folder]) => {
      const folderNames = new Map(folders.map((f) => [f.id, f.name]));
      const shown = bookmarks.filter(
        (b) =>
          (folder === ALL || (folder === NO_FOLDER ? !b.folderId : b.folderId === folder)) &&
          matchesSearch(b, query, b.folderId ? folderNames.get(b.folderId) : undefined),
      );
      return { total: bookmarks.length, shown, folderNames };
    }),
  );

  async ngOnInit() {
    // Opened from the right-click menu: go straight to the save form for that page.
    const pending = await takePendingSave();
    if (pending) {
      await this.router.navigate(["/bookmark"], { queryParams: pending });
    }
  }

  protected filterByTag(tag: string) {
    this.search.setValue(`#${tag}`);
  }

  /** Opens the form pre-filled with the current tab. */
  protected async saveCurrentTab() {
    const tab = await BrowserApi.getTabFromCurrentWindow();
    await this.router.navigate(["/bookmark"], {
      queryParams: { url: tab?.url ?? "", title: tab?.title ?? "" },
    });
  }

  protected async edit(bookmark: Bookmark) {
    await this.router.navigate(["/bookmark"], { queryParams: { id: bookmark.id } });
  }

  protected async open(bookmark: Bookmark) {
    await BrowserApi.createNewTab(bookmark.url);
    if (!BrowserPopupUtils.inPopout(window)) {
      BrowserApi.closePopup(window);
    }
  }

  /** Chrome's local favicon cache (`_favicon`) doesn't exist in Firefox or Safari; hide the gap. */
  protected hideFavicon(event: Event) {
    (event.target as HTMLImageElement).style.visibility = "hidden";
  }

  protected faviconUrl(url: string): string {
    return BrowserApi.getRuntimeURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  }

  protected hostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}
