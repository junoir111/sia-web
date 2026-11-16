// SIA: "Le Mur" — one shared room where ephemeral announcements are posted.
import { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { SiaProfile } from './profile';
import {
  AnnonceFields,
  annonceFromContent,
  cleanBudget,
  cleanText,
  MAX_ANNONCE_LIFETIME_MS,
} from './wallLogic';

export { formatRemaining } from './wallLogic';

export const SIA_ANNONCE_EVENT = 'io.sia.annonce';
const WALL_ALIAS_LOCALPART = 'sia-mur';

export const DURATIONS_HOURS = [1, 3, 6, 24] as const;

export type SiaAnnonce = AnnonceFields & { eventId: string; sender: string };

/** Reads an untrusted wall event; returns undefined if it is not a valid, live announcement. */
export function parseAnnonce(event: MatrixEvent, now: number): SiaAnnonce | undefined {
  if (event.getType() !== SIA_ANNONCE_EVENT || event.isRedacted()) return undefined;
  const eventId = event.getId();
  const sender = event.getSender();
  if (!eventId || !sender) return undefined;
  const fields = annonceFromContent(event.getContent(), event.getTs(), now);
  return fields ? { ...fields, eventId, sender } : undefined;
}

export const wallAlias = (mx: MatrixClient): string =>
  `#${WALL_ALIAS_LOCALPART}:${mx.getDomain() ?? ''}`;

/** The wall room if we already know it locally. */
export const findWallRoomId = (mx: MatrixClient): string | undefined =>
  mx.getRooms().find((room) => room.getCanonicalAlias() === wallAlias(mx))?.roomId;

/**
 * Finds the wall room and joins it if needed. Returns its room ID.
 * The room itself is created once on the server by the system account, never by the app.
 */
export async function ensureWallRoom(mx: MatrixClient): Promise<string> {
  const { room_id: roomId } = await mx.getRoomIdForAlias(wallAlias(mx));
  if (mx.getRoom(roomId)?.getMyMembership() !== 'join') await mx.joinRoom(roomId);
  return roomId;
}

export type NewAnnonce = {
  texte: string;
  categorie: string;
  zone: string;
  dureeHeures: number;
  /** Client request: the amount the client can pay (FCFA), 0 = not given. */
  budget: number;
};

export async function publishAnnonce(
  mx: MatrixClient,
  roomId: string,
  profile: SiaProfile,
  annonce: NewAnnonce
): Promise<void> {
  const content = {
    role: profile.role,
    pseudo: profile.pseudo,
    categorie: cleanText(annonce.categorie, 60),
    zone: cleanText(annonce.zone, 60),
    texte: cleanText(annonce.texte, 280),
    fin: Date.now() + annonce.dureeHeures * 3600 * 1000,
    ...(profile.role === 'client' ? { budget: cleanBudget(annonce.budget) } : {}),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.sendEvent(roomId, SIA_ANNONCE_EVENT as any, content as any);
}

/** "Disponible": shows the provider's status circle on the wall, for 24 h at most. */
export async function publishStatut(
  mx: MatrixClient,
  roomId: string,
  profile: SiaProfile
): Promise<void> {
  const content = {
    role: profile.role,
    pseudo: profile.pseudo,
    categorie: cleanText(profile.metier, 60),
    zone: cleanText(profile.zone, 60),
    texte: cleanText(profile.metier, 280) || 'Disponible',
    fin: Date.now() + MAX_ANNONCE_LIFETIME_MS,
    statut: true,
    modalite: profile.modalite,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.sendEvent(roomId, SIA_ANNONCE_EVENT as any, content as any);
}

/** "Pas disponible": removes our status circle(s) from the wall and from the server. */
export function removeOwnStatuts(mx: MatrixClient, roomId: string, annonces: SiaAnnonce[]): void {
  const me = mx.getUserId();
  annonces
    .filter((a) => a.statut && a.sender === me)
    .forEach((a) => mx.redactEvent(roomId, a.eventId).catch(() => undefined));
}

const cleanupRequested = new Set<string>();

/** Deletes our own announcements whose time is over, so they also leave the server. */
export function cleanupOwnExpired(mx: MatrixClient, roomId: string, now: number): void {
  const me = mx.getUserId();
  const events = mx.getRoom(roomId)?.getLiveTimeline().getEvents() ?? [];
  events
    .filter(
      (evt) => evt.getType() === SIA_ANNONCE_EVENT && !evt.isRedacted() && evt.getSender() === me
    )
    .filter((evt) => !annonceFromContent(evt.getContent(), evt.getTs(), now))
    .forEach((evt) => {
      const eventId = evt.getId();
      if (!eventId || cleanupRequested.has(eventId)) return;
      cleanupRequested.add(eventId);
      mx.redactEvent(roomId, eventId).catch(() => cleanupRequested.delete(eventId));
    });
}
