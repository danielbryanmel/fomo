import { Redirect } from 'expo-router';
import { FomoSaveIcon } from '@/components/icons/FomoIcons';
import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { Activity, Newspaper, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnboardingStatus } from '@/features/onboarding/onboardingStore';
import { colors } from '@/theme';

export default function TabLayout() {
  const onboarding = useOnboardingStatus();
  const auth = useAuth();
  const loading = onboarding === 'loading' || auth.status === 'loading';

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;
  if (onboarding === 'pending') return <Redirect href="/onboarding" />;
  // com Supabase configurado, exige login e @username; em modo demo segue direto
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (auth.status === 'needsProfile') return <Redirect href="/username" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explorar', tabBarIcon: ({ color, size }) => <Activity size={size} color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Newspaper size={size} color={color} /> }} />
      <Tabs.Screen name="publish" options={{ title: 'Publicar', tabBarAccessibilityLabel: 'Publicar um rolê' }} />
      <Tabs.Screen name="saved" options={{ title: 'Quero ir', tabBarIcon: ({ color, size, focused }) => <FomoSaveIcon size={size} color={String(color)} active={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} /> }} />
    </Tabs>
  );
}
