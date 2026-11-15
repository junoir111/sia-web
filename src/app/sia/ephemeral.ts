// SIA: timing rule of ephemeral messages. Pure logic, no imports (unit-tested).
// A message lives 1 minute counted from the moment THIS device first saw it arrive live,
// so slow networks and wrong clocks can never make it invisible or keep it longer.
export const MESSAGE_LIFETIME_MS = 60_000;

/** `seenAt` undefined or 0 = not seen arriving live (old history): treated as already expired. */
export function remainingMs(seenAt: number | undefined, now: number): number {
  if (!seenAt) return 0;
  return Math.max(0, Math.min(MESSAGE_LIFETIME_MS, MESSAGE_LIFETIME_MS - (now - seenAt)));
}

export const isExpired = (seenAt: number | undefined, now: number): boolean =>
  remainingMs(seenAt, now) === 0;
