"use client";

import { useEffect, useRef, useState } from "react";

const MAX_POSTER_WIDTH = 420;
const MIN_POSTER_WIDTH = 120;
// En dessous de cet écart (px), on ne met pas à jour : évite les oscillations d'arrondi.
const TOLERANCE = 2;

// Largeur d'affiche (ratio 2:3) qui aligne son bas sur le bas du bloc d'infos : hauteur du bloc × 2/3,
// plafonnée à 420 px. Purement présentationnel : on mesure le bloc d'infos (pas la grille entière) et la
// valeur n'est utilisée que par la variable CSS `--pw`, ignorée en mobile par une media query.
export function useFitPosterWidth() {
  const infoRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = infoRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const fit = () => {
      // En mobile le bloc d'infos est en `display: contents` : hauteur 0, rien à mesurer.
      const next = Math.min(MAX_POSTER_WIDTH, Math.round((element.offsetHeight * 2) / 3));
      if (next <= MIN_POSTER_WIDTH) return;
      setWidth((current) => (current !== undefined && Math.abs(next - current) <= TOLERANCE ? current : next));
    };
    // Reporté à l'image suivante pour ne pas modifier la mise en page dans le callback de l'observateur.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(element);
    fit();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { infoRef, posterWidth: width };
}
