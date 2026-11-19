import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/**
 * RNF-009 — Modo offline: avisa quando o celular fica sem internet. O que já foi
 * carregado continua na tela, o rascunho da publicação fica salvo no aparelho e
 * as mensagens do chat ficam pendentes e são reenviadas quando a conexão volta.
 * Também liga o onlineManager do TanStack Query, que pausa e retoma as consultas.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((s) => {
      const isOff = s.isConnected === false || s.isInternetReachable === false;
      setOffline(isOff);
      onlineManager.setOnline(!isOff);
    });
    return unsubNet;
  }, []);

  if (!offline) return null;
  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.wrap, { bottom: insets.bottom + 64 }]}>
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.text.primary} />
        <Text variant="labelSmall" style={{ flex: 1 }}>
          Sem internet. Mostrando o que já foi carregado.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
});
