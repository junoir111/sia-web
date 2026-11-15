// SIA: "Le Mur" page — publish, see and filter ephemeral announcements.
import React, { FormEvent, useState } from 'react';
import { Box, Button, Input, Scroll, Text, color, config, toRem } from 'folds';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { openBulle } from './bulle';
import { siaBullePath } from './paths';
import { SiaBulleList } from './SiaBulleList';
import { ROLE_LABELS, SiaProfile, SiaRole } from './profile';
import { useSiaProfile } from './useSiaProfile';
import { AUTRE_QUARTIER, QUARTIERS, resolveZone } from './quartiers';
import { useWall } from './useWall';
import { DURATIONS_HOURS, formatRemaining, publishAnnonce, SiaAnnonce } from './wall';

type RoleFilter = 'tous' | SiaRole;

const cardStyle = {
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
  borderRadius: config.radii.R400,
  padding: config.space.S400,
};

function ZoneField({ defaultZone }: { defaultZone: string }) {
  const known = QUARTIERS.includes(defaultZone);
  const [choice, setChoice] = useState(known ? defaultZone : AUTRE_QUARTIER);
  return (
    <Box gap="200" style={{ flexGrow: 1, minWidth: 0 }} wrap="Wrap">
      <select
        name="zone"
        value={choice}
        onChange={(e) => setChoice(e.currentTarget.value)}
        style={{
          flexGrow: 1,
          minWidth: toRem(140),
          height: toRem(36),
          padding: `0 ${config.space.S200}`,
          borderRadius: config.radii.R300,
          border: `1px solid ${color.Background.ContainerLine}`,
          backgroundColor: color.Background.Container,
          color: color.Background.OnContainer,
          fontFamily: 'inherit',
        }}
      >
        {QUARTIERS.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
        <option value={AUTRE_QUARTIER}>Autre (écrire le quartier)</option>
      </select>
      {choice === AUTRE_QUARTIER && (
        <Input
          variant="Background"
          outlined
          name="zoneAutre"
          maxLength={40}
          defaultValue={known ? '' : defaultZone}
          placeholder="Ton quartier"
          style={{ flexGrow: 1, minWidth: toRem(140) }}
        />
      )}
    </Box>
  );
}

type PublishFormProps = { roomId: string; profile: SiaProfile; onDone: () => void };

function PublishForm({ roomId, profile, onDone }: PublishFormProps) {
  const mx = useMatrixClient();
  const [duree, setDuree] = useState<number>(3);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const isPrestataire = profile.role === 'prestataire';

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const form = new FormData(evt.currentTarget);
    const texte = String(form.get('texte') ?? '').trim();
    if (!texte) {
      setError("Écris ton annonce d'abord.");
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      await publishAnnonce(mx, roomId, profile, {
        texte,
        categorie: String(form.get('categorie') ?? ''),
        zone: resolveZone(String(form.get('zone') ?? ''), String(form.get('zoneAutre') ?? '')),
        dureeHeures: duree,
      });
      onDone();
    } catch {
      setError("L'annonce n'est pas partie. Réessaie.");
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <Box direction="Column" gap="300">
        <Text size="H5">{isPrestataire ? 'Je suis disponible' : "J'ai besoin d'un service"}</Text>
        <Input
          variant="Background"
          outlined
          name="texte"
          maxLength={280}
          autoFocus
          placeholder={
            isPrestataire ? 'Dispo de 14 h à 17 h pour dépannage' : 'Besoin d’un plombier ce soir'
          }
        />
        <Box gap="200">
          <Input
            variant="Background"
            outlined
            name="categorie"
            maxLength={60}
            defaultValue={profile.metier}
            placeholder="Catégorie"
            style={{ flexGrow: 1, minWidth: 0 }}
          />
          <ZoneField defaultZone={profile.zone} />
        </Box>
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Text size="T300">Visible pendant :</Text>
          {DURATIONS_HOURS.map((h) => (
            <Button
              key={h}
              type="button"
              size="300"
              variant={duree === h ? 'Primary' : 'Secondary'}
              fill={duree === h ? 'Solid' : 'Soft'}
              onClick={() => setDuree(h)}
            >
              <Text size="B300">{h} h</Text>
            </Button>
          ))}
        </Box>
        {error && <Text size="T300">{error}</Text>}
        <Box gap="200">
          <Button type="button" variant="Secondary" fill="Soft" onClick={onDone} disabled={sending}>
            <Text size="B400">Annuler</Text>
          </Button>
          <Button type="submit" variant="Primary" disabled={sending} style={{ flexGrow: 1 }}>
            <Text size="B400">{sending ? 'Publication...' : 'Publier'}</Text>
          </Button>
        </Box>
      </Box>
    </form>
  );
}

type AnnonceCardProps = {
  annonce: SiaAnnonce;
  now: number;
  isMine: boolean;
  onRemove: () => void;
  onDispo?: () => void;
  dispoBusy?: boolean;
};

function AnnonceCard({ annonce, now, isMine, onRemove, onDispo, dispoBusy }: AnnonceCardProps) {
  const isPrestataire = annonce.role === 'prestataire';
  return (
    <Box direction="Column" gap="200" style={cardStyle}>
      <Box justifyContent="SpaceBetween" alignItems="Center" gap="200">
        <Text
          size="L400"
          style={{ color: isPrestataire ? color.Primary.Main : color.Secondary.Main }}
        >
          {ROLE_LABELS[annonce.role].title.toUpperCase()} · {annonce.pseudo}
        </Text>
        <Text size="T200" priority="400">
          ⏱ {formatRemaining(annonce.fin, now)}
        </Text>
      </Box>
      <Text size="T400">{annonce.texte}</Text>
      <Text size="T300" priority="400">
        {[annonce.categorie, annonce.zone].filter(Boolean).join(' · ')}
      </Text>
      {!isMine && onDispo && (
        <Box>
          <Button size="300" variant="Primary" onClick={onDispo} disabled={dispoBusy}>
            <Text size="B300">{dispoBusy ? 'Ouverture...' : 'Tu es dispo ?'}</Text>
          </Button>
        </Box>
      )}
      {isMine && (
        <Box>
          <Button size="300" variant="Secondary" fill="Soft" onClick={onRemove}>
            <Text size="B300">Retirer mon annonce</Text>
          </Button>
        </Box>
      )}
    </Box>
  );
}

export function SiaWall() {
  const mx = useMatrixClient();
  const profile = useSiaProfile();
  const { roomId, annonces, error, now } = useWall();
  const [publishing, setPublishing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('tous');
  const [zoneFilter, setZoneFilter] = useState('');
  const me = mx.getUserId();
  const navigate = useNavigate();
  const [dispoBusy, setDispoBusy] = useState<string>();

  const zone = zoneFilter.trim().toLowerCase();
  const visible = annonces
    .filter((a) => roleFilter === 'tous' || a.role === roleFilter)
    .filter(
      (a) =>
        !zone || a.zone.toLowerCase().includes(zone) || a.categorie.toLowerCase().includes(zone)
    );

  const handleDispo = async (annonce: SiaAnnonce) => {
    if (!roomId || !profile) return;
    setDispoBusy(annonce.eventId);
    try {
      const bulleId = await openBulle(mx, roomId, annonce, profile);
      navigate(siaBullePath(bulleId));
    } catch {
      setDispoBusy(undefined);
    }
  };

  const handleRemove = (eventId: string) => {
    if (roomId) mx.redactEvent(roomId, eventId).catch(() => undefined);
  };

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'tous', label: 'Tout' },
    { id: 'prestataire', label: 'Prestataires' },
    { id: 'client', label: 'Clients' },
  ];

  return (
    <Box
      grow="Yes"
      direction="Column"
      style={{
        backgroundColor: color.Background.Container,
        color: color.Background.OnContainer,
        minWidth: 0,
      }}
    >
      <Scroll hideTrack visibility="Hover">
        <Box
          direction="Column"
          gap="400"
          style={{
            padding: config.space.S400,
            maxWidth: toRem(640),
            margin: '0 auto',
            width: '100%',
          }}
        >
          <Box justifyContent="SpaceBetween" alignItems="Center">
            <Box direction="Column">
              <Text size="T200" priority="400" style={{ letterSpacing: toRem(4) }}>
                SIA // LE MUR
              </Text>
              <Text size="H3">Annonces en direct</Text>
            </Box>
            {!publishing && profile && roomId && (
              <Button variant="Primary" onClick={() => setPublishing(true)}>
                <Text size="B400">+ Publier</Text>
              </Button>
            )}
          </Box>

          {publishing && profile && roomId && (
            <PublishForm roomId={roomId} profile={profile} onDone={() => setPublishing(false)} />
          )}

          <Box gap="200" alignItems="Center" wrap="Wrap">
            {filters.map((f) => (
              <Button
                key={f.id}
                size="300"
                variant={roleFilter === f.id ? 'Primary' : 'Secondary'}
                fill={roleFilter === f.id ? 'Solid' : 'Soft'}
                onClick={() => setRoleFilter(f.id)}
              >
                <Text size="B300">{f.label}</Text>
              </Button>
            ))}
            <Input
              variant="Background"
              outlined
              size="300"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.currentTarget.value)}
              placeholder="Zone ou métier..."
              style={{ flexGrow: 1, minWidth: toRem(140) }}
            />
          </Box>

          <SiaBulleList />

          {error && <Text size="T300">{error}</Text>}
          {!error && !roomId && <Text priority="400">Connexion au Mur...</Text>}
          {roomId && visible.length === 0 && (
            <Box direction="Column" gap="100" style={cardStyle}>
              <Text size="H5">Rien pour l&apos;instant</Text>
              <Text size="T300" priority="400">
                Les annonces disparaissent toutes seules à la fin de leur créneau. Publie la tienne.
              </Text>
            </Box>
          )}
          {visible.map((a) => (
            <AnnonceCard
              key={a.eventId}
              annonce={a}
              now={now}
              isMine={a.sender === me}
              onRemove={() => handleRemove(a.eventId)}
              onDispo={profile ? () => handleDispo(a) : undefined}
              dispoBusy={dispoBusy === a.eventId}
            />
          ))}
        </Box>
      </Scroll>
    </Box>
  );
}
