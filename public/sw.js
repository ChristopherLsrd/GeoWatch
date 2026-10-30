// Service worker de GeoWatch : notifications push uniquement (pas de cache, pas de mode hors ligne).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Chemin d'une page du site, ou « / » si l'adresse mène ailleurs (« //hôte », « /\hôte », tabulations…) :
// on laisse le parseur d'URL trancher plutôt qu'une expression régulière.
function sitePath(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

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
        if (typeof parsed.url === "string") message.url = sitePath(parsed.url);
        if (typeof parsed.image === "string" && /^https?:\/\//.test(parsed.image)) message.image = parsed.image;
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
// n'autorise le focus que peu de temps après le clic. Jamais de second onglet si l'un est déjà au premier plan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(sitePath(String(event.notification.data?.url ?? "/")), self.location.origin);
  event.waitUntil(
    (async () => {
      const controlled = await self.clients.matchAll({ type: "window" });
      const client = controlled.find((w) => w.focused) ?? controlled[0];
      if (!client) return self.clients.openWindow(url.href);
      // Échecs ignorés : l'onglet existant reste où il est plutôt que d'en ouvrir un second.
      await client.focus().catch(() => {});
      await client.navigate(url.href).catch(() => {});
    })(),
  );
});
