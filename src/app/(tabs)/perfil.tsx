import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { NIVEIS } from '@/constants/catalogos';
import { computeStreak } from '@/domain/streak';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/** F6 · US-04, US-16 — Meu perfil (dados reais do perfil; contador ainda de exemplo até a Sprint 5) */
const DEMO_CHECKINS = ['2026-11-09', '2026-11-10', '2026-11-12'];

export default function Perfil() {
  const { user, profile, gyms } = useSession();
  const main = gyms.find((g) => g.tipo === 'principal');
  // TODO Sprint 5: datas vindas da tabela publicacao (conta_para_sequencia = true)
  const stats = computeStreak(DEMO_CHECKINS, '2026-11-13');
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
        <Stat value={stats.totalActiveDays} label="dias ativos" />
        <Stat value={stats.currentStreak} label="sequência" highlight />
        <Stat value={stats.longestStreak} label="maior sequência" />
      </View>

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

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="h1" color={highlight ? colors.brand.green : colors.text.primary}>
        {value}
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
});
