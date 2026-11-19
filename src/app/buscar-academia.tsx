import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Header, Notice, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { Gym, GYM_MESSAGES, GymRuleError } from '@/domain/gyms';
import { GymFinder } from '@/features/gyms/gym-finder';
import { PROFILE_MESSAGES, profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

/** US-07, cenários 2 e 3 — trocar a principal ou adicionar secundária (a partir de Minha academia) */
export default function BuscarAcademia() {
  const { tipo = 'secundaria' } = useLocalSearchParams<{ tipo?: 'principal' | 'secundaria' }>();
  const { gyms, refresh } = useSession();
  const [error, setError] = useState<string | null>(null);

  const vincular = async (gym: Gym) => {
    setError(null);
    try {
      await profileApi.linkGym(gym, tipo);
      await refresh();
      toast(
        tipo === 'principal'
          ? GYM_MESSAGES.linked(gym.nome)
          : `${gym.nome} foi adicionada como academia secundária.`,
      );
      router.back();
    } catch (e) {
      setError(e instanceof GymRuleError ? e.message : PROFILE_MESSAGES.generic);
    }
  };

  return (
    <Screen scroll>
      <Header title={tipo === 'principal' ? 'Trocar academia principal' : 'Adicionar academia'} />
      <Text variant="body" color={colors.text.secondary}>
        {tipo === 'principal'
          ? 'A academia principal só pode ser trocada uma vez a cada 7 dias.'
          : 'Você pode ter até 2 academias secundárias.'}
      </Text>
      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}
      <GymFinder
        hidePlaceIds={gyms.map((g) => g.gym.placeId)}
        actions={() => [
          { label: tipo === 'principal' ? 'Treino aqui' : 'Também treino aqui', onPress: vincular },
        ]}
      />
    </Screen>
  );
}
