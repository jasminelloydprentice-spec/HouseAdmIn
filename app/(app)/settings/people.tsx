import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { TextField } from '../../../src/components/TextField';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePeople } from '../../../src/features/documents/hooks';
import { PersonKind } from '../../../src/features/documents/types';
import { supabase } from '../../../src/lib/supabase';
import { colors, radius, spacing } from '../../../src/theme';

const KIND_OPTIONS: { kind: PersonKind; label: string }[] = [
  { kind: 'partner', label: 'Partner' },
  { kind: 'child', label: 'Child' },
  { kind: 'household', label: 'Household' },
  { kind: 'business', label: 'Business' },
  { kind: 'custom', label: 'Other' },
];

/**
 * Lightweight household people: documents can be assigned to a person or
 * context. No sharing/permissions in the MVP — everyone in the household
 * (currently just you) sees everything.
 */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const { householdId } = useAuth();
  const qc = useQueryClient();
  const { data: people, refetch } = usePeople();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PersonKind>('partner');
  const [saving, setSaving] = useState(false);

  const addPerson = async () => {
    if (!name.trim() || !householdId) return;
    setSaving(true);
    const { error } = await supabase.from('people').insert({ household_id: householdId, name: name.trim(), kind });
    setSaving(false);
    if (error) {
      Alert.alert('Could not add', 'The person could not be added. Try again.');
      return;
    }
    setName('');
    void qc.invalidateQueries({ queryKey: ['people'] });
    void refetch();
  };

  const removePerson = (id: string, personName: string) => {
    Alert.alert(`Remove ${personName}?`, 'Documents assigned to them are kept and simply unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('people').delete().eq('id', id);
          void qc.invalidateQueries({ queryKey: ['people'] });
          void refetch();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading">Household people</AppText>
        <View style={styles.navButton} />
      </View>

      <FlatList
        data={people ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.lg }}>
            Assign documents to people or contexts so you can filter by them. Sharing with a partner’s own login is a
            planned future feature.
          </AppText>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.personRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium">{item.name}</AppText>
                <Badge label={item.kind === 'me' ? 'You' : (KIND_OPTIONS.find((k) => k.kind === item.kind)?.label ?? 'Other')} kind={item.kind === 'me' ? 'accent' : 'neutral'} />
              </View>
              {item.kind !== 'me' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => removePerson(item.id, item.name)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        )}
        ListFooterComponent={
          <Card style={{ marginTop: spacing.lg }}>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              Add a person
            </AppText>
            <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Sam" />
            <View style={styles.kindWrap}>
              {KIND_OPTIONS.map((option) => (
                <Pressable
                  key={option.kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === option.kind }}
                  accessibilityLabel={option.label}
                  onPress={() => setKind(option.kind)}
                  style={[styles.kindChip, kind === option.kind && styles.kindChipActive]}
                >
                  <AppText variant="captionMedium" style={{ color: kind === option.kind ? colors.onAccent : colors.textSecondary }}>
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <Button title="Add" onPress={() => void addPerson()} loading={saving} disabled={!name.trim()} style={{ marginTop: spacing.md }} />
          </Card>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  removeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
  },
  kindChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
});
