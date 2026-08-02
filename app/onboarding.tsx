import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../src/components/AppText';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { brand } from '../src/config/brand';
import { colors, spacing } from '../src/theme';

const SLIDES = [
  {
    icon: 'file-tray-full-outline' as const,
    title: 'Keep important paperwork in one secure place.',
    body: 'Pensions, insurance, HMRC, NHS — everything the post brings, safely stored and private to you.',
  },
  {
    icon: 'camera-outline' as const,
    title: 'Photograph letters or import PDFs.',
    body: 'Snap each page, or bring in PDFs from email. The original document is always preserved.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Ask for details whenever you need them.',
    body: '“What is my pension number?” “When does the home insurance expire?” Just ask.',
  },
  {
    icon: 'link-outline' as const,
    title: 'Important answers always link to the original document.',
    body: 'Every answer shows its source page, so you can check the paperwork itself.',
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem('paperkeep.onboarded', 'true').catch(() => undefined);
    router.replace('/(auth)/sign-in');
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <AppText variant="title" tone="accent">
          {brand.name}
        </AppText>
      </View>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={40} color={colors.accent} />
            </View>
            <AppText variant="title" align="center">
              {item.title}
            </AppText>
            <AppText tone="secondary" align="center" style={{ marginTop: spacing.md }}>
              {item.body}
            </AppText>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button
          title={isLast ? 'Get started' : 'Continue'}
          onPress={() => {
            if (isLast) {
              void finish();
            } else {
              listRef.current?.scrollToIndex({ index: index + 1 });
              setIndex((i) => i + 1);
            }
          }}
        />
        {!isLast ? (
          <Button title="Skip" variant="ghost" onPress={() => void finish()} style={{ marginTop: spacing.sm }} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  footer: { padding: spacing.xl, paddingBottom: spacing.xxl },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent },
});
