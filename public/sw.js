// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = { title: "GeoWatch", body: "", url: "/" };
  if (event.data) {
    try {
      message = event.data.json();
    } catch {
      message = { title: "GeoWatch", body: event.data.text(), url: "/" };
    }
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: message.image || "/icons/192",
      lang: "fr",
      data: { url: message.url || "/" },
    }),
  );
});

// Au clic : un onglet GeoWatch contrôlé par le service worker est réutilisé (navigate n'y fonctionne que là), sinon on en ouvre un.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const [existing] = await self.clients.matchAll({ type: "window" });
      if (existing) {
        await existing.navigate(url);
        await existing.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
