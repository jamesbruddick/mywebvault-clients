import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  ProgressBarComponent,
  TypographyModule,
} from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { flattenBookmarkTree } from "../../bookmarks/browser-bookmarks";
import { ImportSummary, BookmarkService } from "../bookmark.service";

type Step = "ready" | "importing" | "done" | "denied" | "failed";

/** Imports the browser's own bookmarks (Chrome/Edge bookmarks bar, other bookmarks, ...). */
@Component({
  selector: "mwv-import-bookmarks",
  templateUrl: "./import-bookmarks.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    ButtonModule,
    CalloutModule,
    ProgressBarComponent,
    TypographyModule,
    AsyncActionsModule,
  ],
})
export class ImportBookmarksComponent {
  private readonly bookmarkService = inject(BookmarkService);
  private readonly logService = inject(LogService);

  protected readonly step = signal<Step>("ready");
  protected readonly progress = signal(0);
  protected readonly summary = signal<ImportSummary | null>(null);

  readonly importBookmarks = async () => {
    // Asked for only now, when the user chooses to import, rather than at install.
    const granted = await BrowserApi.requestPermission({ permissions: ["bookmarks"] });
    if (!granted) {
      this.step.set("denied");
      return;
    }

    this.step.set("importing");
    this.progress.set(0);
    try {
      const items = flattenBookmarkTree(await chrome.bookmarks.getTree());
      const summary = await this.bookmarkService.importFromBrowser(items, (done, total) =>
        this.progress.set(Math.round((done / total) * 100)),
      );
      this.summary.set(summary);
      this.step.set("done");
    } catch (e) {
      this.logService.error(e);
      this.step.set("failed");
    }
  };
}
