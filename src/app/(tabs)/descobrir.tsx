import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Logo, Notice, Screen, Text } from '@/components/ui';
import { Candidate, DISCOVERY_MESSAGES, DiscoveryError, hasFilters } from '@/domain/discovery';
import { DAILY_LIKE_LIMIT } from '@/domain/rules';
import { discoveryApi, setDemoProfile } from '@/features/discovery/api';
import { SwipeDeck, SwipeDeckHandle } from '@/features/discovery/swipe-deck';
import { useDiscovery } from '@/store/discovery';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** D1/D8/D9 · US-08, US-09, US-10 — Descobrir parceiros */
export default function Descobrir() {
  const { profile, gyms } = useSession();
  const { filters, remember, setMatch } = useDiscovery();
  const mainGym = gyms.find((g) => g.tipo === 'principal')?.gym;
  const [people, setPeople] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [last, setLast] = useState<{ person: Candidate; tipo: 'curtir' | 'passar' } | null>(null);
  const deck = useRef<SwipeDeckHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDemoProfile(profile);
      const [list, likes] = await Promise.all([discoveryApi.fetch(filters), discoveryApi.likesToday()]);
      remember(list);
      setPeople(list);
      setLimitReached(likes >= DAILY_LIKE_LIMIT);
      setLast(null);
    } catch (e) {
      setError(e instanceof DiscoveryError ? e.message : DISCOVERY_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  }, [filters, profile, remember]);

  // Recarrega ao voltar para a aba (ex.: depois de mudar filtros ou preferências)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSwipe = useCallback(
    async (person: Candidate, tipo: 'curtir' | 'passar') => {
      setPeople((list) => list.filter((p) => p.id !== person.id));
      try {
        const res = await discoveryApi.act(person.id, tipo);
        setLast({ person, tipo });
        if (res.curtidasHoje >= DAILY_LIKE_LIMIT) setLimitReached(true);
        if (res.match) {
          setMatch({ conexaoId: res.conexaoId, pessoa: person });
          router.push('/match');
        }
      } catch (e) {
        // Não registrou: o card volta para o topo
        setPeople((list) => [person, ...list]);
        if (e instanceof DiscoveryError && e.message === DISCOVERY_MESSAGES.likeLimit) setLimitReached(true);
        else setError(DISCOVERY_MESSAGES.generic);
      }
    },
    [setMatch],
  );

  const desfazer = async () => {
    if (!last) return;
    await discoveryApi.undo(last.person.id);
    setPeople((list) => [last.person, ...list]);
    if (last.tipo === 'curtir') setLimitReached(false);
    setLast(null);
  };

  const curtir = () => (limitReached ? null : deck.current?.swipe('curtir'));

  return (
    <Screen>
      <View style={styles.header}>
        <Logo size={24} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          hitSlop={10}
          onPress={() => router.push('/filtros')}
          style={styles.filterBtn}>
          <Ionicons name="options-outline" size={22} color={colors.text.primary} />
          {hasFilters(filters) ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>
      {mainGym ? (
        <Text variant="caption" color={colors.text.muted}>
          <Ionicons name="location-outline" size={12} /> {mainGym.nome}
        </Text>
      ) : null}

      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}

      {limitReached ? (
        <Notice tone="error" icon="heart-dislike-outline">
          {DISCOVERY_MESSAGES.likeLimit}
        </Notice>
      ) : null}

      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator color={colors.brand.red} style={{ flex: 1 }} />
        ) : people.length > 0 ? (
          <SwipeDeck
            ref={deck}
            people={people}
            gymName={mainGym?.nome}
            onSwipe={handleSwipe}
            onOpen={(p) => router.push({ pathname: '/perfil/[id]', params: { id: p.id } })}
          />
        ) : (
          <Card style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={colors.text.muted} />
            <Text variant="h3" style={{ textAlign: 'center' }}>
              {DISCOVERY_MESSAGES.empty}
            </Text>
            <Button title="Ajustar filtros" variant="secondary" onPress={() => router.push('/filtros')} />
            <Button title="Procurar de novo" variant="ghost" onPress={load} />
          </Card>
        )}
      </View>

      <View style={styles.actions}>
        <RoundButton
          icon="close"
          color={colors.text.secondary}
          label="Passar"
          disabled={!people.length}
          onPress={() => deck.current?.swipe('passar')}
        />
        <RoundButton
          icon="arrow-undo"
          color={colors.brand.green}
          small
          label="Desfazer"
          disabled={!last}
          onPress={desfazer}
        />
        <RoundButton
          icon="heart"
          color={colors.brand.red}
          label="Curtir"
          disabled={!people.length || limitReached}
          onPress={curtir}
        />
      </View>
    </Screen>
  );
}

function RoundButton(props: {
  icon: 'close' | 'heart' | 'arrow-undo';
  color: string;
  label: string;
  small?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const size = props.small ? 48 : 64;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, borderColor: props.color + '88' },
        props.disabled && { opacity: 0.35 },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <Ionicons name={props.icon} size={props.small ? 22 : 30} color={props.color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterBtn: { padding: spacing.xs },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.red,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  round: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
