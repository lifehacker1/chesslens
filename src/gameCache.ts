const KEY = "chesslens-games-v1";
const LIMIT = 1_500_000; // UTF-16 characters: about 3 MB, leaving room for preferences.
type Entry = { savedAt: number; data: unknown };
type Cache = Record<string, Entry>;
let previousRaw: string | null = null;
let previousCache: Cache = {};
function read(): Cache {
  try {
    const raw = localStorage.getItem(KEY) || "{}";
    if (raw === previousRaw) return { ...previousCache };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    previousCache = Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) =>
          v &&
          typeof v === "object" &&
          Number.isFinite((v as Entry).savedAt) &&
          "data" in v,
      ),
    ) as Cache;
    previousRaw = raw;
    return { ...previousCache };
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
        previousRaw = json;
        previousCache = entries;
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
  previousRaw = null;
  previousCache = {};
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
