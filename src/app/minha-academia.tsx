import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ConfirmSheet, Header, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
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

  const [remover, setRemover] = useState<{ placeId: string; nome: string } | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const confirmarRemocao = async () => {
    if (!remover) return;
    setRemovendo(true);
    try {
      await profileApi.removeSecondary(remover.placeId);
      await refresh();
      toast(`${remover.nome} saiu das suas academias.`);
      setRemover(null);
    } catch {
      toast('Não foi possível remover agora. Tente de novo.', 'error');
    } finally {
      setRemovendo(false);
    }
  };

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
            {
              label: 'Remover',
              variant: 'secondary',
              onPress: () => setRemover({ placeId: s.gym.placeId, nome: s.gym.nome }),
            },
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

      {/* US-25: convidar uma conexão para treinar aqui */}
      <Card style={{ marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="people-outline" size={22} color={colors.brand.green} />
          <Text variant="h3" style={{ flex: 1 }}>
            Treinar junto
          </Text>
        </View>
        <Text variant="body" color={colors.text.secondary}>
          Convide alguém que você conheceu no GymBrô para treinar com você na sua academia.
        </Text>
        <Button title="Treinos combinados" variant="secondary" onPress={() => router.push('/treinos')} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="trophy-outline" size={22} color={colors.brand.green} />
          <Text variant="h3" style={{ flex: 1 }}>
            Ranking da semana
          </Text>
        </View>
        <Button title="Ver ranking" variant="secondary" onPress={() => router.push('/ranking')} />
      </Card>
      <ConfirmSheet
        visible={!!remover}
        onClose={() => setRemover(null)}
        onConfirm={confirmarRemocao}
        loading={removendo}
        destructive
        icon="barbell-outline"
        title="Remover academia?"
        message={remover ? `${remover.nome} sai das suas academias secundárias.` : undefined}
        confirmLabel="Remover"
      />
    </Screen>
  );
}
