// Nom lisible d'un appareil à partir du User-Agent : « Chrome · Android », « Edge · Windows ».
// L'ordre compte : Edge et Samsung Internet se déclarent aussi « Chrome », Android aussi « Linux », iOS aussi « Mac OS X ».
export function deviceName(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /SamsungBrowser\//.test(userAgent)
      ? "Samsung Internet"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
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
