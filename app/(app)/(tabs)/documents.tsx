import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorView, LoadingView } from '../../../src/components/StateViews';
import { CATEGORIES } from '../../../src/config/categories';
import { LibraryFilters } from '../../../src/features/documents/api';
import { DocumentCard } from '../../../src/features/documents/DocumentCard';
import { useDocuments, usePeople, useProviders } from '../../../src/features/documents/hooks';
import { colors, radius, spacing, touchTarget, typography } from '../../../src/theme';

type QuickFilter = 'all' | 'action' | 'expiring';

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [category, setCategory] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
  const [personId, setPersonId] = useState<string | undefined>();
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');

  const filters = useMemo<LibraryFilters>(
    () => ({
      search: search.trim() || undefined,
      category,
      provider,
      personId,
      actionNeeded: quick === 'action' || undefined,
      expiringSoon: quick === 'expiring' || undefined,
      sort,
    }),
    [search, category, provider, personId, quick, sort],
  );

  const { data, isLoading, isError, refetch, isRefetching } = useDocuments(filters);
  const { data: providers } = useProviders();
  const { data: people } = usePeople();
  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p.name])), [people]);

  const hasFilters = !!(search.trim() || category || provider || personId || quick !== 'all');

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <AppText variant="largeTitle">Documents</AppText>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search documents"
          placeholder="Search titles, providers, numbers, words…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search.length > 0 ? (
          <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipsRow}>
        <FilterChip label="All" active={quick === 'all'} onPress={() => setQuick('all')} />
        <FilterChip label="Action needed" active={quick === 'action'} onPress={() => setQuick(quick === 'action' ? 'all' : 'action')} />
        <FilterChip label="Expiring soon" active={quick === 'expiring'} onPress={() => setQuick(quick === 'expiring' ? 'all' : 'expiring')} />
        <FilterChip
          label={sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : 'A–Z'}
          active={false}
          icon="swap-vertical-outline"
          onPress={() => setSort(sort === 'newest' ? 'oldest' : sort === 'oldest' ? 'title' : 'newest')}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c.slug}
        style={styles.categoryStrip}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <FilterChip
            label={item.label}
            active={category === item.slug}
            onPress={() => setCategory(category === item.slug ? undefined : item.slug)}
          />
        )}
      />

      {(providers ?? []).length > 0 || (people ?? []).length > 1 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            ...(providers ?? []).map((p) => ({ key: `prov:${p}`, label: p, type: 'provider' as const, id: p })),
            ...(people ?? []).map((p) => ({ key: `person:${p.id}`, label: p.name, type: 'person' as const, id: p.id })),
          ]}
          keyExtractor={(i) => i.key}
          style={styles.categoryStrip}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              icon={item.type === 'person' ? 'person-outline' : 'business-outline'}
              active={item.type === 'provider' ? provider === item.id : personId === item.id}
              onPress={() => {
                if (item.type === 'provider') setProvider(provider === item.id ? undefined : item.id);
                else setPersonId(personId === item.id ? undefined : item.id);
              }}
            />
          )}
        />
      ) : null}

      {isLoading ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView message="Your documents could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          renderItem={({ item }) => <DocumentCard doc={item} personName={item.person_id ? peopleById.get(item.person_id) : null} />}
          ListEmptyComponent={
            hasFilters ? (
              <EmptyState
                icon="search-outline"
                title="Nothing matches"
                message="Try different words or clear the filters."
              />
            ) : (
              <EmptyState
                icon="file-tray-outline"
                title="No documents yet"
                message="Photograph a letter or import a PDF and it will appear here."
                actionTitle="Scan paperwork"
                onAction={() => router.push('/(app)/(tabs)/scan')}
              />
            )
          }
        />
      )}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.onAccent : colors.textSecondary} style={{ marginRight: 4 }} /> : null}
      <AppText variant="captionMedium" style={{ color: active ? colors.onAccent : colors.textSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  categoryStrip: { marginTop: spacing.md, maxHeight: 40, flexGrow: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
});
