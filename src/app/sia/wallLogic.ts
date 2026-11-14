// SIA: validation of wall announcements. Pure logic, no imports (unit-tested).
const MAX_TEXT_LENGTH = 280;
const MAX_FIELD_LENGTH = 60;
export const MAX_ANNONCE_LIFETIME_MS = 24 * 3600 * 1000;

export type AnnonceFields = {
  role: 'prestataire' | 'client';
  pseudo: string;
  categorie: string;
  zone: string;
  texte: string;
  fin: number;
};

export const cleanText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * Reads untrusted announcement content. `sentAt` is the server timestamp of the event.
 * Returns undefined when invalid or over. An announcement never lives more than 24 h after `sentAt`.
 */
export function annonceFromContent(
  content: unknown,
  sentAt: number,
  now: number
): AnnonceFields | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const data = content as Record<string, unknown>;
  if (data.role !== 'prestataire' && data.role !== 'client') return undefined;
  if (typeof data.fin !== 'number' || !Number.isFinite(data.fin)) return undefined;
  const fin = Math.min(data.fin, sentAt + MAX_ANNONCE_LIFETIME_MS);
  if (fin <= now) return undefined;
  const texte = cleanText(data.texte, MAX_TEXT_LENGTH);
  if (!texte) return undefined;
  return {
    role: data.role,
    pseudo: cleanText(data.pseudo, MAX_FIELD_LENGTH) || 'Anonyme',
    categorie: cleanText(data.categorie, MAX_FIELD_LENGTH),
    zone: cleanText(data.zone, MAX_FIELD_LENGTH),
    texte,
    fin,
  };
}

export function formatRemaining(fin: number, now: number): string {
  const minutes = Math.max(0, Math.round((fin - now) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}
