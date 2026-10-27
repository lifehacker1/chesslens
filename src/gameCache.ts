const KEY = "chesslens-games-v1";
const LIMIT = 1_500_000; // UTF-16 characters: about 3 MB, leaving room for preferences.
type Entry = { savedAt: number; data: unknown };
type Cache = Record<string, Entry>;
function read(): Cache {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) =>
          v &&
          typeof v === "object" &&
          Number.isFinite((v as Entry).savedAt) &&
          "data" in v,
      ),
    ) as Cache;
  } catch {
    return {};
  }
}
export function cached<T>(
  key: string,
): { savedAt: number; data: T } | undefined {
  return read()[key] as { savedAt: number; data: T } | undefined;
}
export function saveCached(key: string, data: unknown): boolean {
  const entries = read();
  entries[key] = { savedAt: Date.now(), data };
  const oldest = Object.keys(entries)
    .filter((k) => k !== key)
    .sort((a, b) => entries[a].savedAt - entries[b].savedAt);
  while (true) {
    const json = JSON.stringify(entries);
    if (json.length <= LIMIT) {
      try {
        localStorage.setItem(KEY, json);
        return true;
      } catch {
        /* Evict our own oldest data and retry; never touch other storage. */
      }
    }
    const next = oldest.shift();
    if (!next) return false;
    delete entries[next];
  }
}
export function clearGameCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
export async function cachedRequest<T>(
  key: string,
  load: () => Promise<T>,
  refresh = false,
): Promise<T> {
  const entry = cached<T>(key);
  if (!refresh && entry && Date.now() - entry.savedAt < 15 * 60 * 1000)
    return entry.data;
  try {
    const data = await load();
    saveCached(key, data);
    return data;
  } catch (error) {
    if (entry && !refresh) return entry.data;
    throw error;
  }
}
