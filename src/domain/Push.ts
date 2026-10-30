// Abonnement Web Push d'un navigateur : un par appareil où l'utilisateur a activé les notifications.
export type PushSubscription = {
  // Adresse du service de push du navigateur ; sert d'identifiant.
  endpoint: string;
  keys: { p256dh: string; auth: string };
  // Nom lisible : « Chrome · Android ».
  device: string;
  createdAt: Date;
};

// Contenu d'une notification. url : chemin ouvert au clic (« /titre/tm1 ») ; image : affiche du titre.
export type PushMessage = { title: string; body: string; url: string; image?: string };
