// SIA: shows the onboarding until the user has chosen a role and filled a profile.
import React, { ReactNode } from 'react';
import { useAccountData } from '../hooks/useAccountData';
import { parseSiaProfile, SIA_PROFILE_EVENT } from './profile';
import { SiaOnboarding } from './SiaOnboarding';

export function SiaProfileGate({ children }: { children: ReactNode }) {
  const profileEvent = useAccountData(SIA_PROFILE_EVENT);
  const profile = parseSiaProfile(profileEvent?.getContent());

  if (!profile) return <SiaOnboarding />;
  return children;
}
