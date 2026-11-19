import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, spacing } from '@/theme';

import { Text } from './index';

/**
 * Aviso rápido no topo da tela ("Conexão desfeita.", "{nome} foi bloqueado.").
 * Use toast('mensagem') de qualquer lugar; o <Toaster /> fica no layout raiz.
 */
type Tone = 'success' | 'error' | 'info';
type ToastState = { id: number; message: string; tone: Tone } | null;

const useToastStore = create<{ current: ToastState; show: (m: string, t: Tone) => void; hide: () => void }>(
  (set) => ({
    current: null,
    show: (message, tone) => set({ current: { id: Date.now(), message, tone } }),
    hide: () => set({ current: null }),
  }),
);

export function toast(message: string, tone: Tone = 'success') {
  useToastStore.getState().show(message, tone);
}

const ICONS = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' } as const;
const COLORS = { success: colors.brand.green, error: colors.brand.red, info: colors.text.secondary };

export function Toaster() {
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, 2800);
    return () => clearTimeout(t);
  }, [current, hide]);

  if (!current) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <Animated.View
        key={current.id}
        entering={FadeInUp.springify().damping(18)}
        exiting={FadeOutUp.duration(200)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={styles.toast}>
        <Ionicons name={ICONS[current.tone]} size={20} color={COLORS[current.tone]} />
        <Text variant="labelSmall" style={{ flexShrink: 1 }}>
          {current.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
