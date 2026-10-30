"use client";

import { useEffect, useState } from "react";
import { BellAlertIcon, CheckCircleIcon, DevicePhoneMobileIcon, InformationCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "./apiFetch";
import { deviceName } from "./deviceName";
import { currentPushSubscription, PushPermissionError, pushSupported, subscribeToPush, testResultText, type TestResult } from "./pushClient";

type Settings = { atHome: boolean; priceDrop: boolean };
type Device = { endpoint: string; device: string; createdAt: string };
type Support = "checking" | "ok" | "unsupported" | "denied";
type Status = { ok: boolean; text: string } | null;

const SWITCHES: { key: keyof Settings; label: string }[] = [
  { key: "atHome", label: "Arrivée sur une de mes plateformes" },
  { key: "priceDrop", label: "Baisse de prix" },
];

const JSON_HEADERS = { "Content-Type": "application/json" };
const DENIED_TEXT = "Les notifications sont bloquées pour GeoWatch dans ce navigateur. Autorisez-les dans les réglages du site, puis rechargez la page.";
const NOT_CONFIGURED = "Les notifications ne sont pas configurées sur le serveur.";

// Section « Notifications » des préférences : interrupteurs par type, appareils activés, notification de test.
export function NotificationsSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [support, setSupport] = useState<Support>("checking");
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [prefs, subs] = await Promise.all([
          apiFetch("/api/preferences", controller.signal),
          apiFetch("/api/push/subscriptions", controller.signal),
        ]);
        if (!prefs.ok || !subs.ok) throw new Error("load");
        const prefBody = (await prefs.json()) as { preferences: { notifications?: Settings } };
        const subBody = (await subs.json()) as { devices: Device[] };
        if (controller.signal.aborted) return;
        setSettings(prefBody.preferences.notifications ?? { atHome: true, priceDrop: true });
        setDevices(subBody.devices);
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      }
    })();
    if (!pushSupported()) {
      setSupport("unsupported");
    } else {
      setSupport(Notification.permission === "denied" ? "denied" : "ok");
      currentPushSubscription()
        .then((subscription) => setCurrentEndpoint(subscription?.endpoint ?? null))
        .catch(() => {});
    }
    return () => controller.abort();
  }, []);

  // Enregistré tout de suite ; l'interrupteur revient en arrière si l'enregistrement échoue. Les deux restent bloqués pendant l'enregistrement pour que deux PUT ne s'écrasent pas.
  async function toggle(key: keyof Settings, value: boolean) {
    if (!settings || saving) return;
    const previous = settings;
    setSaving(true);
    setSettings({ ...settings, [key]: value });
    setStatus(null);
    try {
      const response = await apiFetch("/api/preferences", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ notifications: { [key]: value } }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setSettings(previous);
      setStatus({ ok: false, text: "Impossible d'enregistrer le réglage." });
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    setBusy(true);
    setStatus(null);
    try {
      const keyResponse = await apiFetch("/api/push/key");
      if (keyResponse.status === 503) {
        setStatus({ ok: false, text: NOT_CONFIGURED });
        return;
      }
      if (!keyResponse.ok) throw new Error(String(keyResponse.status));
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const pushed = await subscribeToPush(publicKey);
      const subscription = pushed.subscription.toJSON();
      const response = await apiFetch("/api/push/subscriptions", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.keys, device: deviceName(navigator.userAgent) }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { device } = (await response.json()) as { device: Device };
      setDevices((list) => [...(list ?? []).filter((d) => d.endpoint !== device.endpoint), device]);
      setCurrentEndpoint(device.endpoint);
      if (pushed.replaced && pushed.replaced !== device.endpoint) {
        // Ancien abonnement (autre clé VAPID) : retiré du serveur, un échec est sans conséquence.
        const old = pushed.replaced;
        void apiFetch("/api/push/subscriptions", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ endpoint: old }) })
          .then((response) => {
            if (!response.ok) throw new Error(String(response.status));
            setDevices((list) => (list ?? []).filter((d) => d.endpoint !== old));
          })
          .catch((error) => console.error("Retrait de l'ancien abonnement impossible", error));
      }
      setStatus({ ok: true, text: "Notifications activées sur cet appareil" });
    } catch (error) {
      if (error instanceof PushPermissionError) {
        if (error.permission === "denied") setSupport("denied");
        else setStatus({ ok: false, text: "Autorisation non accordée." });
        return;
      }
      setStatus({ ok: false, text: "Impossible d'activer les notifications." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(endpoint: string) {
    setBusy(true);
    setStatus(null);
    try {
      // L'appareil courant est d'abord désabonné dans le navigateur : si le DELETE échoue,
      // le serveur retirera lui-même l'abonnement mort au prochain envoi (410).
      if (endpoint === currentEndpoint) {
        await (await currentPushSubscription())?.unsubscribe();
        // Le navigateur n'est plus abonné, quoi qu'il arrive ensuite.
        setCurrentEndpoint(null);
      }
      const response = await apiFetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setDevices((list) => (list ?? []).filter((d) => d.endpoint !== endpoint));
    } catch {
      setStatus({ ok: false, text: "Impossible de retirer l'appareil." });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    // Le test sert tous les appareils : il part même si celui-ci a bloqué les notifications.
    if (pushSupported() && Notification.permission === "denied") setSupport("denied");
    setBusy(true);
    setStatus(null);
    try {
      const response = await apiFetch("/api/push/test", { method: "POST" });
      if (response.status === 503) {
        setStatus({ ok: false, text: NOT_CONFIGURED });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const { results } = (await response.json()) as { results: TestResult[] };
      const result = testResultText(results);
      setStatus(result);
      // Les appareils expirés ont été retirés par le serveur.
      try {
        const list = await apiFetch("/api/push/subscriptions");
        if (list.ok) setDevices(((await list.json()) as { devices: Device[] }).devices);
      } catch {
        // Le résultat du test reste affiché ; la liste sera relue au prochain chargement.
      }
    } catch {
      setStatus({ ok: false, text: "Impossible d'envoyer la notification de test." });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="error">
        Impossible de charger les notifications.
      </p>
    );
  }
  if (!settings || !devices) return <p className="muted">Chargement…</p>;

  const activeHere = currentEndpoint !== null && devices.some((d) => d.endpoint === currentEndpoint);

  return (
    <section className="pref-form" aria-label="Notifications">
      <div className="pref-field">
        <span className="pref-icon">
          <BellAlertIcon aria-hidden="true" />
        </span>
        <span className="pref-label" id="notif-types-label">
          Me prévenir
        </span>
        <p className="pref-help">Après la vérification quotidienne de votre liste, chaque matin.</p>
        <div className="pref-switches" role="group" aria-labelledby="notif-types-label">
          {SWITCHES.map(({ key, label }) => (
            <label key={key} className="pref-switch">
              <input type="checkbox" checked={settings[key]} disabled={saving} onChange={(e) => void toggle(key, e.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="pref-field">
        <span className="pref-icon">
          <DevicePhoneMobileIcon aria-hidden="true" />
        </span>
        <span className="pref-label">Appareils</span>
        <p className="pref-help">Les navigateurs qui reçoivent les notifications.</p>
        <div>
          {devices.length > 0 && (
            <ul className="pref-devices">
              {devices.map((d) => (
                <li key={d.endpoint}>
                  <span>
                    {d.device}
                    {d.endpoint === currentEndpoint && <span className="muted"> · cet appareil</span>}
                  </span>
                  <button type="button" className="ghost ghost-danger" disabled={busy} onClick={() => void remove(d.endpoint)}>
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          {support === "unsupported" ? (
            <p className="pref-hint">
              <InformationCircleIcon aria-hidden="true" />
              <span>Ce navigateur ne gère pas les notifications push.</span>
            </p>
          ) : support === "denied" ? (
            <p className="pref-hint">
              <InformationCircleIcon aria-hidden="true" />
              <span>{DENIED_TEXT}</span>
            </p>
          ) : (
            support === "ok" &&
            !activeHere && (
              <button type="button" disabled={busy} onClick={() => void activate()}>
                Activer sur cet appareil
              </button>
            )
          )}
        </div>
      </div>
      {(devices.length > 0 || status) && (
        <div className="pref-foot">
          {devices.length > 0 && (
            <button type="button" className="pref-test" disabled={busy} onClick={() => void sendTest()}>
              <PaperAirplaneIcon aria-hidden="true" />
              Envoyer une notification de test
            </button>
          )}
          {status && (
            <p role={status.ok ? "status" : "alert"} className={status.ok ? "pref-saved" : "error"}>
              {status.ok && <CheckCircleIcon aria-hidden="true" />}
              {status.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
