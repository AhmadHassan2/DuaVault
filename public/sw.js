/* DuaVault service worker — app-shell caching + Web Share Target handling. */
const VERSION = "duavault-v1";
const SHELL = ["/home", "/library", "/add", "/practice", "/profile", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "duavault-share").map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => "focus" in c);
      if (existing) return existing.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Images shared from another app: stash them, then open the Add screen.
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const form = await event.request.formData();
        const cache = await caches.open("duavault-share");
        let i = 0;
        for (const file of form.getAll("images")) {
          if (file instanceof File && file.type.startsWith("image/")) {
            await cache.put(`/shared/${Date.now()}-${i++}`, new Response(file, { headers: { "content-type": file.type } }));
          }
        }
        return Response.redirect("/add?shared=1", 303);
      })(),
    );
    return;
  }

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Static assets & datasets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/data/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(event.request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network-first, fall back to cache when offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/home"))),
    );
  }
});
