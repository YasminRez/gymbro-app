import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { Button, Header, Input, Notice, Screen, Text } from '@/components/ui';
import { isStrongPassword, PASSWORD_ERROR } from '@/domain/rules';
import { AUTH_MESSAGES, authApi } from '@/features/auth/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

/**
 * US-02, cenário 4 — Definir nova senha.
 * O link do e-mail abre o app aqui com os tokens no endereço (#access_token=...).
 */
export default function NovaSenha() {
  const url = Linking.useLinkingURL();
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const tokens = useMemo(() => {
    if (!url || !url.includes('#')) return null;
    const params = new URLSearchParams(url.split('#')[1]);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (params.get('error') || !access_token || !refresh_token) return 'invalido' as const;
    return { access_token, refresh_token };
  }, [url]);

  useEffect(() => {
    if (!tokens || tokens === 'invalido') return;
    supabase.auth.setSession(tokens).then(({ error: e }) => setSessionError(!!e));
  }, [tokens]);

  const linkError = tokens === 'invalido' || sessionError;

  const salvar = async () => {
    if (!isStrongPassword(senha)) {
      setError(PASSWORD_ERROR);
      return;
    }
    setLoading(true);
    try {
      await authApi.updatePassword(senha);
      setDone(true);
    } catch {
      setError(AUTH_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Nova senha" />
      {linkError ? (
        <Notice tone="error" icon="time-outline">
          Este link expirou ou já foi usado. Peça um novo em &quot;Esqueci minha senha&quot;.
        </Notice>
      ) : done ? (
        <>
          <Notice tone="success" icon="checkmark-circle-outline">
            Senha alterada com sucesso.
          </Notice>
          <Button title="Continuar" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <Text variant="bodyLarge" color={colors.text.secondary}>
            Crie uma senha nova para a sua conta.
          </Text>
          <Input
            label="Nova senha"
            icon="lock-closed-outline"
            password
            value={senha}
            onChangeText={(t) => {
              setSenha(t);
              setError(null);
            }}
            error={error ?? undefined}
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Button title="Salvar nova senha" onPress={salvar} loading={loading} />
        </>
      )}
    </Screen>
  );
}
