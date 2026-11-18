import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button, Card, Header, Screen, Text } from '@/components/ui';
import { daysUntilMainChange, MAX_SECONDARY } from '@/domain/gyms';
import { GymCard } from '@/features/gyms/gym-finder';
import { profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** P9 · US-07 — Minha academia: principal, secundárias (até 2) e acesso ao ranking */
export default function MinhaAcademia() {
  const { gyms, refresh } = useSession();
  const main = gyms.find((g) => g.tipo === 'principal');
  const secondaries = gyms.filter((g) => g.tipo === 'secundaria');
  const wait = main ? daysUntilMainChange(new Date(main.desde)) : 0;

  const remover = (placeId: string, nome: string) =>
    Alert.alert('Remover academia', `Remover ${nome} das suas academias secundárias?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await profileApi.removeSecondary(placeId);
          await refresh();
        },
      },
    ]);

  return (
    <Screen scroll>
      <Header title="Minha academia" />

      <Text variant="overline" color={colors.text.muted}>
        Principal
      </Text>
      {main ? (
        <GymCard gym={main.gym} actions={[]} />
      ) : (
        <Card>
          <Text variant="body">Você ainda não definiu uma academia principal.</Text>
        </Card>
      )}
      <Text variant="caption" color={colors.text.muted}>
        {wait > 0
          ? `Você poderá trocar sua academia principal novamente em ${wait} ${wait === 1 ? 'dia' : 'dias'}.`
          : 'A academia principal pode ser trocada uma vez a cada 7 dias.'}
      </Text>
      <Button
        title="Trocar academia principal"
        variant="secondary"
        onPress={() => router.push({ pathname: '/buscar-academia', params: { tipo: 'principal' } })}
      />

      <Text variant="overline" color={colors.text.muted} style={{ marginTop: spacing.md }}>
        Secundárias ({secondaries.length}/{MAX_SECONDARY})
      </Text>
      {secondaries.map((s) => (
        <GymCard
          key={s.gym.placeId}
          gym={s.gym}
          actions={[
            { label: 'Remover', variant: 'secondary', onPress: () => remover(s.gym.placeId, s.gym.nome) },
          ]}
        />
      ))}
      {secondaries.length < MAX_SECONDARY ? (
        <Button
          title="Também treino em outra academia"
          variant="secondary"
          onPress={() => router.push({ pathname: '/buscar-academia', params: { tipo: 'secundaria' } })}
        />
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="trophy-outline" size={22} color={colors.brand.green} />
          <Text variant="h3" style={{ flex: 1 }}>
            Ranking da semana
          </Text>
        </View>
        <Button title="Ver ranking" variant="secondary" onPress={() => router.push('/ranking')} />
      </Card>
    </Screen>
  );
}
