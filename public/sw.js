// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : { title: "GeoWatch", body: "", url: "/" };
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: message.image || "/icons/192",
      lang: "fr",
      data: { url: message.url || "/" },
    }),
  );
});

// Au clic : un onglet GeoWatch déjà ouvert est réutilisé, sinon on en ouvre un.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        try {
          await existing.focus();
          await existing.navigate(url);
          return;
        } catch {
          // Onglet non contrôlé par le service worker : on en ouvre un nouveau.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
