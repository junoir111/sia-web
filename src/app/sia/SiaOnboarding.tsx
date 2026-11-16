// SIA: first screen after login — "Tu es quoi ?" then the profile form.
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Box, Button, Input, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { MAX_PHOTOS, compressImage, saveLocalPhotos } from './photos';
import {
  MAX_SERVICE_LABEL,
  MAX_SERVICES,
  MODALITE_LABELS,
  ROLE_LABELS,
  SIA_PROFILE_EVENT,
  SiaModalite,
  SiaProfile,
  SiaRole,
  SiaService,
  suggestedPseudo,
} from './profile';

type ServiceDraft = { label: string; prix: string };
const emptyServices = (): ServiceDraft[] =>
  Array.from({ length: MAX_SERVICES }, () => ({ label: '', prix: '' }));

type RoleCardProps = {
  siaRole: SiaRole;
  onChoose: (role: SiaRole) => void;
};

function RoleCard({ siaRole: role, onChoose }: RoleCardProps) {
  const { title, description } = ROLE_LABELS[role];
  return (
    <Button
      variant={role === 'prestataire' ? 'Primary' : 'Secondary'}
      fill={role === 'prestataire' ? 'Solid' : 'Soft'}
      size="500"
      onClick={() => onChoose(role)}
      style={{
        height: 'auto',
        padding: config.space.S400,
        justifyContent: 'flex-start',
        textAlign: 'left',
      }}
    >
      <Box direction="Column" gap="100" alignItems="Start">
        <Text size="H4">{title}</Text>
        <Text size="T300">{description}</Text>
      </Box>
    </Button>
  );
}

type PhotoPickerProps = {
  photos: (Blob | undefined)[];
  onPick: (index: number, blob: Blob) => void;
};

