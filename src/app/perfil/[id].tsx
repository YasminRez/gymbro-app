import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, Text } from '@/components/ui';
import { NIVEIS } from '@/constants/catalogos';
import { Candidate, DISCOVERY_MESSAGES, DiscoveryError, formatSchedule } from '@/domain/discovery';
import { discoveryApi } from '@/features/discovery/api';
import { Avatar } from '@/features/discovery/profile-card';
import { useDiscovery } from '@/store/discovery';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/** D4 · US-08, cenário 3 — Perfil completo: todas as fotos, bio, dias ativos e sequência */
export default function PerfilCompleto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = useDiscovery((s) => s.cache[id]);
  const setMatch = useDiscovery((s) => s.setMatch);
  const [acting, setActing] = useState(false);
  const mainGym = useSession((s) => s.gyms.find((g) => g.tipo === 'principal')?.gym);
  const [person, setPerson] = useState<Candidate | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (cached) return;
    discoveryApi
      .profile(id)
      .then(setPerson)
      .finally(() => setLoading(false));
  }, [id, cached]);

  const agir = async (tipo: 'curtir' | 'passar') => {
    if (!person || acting) return;
    setActing(true);
    try {
      const res = await discoveryApi.act(person.id, tipo);
      if (res.match) {
        setMatch({ conexaoId: res.conexaoId, pessoa: person });
        router.replace('/match');
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert(e instanceof DiscoveryError ? e.message : DISCOVERY_MESSAGES.generic);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.brand.red} />
      </SafeAreaView>
    );
  }
  if (!person) {
    return (
      <SafeAreaView style={styles.center}>
        <Text variant="body" color={colors.text.secondary}>
          Este perfil não está mais disponível.
        </Text>
      </SafeAreaView>
    );
  }

  const academia = person.academia === 'Sua academia' ? (mainGym?.nome ?? 'Sua academia') : person.academia;
  const nivel = NIVEIS.find((n) => n.value === person.nivel)?.label;
  const photoH = width * 1.15;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ height: photoH }}>
          {person.fotos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {person.fotos.map((f, i) => (
                <Image
                  key={f}
                  source={{ uri: f }}
                  style={{ width, height: photoH }}
                  contentFit="cover"
                  accessibilityLabel={`Foto ${i + 1} de ${person.nome}`}
                />
              ))}
            </ScrollView>
          ) : (
            <Avatar nome={person.nome} />
          )}
          {person.fotos.length > 1 ? (
            <View style={styles.dots}>
              {person.fotos.map((f, i) => (
                <View key={f} style={[styles.dotBar, i === page && { backgroundColor: colors.white }]} />
              ))}
            </View>
          ) : null}
          <SafeAreaView style={styles.back} edges={['top']}>
            <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-down" size={24} color={colors.white} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={{ padding: spacing.lg - 4, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="h1" style={{ flex: 1 }}>
              {person.nome}, {person.idade}
            </Text>
            {person.compatibilidade !== undefined ? (
              <View style={styles.badge}>
                <Text variant="labelSmall" color={colors.bg.base}>
                  {person.compatibilidade}%
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="body" color={colors.text.secondary}>
            <Ionicons name="location-outline" size={14} /> {academia}
            {person.distanciaKm ? ` · a ${person.distanciaKm} km` : ''}
            {nivel ? ` · ${nivel}` : ''}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Card style={styles.stat}>
              <Text variant="h2">{person.diasAtivos}</Text>
              <Text variant="caption" color={colors.text.secondary}>
                dias ativos
              </Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="h2" color={colors.brand.green}>
                {person.sequencia}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                sequência atual
              </Text>
            </Card>
          </View>

          {person.bio ? (
            <Text variant="bodyLarge" color={colors.text.secondary}>
              {person.bio}
            </Text>
          ) : null}

          <Section title="Quando treina">
            <Text variant="body">{formatSchedule(person.slots)}</Text>
          </Section>
          <Section title="Modalidades e objetivos">
            <View style={styles.chips}>
              {[...person.modalidades, ...person.objetivos].map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </Section>
          <Section title="Interesses">
            <View style={styles.chips}>
              {person.interesses.map((t) => (
                <Chip key={t} label={t} selected={person.interessesComuns.includes(t)} />
              ))}
            </View>
            {person.interessesComuns.length > 0 ? (
              <Text variant="caption" color={colors.text.muted}>
                Em destaque: interesses que vocês têm em comum.
              </Text>
            ) : null}
          </Section>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable
          accessibilityLabel="Passar"
          onPress={() => agir('passar')}
          style={[styles.round, { borderColor: colors.text.secondary + '88' }]}>
          <Ionicons name="close" size={30} color={colors.text.secondary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Curtir"
          onPress={() => agir('curtir')}
          style={[styles.round, { borderColor: colors.brand.red + '88' }]}>
          <Ionicons name="heart" size={30} color={colors.brand.red} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color={colors.text.muted}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg.base, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', top: 54, left: spacing.md, right: spacing.md, flexDirection: 'row', gap: 4 },
  dotBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  back: { position: 'absolute', top: 0, right: spacing.md },
  backBtn: {
    marginTop: spacing.md + 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: colors.brand.green,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  stat: { flex: 1, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(11,11,11,0.92)',
  },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
