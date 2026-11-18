import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Chip, Screen, Text } from '@/components/ui';
import { compatibility, CompatProfile } from '@/domain/rules';
import { colors, radius, spacing } from '@/theme';

/** D1 · US-08, US-09 — Descoberta de parceiros */
const eu: CompatProfile = {
  mainGymId: 'g1',
  secondaryGymIds: [],
  slots: [
    { day: 1, period: 'noite' },
    { day: 3, period: 'noite' },
  ],
  goals: ['hipertrofia'],
  modalities: ['musculacao'],
  interests: ['corrida', 'nutricao', 'crossfit'],
};

const candidato = {
  id: 'demo',
  nome: 'Lucas',
  idade: 24,
  academia: 'Smart Fit Águas Claras',
  tags: ['Hipertrofia', 'Noite', 'Intermediário'],
  perfil: {
    ...eu,
    slots: [{ day: 1, period: 'noite' as const }],
    interests: ['corrida', 'futebol', 'nutricao'],
  },
};

export default function Descobrir() {
  const pct = compatibility(eu, candidato.perfil);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">Descobrir</Text>
        <Pressable accessibilityLabel="Filtros" onPress={() => router.push('/filtros')}>
          <Ionicons name="options-outline" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* TODO Sprint 3: deck com gestos (gesture-handler + reanimated) e dados do Supabase */}
      <Pressable style={{ flex: 1 }} onPress={() => router.push(`/perfil/${candidato.id}`)}>
        <Card style={styles.card}>
          <View style={styles.photo}>
            <Ionicons name="person" size={96} color={colors.border.strong} />
            <View style={styles.badge}>
              <Text variant="labelSmall" color={colors.bg.base}>
                {pct}% compatível
              </Text>
            </View>
          </View>
          <Text variant="h2">
            {candidato.nome}, {candidato.idade}
          </Text>
          <Text variant="body" color={colors.text.secondary}>
            {candidato.academia}
          </Text>
          <View style={styles.tags}>
            {candidato.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>
        </Card>
      </Pressable>

      <View style={styles.actions}>
        <RoundButton icon="close" color={colors.text.secondary} label="Passar" onPress={() => {}} />
        <RoundButton
          icon="heart"
          color={colors.brand.red}
          label="Curtir"
          onPress={() => router.push('/match')}
        />
      </View>
    </Screen>
  );
}

function RoundButton(props: { icon: 'close' | 'heart'; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={styles.round}>
      <Ionicons name={props.icon} size={30} color={props.color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { flex: 1, padding: spacing.sm },
  photo: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.brand.green,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  round: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
