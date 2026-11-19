import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ConfirmSheet, Header, Notice, Screen, Sheet, Text } from '@/components/ui';
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
  const [pending, setPending] = useState<Gym | null>(null);
  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState<Gym | null>(null);

  const confirmar = async () => {
    if (!pending) return;
    setError(null);
    setSaving(true);
    try {
      await profileApi.linkGym(pending, 'principal');
      setLinked(pending);
      setPending(null);
    } catch (e) {
      setPending(null);
      setError(e instanceof GymRuleError ? e.message : PROFILE_MESSAGES.generic);
    } finally {
      setSaving(false);
    }
  };

  // Perfil mínimo completo (RN-006): ao atualizar a sessão, o layout libera as abas
  const continuar = async () => {
    setLinked(null);
    if (user) await refresh();
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
        actions={() => [{ label: 'Treino aqui', onPress: setPending }]}
      />

      <ConfirmSheet
        visible={!!pending}
        onClose={() => setPending(null)}
        onConfirm={confirmar}
        loading={saving}
        icon="barbell-outline"
        title="Treino aqui"
        message={pending ? `Definir ${pending.nome} como sua academia principal?` : undefined}
        confirmLabel="Confirmar academia"
      />

      <Sheet
        visible={!!linked}
        onClose={continuar}
        icon="checkmark-circle"
        tone="success"
        title="Tudo certo!"
        message={linked ? GYM_MESSAGES.linked(linked.nome) : undefined}>
        <Button title="Começar a treinar junto" variant="success" onPress={continuar} />
      </Sheet>
    </Screen>
  );
}
