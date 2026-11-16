// SIA: the bubble screen — every message disappears 1 minute after it appears, on both sides.
import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MatrixEventEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { Box, Button, Input, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { getBulleState, getOtherFiche, isBulleMessage, sendMyFiche, silenceRadio } from './bulle';
import { MODALITE_CLIENT_LABELS, SiaFiche, formatPrix } from './profile';
import { useSiaProfile } from './useSiaProfile';
import { remainingMs } from './ephemeral';
import { getSeenAt } from './SiaEphemeralSweeper';
import { SIA_WALL_PATH } from './paths';

const TICK_MS = 500;

type Bubble = { id: string; sender: string; body: string; leftMs: number };

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

type FicheProps = { fiche: SiaFiche; flou: boolean; onToggle: () => void };

/** The provider's card the client reads inside the bubble, with a blur toggle for discretion. */
function FichePrestataire({ fiche, flou, onToggle }: FicheProps) {
  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S300,
        border: `1px solid ${color.Background.ContainerLine}`,
        borderRadius: config.radii.R400,
        backgroundColor: color.SurfaceVariant.Container,
        color: color.SurfaceVariant.OnContainer,
      }}
    >
      <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
        <Text size="T200" priority="400" style={{ letterSpacing: toRem(2) }}>
          FICHE PRESTATAIRE
        </Text>
        <Button size="300" variant="Secondary" fill="Soft" onClick={onToggle}>
          <Text size="B300">{flou ? 'Déflouter' : 'Flouter'}</Text>
        </Button>
      </Box>
      <Box
        direction="Column"
        gap="200"
        style={{
          filter: flou ? 'blur(7px)' : undefined,
          opacity: flou ? 0.5 : 1,
          userSelect: flou ? 'none' : 'auto',
          pointerEvents: flou ? 'none' : 'auto',
          transition: 'filter .18s ease, opacity .18s ease',
        }}
      >
        <Text size="H6">
          {fiche.metier || 'Service'} · {fiche.zone}
        </Text>
        {fiche.services.map((s, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={i} alignItems="Center" justifyContent="SpaceBetween" gap="200">
            <Text size="T300">{s.label}</Text>
            <Text size="T300" style={{ color: color.Primary.Main }}>
              {formatPrix(s.prix)}
            </Text>
          </Box>
        ))}
        <Text size="T200" priority="400">
          {MODALITE_CLIENT_LABELS[fiche.modalite]}
        </Text>
      </Box>
    </Box>
  );
}

export function SiaBulle() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const { roomId: rawRoomId = '' } = useParams();
  const roomId = decodeURIComponent(rawRoomId);
  const { room } = useBulleRoom(roomId);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [confirmSilence, setConfirmSilence] = useState(false);
  const [flou, setFlou] = useState(false);
  const me = mx.getUserId();
  const profile = useSiaProfile();
  const sentFicheRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // A provider shares their card once, encrypted, as soon as the bubble is joined.
  useEffect(() => {
    if (sentFicheRef.current) return;
    const joined = mx.getRoom(roomId)?.getMyMembership() === 'join';
    if (joined && profile?.role === 'prestataire') {
      sentFicheRef.current = true;
      sendMyFiche(mx, roomId, profile);
    }
  }, [mx, roomId, profile, room]);

  const state = room ? getBulleState(room) : undefined;
  const aliasOf = (userId: string) => state?.aliases[userId] ?? 'Inconnu';
  const events = room?.getLiveTimeline().getEvents() ?? [];
  const otherFiche = room ? getOtherFiche(room, me) : undefined;

  // Each message is shown for 1 minute from its arrival on this device (timed by SiaEphemeralSweeper,
  // which also deletes it from the server). Anything not seen arriving live stays hidden.
  const bubbles: Bubble[] = [];
  events.filter(isBulleMessage).forEach((evt) => {
    const id = evt.getId();
    const leftMs = remainingMs(getSeenAt(evt), now);
    if (!id || leftMs === 0) return;
    const body =
      evt.getType() === 'm.room.encrypted'
        ? '🔒 déchiffrement...'
        : String(evt.getContent().body ?? '');
    bubbles.push({ id: evt.getTxnId() ?? id, sender: evt.getSender() ?? '', body, leftMs });
  });

  const others = room?.getJoinedMembers().filter((m) => m.userId !== me) ?? [];
  const invited = room?.getMembersWithMembership('invite') ?? [];
  const closed = !!room && others.length === 0 && invited.length === 0;
  const waiting = others.length === 0 && invited.length > 0;
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
      <Box grow="Yes" direction="Column" alignItems="Center" justifyContent="Center" gap="400" style={shell}>
        <Text>Bulle introuvable ou déjà fermée.</Text>
        <Button variant="Primary" onClick={() => navigate(SIA_WALL_PATH)}>
          <Text size="B400">← Le Mur</Text>
        </Button>
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
        <Box direction="Column" gap="100">
          <Button
            size="300"
            variant="Secondary"
            fill="Soft"
            onClick={() => navigate(SIA_WALL_PATH)}
            style={{ alignSelf: 'flex-start' }}
          >
            <Text size="B300">← Le Mur</Text>
          </Button>
          <Text size="T200" priority="400" style={{ letterSpacing: toRem(3) }}>
            BULLE CHIFFRÉE · 1 MIN
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

      {otherFiche?.role === 'prestataire' && (
        <Box style={{ padding: `${config.space.S300} ${config.space.S400} 0` }}>
          <FichePrestataire fiche={otherFiche} flou={flou} onToggle={() => setFlou((v) => !v)} />
        </Box>
      )}

      <Box
        grow="Yes"
        direction="Column"
        justifyContent="End"
        gap="200"
        style={{ padding: config.space.S400, overflowY: 'auto' }}
      >
        {closed && <Text priority="400">L&apos;autre personne a fermé la bulle.</Text>}
        {waiting && (
          <Text size="T300" priority="400" align="Center">
            En attente de sa réponse... Tu pourras écrire dès qu&apos;il aura accepté.
          </Text>
        )}
        {!closed && !waiting && bubbles.length === 0 && (
          <Text size="T300" priority="400" align="Center">
            Ici, chaque message disparaît 1 minute après s&apos;être affiché.
          </Text>
        )}
        {bubbles.map((b) => {
          const mine = b.sender === me;
          const left = Math.ceil(b.leftMs / 1000);
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
              disabled={waiting}
              placeholder={waiting ? 'En attente...' : "Écris... (s'efface en 1 min)"}
              style={{ flexGrow: 1 }}
              autoFocus
            />
            <Button type="submit" variant="Primary" disabled={sending || waiting}>
              <Text size="B400">Envoyer</Text>
            </Button>
          </Box>
        </form>
      )}
    </Box>
  );
}
