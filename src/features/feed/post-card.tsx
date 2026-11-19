import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui';
import { formatDuration, Post, timeAgo } from '@/domain/feed';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { colors, radius, spacing } from '@/theme';

/**
 * Publicação do feed (US-17): foto, autor, academia, modalidade, duração, legenda,
 * sequência do autor, curtidas e comentários. Toque duplo na foto curte (US-18).
 */
export const PostCard = memo(function PostCard({
  post,
  onLike,
  onLikers,
  onComments,
  onMenu,
}: {
  post: Post;
  onLike: (p: Post, fromDoubleTap?: boolean) => void;
  onLikers: (p: Post) => void;
  onComments: (p: Post) => void;
  onMenu: (p: Post) => void;
}) {
  const { width } = useWindowDimensions();
  const heart = useSharedValue(0);
  const likeScale = useSharedValue(1);

  const likeFromTap = () => onLike(post, true);

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: 300,
    onActivate: () => {
      'worklet';
      heart.set(
        withSequence(withSpring(1, { damping: 9, stiffness: 220 }), withDelay(450, withTiming(0, { duration: 200 }))),
      );
      scheduleOnRN(likeFromTap);
    },
  });

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: 0.4 + heart.value * 0.8 }],
  }));
  const likeBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));

  const tapLike = () => {
    likeScale.set(withSequence(withSpring(1.3, { damping: 6 }), withSpring(1)));
    onLike(post);
  };

  const dur = formatDuration(post.duracaoMin);
  const primeiroNome = post.autor.nome.split(' ')[0];

  return (
    <View style={styles.card}>
      {/* Autor */}
      <View style={styles.header}>
        <PersonAvatar nome={post.autor.nome} foto={post.autor.foto} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="labelButton" numberOfLines={1}>
            {post.minha ? 'Você' : post.autor.nome}
          </Text>
          <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
            {[post.academia, timeAgo(post.criadoEm)].filter(Boolean).join(' · ')}
            {post.visibilidade === 'conexoes' ? ' · ' : ''}
            {post.visibilidade === 'conexoes' ? (
              <Ionicons name="people" size={11} color={colors.text.muted} />
            ) : null}
          </Text>
        </View>
        {post.autor.sequencia > 0 ? (
          <View style={styles.streak} accessibilityLabel={`Sequência de ${post.autor.sequencia} dias`}>
            <Text variant="labelSmall" color={colors.brand.green}>
              🔥 {post.autor.sequencia}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opções da publicação"
          hitSlop={12}
          onPress={() => onMenu(post)}
          style={{ padding: spacing.xs }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Foto (toque duplo curte) */}
      <GestureDetector gesture={doubleTap}>
        <View
          style={{ width, height: Math.round(width * 1.25), backgroundColor: colors.bg.input }}
          accessible
          accessibilityLabel={`Foto do treino de ${primeiroNome}${post.legenda ? `: ${post.legenda}` : ''}`}
          accessibilityHint="Toque duas vezes para curtir">
          <Image
            source={{ uri: post.fotoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          {post.checkin ? (
            <View style={styles.checkin}>
              <Ionicons name="checkmark-circle" size={14} color={colors.bg.base} />
              <Text variant="overline" color={colors.bg.base}>
                Check-in
              </Text>
            </View>
          ) : null}
          <Animated.View pointerEvents="none" style={[styles.bigHeart, heartStyle]}>
            <Ionicons name="heart" size={110} color={colors.white} />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Ações */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.curti ? 'Remover curtida' : 'Curtir'}
          accessibilityState={{ selected: post.curti }}
          hitSlop={8}
          onPress={tapLike}>
          <Animated.View style={likeBtnStyle}>
            <Ionicons
              name={post.curti ? 'heart' : 'heart-outline'}
              size={28}
              color={post.curti ? colors.brand.red : colors.text.primary}
            />
          </Animated.View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.comentarios} comentários. Comentar`}
          hitSlop={8}
          onPress={() => onComments(post)}>
          <Ionicons name="chatbubble-outline" size={25} color={colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {post.modalidade ? <Tag icon="barbell-outline" text={post.modalidade} /> : null}
        {dur ? <Tag icon="time-outline" text={dur} /> : null}
      </View>

      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver quem curtiu"
          disabled={post.curtidas === 0}
          onPress={() => onLikers(post)}>
          <Text variant="labelSmall">
            {post.curtidas} {post.curtidas === 1 ? 'curtida' : 'curtidas'}
          </Text>
        </Pressable>
        {post.legenda ? (
          <Text variant="body" color={colors.text.secondary}>
            <Text variant="labelSmall">{post.minha ? 'Você' : primeiroNome} </Text>
            {post.legenda}
          </Text>
        ) : null}
        {post.comentarios > 0 ? (
          <Pressable onPress={() => onComments(post)} accessibilityRole="button">
            <Text variant="body" color={colors.text.muted}>
              Ver {post.comentarios === 1 ? 'o comentário' : `os ${post.comentarios} comentários`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

function Tag({ icon, text }: { icon: 'barbell-outline' | 'time-outline'; text: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={13} color={colors.text.secondary} />
      <Text variant="caption" color={colors.text.secondary}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg.base, paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  streak: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: '#16241C',
  },
  checkin: {
    position: 'absolute',
    top: spacing.sm + 4,
    left: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.green,
  },
  bigHeart: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.elevated,
  },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
});
