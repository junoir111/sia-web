// SIA: private profile stored in the user's Matrix account data.
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';

export const SIA_PROFILE_EVENT = 'io.sia.profile';

export type SiaRole = 'prestataire' | 'client';

export type SiaModalite = 'recoit' | 'deplace' | 'deux';

// What the provider picks at sign-up.
export const MODALITE_LABELS: Record<SiaModalite, string> = {
  deplace: 'Je me déplace',
  recoit: 'Je reçois à la maison',
  deux: 'Les deux',
};

// How the client reads that choice inside the bubble (only one badge is shown).
export const MODALITE_CLIENT_LABELS: Record<SiaModalite, string> = {
  deplace: 'Il se déplace chez toi',
  recoit: 'Tu vas chez lui',
  deux: 'Il se déplace ou tu vas chez lui',
};

export const parseModalite = (value: unknown): SiaModalite =>
  value === 'recoit' || value === 'deplace' ? value : 'deux';

// A provider lists up to 3 services, each a short label and a price in FCFA.
export type SiaService = { label: string; prix: number };

export const MAX_SERVICES = 3;
export const MAX_SERVICE_LABEL = 40;
const MAX_PRIX = 100_000_000;

/** "5000" -> "5 000 FCFA"; 0 or less -> "—". Locale-free so it is stable to test. */
export function formatPrix(prix: number): string {
  if (!(prix > 0)) return '—';
  return `${String(Math.floor(prix)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

export type SiaProfile = {
  role: SiaRole;
  pseudo: string;
  metier: string;
  zone: string;
  modalite: SiaModalite;
  services: SiaService[];
};

const MAX_FIELD_LENGTH = 60;

const cleanField = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '';

function parseServices(value: unknown): SiaService[] {
  if (!Array.isArray(value)) return [];
  const out: SiaService[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === 'string' ? rec.label.trim().slice(0, MAX_SERVICE_LABEL) : '';
    const n = typeof rec.prix === 'number' ? rec.prix : Number(rec.prix);
    const prix = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_PRIX) : 0;
    if (label) out.push({ label, prix });
    if (out.length >= MAX_SERVICES) break;
  }
  return out;
}

/** Reads untrusted account data and returns a valid profile, or undefined. */
export function parseSiaProfile(content: unknown): SiaProfile | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const data = content as Record<string, unknown>;
  if (data.role !== 'prestataire' && data.role !== 'client') return undefined;
  const profile: SiaProfile = {
    role: data.role,
    pseudo: cleanField(data.pseudo),
    metier: cleanField(data.metier),
    zone: cleanField(data.zone),
    modalite: parseModalite(data.modalite),
    services: parseServices(data.services),
  };
  return profile.pseudo ? profile : undefined;
}

// One photo: ciphertext in the media repo (mxc) plus the key to decrypt it (kept only in the
// encrypted bubble event, never on the server in the clear).
export type SiaPhotoRef = { mxc: string; type: string; encInfo: EncryptedAttachmentInfo };

function parsePhotos(value: unknown): SiaPhotoRef[] {
  if (!Array.isArray(value)) return [];
  const out: SiaPhotoRef[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.mxc === 'string' &&
      r.mxc.startsWith('mxc://') &&
      typeof r.type === 'string' &&
      typeof r.encInfo === 'object' &&
      r.encInfo !== null
    ) {
      out.push({ mxc: r.mxc, type: r.type, encInfo: r.encInfo as EncryptedAttachmentInfo });
    }
    if (out.length >= MAX_SERVICES) break;
  }
  return out;
}

// The card shared inside a bubble (never the pseudo: the bubble uses a disposable alias).
export type SiaFiche = {
  role: SiaRole;
  metier: string;
  zone: string;
  modalite: SiaModalite;
  services: SiaService[];
  photos: SiaPhotoRef[];
};

export const ficheFromProfile = (p: SiaProfile): SiaFiche => ({
  role: p.role,
  metier: p.metier,
  zone: p.zone,
  modalite: p.modalite,
  services: p.services,
  photos: [],
});

export function parseFiche(content: unknown): SiaFiche | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const data = content as Record<string, unknown>;
  if (data.role !== 'prestataire' && data.role !== 'client') return undefined;
  return {
    role: data.role,
    metier: cleanField(data.metier),
    zone: cleanField(data.zone),
    modalite: parseModalite(data.modalite),
    services: parseServices(data.services),
    photos: parsePhotos(data.photos),
  };
}

export const ROLE_LABELS: Record<SiaRole, { title: string; description: string }> = {
  prestataire: {
    title: 'Prestataire',
    description: 'Je propose un service (plombier, coiffure, dépannage...)',
  },
  client: {
    title: 'Client',
    description: "Je cherche quelqu'un pour un service",
  },
};

/** Pseudo proposed at first launch: the identifier chosen at sign-up (« @puma-35:… » → « Puma-35 »). */
export function suggestedPseudo(userId: string | null): string {
  const match = /^@([^:]{1,30}):/.exec(userId ?? '');
  if (!match) return '';
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
