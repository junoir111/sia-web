// SIA: private profile stored in the user's Matrix account data.

export const SIA_PROFILE_EVENT = 'io.sia.profile';

export type SiaRole = 'prestataire' | 'client';

export type SiaProfile = {
  role: SiaRole;
  pseudo: string;
  metier: string;
  zone: string;
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
