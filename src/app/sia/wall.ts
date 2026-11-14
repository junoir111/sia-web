// SIA: "Le Mur" — one shared room where ephemeral announcements are posted.
import { MatrixClient, MatrixError, MatrixEvent, Preset, Visibility } from 'matrix-js-sdk';
import { SiaProfile, SiaRole } from './profile';

export const SIA_ANNONCE_EVENT = 'io.sia.annonce';
const WALL_ALIAS_LOCALPART = 'sia-mur';
const MAX_TEXT_LENGTH = 280;
const MAX_FIELD_LENGTH = 60;

export const DURATIONS_HOURS = [1, 3, 6, 24] as const;

export type SiaAnnonce = {
  eventId: string;
  sender: string;
  role: SiaRole;
  pseudo: string;
  categorie: string;
  zone: string;
  texte: string;
  fin: number;
};

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Reads an untrusted wall event; returns undefined if it is not a valid, live announcement. */
export function parseAnnonce(event: MatrixEvent, now: number): SiaAnnonce | undefined {
  if (event.getType() !== SIA_ANNONCE_EVENT || event.isRedacted()) return undefined;
  const eventId = event.getId();
  const sender = event.getSender();
  const content = event.getContent() as Record<string, unknown>;
  if (!eventId || !sender) return undefined;
  if (content.role !== 'prestataire' && content.role !== 'client') return undefined;
  const fin = typeof content.fin === 'number' ? content.fin : 0;
  // An announcement can never live more than 24 h, whatever its content says.
  const maxFin = event.getTs() + 24 * 3600 * 1000;
  if (fin <= now || fin > maxFin + 60_000) return undefined;
  const texte = clean(content.texte, MAX_TEXT_LENGTH);
  if (!texte) return undefined;
  return {
    eventId,
    sender,
    role: content.role,
    pseudo: clean(content.pseudo, MAX_FIELD_LENGTH) || 'Anonyme',
    categorie: clean(content.categorie, MAX_FIELD_LENGTH),
    zone: clean(content.zone, MAX_FIELD_LENGTH),
    texte,
    fin,
  };
}

export const wallAlias = (mx: MatrixClient): string => {
  const server = mx.getDomain() ?? '';
  return `#${WALL_ALIAS_LOCALPART}:${server}`;
};

/** Finds the wall room (joining it if needed), or creates it the first time. Returns its room ID. */
export async function ensureWallRoom(mx: MatrixClient): Promise<string> {
  const alias = wallAlias(mx);
  try {
    const { room_id: roomId } = await mx.getRoomIdForAlias(alias);
    if (mx.getRoom(roomId)?.getMyMembership() !== 'join') await mx.joinRoom(roomId);
    return roomId;
  } catch (err) {
    if (!(err instanceof MatrixError) || err.errcode !== 'M_NOT_FOUND') throw err;
  }
  const { room_id: roomId } = await mx.createRoom({
    room_alias_name: WALL_ALIAS_LOCALPART,
    name: 'SIA — Le Mur',
    topic: 'Annonces éphémères de la communauté SIA',
    preset: Preset.PublicChat,
    visibility: Visibility.Private,
    initial_state: [
      {
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: 'shared' },
      },
    ],
  });
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
    categorie: annonce.categorie.trim().slice(0, MAX_FIELD_LENGTH),
    zone: annonce.zone.trim().slice(0, MAX_FIELD_LENGTH),
    texte: annonce.texte.trim().slice(0, MAX_TEXT_LENGTH),
    fin: Date.now() + annonce.dureeHeures * 3600 * 1000,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.sendEvent(roomId, SIA_ANNONCE_EVENT as any, content as any);
}

/** Deletes our own announcements whose time is over, so they also leave the server. */
export function cleanupOwnExpired(
  mx: MatrixClient,
  roomId: string,
  events: MatrixEvent[],
  now: number
) {
  const me = mx.getUserId();
  events
    .filter(
      (evt) => evt.getType() === SIA_ANNONCE_EVENT && !evt.isRedacted() && evt.getSender() === me
    )
    .filter((evt) => {
      const {fin} = evt.getContent() as Record<string, unknown>;
      return typeof fin !== 'number' || fin <= now;
    })
    .forEach((evt) => {
      const eventId = evt.getId();
      if (eventId) mx.redactEvent(roomId, eventId).catch(() => undefined);
    });
}

export function formatRemaining(fin: number, now: number): string {
  const minutes = Math.max(0, Math.round((fin - now) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}
