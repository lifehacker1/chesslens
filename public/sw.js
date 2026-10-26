const PREFIX = `chesslens-${self.registration.scope}-`;
const CACHE = `${PREFIX}v13`;
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
        "./engine/lozza/lozzaNNUE.js",
        "./engine/lozza/lozzaHCE.js",
        "./engine/lozza/LICENSE.txt",
        "./engine/lozza/manifest.json",
        "./manifest.webmanifest",
        "./icon.svg",
        "./icon-192.png",
        "./icon-512.png",
        ...assets,
      ]);
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
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
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
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
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
