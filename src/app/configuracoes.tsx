import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NavRow, SettingsGroup } from '@/components/settings-rows';
import { Button, ConfirmSheet, Header, Screen, Text } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** C1 · US-02 (cenário 6), US-21, US-23, US-24 — Configurações */
export default function Configuracoes() {
  const { signOut, user } = useSession();
  const [confirmSair, setConfirmSair] = useState(false);
  const [saindo, setSaindo] = useState(false);

  return (
    <Screen scroll>
      <Header title="Configurações" />
      {user?.nome ? (
        <Text variant="body" color={colors.text.secondary}>
          Conectado como {user.nome}
        </Text>
      ) : null}

      <SettingsGroup title="Conta">
        <NavRow
          first
          icon="person-outline"
          label="Editar perfil"
          onPress={() => router.push('/editar-perfil')}
        />
        <NavRow
          icon="business-outline"
          label="Minha academia"
          onPress={() => router.push('/minha-academia')}
        />
        <NavRow
          icon="options-outline"
          label="Preferências de descoberta"
          onPress={() => router.push('/preferencias')}
        />
      </SettingsGroup>

      <SettingsGroup title="Notificações e privacidade">
        <NavRow
          first
          icon="notifications-outline"
          label="Notificações"
          hint="Escolha o que quer receber"
          onPress={() => router.push('/config-notificacoes')}
        />
        <NavRow
          icon="lock-closed-outline"
          label="Privacidade"
          hint="Distância, publicações e descoberta"
          onPress={() => router.push('/privacidade')}
        />
        <NavRow icon="ban-outline" label="Usuários bloqueados" onPress={() => router.push('/bloqueados')} />
      </SettingsGroup>

      <SettingsGroup title="Sobre">
        <NavRow
          first
          icon="document-text-outline"
          label="Termos de Uso"
          onPress={() => router.push({ pathname: '/documento/[tipo]', params: { tipo: 'termos-de-uso' } })}
        />
        <NavRow
          icon="shield-checkmark-outline"
          label="Política de Privacidade"
          onPress={() =>
            router.push({ pathname: '/documento/[tipo]', params: { tipo: 'politica-de-privacidade' } })
          }
        />
      </SettingsGroup>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Button title="Sair da conta" variant="secondary" onPress={() => setConfirmSair(true)} />
        <Button title="Excluir conta" variant="ghost" onPress={() => router.push('/excluir-conta')} />
      </View>
      <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
        GymBrô v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>

      {/* US-02, cenário 6 */}
      <ConfirmSheet
        visible={confirmSair}
        onClose={() => setConfirmSair(false)}
        onConfirm={async () => {
          setSaindo(true);
          await signOut();
        }}
        loading={saindo}
        destructive
        icon="log-out-outline"
        title="Sair da conta?"
        message="Você vai precisar entrar de novo com e-mail e senha."
        confirmLabel="Sair"
      />
    </Screen>
  );
}
