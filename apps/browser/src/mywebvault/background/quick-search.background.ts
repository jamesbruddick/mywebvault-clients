import { filter, firstValueFrom, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { cipherToBookmark, isBookmarkCipher } from "../bookmarks/bookmark";
import { toggleSearchOverlay } from "../content/search-overlay";
import {
  isOpenableUrl,
  OPEN_SEARCH_COMMAND,
  OpenRequest,
  QuickSearchBookmark,
  QuickSearchData,
  QuickSearchMessage,
} from "../search/quick-search";

export interface QuickSearchDependencies {
  accountService: AccountService;
  authService: AuthService;
  cipherService: CipherService;
  folderService: FolderService;
  logService: LogService;
}

const SEARCH_PAGE = "search/search.html";
const WINDOW_WIDTH = 680;
const WINDOW_HEIGHT = 480;
const DECRYPT_TIMEOUT_MS = 15_000;

/**
 * Registers the quick search hotkey and the messages its page sends. Must be called synchronously
 * when the service worker starts, so the hotkey that woke the worker isn't missed.
 */
export function registerQuickSearch(deps: QuickSearchDependencies): void {
  chrome.commands?.onCommand.addListener((command, tab) => {
    if (command === OPEN_SEARCH_COMMAND) {
      void openQuickSearch(tab).catch((e) => deps.logService.error(e));
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const command = message?.command;
    if (
      command !== QuickSearchMessage.GetData &&
      command !== QuickSearchMessage.Open &&
      command !== QuickSearchMessage.Unlock
    ) {
      return false;
    }
    // Decrypted bookmarks only go to this extension's own pages, never to content scripts or
    // anything running in a web page.
    if (!isOwnExtensionPage(sender)) {
      return false;
    }
    void handleMessage(deps, message, sender)
      .then(sendResponse)
      .catch((e) => {
        deps.logService.error(e);
        sendResponse(null);
      });
    return true;
  });
}

function isOwnExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && (sender.url ?? "").startsWith("chrome-extension://");
}

async function handleMessage(
  deps: QuickSearchDependencies,
  message: { command: string },
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.command) {
    case QuickSearchMessage.GetData:
      return getSearchData(deps);
    case QuickSearchMessage.Open:
      await openBookmark(message as OpenRequest, sender);
      return true;
    case QuickSearchMessage.Unlock:
      await openPopup();
      return true;
  }
  return null;
}

async function getSearchData(deps: QuickSearchDependencies): Promise<QuickSearchData> {
  const account = await firstValueFrom(deps.accountService.activeAccount$);
  if (!account) {
    return { state: "loggedOut" };
  }
  const status = await firstValueFrom(deps.authService.authStatusFor$(account.id));
  if (status === AuthenticationStatus.Locked) {
    return { state: "locked" };
  }
  if (status !== AuthenticationStatus.Unlocked) {
    return { state: "loggedOut" };
  }

  const ciphers = await firstValueFrom(
    deps.cipherService.cipherViews$(account.id).pipe(
      filter((c): c is CipherView[] => c != null),
      timeout(DECRYPT_TIMEOUT_MS),
    ),
  );
  const folders = await firstValueFrom(deps.folderService.folderViews$(account.id));
  const folderNames = new Map((folders ?? []).map((f) => [f.id, f.name]));

  const bookmarks: QuickSearchBookmark[] = ciphers.filter(isBookmarkCipher).map((cipher) => {
    const b = cipherToBookmark(cipher);
    return {
      title: b.title,
      url: b.url,
      tags: b.tags,
      folder: b.folderId ? (folderNames.get(b.folderId) ?? null) : null,
      notes: b.notes,
      favorite: b.favorite,
      updated: b.updated?.getTime() ?? 0,
    };
  });
  return { state: "unlocked", bookmarks };
}

async function openBookmark(request: OpenRequest, sender: chrome.runtime.MessageSender) {
  if (!isOpenableUrl(request.url)) {
    return;
  }
  const targetTabId = request.tabId ?? sender.tab?.id;
  if (request.disposition === "currentTab" && targetTabId != null) {
    await chrome.tabs.update(targetTabId, { url: request.url, active: true });
    return;
  }
  const origin =
    targetTabId != null ? await chrome.tabs.get(targetTabId).catch((): null => null) : null;
  await chrome.tabs.create({
    url: request.url,
    active: true,
    ...(origin ? { windowId: origin.windowId, index: origin.index + 1 } : {}),
  });
}

async function openPopup(): Promise<void> {
  try {
    await chrome.action.openPopup();
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup/index.html?uilocation=tab") });
  }
}

/**
 * Shows the search over the current page. Pages extensions can't touch (chrome:// pages, the Web
 * Store, the new tab page) get a small centred window instead.
 */
async function openQuickSearch(tab?: chrome.tabs.Tab): Promise<void> {
  const pageUrl = chrome.runtime.getURL(SEARCH_PAGE);
  if (tab?.id != null) {
    try {
      // The hotkey grants temporary access to this tab (activeTab); nothing else is needed.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: toggleSearchOverlay,
        args: [pageUrl],
      });
      return;
    } catch {
      // Restricted page: fall through to a window.
    }
  }
  await openSearchWindow(pageUrl, tab);
}

async function openSearchWindow(pageUrl: string, tab?: chrome.tabs.Tab): Promise<void> {
  const current = await chrome.windows.getLastFocused().catch((): null => null);
  const left =
    current?.left != null && current.width != null
      ? Math.round(current.left + (current.width - WINDOW_WIDTH) / 2)
      : undefined;
  const top =
    current?.top != null && current.height != null
      ? Math.round(current.top + (current.height - WINDOW_HEIGHT) / 3)
      : undefined;
  const params = new URLSearchParams({ mode: "window" });
  if (tab?.id != null) {
    params.set("tab", String(tab.id));
  }
  await chrome.windows.create({
    url: `${pageUrl}?${params}`,
    type: "popup",
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    left,
    top,
    focused: true,
  });
}
