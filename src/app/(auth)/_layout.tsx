import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'ready' || status === 'mock') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
