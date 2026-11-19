import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

import { Button, Text } from './index';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Pop-up moderno do GymBrô: painel que sobe de baixo (bottom sheet), com fundo
 * escurecido. Substitui o Alert.alert do sistema, que tem visual diferente no
 * Android e no iOS e não segue o tema escuro do protótipo.
 *
 * Animação com Reanimated (roda na thread de UI): o fundo entra com FadeIn e o
 * painel sobe com SlideInDown em mola. Tocar fora ou no "voltar" do Android fecha.
 */
export function Sheet({
  visible,
  onClose,
  title,
  message,
  icon,
  tone = 'neutral',
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: IconName;
  tone?: 'neutral' | 'success' | 'danger';
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const toneColor =
    tone === 'success' ? colors.brand.green : tone === 'danger' ? colors.brand.red : colors.text.primary;
  const toneBg = tone === 'success' ? '#16241C' : tone === 'danger' ? '#2A1716' : colors.bg.input;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* O painel sobe junto com o teclado (campos de denúncia, convite etc.) */}
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={styles.backdrop}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
          <View style={styles.handle} />
          {icon ? (
            <View style={[styles.iconCircle, { backgroundColor: toneBg }]}>
              <Ionicons name={icon} size={28} color={toneColor} />
            </View>
          ) : null}
          {title || message ? (
            <View style={styles.texts}>
              {title ? (
                <Text variant="h2" style={styles.center} accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
              {message ? (
                <Text variant="body" color={colors.text.secondary} style={styles.center}>
                  {message}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Lista de ações (galeria/câmera, menu da foto...) ---------- */

export type SheetAction = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  destructive?: boolean;
};

export function ActionSheet({
  visible,
  onClose,
  title,
  message,
  header,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** Conteúdo acima das ações (ex.: miniatura da foto) */
  header?: ReactNode;
  actions: SheetAction[];
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} message={message}>
      {header}
      <View style={styles.group}>
        {actions.map((a, i) => {
          const c = a.destructive ? colors.brand.red : colors.text.primary;
          return (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                onClose();
                // Deixa o pop-up fechar antes de abrir galeria/câmera ou outro pop-up
                setTimeout(a.onPress, 250);
              }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowBorder,
                pressed && { backgroundColor: colors.bg.input },
              ]}>
              {a.icon ? (
                <View style={[styles.rowIcon, a.destructive && { backgroundColor: '#2A1716' }]}>
                  <Ionicons name={a.icon} size={20} color={c} />
                </View>
              ) : null}
              <Text variant="labelButton" color={c} style={{ flex: 1 }}>
                {a.label}
              </Text>
              {!a.destructive ? (
                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Button title="Cancelar" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

/* ---------- Confirmação (Sim / Cancelar) ---------- */

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  destructive,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  icon?: IconName;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={loading ? () => {} : onClose}
      title={title}
      message={message}
      icon={icon}
      tone={destructive ? 'danger' : 'neutral'}>
      <View style={{ gap: spacing.sm }}>
        <Button title={confirmLabel} onPress={onConfirm} loading={loading} />
        <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={loading} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.sm + 4,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.strong,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  texts: { gap: spacing.xs + 2, paddingHorizontal: spacing.sm },
  center: { textAlign: 'center' },
  group: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.strong },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
