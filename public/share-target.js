// Receives files shared to the installed app (Android share sheet → "A5 Notes").
// The share arrives as a POST to ./share-target; we park the files in a cache
// and redirect to the app, which picks them up on load (see src/incoming.ts).
// Loaded into the generated service worker via workbox.importScripts.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return;
  event.respondWith(
    (async () => {
      const app = new URL("./", self.registration.scope);
      try {
        const data = await event.request.formData();
        const files = data.getAll("file").filter((f) => typeof f !== "string");
        const cache = await caches.open("a5-shared-files");
        for (const key of await cache.keys()) await cache.delete(key);
        let i = 0;
        for (const file of files) {
          await cache.put(
            new URL(`shared-file/${i++}`, app).href,
            new Response(file, {
              headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
            }),
          );
        }
        app.searchParams.set("shared", String(files.length));
      } catch {
        app.searchParams.set("shared", "error");
      }
      return Response.redirect(app.href, 303);
    })(),
  );
});
