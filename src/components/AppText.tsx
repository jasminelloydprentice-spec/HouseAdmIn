import { Text, TextProps, TextStyle } from 'react-native';
import { colors, typography } from '../theme';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onAccent';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accent,
  danger: colors.danger,
  onAccent: colors.onAccent,
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

/** Themed text. Supports Dynamic Type via allowFontScaling (default on). */
export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      accessibilityRole={variant === 'largeTitle' || variant === 'title' ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: toneColor[tone], textAlign: align }, style]}
      {...rest}
    />
  );
}
