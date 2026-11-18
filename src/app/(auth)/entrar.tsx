import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, TextInputInstance, View } from 'react-native';

import { Button, Divider, Input, Logo, Notice, Screen, Text } from '@/components/ui';
import { AUTH_MESSAGES, AuthError, authApi, DEMO_LOGIN } from '@/features/auth/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

/** A2 · US-02 — Entrar (RN-001, RN-023) */
export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const senhaRef = useRef<TextInputInstance>(null);

  const entrar = async () => {
    if (!email.trim() || !senha) {
      setError(AUTH_MESSAGES.invalidCredentials);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.signIn(email, senha);
      // Sessão ativa: o layout raiz leva para a aba Descobrir.
    } catch (e) {
      setError(e instanceof AuthError ? e.message : AUTH_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
          Ao entrar você concorda com os{' '}
          <Link href="/documento/termos-de-uso">
            <Text variant="caption" color={colors.text.secondary}>
              Termos de Uso
            </Text>
          </Link>{' '}
          e a{' '}
          <Link href="/documento/politica-de-privacidade">
            <Text variant="caption" color={colors.text.secondary}>
              Política de Privacidade
            </Text>
          </Link>
          .
        </Text>
      }>
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
        <Logo />
      </View>
      <Text variant="h1">Bem-vindo de volta, brô 💪</Text>
      <Text variant="bodyLarge" color={colors.text.secondary}>
        Entre para ver quem treina na sua academia.
      </Text>

      <Input
        label="E-mail"
        icon="mail-outline"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        error={error ? ' ' : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => senhaRef.current?.focus()}
      />
      <Input
        ref={senhaRef}
        label="Senha"
        icon="lock-closed-outline"
        password
        value={senha}
        onChangeText={(t) => {
          setSenha(t);
          setError(null);
        }}
        error={error ? ' ' : undefined}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={entrar}
      />

      <Link href="/recuperar-senha" asChild>
        <Pressable accessibilityRole="link" style={{ alignSelf: 'flex-end' }} hitSlop={8}>
          <Text variant="labelSmall" color={colors.brand.red}>
            Esqueci minha senha
          </Text>
        </Pressable>
      </Link>

      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}

      <Button title="Entrar" onPress={entrar} loading={loading} />
      <Divider label="ou" />
      <Button title="Criar conta" variant="secondary" onPress={() => router.push('/criar-conta')} />

      {!isSupabaseConfigured ? (
        <Pressable
          onPress={() => {
            setEmail(DEMO_LOGIN.email);
            setSenha(DEMO_LOGIN.senha);
          }}
          style={{ marginTop: spacing.sm }}>
          <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
            Modo demonstração (sem Supabase). Toque aqui para preencher a conta de teste: {DEMO_LOGIN.email}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
