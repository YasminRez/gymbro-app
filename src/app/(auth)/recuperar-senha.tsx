import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Header, Input, Notice, Screen, Text } from '@/components/ui';
import { AUTH_MESSAGES, authApi } from '@/features/auth/api';
import { colors, radius, spacing } from '@/theme';

/** A3 · US-02, cenário 4 — Recuperar senha */
export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('E-mail inválido.');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendPasswordReset(email);
    } catch {
      // mesma resposta para não revelar se o e-mail existe
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          Lembrou?{' '}
          <Text variant="body" color={colors.brand.red} onPress={() => router.back()}>
            Voltar para Entrar
          </Text>
        </Text>
      }>
      <Header title="Recuperar senha" />
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.lg,
          backgroundColor: '#2A1716',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.brand.red} />
      </View>
      <Text variant="h1">Esqueceu a senha?</Text>
      <Text variant="bodyLarge" color={colors.text.secondary}>
        Informe o e-mail da sua conta. Vamos enviar um link de redefinição válido por 30 minutos.
      </Text>
      <Input
        label="E-mail"
        icon="mail-outline"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        error={error ?? undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={enviar}
      />
      <Button title={sent ? 'Enviar de novo' : 'Enviar link'} onPress={enviar} loading={loading} />
      {sent ? (
        <View style={{ marginTop: spacing.sm }}>
          <Notice tone="success" icon="mail-outline">
            {AUTH_MESSAGES.resetSent}
          </Notice>
        </View>
      ) : null}
    </Screen>
  );
}