/** Three small square slots: tap to take a photo or pick one. Stays on the device only. */
function PhotoPicker({ photos, onPick }: PhotoPickerProps) {
  const urls = useMemo(
    () => photos.map((b) => (b ? URL.createObjectURL(b) : undefined)),
    [photos]
  );
  useEffect(
    () => () => urls.forEach((u) => (u ? URL.revokeObjectURL(u) : undefined)),
    [urls]
  );
  return (
    <Box gap="200">
      {photos.map((b, i) => (
        <Box
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          as="label"
          alignItems="Center"
          justifyContent="Center"
          style={{
            width: toRem(56),
            height: toRem(56),
            borderRadius: config.radii.R300,
            border: `1px ${b ? 'solid' : 'dashed'} ${color.Background.ContainerLine}`,
            backgroundColor: color.Background.Container,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (evt) => {
              const f = evt.currentTarget.files?.[0];
              evt.currentTarget.value = '';
              if (f) onPick(i, await compressImage(f));
            }}
          />
          {urls[i] ? (
            <img
              src={urls[i]}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Text size="H3" priority="400">
              +
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

type ProfileFormProps = {
  role: SiaRole;
  onBack: () => void;
};

function ProfileForm({ role, onBack }: ProfileFormProps) {
  const mx = useMatrixClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const isPrestataire = role === 'prestataire';
  const [modalite, setModalite] = useState<SiaModalite>('deplace');
  const [services, setServices] = useState<ServiceDraft[]>(emptyServices);
  const [photos, setPhotos] = useState<(Blob | undefined)[]>(() =>
    Array.from({ length: MAX_PHOTOS }, () => undefined)
  );

  const setService = (index: number, field: keyof ServiceDraft, value: string) =>
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));

  const setPhoto = (index: number, blob: Blob) =>
    setPhotos((prev) => prev.map((p, i) => (i === index ? blob : p)));

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const form = new FormData(evt.currentTarget);
    const builtServices: SiaService[] = isPrestataire
      ? services
          .map((s) => ({
            label: s.label.trim().slice(0, MAX_SERVICE_LABEL),
            prix: Math.max(0, Math.floor(Number(s.prix.replace(/[^0-9]/g, '')) || 0)),
          }))
          .filter((s) => s.label)
      : [];
    const profile: SiaProfile = {
      role,
      pseudo: String(form.get('pseudo') ?? '').trim(),
      metier: String(form.get('metier') ?? '').trim(),
      zone: String(form.get('zone') ?? '').trim(),
      modalite,
      services: builtServices,
    };
    if (!profile.pseudo || !profile.zone) {
      setError('Le pseudo et la zone sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (isPrestataire) {
        await saveLocalPhotos(photos.filter((b): b is Blob => !!b));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mx.setAccountData(SIA_PROFILE_EVENT as any, profile as any);
    } catch {
      setError("Impossible d'enregistrer. Vérifie ta connexion et réessaie.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box direction="Column" gap="400">
        <Text size="H3">Ton profil {ROLE_LABELS[role].title}</Text>
        <Text size="T300" priority="400">
          Jamais ton vrai nom. Seuls ton pseudo, ton {isPrestataire ? 'métier' : 'besoin'} et ta
          zone seront visibles.
        </Text>
        <Box direction="Column" gap="100">
          <Text size="L400">Pseudo</Text>
          <Input
            variant="Background"
            outlined
            name="pseudo"
            maxLength={30}
            defaultValue={suggestedPseudo(mx.getUserId())}
            placeholder="Delta-4"
            autoFocus
            required
          />
        </Box>
        <Box direction="Column" gap="100">
          <Text size="L400">
            {isPrestataire ? 'Ton métier / service' : 'Ce que tu cherches souvent'}
          </Text>
          <Input
            variant="Background"
            outlined
            name="metier"
            maxLength={60}
            placeholder={isPrestataire ? 'Plombier' : 'Dépannage, plomberie...'}
          />
        </Box>
        <Box direction="Column" gap="100">
          <Text size="L400">Ta zone (quartier)</Text>
          <Input
            variant="Background"
            outlined
            name="zone"
            maxLength={40}
            placeholder="PK12"
            required
          />
        </Box>
        {isPrestataire && (
          <Box direction="Column" gap="100">
            <Text size="L400">Décris ton service</Text>
            <Text size="T200" priority="400">
              Visible seulement dans la bulle · 3 lignes max · quoi + prix
            </Text>
            {services.map((s, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box key={i} gap="200">
                <Input
                  variant="Background"
                  outlined
                  value={s.label}
                  onChange={(evt) => setService(i, 'label', evt.currentTarget.value)}
                  maxLength={MAX_SERVICE_LABEL}
                  placeholder={i === 0 ? 'Débouchage évier' : 'Autre service...'}
                  style={{ flexGrow: 1 }}
                />
                <Input
                  variant="Background"
                  outlined
                  value={s.prix}
                  onChange={(evt) =>
                    setService(i, 'prix', evt.currentTarget.value.replace(/[^0-9]/g, ''))
                  }
                  inputMode="numeric"
                  placeholder="FCFA"
                  style={{ width: toRem(96) }}
                />
              </Box>
            ))}
          </Box>
        )}
        {isPrestataire && (
          <Box direction="Column" gap="100">
            <Box alignItems="Center" gap="200">
              <Text size="L400">Photos</Text>
              <Text size="T200" priority="400">
                3 max · optionnel · privé
              </Text>
            </Box>
            <PhotoPicker photos={photos} onPick={setPhoto} />
          </Box>
        )}
        {isPrestataire && (
          <Box direction="Column" gap="100">
            <Text size="L400">Comment tu travailles</Text>
            <Box gap="200" wrap="Wrap">
              {(Object.keys(MODALITE_LABELS) as SiaModalite[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="300"
                  variant={modalite === m ? 'Primary' : 'Secondary'}
                  fill={modalite === m ? 'Solid' : 'Soft'}
                  onClick={() => setModalite(m)}
                >
                  <Text size="B300">{MODALITE_LABELS[m]}</Text>
                </Button>
              ))}
            </Box>
          </Box>
        )}
        {error && (
          <Text size="T300" style={{ color: 'var(--sia-critical, #E69D9D)' }}>
            {error}
          </Text>
        )}
        <Box gap="300">
          <Button type="button" variant="Secondary" fill="Soft" onClick={onBack} disabled={saving}>
            <Text size="B400">Retour</Text>
          </Button>
          <Button type="submit" variant="Primary" disabled={saving} style={{ flexGrow: 1 }}>
            <Text size="B400">{saving ? 'Enregistrement...' : 'Entrer dans SIA'}</Text>
          </Button>
        </Box>
      </Box>
    </form>
  );
}

export function SiaOnboarding() {
  const [role, setRole] = useState<SiaRole>();

  return (
    <Box
      grow="Yes"
      alignItems="Center"
      justifyContent="Center"
      style={{
        padding: config.space.S400,
        overflowY: 'auto',
        backgroundColor: color.Background.Container,
        color: color.Background.OnContainer,
      }}
    >
      <Box direction="Column" gap="500" style={{ width: '100%', maxWidth: toRem(420) }}>
        <Text size="T200" priority="400" style={{ letterSpacing: toRem(4) }}>
          SIA // DISCRÉTION
        </Text>
        {role ? (
          <ProfileForm role={role} onBack={() => setRole(undefined)} />
        ) : (
          <>
            <Text size="H2">Tu es quoi ?</Text>
            <RoleCard siaRole="prestataire" onChoose={setRole} />
            <RoleCard siaRole="client" onChoose={setRole} />
            <Text size="T200" priority="400">
              Tu pourras changer plus tard dans ton profil.
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
