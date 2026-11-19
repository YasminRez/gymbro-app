import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Header, Input, Notice, Screen, Sheet, Text } from '@/components/ui';
import { GymRuleError } from '@/domain/gyms';
import { PROFILE_MESSAGES, profileApi } from '@/features/profile/api';
import { getCurrentCoords } from '@/lib/location';
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
  const [enviada, setEnviada] = useState(false);
  const fechar = () => {
    setEnviada(false);
    if (router.canGoBack()) router.back();
  };
  const ok = nome.trim().length >= 3 && endereco.trim().length >= 5;

  const enviar = async () => {
    setLoading(true);
    setError(null);
    try {
      // Sem coordenadas a academia fica fora do filtro de distância da descoberta:
      // usa a posição atual (sem pedir permissão de novo) como aproximação.
      const loc = await getCurrentCoords({ ask: false }).catch(() => null);
      await profileApi.suggestGym(nome, endereco, loc?.status === 'ok' ? loc.coords : undefined);
      await refresh();
      setEnviada(true);
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
      {/* US-07, cenário 4 */}
      <Sheet
        visible={enviada}
        onClose={fechar}
        icon="checkmark-circle"
        tone="success"
        title="Sugestão enviada"
        message='Sua academia está "Em análise". Enquanto isso, ela já aparece como sua academia principal.'>
        <Button title="Entendi" variant="success" onPress={fechar} />
      </Sheet>
    </Screen>
  );
}
