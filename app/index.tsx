import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { LoadingView } from '../src/components/StateViews';
import { useAuth } from '../src/features/auth/AuthContext';

const ONBOARDED_KEY = 'paperkeep.onboarded';

export default function Index() {
  const { session, initialising } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === 'true'))
      .catch(() => setOnboarded(false));
  }, []);

  if (initialising || onboarded === null) return <LoadingView />;
  if (session) return <Redirect href="/(app)/(tabs)" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/sign-in" />;
}
