// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const message = { title: "GeoWatch", body: "", url: "/", image: null };
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (typeof parsed === "string") {
        message.body = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (typeof parsed.title === "string") message.title = parsed.title;
        if (typeof parsed.body === "string") message.body = parsed.body;
        // Chemin du site seulement : « //hôte » ou « /\hôte » mèneraient ailleurs.
        if (typeof parsed.url === "string" && /^\/(?![/\\])/.test(parsed.url)) message.url = parsed.url;
        if (typeof parsed.image === "string" && parsed.image.startsWith("https://")) message.image = parsed.image;
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
      data: { url: message.url },
    }),
  );
});

// Au clic : parmi les onglets contrôlés (navigate n'y fonctionne que là), celui qui a le focus, sinon le premier ;
// sans onglet, nouvelle fenêtre. Le focus passe avant la navigation, qui peut être lente : le navigateur
// n'autorise le focus que peu de temps après le clic.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const controlled = await self.clients.matchAll({ type: "window" });
      const client = controlled.find((w) => w.focused) ?? controlled[0];
      if (!client) return self.clients.openWindow(url.href);
      try {
        await client.focus();
      } catch {
        // Ignoré : un échec du focus ne doit jamais ouvrir un second onglet.
      }
      try {
        await client.navigate(url.href);
      } catch {
        return self.clients.openWindow(url.href);
      }
    })(),
  );
});
