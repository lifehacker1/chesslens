import type { EngineConfig } from "./engine";
export function engineFiles(engine: EngineConfig) {
  if (engine.id === "stockfish-19-full")
    return [
      "./engine/stockfish-19-single.js",
      "./engine/stockfish-19-single.wasm",
    ];
  if (engine.id === "stockfish-19-lite")
    return [
      "./engine/stockfish-19-lite-single.js",
      "./engine/stockfish-19-lite-single.wasm",
    ];
  return [engine.url];
}
export function engineCacheName() {
  return `chesslens-${new URL("./", document.baseURI).href}-engines-v1`;
}
export async function isEngineDownloaded(engine: EngineConfig) {
  if (!("caches" in window)) return false;
  const cache = await caches.open(engineCacheName());
  const matches = await Promise.all(
    engineFiles(engine).map((path) =>
      cache.match(new URL(path, document.baseURI).href, { ignoreVary: true }),
    ),
  );
  return matches.every(Boolean);
}
export async function removeEngineDownload(engine: EngineConfig) {
  const cache = await caches.open(engineCacheName());
  await Promise.all(
    engineFiles(engine).map((path) =>
      cache.delete(new URL(path, document.baseURI).href, { ignoreVary: true }),
    ),
  );
}
export async function downloadEngine(
  engine: EngineConfig,
  signal: AbortSignal,
  progress?: (message: string) => void,
) {
  if (!("caches" in window))
    throw new Error(
      "Offline engine downloads need a secure browser with storage enabled.",
    );
  const cache = await caches.open(engineCacheName());
  let bytes = 0;
  let lastNotice = 0;
  for (const path of engineFiles(engine)) {
    if (signal.aborted)
      throw new DOMException("Download cancelled", "AbortError");
    const url = new URL(path, document.baseURI);
    if (url.origin !== location.origin)
      throw new Error("Engine downloads must be hosted on this site.");
    if (await cache.match(url.href, { ignoreVary: true })) continue;
    progress?.(`Downloading ${url.pathname.split("/").pop()}…`);
    const response = await fetch(url.href, { signal });
    if (
      !response.ok ||
      response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error(
        "Engine file is unavailable. Check the file path and try again.",
      );
    const stream = response.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength;
          if (Date.now() - lastNotice >= 250) {
            lastNotice = Date.now();
            progress?.(
              `Downloading · ${(bytes / 1000000).toFixed(1)} MB received`,
            );
          }
          controller.enqueue(chunk);
        },
      }),
    );
    await cache.put(
      url.href,
      stream
        ? new Response(stream, {
            status: response.status,
            headers: response.headers,
          })
        : response,
    );
  }
  window.dispatchEvent(new Event("chesslens-engine-download"));
  progress?.("Saved on this device · ready for offline analysis");
}
