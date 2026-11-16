// SIA: offers on a client's request. Pure logic, no imports (unit-tested).
// When a provider answers a request, the invitation's reason carries a hidden reference to that
// request (" [ref:<event id>]"). The client can then see all offers for one request side by side,
// pick one, and the others are refused at once.

const REF_PATTERN = /\s*\[ref:([^\]\s]{1,255})\]\s*$/;

/** Adds the request reference to the visible text of an invitation. */
export function withRef(text: string, ref: string): string {
  return `${text} [ref:${ref}]`;
}

/** Splits an untrusted invitation reason into the text to show and the request reference, if any. */
export function parseReason(reason: unknown): { text: string; ref?: string } {
  if (typeof reason !== 'string') return { text: '' };
  const match = REF_PATTERN.exec(reason);
  if (!match) return { text: reason.trim() };
  return { text: reason.slice(0, match.index).trim(), ref: match[1] };
}

export type Invitation = { roomId: string; reason: unknown };

/** The other invitations answering the same request as `roomId` (they are refused when one is chosen). */
export function siblingOffers(invitations: Invitation[], roomId: string): string[] {
  const ref = parseReason(invitations.find((i) => i.roomId === roomId)?.reason).ref;
  if (!ref) return [];
  return invitations
    .filter((i) => i.roomId !== roomId && parseReason(i.reason).ref === ref)
    .map((i) => i.roomId);
}
