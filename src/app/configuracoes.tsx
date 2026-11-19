import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, ConfirmSheet, Header, Screen, Text } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/** C1 · US-02 (cenário 6), US-23, US-24 — Configurações e privacidade */
export default function Configuracoes() {
  const { signOut, user } = useSession();

  const [confirmSair, setConfirmSair] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const sair = () => setConfirmSair(true);

  return (
    <Screen scroll>
      <Header title="Configurações" />
      {user?.nome ? (
        <Text variant="body" color={colors.text.secondary}>
          Conectado como {user.nome}
        </Text>
      ) : null}
      <Text variant="overline" color={colors.text.muted} style={{ marginTop: spacing.sm }}>
        Segurança
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/bloqueados')}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 4,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.bg.elevated,
            borderWidth: 1,
            borderColor: colors.border.default,
          },
          pressed && { opacity: 0.8 },
        ]}>
        <Ionicons name="ban-outline" size={20} color={colors.text.secondary} />
        <View style={{ flex: 1 }}>
          <Text variant="labelButton">Usuários bloqueados</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>
      <Text variant="body" color={colors.text.muted}>
        Privacidade (visibilidade das publicações e distância), notificações e exclusão de conta entram aqui
        na Sprint 6.
      </Text>
      <Button title="Sair da conta" variant="secondary" onPress={sair} />

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
