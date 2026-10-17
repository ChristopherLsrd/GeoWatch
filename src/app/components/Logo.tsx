// Logo GeoWatch (geowatch-design/logo.svg, aussi utilisé comme favicon dans src/app/icon.svg) :
// un globe avec un bouton lecture, sur un carré ambre. Décoratif par défaut, le nom étant écrit à côté.
export function Logo({ size = 34, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <rect width="64" height="64" rx="16" fill="#F0B04F" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#1A1206" strokeWidth="3.5" />
      <ellipse cx="32" cy="32" rx="8.5" ry="19" fill="none" stroke="#1A1206" strokeWidth="3" />
      <path d="M14 26H50M14 38H50" stroke="#1A1206" strokeWidth="3" />
      <path d="M27 24.5 41 32 27 39.5Z" fill="#1A1206" stroke="#F0B04F" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}
