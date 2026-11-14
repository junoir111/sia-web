// SIA: the bubble screen — every message disappears 5 s after being sent, on both sides.
import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MatrixEvent, MatrixEventEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { Box, Button, Input, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { getBulleState, MESSAGE_LIFETIME_MS, silenceRadio } from './bulle';
import { SIA_WALL_PATH } from './paths';

const TICK_MS = 500;

type Bubble = { id: string; sender: string; body: string; ts: number };

function useBulleRoom(roomId: string) {
  const mx = useMatrixClient();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    mx.on(RoomEvent.Timeline, bump);
    mx.on(RoomEvent.Redaction, bump);
    mx.on(MatrixEventEvent.Decrypted, bump);
    mx.on(RoomStateEvent.Members, bump);
    return () => {
      mx.off(RoomEvent.Timeline, bump);
      mx.off(RoomEvent.Redaction, bump);
      mx.off(MatrixEventEvent.Decrypted, bump);
      mx.off(RoomStateEvent.Members, bump);
    };
  }, [mx]);
  return { room: mx.getRoom(roomId), version };
}

const isMessage = (evt: MatrixEvent): boolean =>
  !evt.isRedacted() && (evt.getType() === 'm.room.message' || evt.getType() === 'm.room.encrypted');

export function SiaBulle() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const { roomId: rawRoomId = '' } = useParams();
  const roomId = decodeURIComponent(rawRoomId);
  const { room } = useBulleRoom(roomId);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [confirmSilence, setConfirmSilence] = useState(false);
  const firstSeen = useRef(new Map<string, number>());
  const deleted = useRef(new Set<string>());
  const me = mx.getUserId();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const state = room ? getBulleState(room) : undefined;
  const aliasOf = (userId: string) => state?.aliases[userId] ?? 'Inconnu';
  const events = room?.getLiveTimeline().getEvents() ?? [];

  // Hide what is older than 5 s (server time, or first seen here if the clocks disagree).
  const bubbles: Bubble[] = [];
  events.filter(isMessage).forEach((evt) => {
    const id = evt.getId();
    if (!id) return;
    const seen = firstSeen.current.get(id) ?? now;
    firstSeen.current.set(id, seen);
    if (now - evt.getTs() >= MESSAGE_LIFETIME_MS || now - seen >= MESSAGE_LIFETIME_MS) return;
    const body =
      evt.getType() === 'm.room.encrypted'
        ? '🔒 déchiffrement...'
        : String(evt.getContent().body ?? '');
    bubbles.push({ id, sender: evt.getSender() ?? '', body, ts: evt.getTs() });
  });

  // Our own expired messages are also deleted from the server.
  useEffect(() => {
    events
      .filter((evt) => isMessage(evt) && evt.getSender() === me)
      .filter((evt) => now - evt.getTs() >= MESSAGE_LIFETIME_MS)
      .forEach((evt) => {
        const id = evt.getId();
        if (!id || id.startsWith('~') || deleted.current.has(id)) return;
        deleted.current.add(id);
        mx.redactEvent(roomId, id).catch(() => deleted.current.delete(id));
      });
  });

  const others = room?.getJoinedMembers().filter((m) => m.userId !== me) ?? [];
  const invited = room?.getMembersWithMembership('invite') ?? [];
  const closed = !!room && others.length === 0 && invited.length === 0;
  let otherLabel = '—';
  if (others[0]) otherLabel = aliasOf(others[0].userId);
  else if (invited[0]) otherLabel = `${aliasOf(invited[0].userId)} (invité)`;

  const handleSend = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const input = evt.currentTarget.elements.namedItem('message') as HTMLInputElement | null;
    const text = input?.value.trim();
    if (!text || !input) return;
    setSending(true);
    input.value = '';
    try {
      await mx.sendTextMessage(roomId, text);
    } finally {
      setSending(false);
      input.focus();
    }
  };

  const handleSilence = async () => {
    await silenceRadio(mx, roomId);
    navigate(SIA_WALL_PATH);
  };

  const shell = {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
  };

  if (!room) {
    return (
      <Box grow="Yes" alignItems="Center" justifyContent="Center" style={shell}>
        <Text>Bulle introuvable ou déjà fermée.</Text>
      </Box>
    );
  }

  return (
    <Box grow="Yes" direction="Column" style={{ ...shell, minWidth: 0 }}>
      <Box
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="200"
        style={{
          padding: config.space.S300,
          borderBottom: `1px solid ${color.Background.ContainerLine}`,
        }}
      >
        <Box direction="Column">
          <Text size="T200" priority="400" style={{ letterSpacing: toRem(3) }}>
            BULLE CHIFFRÉE · 5 S
          </Text>
          <Text size="H5">{otherLabel}</Text>
          <Text size="T200" priority="400">
            Toi : {me ? aliasOf(me) : ''}
          </Text>
        </Box>
        {confirmSilence ? (
          <Box gap="200">
            <Button
              size="300"
              variant="Secondary"
              fill="Soft"
              onClick={() => setConfirmSilence(false)}
            >
              <Text size="B300">Non</Text>
            </Button>
            <Button size="300" variant="Critical" onClick={handleSilence}>
              <Text size="B300">Tout effacer</Text>
            </Button>
          </Box>
        ) : (
          <Button size="300" variant="Critical" fill="Soft" onClick={() => setConfirmSilence(true)}>
            <Text size="B300">Silence Radio</Text>
          </Button>
        )}
      </Box>

      <Box
        grow="Yes"
        direction="Column"
        justifyContent="End"
        gap="200"
        style={{ padding: config.space.S400, overflowY: 'auto' }}
      >
        {closed && <Text priority="400">L&apos;autre personne a fermé la bulle.</Text>}
        {!closed && bubbles.length === 0 && (
          <Text size="T300" priority="400" align="Center">
            Ici, chaque message disparaît 5 secondes après l&apos;envoi. Sois réactif.
          </Text>
        )}
        {bubbles.map((b) => {
          const mine = b.sender === me;
          const left = Math.max(0, Math.ceil((MESSAGE_LIFETIME_MS - (now - b.ts)) / 1000));
          return (
            <Box key={b.id} direction="Column" alignItems={mine ? 'End' : 'Start'}>
              <Box
                direction="Column"
                style={{
                  maxWidth: '80%',
                  padding: `${config.space.S200} ${config.space.S300}`,
                  borderRadius: config.radii.R400,
                  backgroundColor: mine ? color.Primary.Container : color.SurfaceVariant.Container,
                  color: mine ? color.Primary.OnContainer : color.SurfaceVariant.OnContainer,
                }}
              >
                <Text size="T200" priority="400">
                  {aliasOf(b.sender)} · {left} s
                </Text>
                <Text size="T400" style={{ wordBreak: 'break-word' }}>
                  {b.body}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {!closed && (
        <form
          onSubmit={handleSend}
          style={{
            padding: config.space.S300,
            borderTop: `1px solid ${color.Background.ContainerLine}`,
          }}
        >
          <Box gap="200">
            <Input
              variant="Background"
              outlined
              name="message"
              autoComplete="off"
              maxLength={2000}
              placeholder="Écris... (s'efface en 5 s)"
              style={{ flexGrow: 1 }}
              autoFocus
            />
            <Button type="submit" variant="Primary" disabled={sending}>
              <Text size="B400">Envoyer</Text>
            </Button>
          </Box>
        </form>
      )}
    </Box>
  );
}
