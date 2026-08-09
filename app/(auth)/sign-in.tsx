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
const MIN_PASSWORD = 8;

type Mode = 'password' | 'otp-email' | 'otp-code';

/**
 * Sign in.
 *
 * Password is the default because it has no external dependencies — email
 * delivery (SMTP provider, templates, rate limits) is a common source of
 * setup failure and locks the user out of their own documents. The email
 * one-time-code flow is kept as an alternative for deployments that have
 * working transactional email.
 *
 * New users are provisioned (household, profile, "Me" person) by a database
 * trigger — the client never performs privileged setup.
 */
export default function SignIn() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Supabase errors can be verbose; keep the useful sentence. */
  const readableError = (message: string): string => {
    const clean = message.split('\n')[0].trim();
    return clean.length > 160 ? `${clean.slice(0, 160)}…` : clean;
  };

  const validEmail = () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return null;
    }
    return trimmed;
  };

  const signInWithPassword = async () => {
    const trimmed = validEmail();
    if (!trimmed) return;
    if (password.length < 1) {
      setError('Enter your password.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    setLoading(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('invalid login')
          ? 'That email and password combination was not recognised.'
          : readableError(err.message),
      );
      return;
    }
    router.replace('/(app)/(tabs)');
  };

  const createAccount = async () => {
    const trimmed = validEmail();
    if (!trimmed) return;
    if (password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    const { data, error: err } = await supabase.auth.signUp({ email: trimmed, password });
    setLoading(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('already registered')
          ? 'An account already exists for that email — sign in instead.'
          : readableError(err.message),
      );
      return;
    }
    // With email confirmation enabled, signUp returns no session until the
    // address is verified. Say so rather than appearing to hang.
    if (!data.session) {
      setNotice('Account created. Confirm the email Supabase sent you, then sign in.');
      return;
    }
    router.replace('/(app)/(tabs)');
  };

  const sendCode = async () => {
    const trimmed = validEmail();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) {
      const message = err.message.toLowerCase();
      if (message.includes('rate') || message.includes('too many')) {
        setError('Too many attempts — please wait a few minutes and try again.');
      } else {
        setError(`Could not send the email: ${readableError(err.message)}`);
      }
      return;
    }
    setMode('otp-code');
  };

  const verifyCode = async () => {
    // Supabase's OTP length is configurable per project (commonly 6 or 8),
    // so accept any plausible length rather than hard-coding one.
    const trimmedCode = code.trim();
    if (!/^\d{4,12}$/.test(trimmedCode)) {
      setError('Enter the numeric code from your email.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: trimmedCode,
      type: 'email',
    });
    setLoading(false);
    if (err) {
      setError(
        err.message.toLowerCase().includes('expired')
          ? 'That code has expired — request a new one.'
          : 'That code was not accepted. Check it and try again, or request a new one.',
      );
      return;
    }
    router.replace('/(app)/(tabs)');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode('');
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

      {notice ? (
        <AppText tone="accent" style={{ marginBottom: spacing.lg }} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      {mode === 'password' ? (
        <>
          <TextField
            label="Email address"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
          />
          <TextField
            label="Password"
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            error={error}
            hint={`At least ${MIN_PASSWORD} characters when creating an account.`}
            onSubmitEditing={() => void signInWithPassword()}
          />
          <Button title="Sign in" onPress={() => void signInWithPassword()} loading={loading} />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => void createAccount()}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            title="Email me a code instead"
            variant="ghost"
            onPress={() => switchMode('otp-email')}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : mode === 'otp-email' ? (
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
            hint="We’ll email you a one-time sign-in code."
            onSubmitEditing={() => void sendCode()}
          />
          <Button title="Email me a code" onPress={() => void sendCode()} loading={loading} />
          <Button
            title="Use a password instead"
            variant="ghost"
            onPress={() => switchMode('password')}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : (
        <>
          <AppText tone="secondary" style={{ marginBottom: spacing.lg }}>
            We’ve sent a sign-in code to {email.trim()}. It can take a minute to arrive.
          </AppText>
          <TextField
            label="Sign-in code"
            placeholder="Code from your email"
            keyboardType="number-pad"
            autoFocus
            maxLength={12}
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
            title="Back"
            variant="ghost"
            onPress={() => switchMode('password')}
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
