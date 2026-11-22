import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'fomo.onboarding.v1';

export type OnboardingStatus = 'loading' | 'pending' | 'done';

/** Flag local (não sensível). Em caso de erro de storage, não bloqueia o app. */
export function useOnboardingStatus(): OnboardingStatus {
  const [status, setStatus] = useState<OnboardingStatus>('loading');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setStatus(v === 'done' ? 'done' : 'pending'))
      .catch(() => setStatus('done'));
  }, []);
  return status;
}

export async function completeOnboarding() {
  try {
    await AsyncStorage.setItem(KEY, 'done');
  } catch {
    // storage indisponível (ex.: navegação privada) — segue sem persistir
  }
}
