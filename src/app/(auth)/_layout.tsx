import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme';

/**
 * Fluxo de entrada guiado pelo estado de auth (sem depender de recarregar a página):
 *  signedOut → /login · needsProfile → /username · ready → app.
 */
export default function AuthLayout() {
  const { status } = useAuth();
  const segments = useSegments();
  const screen = segments[segments.length - 1];
  if (status === 'ready' || status === 'mock') return <Redirect href="/" />;
  if (status === 'needsProfile' && screen !== 'username') return <Redirect href="/username" />;
  if (status === 'signedOut' && screen === 'username') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />;
}
