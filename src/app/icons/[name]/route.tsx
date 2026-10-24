// Icônes PNG de l'application installée, dessinées au build à partir de src/app/icon.svg.
// Chrome exige du PNG en 192 et 512 px ; la variante « maskable » garde une marge pour le découpage rond d'Android.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ICONS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const;

// Ambre du fond de icon.svg : remplit toute la surface de la variante maskable.
const AMBER = "#F0B04F";
// Zone sûre d'une icône maskable : le cercle central de 80 %.
const SAFE_ZONE = 0.8;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const icon = ICONS[name as keyof typeof ICONS];
  if (!icon) return new Response(null, { status: 404 });

  const svg = readFileSync(join(process.cwd(), "src/app/icon.svg")).toString("base64");
  const inner = icon.maskable ? Math.round(icon.size * SAFE_ZONE) : icon.size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: icon.maskable ? AMBER : "transparent",
        }}
      >
        <img src={`data:image/svg+xml;base64,${svg}`} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
