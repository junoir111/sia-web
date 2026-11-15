// SIA: provider availability — the "Disponible" switch and the status circles on the wall.
import React, { useState } from 'react';
import { Box, Button, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { MODALITE_LABELS, SiaProfile } from './profile';
import { formatRemaining, publishStatut, removeOwnStatuts, SiaAnnonce } from './wall';

type StatutToggleProps = { roomId: string; profile: SiaProfile; annonces: SiaAnnonce[] };

/** One tap: "Disponible" shows our circle on the wall (24 h at most), "Pas disponible" removes it. */
export function StatutToggle({ roomId, profile, annonces }: StatutToggleProps) {
  const mx = useMatrixClient();
  const [busy, setBusy] = useState(false);
  const me = mx.getUserId();
  const available = annonces.some((a) => a.statut && a.sender === me);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (available) removeOwnStatuts(mx, roomId, annonces);
      else await publishStatut(mx, roomId, profile);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      alignItems="Center"
      justifyContent="SpaceBetween"
      gap="300"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        border: `1px solid ${available ? color.Primary.Main : color.SurfaceVariant.ContainerLine}`,
        backgroundColor: color.SurfaceVariant.Container,
        color: color.SurfaceVariant.OnContainer,
      }}
    >
      <Box direction="Column">
        <Text size="H5">{available ? '🟢 Disponible' : '🔴 Pas disponible'}</Text>
        <Text size="T200" priority="400">
          {available ? 'Ton cercle est visible sur le Mur.' : 'Personne ne te voit sur le Mur.'}
        </Text>
      </Box>
      <Button
        variant={available ? 'Secondary' : 'Primary'}
        fill={available ? 'Soft' : 'Solid'}
        onClick={handleToggle}
        disabled={busy}
      >
        <Text size="B400">{available ? 'Me rendre indisponible' : 'Me rendre disponible'}</Text>
      </Button>
    </Box>
  );
}

const CIRCLE = toRem(64);

type StatutCirclesProps = {
  statuts: SiaAnnonce[];
  now: number;
  me: string | null;
  onDispo?: (annonce: SiaAnnonce) => void;
  dispoBusy?: string;
};

/** Row of status circles; tapping one shows what this provider offers. */
export function StatutCircles({ statuts, now, me, onDispo, dispoBusy }: StatutCirclesProps) {
  const [selectedId, setSelectedId] = useState<string>();
  if (statuts.length === 0) return null;
  const selected = statuts.find((a) => a.eventId === selectedId);

  return (
    <Box direction="Column" gap="300">
      <Text size="L400" priority="400">
        DISPONIBLES MAINTENANT
      </Text>
      <Box gap="300" style={{ overflowX: 'auto', paddingBottom: config.space.S100 }}>
        {statuts.map((a) => {
          const active = a.eventId === selectedId;
          return (
            <Box
              as="button"
              type="button"
              key={a.eventId}
              direction="Column"
              alignItems="Center"
              gap="100"
              shrink="No"
              onClick={() => setSelectedId(active ? undefined : a.eventId)}
              aria-label={`${a.pseudo}, ${a.categorie}, ${a.zone}`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
                width: toRem(84),
                padding: 0,
              }}
            >
              <Box
                alignItems="Center"
                justifyContent="Center"
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: '50%',
                  border: `${toRem(3)} solid ${color.Primary.Main}`,
                  outline: active ? `${toRem(2)} solid ${color.Secondary.Main}` : 'none',
                  outlineOffset: toRem(2),
                  backgroundColor: color.Primary.Container,
                  color: color.Primary.OnContainer,
                }}
              >
                <Text size="H3">{(a.categorie || a.pseudo).charAt(0).toUpperCase()}</Text>
              </Box>
              <Text size="T200" truncate style={{ maxWidth: '100%' }}>
                {a.categorie || a.pseudo}
              </Text>
              <Text size="T200" priority="400" truncate style={{ maxWidth: '100%' }}>
                {a.zone}
              </Text>
            </Box>
          );
        })}
      </Box>
      {selected && (
        <Box
          direction="Column"
          gap="200"
          style={{
            padding: config.space.S400,
            borderRadius: config.radii.R400,
            border: `1px solid ${color.Primary.MainLine}`,
            backgroundColor: color.SurfaceVariant.Container,
            color: color.SurfaceVariant.OnContainer,
          }}
        >
          <Text size="L400" style={{ color: color.Primary.Main }}>
            PRESTATAIRE · {selected.pseudo}
          </Text>
          <Text size="H4">{selected.categorie || 'Service'}</Text>
          <Text size="T300">📍 {selected.zone}</Text>
          {selected.modalite && <Text size="T300">{MODALITE_LABELS[selected.modalite]}</Text>}
          <Text size="T200" priority="400">
            Disponible encore {formatRemaining(selected.fin, now)}
          </Text>
          {selected.sender !== me && onDispo && (
            <Box>
              <Button
                variant="Primary"
                onClick={() => onDispo(selected)}
                disabled={dispoBusy === selected.eventId}
              >
                <Text size="B400">
                  {dispoBusy === selected.eventId ? 'Ouverture...' : 'Tu es dispo ?'}
                </Text>
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
