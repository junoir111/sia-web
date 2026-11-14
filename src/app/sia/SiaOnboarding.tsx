// SIA: first screen after login — "Tu es quoi ?" then the profile form.
import React, { FormEvent, useState } from 'react';
import { Box, Button, Input, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { ROLE_LABELS, SIA_PROFILE_EVENT, SiaProfile, SiaRole } from './profile';

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

type ProfileFormProps = {
  role: SiaRole;
  onBack: () => void;
};

function ProfileForm({ role, onBack }: ProfileFormProps) {
  const mx = useMatrixClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const isPrestataire = role === 'prestataire';

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    const form = new FormData(evt.currentTarget);
    const profile: SiaProfile = {
      role,
      pseudo: String(form.get('pseudo') ?? '').trim(),
      metier: String(form.get('metier') ?? '').trim(),
      zone: String(form.get('zone') ?? '').trim(),
    };
    if (!profile.pseudo || !profile.zone) {
      setError('Le pseudo et la zone sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
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
