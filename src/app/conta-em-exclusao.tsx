import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { daysUntilDeletion, formatDateBR } from '@/domain/engagement';
import { ENGAGEMENT_MESSAGES, engagementApi } from '@/features/engagement/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/**
 * US-24 / RN-022 — Conta em exclusão
 * Aparece logo depois de pedir a exclusão e sempre que alguém entra numa conta
 * desativada dentro dos 30 dias. "Reativar" cancela a exclusão.
 */
export default function ContaEmExclusao() {
  const { deletionAt, setDeletion, signOut, refresh } = useSession();
  const [loading, setLoading] = useState<'reativar' | 'sair' | null>(null);

  const reativar = async () => {
    setLoading('reativar');
    try {
      await engagementApi.cancelDeletion();
      await refresh().catch(() => undefined);
      setDeletion(null);
      toast('Que bom te ver de volta! Sua conta foi reativada.');
    } catch {
      toast(ENGAGEMENT_MESSAGES.generic, 'error');
    } finally {
      setLoading(null);
    }
  };

  const sair = async () => {
    setLoading('sair');
    await signOut();
  };

  const dias = deletionAt ? daysUntilDeletion(deletionAt) : 30;

  return (
    <Screen
      footer={
        <>
          <Button
            title="Reativar minha conta"
            variant="success"
            loading={loading === 'reativar'}
            onPress={reativar}
          />
          <Button title="Sair" variant="ghost" loading={loading === 'sair'} onPress={sair} />
        </>
      }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.bg.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="hourglass-outline" size={36} color={colors.text.secondary} />
        </View>
        <Text variant="h1" style={{ textAlign: 'center' }}>
          Conta em exclusão
        </Text>
        <Text variant="bodyLarge" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          Sua conta está desativada e será apagada de vez
          {deletionAt ? ` em ${formatDateBR(deletionAt)}` : ''} ({dias} {dias === 1 ? 'dia' : 'dias'}).
        </Text>
        <Text variant="body" color={colors.text.muted} style={{ textAlign: 'center' }}>
          Enquanto isso, ninguém vê seu perfil ou suas publicações. Mudou de ideia? Reative agora e tudo volta
          como estava, menos as conexões, que foram desfeitas.
        </Text>
      </View>
    </Screen>
  );
}
