import { Redirect, Stack } from 'expo-router';
import { LoadingView } from '../../src/components/StateViews';
import { useAuth } from '../../src/features/auth/AuthContext';
import { colors } from '../../src/theme';

/** Auth guard: everything inside (app) requires a signed-in session. */
export default function AppLayout() {
  const { session, initialising, householdId, householdLoading } = useAuth();

  if (initialising) return <LoadingView />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (householdLoading && !householdId) return <LoadingView message="Setting up your household…" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
