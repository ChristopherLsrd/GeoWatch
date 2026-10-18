"use client";

import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

// Fenêtre modale avec le lecteur YouTube. Montée seulement quand elle est ouverte : à la fermeture
// l'iframe est démonté, ce qui arrête la lecture.
export function TrailerDialog({ youtubeKey, name, onClose }: { youtubeKey: string; name: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="trailer-dialog"
      aria-label={name}
      // Échap (natif) ferme la boîte et déclenche « close ».
      onClose={onClose}
      // Un clic sur le fond (le <dialog> lui-même, pas son contenu) ferme la fenêtre.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="trailer-frame">
        <button type="button" className="trailer-close" aria-label="Fermer" onClick={onClose}>
          <XMarkIcon aria-hidden="true" />
        </button>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0`}
          title={name}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </dialog>
  );
}
