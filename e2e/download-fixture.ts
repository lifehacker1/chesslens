import { type Page } from "@playwright/test";
export async function seedDownload(page: Page, username: string) {
  await page.goto("/");
  await page.evaluate(async (username) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chesslens-downloads", 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("collections", { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("collections", "readwrite");
      t.objectStore("collections").put({
        version: 1,
        id: username,
        username,
        archives: [],
        finished: [],
        state: "paused",
        analysis: "paused",
        updatedAt: Date.now(),
        error: "",
        skipped: 0,
      });
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
    db.close();
  }, username);
  await page.reload();
}
