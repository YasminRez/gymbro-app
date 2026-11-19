import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { FEED_MESSAGES } from '@/domain/feed';
import { usePublish } from '@/store/publish';
import { colors, radius, spacing } from '@/theme';

/**
 * F5 · US-15 (cenário 1) e US-16 (cenário 5) — "Dia {n} concluído! 🔥"
 * Aparece depois do check-in, com os contadores atualizados e o aviso de novo recorde.
 */
export default function DiaConcluido() {
  const result = usePublish((s) => s.lastResult);
  const setResult = usePublish((s) => s.setResult);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, [pulse]);
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const fechar = () => {
    setResult(null);
    router.back();
  };

  if (!result) return null;
  const s = result.estatisticas;

  return (
    <View style={styles.backdrop}>
      <LinearGradient
        colors={[colors.brand.green + '44', 'rgba(11,11,11,0.97)', colors.bg.base]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.content}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.flame, flameStyle]}>
          <Text style={{ fontSize: 72, lineHeight: 86 }}>🔥</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text variant="overline" color={colors.brand.green}>
            Check-in feito
          </Text>
          <Text variant="displayXL" style={{ textAlign: 'center' }} accessibilityRole="header">
            {FEED_MESSAGES.checkinDone(s.totalDiasAtivos)}
          </Text>
        </Animated.View>

        {result.novoRecorde ? (
          <Animated.View entering={ZoomIn.delay(450).springify()} style={styles.record}>
            <Ionicons name="trophy" size={20} color={colors.bg.base} />
            <Text variant="labelButton" color={colors.bg.base}>
              {FEED_MESSAGES.newRecord(s.maiorSequencia)}
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(300)} style={styles.stats}>
          <Stat value={s.sequenciaAtual} label="sequência" highlight />
          <Stat value={s.maiorSequencia} label="recorde" />
          <Stat value={s.diasNoMes} label="no mês" />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200)} style={styles.thumbWrap}>
          <Image source={{ uri: result.publicacao.fotoUrl }} style={styles.thumb} contentFit="cover" />
        </Animated.View>

        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button title="Ver no feed" variant="success" onPress={fechar} />
          <Button
            title="Ver meu calendário"
            variant="ghost"
            onPress={() => {
              setResult(null);
              router.replace('/calendario');
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="h1" color={highlight ? colors.brand.green : colors.text.primary}>
        {value}
      </Text>
      <Text variant="caption" color={colors.text.secondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,11,0.92)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  flame: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16241C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.green,
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  thumbWrap: { transform: [{ rotate: '-4deg' }] },
  thumb: { width: 96, height: 120, borderRadius: radius.md, borderWidth: 2, borderColor: colors.white },
});
