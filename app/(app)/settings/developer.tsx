import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { env } from '../../../src/config/env';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { supabase } from '../../../src/lib/supabase';
import { colors, spacing } from '../../../src/theme';

/**
 * Rough usage/cost estimator, based on recorded token counts per processing
 * job. Prices are indicative defaults (per million tokens) and configurable
 * server-side; this screen exists for the developer/owner, gated behind
 * EXPO_PUBLIC_DEV_TOOLS.
 */
const INPUT_COST_PER_MTOK_GBP = 2.4; // ~ $3/MTok
const OUTPUT_COST_PER_MTOK_GBP = 12; // ~ $15/MTok

export default function DeveloperScreen() {
  const insets = useSafeAreaInsets();
  const { householdId } = useAuth();

  const { data } = useQuery({
    queryKey: ['dev-usage', householdId],
    enabled: !!householdId && env.devToolsEnabled,
    queryFn: async () => {
      const { data: jobs, error } = await supabase
        .from('processing_jobs')
        .select('status, input_tokens, output_tokens, pages_processed, model, created_at')
        .eq('household_id', householdId!);
      if (error) throw error;
      return jobs ?? [];
    },
  });

  const jobs = data ?? [];
  const succeeded = jobs.filter((j) => j.status === 'succeeded');
  const failed = jobs.filter((j) => j.status === 'failed');
  const inputTokens = succeeded.reduce((sum, j) => sum + (j.input_tokens ?? 0), 0);
  const outputTokens = succeeded.reduce((sum, j) => sum + (j.output_tokens ?? 0), 0);
  const pages = succeeded.reduce((sum, j) => sum + (j.pages_processed ?? 0), 0);
  const estimate = (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK_GBP + (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK_GBP;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Developer</AppText>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <AppText variant="heading">AI usage (this household)</AppText>
          <Row label="Analysis runs" value={`${succeeded.length} succeeded · ${failed.length} failed`} />
          <Row label="Pages processed" value={String(pages)} />
          <Row label="Input tokens" value={inputTokens.toLocaleString('en-GB')} />
          <Row label="Output tokens" value={outputTokens.toLocaleString('en-GB')} />
          <Row label="Estimated cost" value={`≈ £${estimate.toFixed(2)}`} />
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
            Rough estimate from recorded token counts at indicative rates (£{INPUT_COST_PER_MTOK_GBP}/M input, £
            {OUTPUT_COST_PER_MTOK_GBP}/M output). Actual billing is whatever your Anthropic account charges. Token
            counts never include document content.
          </AppText>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <AppText variant="heading">Environment</AppText>
          <Row label="Supabase URL" value={env.supabaseUrl.replace(/^https?:\/\//, '')} />
          <Row label="Mock AI expected" value={env.devMockAi ? 'yes' : 'no'} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="captionMedium">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.md },
});
