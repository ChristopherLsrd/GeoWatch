// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const message = { title: "GeoWatch", body: "", url: "/", image: undefined };
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (typeof parsed === "string") {
        message.body = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (typeof parsed.title === "string") message.title = parsed.title;
        if (typeof parsed.body === "string") message.body = parsed.body;
        if (typeof parsed.url === "string" && parsed.url.startsWith("/")) message.url = parsed.url;
        if (typeof parsed.image === "string") message.image = parsed.image;
      }
    } catch {
      message.body = event.data.text();
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

// Au clic : parmi les onglets contrôlés (navigate n'y fonctionne que là), celui qui a le focus, sinon le premier ; sans onglet, nouvelle fenêtre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const controlled = await self.clients.matchAll({ type: "window" });
      const client = controlled.find((w) => w.focused) ?? controlled[0];
      if (!client) return self.clients.openWindow(url);
      let target;
      try {
        target = (await client.navigate(url)) ?? client;
      } catch {
        return self.clients.openWindow(url);
      }
      // Un échec du focus ne doit jamais ouvrir un second onglet.
      try {
        await target.focus();
      } catch {
        // Ignoré.
      }
    })(),
  );
});
