// SIA: runs for the whole app. Times every bubble message from its live arrival on this device
// and deletes it from the server once its minute is over, whoever wrote it and whatever screen is open.
import { useEffect } from 'react';
import { IRoomTimelineData, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { isBulleMessage, isBulleRoom } from './bulle';
import { isExpired } from './ephemeral';
import { cleanupOwnExpired, findWallRoomId } from './wall';

const SWEEP_MS = 1_000;
const WALL_CLEANUP_MS = 60_000;
const RETRY_MS = 10_000;

/** When this device saw each message arrive live. 0 = old history, already expired. */
const seenAt = new WeakMap<MatrixEvent, number>();

export const getSeenAt = (evt: MatrixEvent): number | undefined => seenAt.get(evt);

const mark = (evt: MatrixEvent, at: number) => {
  if (!seenAt.has(evt)) seenAt.set(evt, at);
};

export function SiaEphemeralSweeper() {
  const mx = useMatrixClient();

  useEffect(() => {
    const requested = new Set<string>();
    const bulleRooms = () =>
      mx.getRooms().filter((room) => isBulleRoom(room) && room.getMyMembership() === 'join');
    const messagesOf = (room: Room) => room.getLiveTimeline().getEvents().filter(isBulleMessage);

    // Whatever is already there when the app starts was not seen arriving: it is expired.
    bulleRooms().forEach((room) => messagesOf(room).forEach((evt) => mark(evt, 0)));

    const onTimeline = (
      evt: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (!room || !isBulleRoom(room) || !isBulleMessage(evt)) return;
      mark(evt, data?.liveEvent ? Date.now() : 0);
    };

    const sweep = () => {
      const now = Date.now();
      bulleRooms().forEach((room) =>
        messagesOf(room).forEach((evt) => {
          mark(evt, 0);
          const id = evt.getId();
          if (!id || id.startsWith('~') || requested.has(id)) return;
          if (!isExpired(seenAt.get(evt), now)) return;
          requested.add(id);
          mx.redactEvent(room.roomId, id).catch(() => {
            setTimeout(() => requested.delete(id), RETRY_MS);
          });
        })
      );
    };

    const wallCleanup = () => {
      const wallId = findWallRoomId(mx);
      if (wallId) cleanupOwnExpired(mx, wallId, Date.now());
    };

    mx.on(RoomEvent.Timeline, onTimeline);
    const sweepId = setInterval(sweep, SWEEP_MS);
    const wallCleanupId = setInterval(wallCleanup, WALL_CLEANUP_MS);
    return () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      clearInterval(sweepId);
      clearInterval(wallCleanupId);
    };
  }, [mx]);

  return null;
}
