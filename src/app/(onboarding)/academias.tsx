import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Header, Notice, Screen, Text } from '@/components/ui';
import { Gym, GYM_MESSAGES, GymRuleError } from '@/domain/gyms';
import { GymFinder } from '@/features/gyms/gym-finder';
import { PROFILE_MESSAGES, profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

/** P5/P6 · US-06, US-07 — Escolher a academia principal no onboarding */
export default function Academias() {
  const { modo } = useLocalSearchParams<{ modo?: 'proximas' | 'busca' }>();
  const { user, refresh } = useSession();
  const [error, setError] = useState<string | null>(null);

  const treinoAqui = (gym: Gym) => {
    Alert.alert('Treino aqui', `Definir ${gym.nome} como sua academia principal?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          setError(null);
          try {
            await profileApi.linkGym(gym, 'principal');
            Alert.alert('Tudo certo', GYM_MESSAGES.linked(gym.nome));
            // Perfil mínimo completo (RN-006): o layout libera as abas
            if (user) await refresh();
          } catch (e) {
            setError(e instanceof GymRuleError ? e.message : PROFILE_MESSAGES.generic);
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Header title="Academias" />
      <Text variant="body" color={colors.text.secondary}>
        Escolha onde você treina. Ela vira sua academia principal e você aparece para quem treina lá.
      </Text>
      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}
      <GymFinder
        startWithSearch={modo === 'busca'}
        actions={() => [{ label: 'Treino aqui', onPress: treinoAqui }]}
      />
    </Screen>
  );
}
