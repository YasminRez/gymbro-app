import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Candidate, formatSchedule, initials } from '@/domain/discovery';
import { colors, radius, spacing } from '@/theme';

/** Card do Descobrir (D1 · US-08, cenário 1) */
export function ProfileCard({ person, gymName }: { person: Candidate; gymName?: string }) {
  const foto = person.fotos[0];
  const academia = person.academia === 'Sua academia' ? (gymName ?? 'Sua academia') : person.academia;
  const tags = [...person.modalidades, ...person.objetivos].slice(0, 4);

  return (
    <View style={styles.card}>
      {foto ? (
        <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <Avatar nome={person.nome} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(11,11,11,0.65)', colors.bg.base]}
        locations={[0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {person.compatibilidade !== undefined ? (
        <View style={styles.badge} accessibilityLabel={`${person.compatibilidade}% compatível`}>
          <Ionicons name="flash" size={14} color={colors.bg.base} />
          <Text variant="labelSmall" color={colors.bg.base}>
            {person.compatibilidade}% compatível
          </Text>
        </View>
      ) : null}

      <View style={styles.info}>
        <Text variant="h1" color={colors.white}>
          {person.nome.split(' ')[0]}, {person.idade}
        </Text>
        <Row icon="location-outline">
          {academia ?? 'Academia'}
          {person.distanciaKm ? ` · a ${person.distanciaKm} km` : ''}
        </Row>
        <Row icon="time-outline">{formatSchedule(person.slots)}</Row>
        <View style={styles.tags}>
          {tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text variant="caption" color={colors.text.primary}>
                {t}
              </Text>
            </View>
          ))}
        </View>
        {person.interessesComuns.length > 0 ? (
          <View style={styles.tags}>
            {person.interessesComuns.slice(0, 4).map((t) => (
              <View key={t} style={[styles.tag, styles.common]}>
                <Ionicons name="heart" size={10} color={colors.brand.green} />
                <Text variant="caption" color={colors.brand.green}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Row({ icon, children }: { icon: 'location-outline' | 'time-outline'; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={15} color={colors.text.secondary} />
      <Text variant="body" color={colors.text.secondary} numberOfLines={1} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

export function Avatar({ nome, size }: { nome: string; size?: number }) {
  const style = size
    ? { width: size, height: size, borderRadius: size / 2 }
    : (StyleSheet.absoluteFill as object);
  return (
    <LinearGradient colors={['#3A2321', colors.bg.elevated]} style={[style, styles.avatar]}>
      <Text
        variant="displayXL"
        color={colors.brand.red}
        style={size ? { fontSize: size * 0.38, lineHeight: size * 0.46 } : undefined}>
        {initials(nome)}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg + 4,
    overflow: 'hidden',
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.green,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  info: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.xs + 2,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  common: { backgroundColor: 'rgba(107,175,138,0.16)' },
});
