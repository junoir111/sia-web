// SIA: "Le Mur" — one shared room where ephemeral announcements are posted.
import { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { SiaProfile } from './profile';
import { AnnonceFields, annonceFromContent, cleanText } from './wallLogic';

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
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.sendEvent(roomId, SIA_ANNONCE_EVENT as any, content as any);
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
