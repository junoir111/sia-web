// SIA: "Le Mur" page — publish, see and filter ephemeral announcements.
import React, { FormEvent, useState } from 'react';
import { Box, Button, Input, Scroll, Text, color, config, toRem } from 'folds';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { openBulle } from './bulle';
import { siaBullePath } from './paths';
import { SiaBulleList } from './SiaBulleList';
import { ROLE_LABELS, SiaProfile, formatPrix } from './profile';
import { cleanBudget } from './wallLogic';
import { MetierTile, metierKey, metierTiles } from './murLogic';
import { useSiaProfile } from './useSiaProfile';
import { AUTRE_QUARTIER, QUARTIERS, resolveZone } from './quartiers';
import { QUARTIERS_LIST_ID, SiaQuartierList } from './SiaQuartierList';
import { StatutCircles, StatutToggle } from './SiaStatut';
import { useWall } from './useWall';
import { DURATIONS_HOURS, formatRemaining, publishAnnonce, SiaAnnonce } from './wall';

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
        budget: cleanBudget(String(form.get('budget') ?? '').replace(/[^0-9]/g, '')),
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
        {!isPrestataire && (
          <Text size="T200" priority="400">
            Les prestataires en ligne reçoivent ta demande. Ceux qui acceptent t&apos;envoient une
            offre : tu choisis avec qui parler.
          </Text>
        )}
        <Input
          variant="Background"
          outlined
          name="texte"
          maxLength={280}
          autoFocus
          placeholder={
            isPrestataire ? 'Dispo de 14 h à 17 h pour dépannage' : 'Fuite sous l’évier, ce soir'
          }
        />
        <Box gap="200" wrap="Wrap">
          <Input
            variant="Background"
            outlined
            name="categorie"
            maxLength={60}
            defaultValue={profile.metier}
            placeholder={isPrestataire ? 'Catégorie' : 'Service (ex. plombier)'}
            style={{ flexGrow: 1, minWidth: toRem(140) }}
          />
          {!isPrestataire && (
            <Input
              variant="Background"
              outlined
              name="budget"
              inputMode="numeric"
              maxLength={11}
              placeholder="Ton budget (FCFA)"
              style={{ flexGrow: 1, minWidth: toRem(140) }}
            />
          )}
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
  // A provider answers a client's request; a client asks a provider.
  const actionLabel = isPrestataire ? 'Tu es dispo ?' : "J'accepte cette demande";
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
      {annonce.budget > 0 && (
        <Text size="T300" style={{ color: color.Primary.Main }}>
          Budget : {formatPrix(annonce.budget)}
        </Text>
      )}
      {!isMine && onDispo && (
        <Box>
          <Button size="300" variant="Primary" onClick={onDispo} disabled={dispoBusy}>
            <Text size="B300">{dispoBusy ? 'Ouverture...' : actionLabel}</Text>
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

type MetierGridProps = {
  tiles: MetierTile[];
  onOpen: (key: string) => void;
};

/** Le Mur n°4: one tile per trade, with how many are available and how many clients ask. */
function MetierGrid({ tiles, onOpen }: MetierGridProps) {
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: config.space.S300,
      }}
    >
      {tiles.map((t) => {
        const active = t.dispo > 0 || t.demandes > 0;
        return (
          <Box
            as="button"
            type="button"
            key={t.key}
            direction="Column"
            justifyContent="SpaceBetween"
            gap="400"
            onClick={() => onOpen(t.key)}
            aria-label={`${t.label} : ${t.dispo} disponible(s), ${t.demandes} demande(s)`}
            style={{
              ...cardStyle,
              minHeight: toRem(120),
              textAlign: 'left',
              cursor: 'pointer',
              font: 'inherit',
              border: `1px solid ${active ? color.Primary.Main : color.SurfaceVariant.ContainerLine}`,
            }}
          >
            <Box justifyContent="SpaceBetween" alignItems="Start" gap="200">
              <Text size="H5" truncate>
                {t.label}
              </Text>
              {t.dispo > 0 && (
                <Box
                  shrink="No"
                  style={{
                    width: toRem(12),
                    height: toRem(12),
                    borderRadius: '50%',
                    backgroundColor: color.Primary.Main,
                  }}
                />
              )}
            </Box>
            <Box direction="Column" gap="100">
              <Text
                size="T300"
                style={{ color: t.dispo > 0 ? color.Primary.Main : undefined }}
                priority={t.dispo > 0 ? undefined : '400'}
              >
                {t.dispo > 0 ? `${t.dispo} dispo` : 'personne de dispo'}
              </Text>
              {t.demandes > 0 && (
                <Text size="T200" priority="400">
                  {t.demandes} demande{t.demandes > 1 ? 's' : ''} de client
                </Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function SiaWall() {
  const mx = useMatrixClient();
  const profile = useSiaProfile();
  const { roomId, annonces, error, now } = useWall();
  const [publishing, setPublishing] = useState(false);
  const [search, setSearch] = useState('');
  const [metier, setMetier] = useState<string>();
  const me = mx.getUserId();
  const navigate = useNavigate();
  const [dispoBusy, setDispoBusy] = useState<string>();

  const query = search.trim().toLowerCase();
  const found = annonces.filter(
    (a) =>
      !query || a.zone.toLowerCase().includes(query) || a.categorie.toLowerCase().includes(query)
  );
  const tiles = metierTiles(found);
  const demandesCount = found.filter((a) => a.role === 'client').length;
  const visible = metier ? found.filter((a) => metierKey(a.categorie) === metier) : [];
  const metierLabel = tiles.find((t) => t.key === metier)?.label ?? 'Métier';

  const statuts = visible.filter((a) => a.statut);
  const cards = visible.filter((a) => !a.statut);

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

  const openPublish = () => {
    setPublishing(true);
    document.getElementById('sia-mur-haut')?.scrollIntoView({ behavior: 'smooth' });
  };

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
          <Box id="sia-mur-haut" direction="Column">
            <Text size="T200" priority="400" style={{ letterSpacing: toRem(4) }}>
              SIA
            </Text>
            <Text size="H2">Le Mur</Text>
          </Box>

          <Input
            variant="Background"
            outlined
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setMetier(undefined);
            }}
            list={QUARTIERS_LIST_ID}
            autoComplete="off"
            placeholder="Ton quartier ou un métier"
            style={{ borderRadius: toRem(999) }}
          />
          <SiaQuartierList />

          {publishing && profile && roomId && (
            <PublishForm roomId={roomId} profile={profile} onDone={() => setPublishing(false)} />
          )}

          {profile?.role === 'prestataire' && roomId && (
            <StatutToggle roomId={roomId} profile={profile} annonces={annonces} />
          )}

          <SiaBulleList />

          {error && <Text size="T300">{error}</Text>}
          {!error && !roomId && <Text priority="400">Connexion au Mur...</Text>}

          {roomId && !metier && tiles.length === 0 && (
            <Box direction="Column" gap="100" style={cardStyle}>
              <Text size="H5">Rien pour l&apos;instant</Text>
              <Text size="T300" priority="400">
                {query
                  ? 'Personne pour cette recherche. Essaie un autre quartier ou métier.'
                  : 'Les annonces disparaissent toutes seules à la fin de leur créneau. Touche + pour publier.'}
              </Text>
            </Box>
          )}
          {roomId && !metier && tiles.length > 0 && (
            <MetierGrid tiles={tiles} onOpen={setMetier} />
          )}
          {roomId && !metier && demandesCount > 0 && (
            <Text size="T300" priority="400">
              {demandesCount} client{demandesCount > 1 ? 's cherchent' : ' cherche'} quelqu&apos;un
              en ce moment.
            </Text>
          )}

          {metier && (
            <Box alignItems="Center" gap="300">
              <Button size="300" variant="Secondary" fill="Soft" onClick={() => setMetier(undefined)}>
                <Text size="B300">← Tous les métiers</Text>
              </Button>
              <Text size="H4" truncate>
                {metierLabel}
              </Text>
            </Box>
          )}
          {metier && (
            <StatutCircles
              statuts={statuts}
              now={now}
              me={me}
              onDispo={profile?.role === 'client' ? handleDispo : undefined}
              dispoBusy={dispoBusy}
            />
          )}
          {metier && visible.length === 0 && (
            <Text size="T300" priority="400">
              Plus rien dans ce métier pour l&apos;instant.
            </Text>
          )}
          {cards.map((a) => (
            <AnnonceCard
              key={a.eventId}
              annonce={a}
              now={now}
              isMine={a.sender === me}
              onRemove={() => handleRemove(a.eventId)}
              onDispo={profile && profile.role !== a.role ? () => handleDispo(a) : undefined}
              dispoBusy={dispoBusy === a.eventId}
            />
          ))}
          {/* Room under the last tile so the round button never hides it. */}
          <Box style={{ height: toRem(72) }} shrink="No" />
        </Box>
      </Scroll>
      {!publishing && profile && roomId && (
        <Button
          variant="Primary"
          onClick={openPublish}
          aria-label="Publier une annonce"
          style={{
            position: 'fixed',
            right: toRem(20),
            bottom: `calc(${toRem(20)} + env(safe-area-inset-bottom, 0px))`,
            width: toRem(60),
            height: toRem(60),
            borderRadius: '50%',
            padding: 0,
            zIndex: 10,
          }}
        >
          <Text size="H2">+</Text>
        </Button>
      )}
    </Box>
  );
}
