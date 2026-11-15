// SIA: private profile stored in the user's Matrix account data.

export const SIA_PROFILE_EVENT = 'io.sia.profile';

export type SiaRole = 'prestataire' | 'client';

export type SiaModalite = 'recoit' | 'deplace' | 'deux';

export const MODALITE_LABELS: Record<SiaModalite, string> = {
  recoit: '🏠 Reçoit (maison / atelier)',
  deplace: '🛵 Se déplace',
  deux: '🔄 Reçoit et se déplace',
};

export const parseModalite = (value: unknown): SiaModalite =>
  value === 'recoit' || value === 'deplace' ? value : 'deux';

export type SiaProfile = {
  role: SiaRole;
  pseudo: string;
  metier: string;
  zone: string;
  modalite: SiaModalite;
};

const MAX_FIELD_LENGTH = 60;

const cleanField = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '';

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
  };
  return profile.pseudo ? profile : undefined;
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

/** Pseudo proposed at first launch for accounts made by the invitation tool (« @puma-35:… » → « Puma-35 »). */
export function suggestedPseudo(userId: string | null): string {
  const match = /^@([a-z]+-\d{2}):/.exec(userId ?? '');
  if (!match) return '';
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}
