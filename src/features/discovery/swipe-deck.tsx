import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui';
import { Candidate } from '@/domain/discovery';
import { colors, radius, spacing } from '@/theme';

import { ProfileCard } from './profile-card';

/**
 * Pilha de cards com gesto de arrastar (US-09): direita = curtir, esquerda = passar.
 * Feito com react-native-gesture-handler + reanimated (RNF-008).
 */
export type SwipeDeckHandle = { swipe: (dir: 'curtir' | 'passar') => void };

type Props = {
  people: Candidate[];
  gymName?: string;
  onSwipe: (person: Candidate, tipo: 'curtir' | 'passar') => void;
  onOpen: (person: Candidate) => void;
  /** Menu ⋯ do card: denunciar / bloquear (US-13, US-14) */
  onMenu?: (person: Candidate) => void;
};

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { people, gymName, onSwipe, onOpen, onMenu },
  ref,
) {
  const { width } = useWindowDimensions();
  const threshold = width * 0.28;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const top = people[0];
  const next = people[1];

  const finish = (tipo: 'curtir' | 'passar') => {
    if (top) onSwipe(top, tipo);
  };

  // Novo card no topo: volta para o centro
  useEffect(() => {
    x.value = 0;
    y.value = 0;
  }, [top?.id, x, y]);

  const fly = (tipo: 'curtir' | 'passar') => {
    'worklet';
    const to = (tipo === 'curtir' ? 1 : -1) * width * 1.4;
    x.value = withTiming(to, { duration: 220 }, () => scheduleOnRN(finish, tipo));
  };

  useImperativeHandle(ref, () => ({ swipe: (tipo) => top && fly(tipo) }));

  const pan = usePanGesture({
    enabled: !!top,
    onUpdate: (e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.25;
    },
    onDeactivate: (e) => {
      if (x.value > threshold || e.velocityX > 900) fly('curtir');
      else if (x.value < -threshold || e.velocityX < -900) fly('passar');
      else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    },
  });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, width], [-14, 14])}deg` },
    ],
  }));
  const nextStyle = useAnimatedStyle(() => {
    const p = interpolate(Math.abs(x.value), [0, threshold], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 0.94 + 0.06 * p }], opacity: 0.6 + 0.4 * p };
  });
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [20, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-threshold, -20], [1, 0], Extrapolation.CLAMP),
  }));

  if (!top) return null;

  return (
    <View style={{ flex: 1 }}>
      {next ? (
        <Animated.View key={next.id} style={[StyleSheet.absoluteFill, nextStyle]} pointerEvents="none">
          <ProfileCard person={next} gymName={gymName} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View key={top.id} style={[StyleSheet.absoluteFill, topStyle]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => onOpen(top)}
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil completo de ${top.nome}`}
            accessibilityHint="Deslize para a direita para curtir ou para a esquerda para passar">
            <ProfileCard person={top} gymName={gymName} />
          </Pressable>
          {onMenu ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mais opções sobre ${top.nome}`}
              hitSlop={10}
              onPress={() => onMenu(top)}
              style={styles.menuBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <Animated.View style={[styles.stamp, styles.like, likeStyle]} pointerEvents="none">
            <Text variant="h2" color={colors.brand.green}>
              CURTIR
            </Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.pass, passStyle]} pointerEvents="none">
            <Text variant="h2" color={colors.brand.red}>
              PASSAR
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  menuBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stamp: {
    position: 'absolute',
    top: 56,
    borderWidth: 3,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  like: { left: 24, borderColor: colors.brand.green, transform: [{ rotate: '-14deg' }] },
  pass: { right: 24, borderColor: colors.brand.red, transform: [{ rotate: '14deg' }] },
});
