import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BitwardenIcon, IconModule, ItemModule } from "@bitwarden/components";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { OPEN_SEARCH_COMMAND } from "../../search/quick-search";

/** Settings for myWebVault: only the pages that apply to a bookmark manager. */
@Component({
  selector: "mwv-settings",
  templateUrl: "./mywebvault-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    JslibModule,
    IconModule,
    ItemModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
  ],
})
export class MyWebVaultSettingsComponent implements OnInit {
  /** The quick search hotkey as the user has it set, e.g. "⌘⇧K". */
  protected readonly shortcut = signal("");

  protected readonly links: { route: string; icon: BitwardenIcon; label: string; id: string }[] = [
    {
      route: "/account-security",
      icon: "bwi-lock",
      label: "accountSecurity",
      id: "account-security",
    },
    { route: "/folders", icon: "bwi-folder", label: "folders", id: "folders" },
    {
      route: "/import-bookmarks",
      icon: "bwi-download",
      label: "importBrowserBookmarks",
      id: "import",
    },
    { route: "/export", icon: "bwi-upload", label: "exportVault", id: "export" },
    { route: "/appearance", icon: "bwi-brush", label: "appearance", id: "appearance" },
    { route: "/about", icon: "bwi-info-circle", label: "about", id: "about" },
  ];

  async ngOnInit() {
    const commands = await chrome.commands.getAll();
    this.shortcut.set(commands.find((c) => c.name === OPEN_SEARCH_COMMAND)?.shortcut ?? "");
  }

  /** Chrome only lets users change extension shortcuts on its own settings page. */
  protected async openShortcutSettings() {
    await BrowserApi.createNewTab("chrome://extensions/shortcuts");
  }
}
