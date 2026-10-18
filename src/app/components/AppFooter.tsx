export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>
        Données : <a href="https://www.justwatch.com/fr" target="_blank" rel="noopener noreferrer">JustWatch</a>
      </span>
      <span className="app-footer-tmdb">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tmdb-logo.svg" alt="TMDB" height={12} />
        </a>
        <span>Ce produit utilise l&apos;API TMDB, sans être approuvé ni certifié par TMDB.</span>
      </span>
      <span>
        Drapeaux : <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener noreferrer">Twemoji</a> (CC BY 4.0)
      </span>
      <span>Code sous licence MIT</span>
    </footer>
  );
}
