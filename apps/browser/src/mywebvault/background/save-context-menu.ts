import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { setPendingSave, takePendingSave } from "../pending-save";

const SAVE_PAGE_ID = "mywebvault-save-page";
const SAVE_LINK_ID = "mywebvault-save-link";

function create(properties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve) =>
    chrome.contextMenus.create(properties, () => {
      // Reading lastError marks it handled; the item already existing is fine.
      void chrome.runtime.lastError;
      resolve();
    }),
  );
}

/**
 * Adds "Save page to myWebVault" and "Save link to myWebVault" to the right-click menu. Called
 * whenever the background rebuilds the menu, because the rebuild removes all items first.
 */
export async function createSaveContextMenu(i18nService: I18nService): Promise<void> {
  if (!chrome.contextMenus) {
    return;
  }
  await create({
    id: SAVE_PAGE_ID,
    title: i18nService.t("saveToMyWebVault"),
    contexts: ["page"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  });
  await create({
    id: SAVE_LINK_ID,
    title: i18nService.t("saveLinkToMyWebVault"),
    contexts: ["link"],
    targetUrlPatterns: ["http://*/*", "https://*/*"],
  });
}

/**
 * Handles clicks on the save items: the page (or link) is handed to the popup, which opens on the
 * "Save bookmark" form. Saving happens in the popup so the user can unlock first and edit details.
 */
export function listenForSaveContextMenuClicks(): void {
  if (!chrome.contextMenus) {
    return;
  }
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SAVE_PAGE_ID && info.menuItemId !== SAVE_LINK_ID) {
      return;
    }
    const isLink = info.menuItemId === SAVE_LINK_ID;
    const url = isLink ? info.linkUrl : (info.pageUrl ?? tab?.url);
    if (!url) {
      return;
    }
    const title = isLink ? (info.selectionText ?? "") : (tab?.title ?? "");

    void setPendingSave({ url, title }).then(async () => {
      try {
        await chrome.action.openPopup();
      } catch {
        // No focused window to anchor the popup to: open the save form in a tab instead.
        await takePendingSave();
        const query = new URLSearchParams({ url, title }).toString();
        await BrowserApi.createNewTab(
          BrowserApi.getRuntimeURL(`popup/index.html?uilocation=tab#/bookmark?${query}`),
        );
      }
    });
  });
}
