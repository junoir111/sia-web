// SIA: requests received ("Tu es dispo ?"), offers on a client's request, and open bubbles, on the wall.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientEvent, Room, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { Box, Button, Text, color, config } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import {
  acceptBulle,
  chooseOffre,
  declineBulle,
  getBulleState,
  isBulleRoom,
  wasRefused,
} from './bulle';
import { Invitation, parseReason, siblingOffers } from './offres';
import { siaBullePath } from './paths';

function useBulleRooms(): Room[] {
  const mx = useMatrixClient();
  const [, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    mx.on(ClientEvent.Room, bump);
    mx.on(RoomEvent.MyMembership, bump);
    mx.on(RoomEvent.Name, bump);
    mx.on(RoomStateEvent.Members, bump);
    return () => {
      mx.off(ClientEvent.Room, bump);
      mx.off(RoomEvent.MyMembership, bump);
      mx.off(RoomEvent.Name, bump);
      mx.off(RoomStateEvent.Members, bump);
    };
  }, [mx]);
  return mx.getRooms().filter(isBulleRoom);
}

const boxStyle = {
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  border: `1px solid ${color.Primary.MainLine}`,
  borderRadius: config.radii.R400,
  padding: config.space.S300,
};

type InviteCardProps = {
  text: string;
  isOffer: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

function InviteCard({ text, isOffer, busy, onAccept, onDecline }: InviteCardProps) {
  return (
    <Box direction="Column" gap="200" style={boxStyle}>
      <Text size="L400" style={{ color: color.Primary.Main }}>
        {isOffer ? 'OFFRE REÇUE' : 'DEMANDE REÇUE'}
      </Text>
      <Text size="T300">{text || 'Tu es dispo ?'}</Text>
      <Box gap="200">
        <Button size="300" variant="Secondary" fill="Soft" disabled={busy} onClick={onDecline}>
          <Text size="B300">Refuser</Text>
        </Button>
        <Button size="300" variant="Primary" disabled={busy} onClick={onAccept}>
          <Text size="B300">{isOffer ? 'Choisir → ouvrir la bulle' : 'Je suis dispo → ouvrir la bulle'}</Text>
        </Button>
      </Box>
    </Box>
  );
}

export function SiaBulleList() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const rooms = useBulleRooms();
  const [busy, setBusy] = useState<string>();
  const [refused, setRefused] = useState(false);
  const me = mx.getUserId() ?? '';

  const invites = rooms.filter((r) => r.getMyMembership() === 'invite');
  const open = rooms.filter((r) => r.getMyMembership() === 'join' && !wasRefused(r, me));
  const refusedRooms = rooms.filter((r) => wasRefused(r, me));
  const refusedKey = refusedRooms.map((r) => r.roomId).join(',');

  // An offer the client did not pick (or a request refused): that bubble simply disappears.
  useEffect(() => {
    refusedKey
      .split(',')
      .filter(Boolean)
      .forEach((roomId) => declineBulle(mx, roomId).catch(() => undefined));
  }, [mx, refusedKey]);

  if (invites.length === 0 && open.length === 0 && !refused) return null;

  const invitations: Invitation[] = invites.map((room) => ({
    roomId: room.roomId,
    reason: room.getMember(me)?.events.member?.getContent().reason,
  }));
  const offerCount = invitations.filter((i) => parseReason(i.reason).ref).length;

  const handleAccept = async (roomId: string) => {
    setBusy(roomId);
    setRefused(false);
    try {
      await chooseOffre(mx, roomId, siblingOffers(invitations, roomId));
      navigate(siaBullePath(roomId));
    } catch {
      setRefused(true);
    } finally {
      setBusy(undefined);
    }
  };

  const handleDecline = async (roomId: string) => {
    setBusy(roomId);
    await declineBulle(mx, roomId).catch(() => undefined);
    setBusy(undefined);
  };

  return (
    <Box direction="Column" gap="200">
      {refused && <Text size="T300">Demande non valide : elle a été refusée.</Text>}
      {offerCount > 1 && (
        <Text size="T300">
          {offerCount} prestataires ont accepté ta demande. Choisis avec qui parler : les autres
          seront effacés.
        </Text>
      )}
      {invitations.map((inv) => {
        const { text, ref } = parseReason(inv.reason);
        return (
          <InviteCard
            key={inv.roomId}
            text={text}
            isOffer={!!ref}
            busy={busy === inv.roomId}
            onAccept={() => handleAccept(inv.roomId)}
            onDecline={() => handleDecline(inv.roomId)}
          />
        );
      })}
      {open.map((room) => {
        const state = getBulleState(room);
        const other = room
          .getMembers()
          .find((m) => m.userId !== me && (m.membership === 'join' || m.membership === 'invite'));
        const alias = other ? state?.aliases[other.userId] : undefined;
        return (
          <Button
            key={room.roomId}
            variant="Secondary"
            fill="Soft"
            onClick={() => navigate(siaBullePath(room.roomId))}
            style={{ justifyContent: 'flex-start' }}
          >
            <Text size="B400">
              💬 Bulle avec {alias ?? 'quelqu’un'}
              {other?.membership === 'invite' ? ' (en attente)' : ''}
            </Text>
          </Button>
        );
      })}
    </Box>
  );
}
