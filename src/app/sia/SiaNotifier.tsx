// SIA: discreet alert on an incoming signal (a bubble message, or a "Tu es dispo ?" invite).
// Vibration + a soft synthesized "tap". No text, no pop-up: the signal only; the detail waits in the app.
// Works while the app is open. App closed / in background needs push (Firebase or ntfy, phase 6.3).
import { useEffect, useRef } from 'react';
import { IRoomTimelineData, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { isBulleMessage, isBulleRoom } from './bulle';

const VIBRATION_PATTERN = [100, 50, 100];
// Ignore the burst of history/sync that fires right after mount, so old messages do not buzz.
const READY_DELAY_MS = 1500;

/** A short feutré "tap", built in code (Web Audio), no audio file. Silently gives up if audio is blocked. */
function playTap(): void {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    Promise.resolve(ctx.resume?.()).then(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(430, t + 0.08);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
      osc.onended = () => ctx.close();
    });
  } catch {
    // Audio unavailable: the vibration still fires.
  }
}

function signal(): void {
  try {
    navigator.vibrate?.(VIBRATION_PATTERN);
  } catch {
    // Vibration unavailable: the tap still plays.
  }
  playTap();
}

export function SiaNotifier() {
  const mx = useMatrixClient();
  const readyAt = useRef(0);

  useEffect(() => {
    readyAt.current = Date.now() + READY_DELAY_MS;
    const me = mx.getUserId();

    const onTimeline = (
      evt: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (Date.now() < readyAt.current || removed || !data?.liveEvent) return;
      if (!room || !isBulleRoom(room) || !isBulleMessage(evt)) return;
      if (evt.getSender() === me) return;
      signal();
    };

    const onMembership = (room: Room, membership: string, prevMembership?: string) => {
      if (Date.now() < readyAt.current) return;
      if (membership === 'invite' && prevMembership !== 'invite') signal();
    };

    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(RoomEvent.MyMembership, onMembership);
    return () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(RoomEvent.MyMembership, onMembership);
    };
  }, [mx]);

  return null;
}
