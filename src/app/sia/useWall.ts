// SIA: loads the wall room and keeps the list of live announcements up to date.
import { useEffect, useMemo, useState } from 'react';
import { MatrixEvent, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { cleanupOwnExpired, ensureWallRoom, parseAnnonce, SiaAnnonce } from './wall';

const HISTORY_LIMIT = 150;
const TICK_MS = 30_000;

type WallState = {
  roomId?: string;
  annonces: SiaAnnonce[];
  error?: string;
  now: number;
};

export function useWall(): WallState {
  const mx = useMatrixClient();
  const [roomId, setRoomId] = useState<string>();
  const [error, setError] = useState<string>();
  const [events, setEvents] = useState<MatrixEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    ensureWallRoom(mx)
      .then((id) => !cancelled && setRoomId(id))
      .catch(() => !cancelled && setError('Le Mur est indisponible. Vérifie ta connexion.'));
    return () => {
      cancelled = true;
    };
  }, [mx]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!roomId) return undefined;
    let room = mx.getRoom(roomId);
    const refresh = () => {
      room = mx.getRoom(roomId);
      if (room) setEvents([...room.getLiveTimeline().getEvents()]);
    };
    const onRoomReady = () => {
      room = mx.getRoom(roomId);
      if (!room) return;
      mx.paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: HISTORY_LIMIT })
        .catch(() => undefined)
        .finally(() => {
          refresh();
          cleanupOwnExpired(mx, roomId, Date.now());
        });
    };
    if (room) onRoomReady();
    mx.on(RoomEvent.Timeline, refresh);
    mx.on(RoomEvent.Redaction, refresh);
    mx.on(RoomEvent.MyMembership, onRoomReady);
    return () => {
      mx.off(RoomEvent.Timeline, refresh);
      mx.off(RoomEvent.Redaction, refresh);
      mx.off(RoomEvent.MyMembership, onRoomReady);
    };
  }, [mx, roomId]);

  const annonces = useMemo(
    () =>
      events
        .map((evt) => parseAnnonce(evt, now))
        .filter((a): a is SiaAnnonce => a !== undefined)
        .reverse(),
    [events, now]
  );

  return { roomId, annonces, error, now };
}
