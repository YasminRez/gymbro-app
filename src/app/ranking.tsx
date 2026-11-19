import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Header, Text } from '@/components/ui';
import { daysUntilWeekEnds, Ranking, RankingRow, weekLabel } from '@/domain/engagement';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { engagementApi } from '@/features/engagement/api';
import { openProfile } from '@/features/profile/open-profile';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

const MEDALS = ['#E5B84B', '#C0C4CC', '#C98A5A'];

/**
 * F8 · US-22 — Ranking da semana
 * Check-ins válidos (RN-017) de segunda a domingo na academia principal, calculados
 * no banco (ranking_semanal). Empate divide a posição. Bloqueados não aparecem (RN-015).
 * Recomeça toda segunda-feira.
 */
export default function RankingScreen() {
  const gyms = useSession((s) => s.gyms);
  const [gymId, setGymId] = useState<string | undefined>(undefined);
  const [data, setData] = useState<Ranking | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (id?: string) => {
    try {
      setError(false);
      setData(await engagementApi.ranking(id));
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(gymId);
    }, [load, gymId]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load(gymId);
    setRefreshing(false);
  };

  const today = data?.hoje ?? new Date().toISOString().slice(0, 10);
  const days = daysUntilWeekEnds(today);
  const meOutOfList = data?.eu && !data.lista.some((r) => r.souEu);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal: spacing.lg - 4 }}>
        <Header title="Ranking da semana" />
      </View>

      {gyms.length > 1 ? (
        <View style={styles.gyms} accessibilityRole="tablist">
          {gyms.map((g) => {
            const selected =
              (gymId ?? gyms.find((x) => x.tipo === 'principal')?.gym.placeId) === g.gym.placeId;
            return (
              <Pressable
                key={g.gym.placeId}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setData(null);
                  setGymId(g.gym.placeId);
                }}
                style={[styles.gymChip, selected && styles.gymChipOn]}>
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  color={selected ? colors.white : colors.text.secondary}>
                  {g.gym.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {data === null && !error ? (
        <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <View style={styles.empty}>
          <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
            Não foi possível carregar o ranking. Verifique sua internet.
          </Text>
          <Button title="Tentar de novo" variant="secondary" onPress={() => load(gymId)} />
        </View>
      ) : (
        <FlatList
          data={data!.lista}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.red} />
          }
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
              <Card style={styles.hero}>
                <Ionicons name="trophy" size={28} color={MEDALS[0]} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3" numberOfLines={1}>
                    {data!.academia?.nome ?? 'Sua academia'}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    {weekLabel(data!.inicio, data!.fim)} ·{' '}
                    {days === 1 ? 'termina hoje' : `termina em ${days} dias`}
                  </Text>
                </View>
              </Card>
              {data!.eu ? (
                <Text variant="body" color={colors.text.secondary}>
                  Você está em <Text variant="labelSmall">{data!.eu.posicao}º lugar</Text> com{' '}
                  {plural(data!.eu.checkins)} nesta semana.
                </Text>
              ) : data!.lista.length > 0 ? (
                <Text variant="body" color={colors.text.secondary}>
                  Faça seu check-in de hoje para entrar no ranking.
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <Row r={item} />}
          ListFooterComponent={meOutOfList && data!.eu ? <Row r={data!.eu} separated /> : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="podium-outline" size={40} color={colors.text.muted} />
              <Text variant="h3" style={{ textAlign: 'center' }}>
                Ninguém treinou ainda esta semana
              </Text>
              <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                Publique o treino de hoje e saia na frente. O ranking conta 1 check-in por dia.
              </Text>
              <Button title="Publicar treino" onPress={() => router.push('/publicar')} />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? 'check-in' : 'check-ins'}`;

function Row({ r, separated }: { r: RankingRow; separated?: boolean }) {
  const medal = r.posicao <= 3 ? MEDALS[r.posicao - 1] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.posicao}º lugar, ${r.souEu ? 'você' : r.nome}, ${plural(r.checkins)}`}
      disabled={r.souEu}
      onPress={() => openProfile(r.id)}
      style={({ pressed }) => [
        styles.row,
        r.souEu && styles.me,
        separated && { marginTop: spacing.md },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={[styles.pos, medal ? { backgroundColor: medal + '26', borderColor: medal } : null]}>
        <Text variant="labelSmall" color={medal ?? colors.text.secondary}>
          {r.posicao}º
        </Text>
      </View>
      <PersonAvatar nome={r.nome} foto={r.foto} size={42} />
      <View style={{ flex: 1 }}>
        <Text variant="labelButton" numberOfLines={1}>
          {r.souEu ? 'Você' : r.nome}
        </Text>
        <Text variant="caption" color={colors.text.muted}>
          {r.sequencia > 0 ? `${r.sequencia} dias seguidos 🔥` : 'Sem sequência'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="h3" color={colors.brand.green}>
          {r.checkins}
        </Text>
        <Text variant="caption" color={colors.text.muted}>
          {r.checkins === 1 ? 'check-in' : 'check-ins'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  content: { paddingHorizontal: spacing.lg - 4, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 },
  gyms: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg - 4,
    marginBottom: spacing.sm,
  },
  gymChip: {
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.elevated,
  },
  gymChipOn: { backgroundColor: colors.brand.red, borderColor: colors.brand.red },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  me: { borderColor: colors.brand.green, backgroundColor: '#16241C' },
  pos: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
