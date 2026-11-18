import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Header, Input, Notice, Screen, Text } from '@/components/ui';
import { GymRuleError } from '@/domain/gyms';
import { PROFILE_MESSAGES, profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

/**
 * P8 · US-07, cenário 4 — Sugerir academia não cadastrada.
 * Fica "Em análise" para a moderação e já vale como academia principal provisória.
 * (Esta rota existe no onboarding e também a partir de Minha academia.)
 */
export default function SugerirAcademia() {
  const refresh = useSession((s) => s.refresh);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = nome.trim().length >= 3 && endereco.trim().length >= 5;

  const enviar = async () => {
    setLoading(true);
    setError(null);
    try {
      await profileApi.suggestGym(nome, endereco);
      await refresh();
      Alert.alert(
        'Sugestão enviada',
        'Sua academia está "Em análise". Enquanto isso, ela já aparece como sua academia principal.',
      );
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(e instanceof GymRuleError ? e.message : PROFILE_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      footer={<Button title="Enviar sugestão" onPress={enviar} disabled={!ok} loading={loading} />}>
      <Header title="Sugerir academia" />
      <Text variant="body" color={colors.text.secondary}>
        Não encontrou onde você treina? Informe nome e endereço. A equipe analisa e, enquanto isso, ela fica
        vinculada ao seu perfil de forma provisória.
      </Text>
      <Input label="Nome da academia" icon="barbell-outline" value={nome} onChangeText={setNome} />
      <Input
        label="Endereço"
        icon="location-outline"
        value={endereco}
        onChangeText={setEndereco}
        placeholder="Rua, número, bairro e cidade"
      />
      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}
    </Screen>
  );
}
