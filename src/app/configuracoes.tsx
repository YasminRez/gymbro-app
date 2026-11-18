import { Alert, Platform } from 'react-native';

import { Button, Header, Screen, Text } from '@/components/ui';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

/** C1 · US-02 (cenário 6), US-23, US-24 — Configurações e privacidade */
export default function Configuracoes() {
  const { signOut, user } = useSession();

  const sair = () => {
    const confirmar = () => signOut();
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Deseja sair da sua conta?')) confirmar();
      return;
    }
    Alert.alert('Sair da conta', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: confirmar },
    ]);
  };

  return (
    <Screen scroll>
      <Header title="Configurações" />
      {user?.nome ? (
        <Text variant="body" color={colors.text.secondary}>
          Conectado como {user.nome}
        </Text>
      ) : null}
      <Text variant="body" color={colors.text.muted}>
        Privacidade (visibilidade das publicações e distância), notificações, usuários bloqueados e exclusão
        de conta entram aqui nas próximas sprints.
      </Text>
      <Button title="Sair da conta" variant="secondary" onPress={sair} />
    </Screen>
  );
}
