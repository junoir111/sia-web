// SIA: requests received ("Tu es dispo ?") and open bubbles, shown on the wall.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { Box, Button, Text, color, config } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { acceptBulle, declineBulle, getBulleState, isBulleRoom } from './bulle';
import { siaBullePath } from './paths';

function useBulleRooms(): Room[] {
  const mx = useMatrixClient();
  const [, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    mx.on(ClientEvent.Room, bump);
    mx.on(RoomEvent.MyMembership, bump);
    mx.on(RoomEvent.Name, bump);
    return () => {
      mx.off(ClientEvent.Room, bump);
      mx.off(RoomEvent.MyMembership, bump);
      mx.off(RoomEvent.Name, bump);
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

export function SiaBulleList() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const rooms = useBulleRooms();
  const [busy, setBusy] = useState<string>();
  const me = mx.getUserId() ?? '';

  const invites = rooms.filter((r) => r.getMyMembership() === 'invite');
  const open = rooms.filter((r) => r.getMyMembership() === 'join');
  if (invites.length === 0 && open.length === 0) return null;

  const handleAccept = async (roomId: string) => {
    setBusy(roomId);
    try {
      await acceptBulle(mx, roomId);
      navigate(siaBullePath(roomId));
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
      {invites.map((room) => {
        const reason = room.getMember(me)?.events.member?.getContent().reason;
        return (
          <Box key={room.roomId} direction="Column" gap="200" style={boxStyle}>
            <Text size="L400" style={{ color: color.Primary.Main }}>
              DEMANDE REÇUE
            </Text>
            <Text size="T300">{typeof reason === 'string' ? reason : 'Tu es dispo ?'}</Text>
            <Box gap="200">
              <Button
                size="300"
                variant="Secondary"
                fill="Soft"
                disabled={busy === room.roomId}
                onClick={() => handleDecline(room.roomId)}
              >
                <Text size="B300">Refuser</Text>
              </Button>
              <Button
                size="300"
                variant="Primary"
                disabled={busy === room.roomId}
                onClick={() => handleAccept(room.roomId)}
              >
                <Text size="B300">Je suis dispo → ouvrir la bulle</Text>
              </Button>
            </Box>
          </Box>
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
