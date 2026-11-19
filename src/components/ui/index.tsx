import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ComponentProps, forwardRef, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TextInputInstance,
  TextInputProps,
  TextProps as RNTextProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography, TypographyVariant } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------- Text ---------- */

type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: string;
};

export function Text({ variant = 'body', color = colors.text.primary, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color }, style]} />;
}

/* ---------- Screen ---------- */

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  /** Conteúdo fixo no rodapé (ex.: botão principal) */
  footer?: ReactNode;
};

export function Screen({ children, scroll = false, style, footer }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.screenContent, { flexGrow: 1 }, style]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {content}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Header com voltar ---------- */

export function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
      </Pressable>
      <Text variant="h2">{title}</Text>
    </View>
  );
}

/* ---------- Logo ---------- */

export function Logo({ size = 32 }: { size?: number }) {
  const ring = size * 1.1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityLabel="GymBrô">
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: ring * 0.22,
          borderColor: colors.text.primary,
        }}
      />
      <Text variant="h1" style={{ fontSize: size, lineHeight: size * 1.2 }}>
        gymbr
        <Text variant="h1" color={colors.brand.red} style={{ fontSize: size, lineHeight: size * 1.2 }}>
          ô
        </Text>
      </Text>
    </View>
  );
}

/* ---------- Button (variantes do protótipo) ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
};

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brand.red, fg: colors.white },
  secondary: { bg: 'transparent', fg: colors.text.primary, border: colors.border.strong },
  success: { bg: colors.brand.green, fg: colors.bg.base },
  ghost: { bg: 'transparent', fg: colors.text.secondary },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const c = buttonColors[variant];
  const off = disabled && variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: off ? colors.bg.elevated : c.bg,
          borderColor: off ? colors.bg.elevated : (c.border ?? c.bg),
        },
        pressed && { opacity: 0.8 },
      ]}>
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <Text variant="labelButton" color={off ? colors.text.muted : c.fg}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/* ---------- Input ---------- */

type InputProps = TextInputProps & {
  label: string;
  icon?: IconName;
  error?: string;
  hint?: string;
  valid?: boolean;
  /** Mostra o botão de olho para ver/ocultar a senha */
  password?: boolean;
};

export const Input = forwardRef<TextInputInstance, InputProps>(function Input(
  { label, icon, error, hint, valid, password, style, ...rest },
  ref,
) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const state = error ? 'error' : valid ? 'valid' : focused ? 'focus' : 'idle';
  const borderColor = {
    error: colors.brand.red,
    valid: colors.brand.green,
    focus: colors.border.strong,
    idle: colors.border.default,
  }[state];
  const iconColor =
    state === 'error' ? colors.brand.red : state === 'valid' ? colors.brand.green : colors.text.muted;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="labelSmall" color={colors.text.secondary}>
        {label}
      </Text>
      <View style={[styles.inputBox, { borderColor }, state === 'error' && { backgroundColor: '#2A1716' }]}>
        {icon ? <Ionicons name={icon} size={20} color={iconColor} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={password ? hidden : rest.secureTextEntry}
          style={[styles.input, style]}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.text.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color={colors.brand.red}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.text.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/* ---------- Checkbox ---------- */

export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'flex-start' }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        hitSlop={10}
        onPress={() => onChange(!checked)}
        style={[
          styles.checkbox,
          checked && { backgroundColor: colors.brand.red, borderColor: colors.brand.red },
        ]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/* ---------- Aviso (sucesso / erro) ---------- */

export function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'error';
  icon: IconName;
  children: string;
}) {
  const c = tone === 'success' ? colors.brand.green : colors.brand.red;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        { backgroundColor: tone === 'success' ? '#16241C' : '#2A1716', borderColor: c + '55' },
      ]}>
      <Ionicons name={icon} size={18} color={c} />
      <Text variant="body" color={c} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/* ---------- Divisor "ou" ---------- */

export function Divider({ label }: { label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={styles.line} />
      {label ? (
        <Text variant="caption" color={colors.text.muted}>
          {label}
        </Text>
      ) : null}
      <View style={styles.line} />
    </View>
  );
}

/* ---------- Chip ---------- */

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.brand.red, borderColor: colors.brand.red }]}>
      <Text variant="labelSmall" color={selected ? colors.white : colors.text.secondary}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Card ---------- */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  screenContent: { padding: spacing.lg - 4, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
    gap: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.base,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  button: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  inputBox: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.text.primary,
    ...typography.bodyLarge,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border.default },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.elevated,
  },
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: spacing.sm,
  },
});

export { ActionSheet, ConfirmSheet, Sheet, type SheetAction } from './sheet';
