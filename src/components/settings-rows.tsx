import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Grupo de linhas com título (Configurações, C1/C2) */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <Text variant="overline" color={colors.text.muted} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

/** Linha que abre outra tela */
export function NavRow({
  icon,
  label,
  hint,
  value,
  onPress,
  destructive,
  first,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  first?: boolean;
}) {
  const color = destructive ? colors.brand.red : colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.border, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={destructive ? colors.brand.red : colors.text.secondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelButton" color={color}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color={colors.text.muted}>
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="caption" color={colors.text.muted}>
          {value}
        </Text>
      ) : null}
      {!destructive ? <Ionicons name="chevron-forward" size={18} color={colors.text.muted} /> : null}
    </Pressable>
  );
}

/** Linha com interruptor */
export function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
  first,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}) {
  return (
    <View
      style={[styles.row, !first && styles.border, disabled && { opacity: 0.5 }]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !disabled && onChange(!value)}>
      {icon ? <Ionicons name={icon} size={20} color={colors.text.secondary} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelButton">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.text.muted}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.bg.input, true: colors.brand.green }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.bg.input}
      />
    </View>
  );
}

/** Opção de escolha única (rádio) */
export function RadioRow({
  label,
  hint,
  selected,
  onPress,
  first,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.border, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="labelButton">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.text.muted}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.brand.red : colors.text.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    minHeight: 56,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.strong },
});
