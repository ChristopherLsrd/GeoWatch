// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = { title: "GeoWatch", body: "", url: "/" };
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object" && typeof parsed.title === "string") message = parsed;
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

// Au clic : l'onglet qui a le focus (sinon le premier) est réutilisé ; si navigate échoue, on ouvre une nouvelle fenêtre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((w) => w.focused) ?? windows[0];
      if (client) {
        try {
          const navigated = await client.navigate(url);
          await (navigated ?? client).focus();
          return;
        } catch {
          // Onglet non contrôlé (navigate rejette) : on ouvre une nouvelle fenêtre.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
