// SIA: "La bulle" — a private end-to-end encrypted room between two people, opened from an announcement.
import { MatrixClient, MatrixEvent, Preset, Room, Visibility } from 'matrix-js-sdk';
import { SiaProfile, SiaRole, ROLE_LABELS } from './profile';
import { findWallRoomId, SiaAnnonce } from './wall';

export const SIA_BULLE_STATE = 'io.sia.bulle';
export const BULLE_ROOM_NAME = 'SIA · Bulle';
const JOIN_WAIT_MS = 10_000;
const JOIN_POLL_MS = 150;

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

/** Anything written in a bubble (not room state, not a deletion) is ephemeral. */
export const isBulleMessage = (evt: MatrixEvent): boolean =>
  !evt.isState() && !evt.isRedacted() && evt.getType() !== 'm.room.redaction';

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
    preset: Preset.PrivateChat,
    visibility: Visibility.Private,
    is_direct: true,
    // Both sides may delete any message: that is how expired messages leave the server.
    power_level_content_override: { redact: 0 },
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Waits until the joined room and its state have reached this device. */
async function waitForJoinedRoom(mx: MatrixClient, roomId: string): Promise<Room | undefined> {
  const deadline = Date.now() + JOIN_WAIT_MS;
  for (;;) {
    const room = mx.getRoom(roomId);
    if (room?.getMyMembership() === 'join' && room.currentState.getStateEvents('m.room.create', ''))
      return room;
    if (Date.now() >= deadline) return undefined;
    // eslint-disable-next-line no-await-in-loop
    await sleep(JOIN_POLL_MS);
  }
}

export async function declineBulle(mx: MatrixClient, roomId: string): Promise<void> {
  await mx.leave(roomId);
  await mx.forget(roomId).catch(() => undefined);
}

/**
 * Accepting a request: join, check it is a real bubble (encrypted, tied to an announcement of the wall),
 * then take our announcement off the wall. A fake bubble is left at once and the call throws.
 */
export async function acceptBulle(mx: MatrixClient, roomId: string): Promise<void> {
  await mx.joinRoom(roomId);
  const room = await waitForJoinedRoom(mx, roomId);
  const state = room ? getBulleState(room) : undefined;
  const wallRoomId = findWallRoomId(mx);
  const valid =
    !!room && room.hasEncryptionStateEvent() && !!state && state.wallRoomId === wallRoomId;
  if (!valid || !state) {
    await declineBulle(mx, roomId).catch(() => undefined);
    throw new Error('Invalid bubble');
  }
  // Only our own announcement can be removed by us: the server refuses anything else.
  await mx.redactEvent(state.wallRoomId, state.annonceEventId).catch(() => undefined);
}

/** "Silence Radio": delete every message still there, from both sides, then leave and forget. */
export async function silenceRadio(mx: MatrixClient, roomId: string): Promise<void> {
  const room = mx.getRoom(roomId);
  const ids = (room?.getLiveTimeline().getEvents() ?? [])
    .filter(isBulleMessage)
    .map((evt) => evt.getId())
    .filter((id): id is string => !!id && !id.startsWith('~'));
  await Promise.all(ids.map((id) => mx.redactEvent(roomId, id).catch(() => undefined)));
  await mx.leave(roomId).catch(() => undefined);
  await mx.forget(roomId).catch(() => undefined);
}
