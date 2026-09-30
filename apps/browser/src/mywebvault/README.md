# myWebVault (browser extension)

myWebVault is a bookmark manager built on the Bitwarden browser extension. Everything specific to
myWebVault lives in this folder; changes to Bitwarden's own files are kept small (a switch check or
one import) so upstream security fixes stay easy to merge.

## Layout

```
features.ts                  MYWEBVAULT_PASSWORD_FEATURES / BITWARDEN_ACCOUNT_FEATURES switches
theme.css                    Brand colours, logo colours, hides unsupported login options
pending-save.ts              Right-click menu -> popup handoff (session storage)
bookmarks/bookmark.ts        Bookmark <-> vault item mapping (the only place that knows it)
bookmarks/browser-bookmarks.ts  Flattens chrome.bookmarks trees for import
background/save-context-menu.ts "Save page/link to myWebVault" right-click items
background/quick-search.background.ts  Quick search hotkey + the data/open messages its page sends
content/search-overlay.ts    Injected on hotkey: adds/removes the full-page search iframe
search/quick-search.ts       Message types, ranking, URL checks (shared by page and background)
popup/quick-search/          The search page (plain DOM, no Angular) shown in the iframe or a window
popup/bookmark.service.ts    Bookmarks on top of Bitwarden's CipherService/FolderService
popup/routes.ts              Swaps Bitwarden's popup routes for the bookmark pages
popup/pages/                 Bookmarks list, add/edit form, import, settings, tab bar
```

Angular code must live under a `popup/` folder (ESLint forbids Angular imports elsewhere).

## Quick search (Ctrl/⌘+Shift+K)

The hotkey grants `activeTab`, so the background can inject `content/search-overlay.ts`, which adds
an iframe of `search/search.html` over the page. The page can't read inside the iframe. The search
page asks the background for the decrypted list; the background only answers this extension's own
pages. Pages extensions can't touch (chrome://, Web Store) get a small centred window instead.

## Storage

Bookmarks are Bitwarden Login items: title = name, URL = first URI (match "Never", so nothing ever
autofills), tags = custom field `mywebvault:tags`. Encryption and sync are Bitwarden's, unmodified.

## Where Bitwarden files were touched

| File                                                            | Change                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background/main.background.ts`                                 | Skip autofill (incl. overlay/tabs init), passkeys, phishing detection, HTTP auth, IPC content script, Bitwarden context menu; no-op live push; add ours |
| `background/runtime.background.ts`                              | Skip autofill injection, welcome page, default-password-manager prompt on install                                                                       |
| `popup/app-routing.module.ts`                                   | `applyMyWebVaultRoutes(routes)`                                                                                                                         |
| `popup/scss/index.ts`                                           | Load `theme.css`                                                                                                                                        |
| `auth/popup/login/extension-login-component.service.ts`         | No passkey login                                                                                                                                        |
| `auth/popup/settings/account-security.component.*`              | Hide biometrics, devices, two-step login, change password                                                                                               |
| `tools/popup/settings/about-page/about-page-v2.component.*`     | Hide Bitwarden help/web app/rate links                                                                                                                  |
| `tools/popup/settings/about-dialog/about-dialog.component.html` | Name + attribution                                                                                                                                      |
| `platform/badge/badge-browser-api.ts`                           | `webNavigation` optional; tabs without a readable URL still get the lock icon                                                                           |
| `manifest.v3.json`, `_locales/*`                                | Name, permissions, strings                                                                                                                              |
| `libs/assets/.../bitwarden-logo*.icon.ts`                       | myWebVault wordmark                                                                                                                                     |
| `libs/auth/.../input-password.component.ts`                     | Breach check off by default                                                                                                                             |
