import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

type Kind = 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'info';

const palette: Record<Kind, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
  info: { bg: colors.infoSoft, fg: colors.info },
};

export interface BadgeProps {
  label: string;
  kind?: Kind;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Small status/label pill. Icons accompany colour so meaning never relies on colour alone. */
export function Badge({ label, kind = 'neutral', icon }: BadgeProps) {
  const { bg, fg } = palette[kind];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={11} color={fg} style={{ marginRight: 3 }} /> : null}
      <AppText variant="small" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
