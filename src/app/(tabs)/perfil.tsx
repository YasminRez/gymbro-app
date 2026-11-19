import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { NIVEIS } from '@/constants/catalogos';
import { Stats } from '@/domain/feed';
import { feedApi } from '@/features/feed/api';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/**
 * F6 · US-04, US-16 — Meu perfil
 * Contadores reais (RN-017/RN-018): dias ativos, sequência 🔥, maior sequência e
 * dias ativos no mês, recalculados no banco sempre que a aba abre.
 */
export default function Perfil() {
  const { user, profile, gyms } = useSession();
  const main = gyms.find((g) => g.tipo === 'principal');
  const [stats, setStats] = useState<Stats | null>(null);

  useFocusEffect(
    useCallback(() => {
      feedApi
        .myStats()
        .then(setStats)
        .catch(() => undefined);
    }, []),
  );
  const nivel = NIVEIS.find((n) => n.value === profile?.nivel)?.label;

  return (
    <Screen scroll>
      <View style={styles.top}>
        <Text variant="h1">Meu perfil</Text>
        <Pressable
          accessibilityLabel="Configurações"
          hitSlop={10}
          onPress={() => router.push('/configuracoes')}>
          <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <View style={styles.header}>
        {profile?.fotos[0] ? (
          <Image source={{ uri: profile.fotos[0].uri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Ionicons name="person" size={40} color={colors.text.muted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2">{user?.nome || 'Você'}</Text>
          {main ? (
            <Text variant="body" color={colors.text.secondary}>
              <Ionicons name="location-outline" size={14} /> {main.gym.nome}
              {main.gym.status === 'pendente' ? ' (em análise)' : ''}
            </Text>
          ) : null}
          {nivel ? (
            <Text variant="caption" color={colors.text.muted}>
              {nivel}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.row}>
        <Stat value={stats?.totalDiasAtivos} label="dias ativos" />
        <Stat value={stats?.sequenciaAtual} label="sequência 🔥" highlight />
      </View>
      <View style={styles.row}>
        <Stat value={stats?.maiorSequencia} label="maior sequência" />
        <Stat value={stats?.diasNoMes} label="dias no mês" />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/calendario')}
        style={({ pressed }) => [styles.calendar, pressed && { opacity: 0.8 }]}>
        <Ionicons name="calendar-outline" size={20} color={colors.brand.green} />
        <Text variant="labelButton" style={{ flex: 1 }}>
          Calendário de check-ins
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      {profile?.bio ? (
        <Text variant="bodyLarge" color={colors.text.secondary}>
          {profile.bio}
        </Text>
      ) : null}

      {profile && profile.modalidades.length + profile.objetivos.length > 0 ? (
        <View style={styles.chips}>
          {[...profile.modalidades, ...profile.objetivos].map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      ) : null}

      <Button title="Editar perfil" variant="secondary" onPress={() => router.push('/editar-perfil')} />
      <Button title="Minha academia" variant="secondary" onPress={() => router.push('/minha-academia')} />
      <Button
        title="Preferências de descoberta"
        variant="secondary"
        onPress={() => router.push('/preferencias')}
      />
    </Screen>
  );
}

function Stat({ value, label, highlight }: { value?: number; label: string; highlight?: boolean }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="h1" color={highlight ? colors.brand.green : colors.text.primary}>
        {value ?? '–'}
      </Text>
      <Text variant="caption" color={colors.text.secondary}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 84, height: 84, borderRadius: radius.lg },
  avatarEmpty: { backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  calendar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
