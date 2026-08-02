import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { brand } from '../../src/config/brand';
import { supabase } from '../../src/lib/supabase';
import { spacing } from '../../src/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email one-time-code sign in. Stage 1 sends the code; stage 2 verifies it.
 * New users are provisioned (household, profile, "Me" person) by a database
 * trigger — the client never performs privileged setup.
 */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) {
      setError(err.message.includes('rate') ? 'Too many attempts — please wait a minute and try again.' : 'Could not send the code. Check your connection and try again.');
      return;
    }
    setStage('code');
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (err) {
      setError('That code was not accepted. Check it and try again, or request a new one.');
      return;
    }
    router.replace('/(app)/(tabs)');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="largeTitle" tone="accent">
          {brand.name}
        </AppText>
        <AppText tone="secondary" style={{ marginTop: spacing.sm }} align="center">
          {brand.tagline}
        </AppText>
      </View>

      {stage === 'email' ? (
        <>
          <TextField
            label="Email address"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoFocus
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            error={error}
            hint="We’ll email you a one-time sign-in code. No password needed."
            onSubmitEditing={() => void sendCode()}
          />
          <Button title="Email me a code" onPress={() => void sendCode()} loading={loading} />
        </>
      ) : (
        <>
          <AppText tone="secondary" style={{ marginBottom: spacing.lg }}>
            We’ve sent a 6-digit code to {email.trim()}. It can take a minute to arrive.
          </AppText>
          <TextField
            label="Sign-in code"
            placeholder="123456"
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(null);
            }}
            error={error}
            onSubmitEditing={() => void verifyCode()}
          />
          <Button title="Sign in" onPress={() => void verifyCode()} loading={loading} />
          <Button
            title="Use a different email"
            variant="ghost"
            onPress={() => {
              setStage('email');
              setCode('');
              setError(null);
            }}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: spacing.xxxl },
});
