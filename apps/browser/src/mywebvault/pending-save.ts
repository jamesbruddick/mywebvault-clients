/**
 * Hands a page from the right-click menu (background) to the popup's "Save bookmark" form.
 * Stored in session storage: memory-only, cleared when the browser closes, and read once.
 */
export interface PendingSave {
  url: string;
  title: string;
}

const KEY = "mywebvault.pendingSave";
const MAX_AGE_MS = 2 * 60 * 1000;

export async function setPendingSave(save: PendingSave): Promise<void> {
  await chrome.storage.session.set({ [KEY]: { ...save, at: Date.now() } });
}

/** Returns and clears the pending save, if one was set in the last two minutes. */
export async function takePendingSave(): Promise<PendingSave | null> {
  const stored = (await chrome.storage.session.get(KEY))[KEY] as
    (PendingSave & { at: number }) | undefined;
  if (!stored) {
    return null;
  }
  await chrome.storage.session.remove(KEY);
  return Date.now() - stored.at < MAX_AGE_MS ? { url: stored.url, title: stored.title } : null;
}
