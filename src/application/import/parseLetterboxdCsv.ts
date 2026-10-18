// Lecture de watchlist.csv, exporté de Letterboxd (Settings → Import & Export → Export your data).
// En-tête attendu : Date,Name,Year,Letterboxd URI (colonnes repérées par leur nom).
// Fonction pure, utilisée aussi dans le navigateur.

export type LetterboxdEntry = {
  name: string;
  year: number | null;
  // AAAA-MM-JJ : date d'ajout dans la watchlist Letterboxd.
  addedAt: string | null;
  letterboxdUri: string | null;
};

export const MAX_NAME_LENGTH = 300;

export class LetterboxdCsvError extends Error {}

// Découpe un CSV (RFC 4180) en lignes de champs : guillemets, virgules et guillemets doublés, CRLF ou LF.
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseLetterboxdCsv(text: string): { entries: LetterboxdEntry[]; skipped: number } {
  const rows = parseRows(text.replace(/^﻿/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const column = (name: string) => header.indexOf(name);
  const nameCol = column("name");
  if (nameCol === -1) throw new LetterboxdCsvError("Fichier non reconnu : colonne « Name » absente.");
  const yearCol = column("year");
  const dateCol = column("date");
  const uriCol = column("letterboxd uri");

  const entries: LetterboxdEntry[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === "")) continue;
    const cell = (index: number) => (index === -1 ? "" : (row[index] ?? "").trim());
    const name = cell(nameCol);
    if (!name || name.length > MAX_NAME_LENGTH) {
      skipped++;
      continue;
    }
    const year = /^\d{4}$/.test(cell(yearCol)) ? Number(cell(yearCol)) : null;
    const addedAt = /^\d{4}-\d{2}-\d{2}$/.test(cell(dateCol)) ? cell(dateCol) : null;
    const uri = cell(uriCol);
    entries.push({ name, year, addedAt, letterboxdUri: uri.startsWith("https://") ? uri : null });
  }
  return { entries, skipped };
}
