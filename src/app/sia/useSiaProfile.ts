import { useAccountData } from '../hooks/useAccountData';
import { parseSiaProfile, SIA_PROFILE_EVENT, SiaProfile } from './profile';

export function useSiaProfile(): SiaProfile | undefined {
  const profileEvent = useAccountData(SIA_PROFILE_EVENT);
  return parseSiaProfile(profileEvent?.getContent());
}
