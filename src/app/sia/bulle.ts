// SIA: "La bulle" — a private end-to-end encrypted room between two people, opened from an announcement.
import { MatrixClient, Preset, Room, Visibility } from 'matrix-js-sdk';
import { SiaProfile, SiaRole, ROLE_LABELS } from './profile';
import { SiaAnnonce } from './wall';

export const SIA_BULLE_STATE = 'io.sia.bulle';
export const BULLE_ROOM_NAME = 'SIA · Bulle';
export const MESSAGE_LIFETIME_MS = 5_000;

const CODE_WORDS = [
  'Alpha',
  'Bravo',
  'Delta',
  'Echo',
  'Kilo',
  'Lima',
  'Omega',
  'Sierra',
  'Tango',
  'Zulu',
];

export type BulleState = {
  annonceEventId: string;
  wallRoomId: string;
  aliases: Record<string, string>;
};

const randomInt = (max: number): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
};

/** Disposable alias for one bubble only, e.g. "Prestataire-Delta-4". */
export function makeAlias(role: SiaRole): string {
  return `${ROLE_LABELS[role].title}-${CODE_WORDS[randomInt(CODE_WORDS.length)]}-${randomInt(10)}`;
}

export function parseBulleState(content: unknown): BulleState | undefined {
  if (typeof content !== 'object' || content === null) return undefined;
  const data = content as Record<string, unknown>;
  if (typeof data.annonceEventId !== 'string' || typeof data.wallRoomId !== 'string')
    return undefined;
  const aliases: Record<string, string> = {};
  if (typeof data.aliases === 'object' && data.aliases !== null) {
    Object.entries(data.aliases as Record<string, unknown>).forEach(([userId, alias]) => {
      if (typeof alias === 'string') aliases[userId] = alias.slice(0, 40);
    });
  }
  return { annonceEventId: data.annonceEventId, wallRoomId: data.wallRoomId, aliases };
}

export function getBulleState(room: Room): BulleState | undefined {
  const event = room.currentState.getStateEvents(SIA_BULLE_STATE, '');
  return parseBulleState(event?.getContent());
}

export const isBulleRoom = (room: Room): boolean => room.name === BULLE_ROOM_NAME;

/** "Tu es dispo ?": opens an encrypted bubble with the author of the announcement and invites them. */
export async function openBulle(
  mx: MatrixClient,
  wallRoomId: string,
  annonce: SiaAnnonce,
  profile: SiaProfile
): Promise<string> {
  const me = mx.getUserId();
  if (!me) throw new Error('Not logged in');
  const state: BulleState = {
    annonceEventId: annonce.eventId,
    wallRoomId,
    aliases: { [me]: makeAlias(profile.role), [annonce.sender]: makeAlias(annonce.role) },
  };
  const { room_id: roomId } = await mx.createRoom({
    name: BULLE_ROOM_NAME,
    preset: Preset.TrustedPrivateChat,
    visibility: Visibility.Private,
    is_direct: true,
    initial_state: [
      { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
      {
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: 'joined' },
      },
      { type: SIA_BULLE_STATE, state_key: '', content: state },
    ],
  });
  await mx.invite(roomId, annonce.sender, `Tu es dispo ? — ${annonce.texte.slice(0, 80)}`);
  return roomId;
}

/** Accepting a request: join the bubble and take our announcement off the wall. */
export async function acceptBulle(mx: MatrixClient, roomId: string): Promise<void> {
  await mx.joinRoom(roomId);
  const room = mx.getRoom(roomId);
  const state = room ? getBulleState(room) : undefined;
  if (!state) return;
  const annonce = mx.getRoom(state.wallRoomId)?.findEventById(state.annonceEventId);
  if (annonce && annonce.getSender() === mx.getUserId() && !annonce.isRedacted()) {
    await mx.redactEvent(state.wallRoomId, state.annonceEventId).catch(() => undefined);
  }
}

export async function declineBulle(mx: MatrixClient, roomId: string): Promise<void> {
  await mx.leave(roomId);
  await mx.forget(roomId).catch(() => undefined);
}

/** "Silence Radio": delete everything we wrote, then leave and forget the bubble. */
export async function silenceRadio(mx: MatrixClient, roomId: string): Promise<void> {
  const room = mx.getRoom(roomId);
  const me = mx.getUserId();
  const mine = (room?.getLiveTimeline().getEvents() ?? []).filter(
    (evt) => evt.getSender() === me && !evt.isState() && !evt.isRedacted() && evt.getId()
  );
  await Promise.all(
    mine.map((evt) => mx.redactEvent(roomId, evt.getId() as string).catch(() => undefined))
  );
  await mx.leave(roomId).catch(() => undefined);
  await mx.forget(roomId).catch(() => undefined);
}
