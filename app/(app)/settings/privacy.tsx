import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { brand } from '../../../src/config/brand';
import { colors, spacing } from '../../../src/theme';

/** Plain-English privacy explanation. Honest about limits — no overclaiming. */
export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Privacy and data</AppText>
        <View style={styles.navButton} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Section
          icon="folder-outline"
          title="What is stored"
          body={`The original photos or PDFs you add, the text read from them, the details extracted from that text (like policy numbers and dates), your corrections, tags, reminders, and your email address for signing in. Nothing else is collected — ${brand.name} has no analytics or tracking.`}
        />
        <Section
          icon="server-outline"
          title="Where it is stored and processed"
          body="Your documents live in a private storage area and database hosted on Supabase, protected by row-level security so only your signed-in account can access them. Files are encrypted in transit and at rest by the hosting platform. This is not end-to-end encryption: like most cloud services, the infrastructure operator could technically access stored data, so treat the app as private, not secret."
        />
        <Section
          icon="sparkles-outline"
          title="How AI analysis works"
          body="When a document is analysed, its pages are sent securely to Anthropic's Claude API to read the text and suggest structured details. The AI can make mistakes — that is why every extraction is shown to you for review, why each detail records whether it was AI-read or confirmed by you, and why answers always link back to the original page. Always verify critical details (amounts, deadlines, account numbers) against the original document."
        />
        <Section
          icon="link-outline"
          title="Answers are grounded"
          body="The Ask feature only uses documents in your own household. If the answer isn't in your documents, it says so rather than guessing."
        />
        <Section
          icon="trash-outline"
          title="Deleting your data"
          body="Deleting a document permanently removes the original file, its extracted text and details, and linked reminders. Deleting your account (Settings → Delete account and data) removes every document, all extracted data, reminders, conversations and your sign-in — immediately and irreversibly at the application level; the platform's routine backups age out on the provider's schedule."
        />
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={colors.accent} />
        <AppText variant="heading">{title}</AppText>
      </View>
      <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm, lineHeight: 19 }}>
        {body}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
