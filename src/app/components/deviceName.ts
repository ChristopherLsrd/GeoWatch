// Nom lisible d'un appareil à partir du User-Agent : « Chrome · Android », « Edge · Windows ».
// L'ordre compte : Edge, Opera et Samsung Internet se déclarent aussi « Chrome » (CriOS, FxiOS et EdgiOS sont les versions iOS), Android aussi « Linux », iOS aussi « Mac OS X ».
export function deviceName(userAgent: string): string {
  const browser = /Edg\/|EdgA\/|EdgiOS\//.test(userAgent)
    ? "Edge"
    : /OPR\/|OPT\//.test(userAgent)
      ? "Opera"
      : /SamsungBrowser\//.test(userAgent)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(userAgent)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "Navigateur";
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return system ? `${browser} · ${system}` : browser;
}
