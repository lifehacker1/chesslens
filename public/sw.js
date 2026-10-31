const PREFIX = `chesslens-${self.registration.scope}-`;
const CACHE = `${PREFIX}v26`;
const ENGINES = `${PREFIX}engines-v1`;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch("./", { cache: "reload" });
      if (!shell.ok) throw new Error("App shell unavailable");
      const html = await shell.clone().text();
      await cache.put("./", shell);
      const assets = [...new Set(html.match(/\.\/assets\/[^"'\s<>]+/g) || [])];
      await cache.addAll([
        "./engine/lozza/LICENSE.txt",
        "./engine/lozza/manifest.json",
        "./manifest.webmanifest",
        "./icon.svg",
        "./icon-192.png",
        "./icon-512.png",
        ...assets,
      ]);
      const engines = await caches.open(ENGINES);
      for (const path of [
        "./engine/lozza/lozzaNNUE.js",
        "./engine/lozza/lozzaHCE.js",
      ]) {
        if (!(await engines.match(path, { ignoreVary: true })))
          await engines.add(path);
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== ENGINES)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const engineCache = await caches.open(ENGINES);
      const downloaded = await engineCache.match(event.request, {
        ignoreVary: true,
      });
      if (downloaded) return downloaded;
      const isEngine = /\/engine\/.*\.(?:js|wasm|nnue)$/.test(
        new URL(event.request.url).pathname,
      );
      const cache = await caches.open(isEngine ? ENGINES : CACHE);
      if (isEngine) {
        const saved = await cache.match(event.request, { ignoreVary: true });
        if (saved) return saved;
      }
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          try {
            await cache.put(event.request, response.clone());
            if (isEngine) {
              const clients = await self.clients.matchAll();
              clients.forEach((client) =>
                client.postMessage({ type: "engine-saved" }),
              );
            }
          } catch {
            /* Storage limits must not prevent online analysis. */
          }
        }
        return response;
      } catch {
        return (
          // Static assets may carry Vary: Origin from the preview/static host.
          // Module-script requests add Origin while install-time fetches do not.
          (await cache.match(event.request, { ignoreVary: true })) ||
          (event.request.mode === "navigate"
            ? await cache.match("./")
            : undefined) ||
          Response.error()
        );
      }
    })(),
  );
});
