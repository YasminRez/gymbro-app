import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Notice, Screen, Text } from '@/components/ui';
import { CURRENT_TERMS_DATE, CURRENT_TERMS_VERSION, TERMS_CHANGES } from '@/constants/legal';
import { AUTH_MESSAGES, authApi } from '@/features/auth/api';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/**
 * A5 · US-03, cenário 2 — Termos atualizados.
 * Fica na frente de todo o app até a pessoa aceitar a versão atual (RN-005).
 */
export default function TermosAtualizados() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const signOut = useSession((s) => s.signOut);

  const aceitar = async () => {
    setLoading(true);
    setError(false);
    try {
      await authApi.acceptTerms();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <View style={styles.sheet}>
        <View style={styles.icon}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.brand.green} />
        </View>
        <Text variant="h2">Atualizamos nossos termos</Text>
        <Text variant="body" color={colors.text.secondary}>
          Para continuar usando o GymBrô, leia e aceite a nova versão (v{CURRENT_TERMS_VERSION} ·{' '}
          {CURRENT_TERMS_DATE}).
        </Text>
        <View style={styles.list}>
          {TERMS_CHANGES.map((c) => (
            <View key={c} style={{ flexDirection: 'row', gap: spacing.sm + 4 }}>
              <Ionicons name="checkmark" size={18} color={colors.brand.green} />
              <Text variant="body" style={{ flex: 1 }}>
                {c}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="labelSmall" color={colors.brand.red}>
          <Link href="/documento/termos-de-uso">Ler Termos de Uso</Link>
          {'  ·  '}
          <Link href="/documento/politica-de-privacidade">Ler Política de Privacidade</Link>
        </Text>
        {error ? (
          <Notice tone="error" icon="alert-circle-outline">
            {AUTH_MESSAGES.generic}
          </Notice>
        ) : null}
        <Button title="Li e aceito" onPress={aceitar} loading={loading} />
        <Button title="Sair da conta" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg - 4,
    gap: spacing.md,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
});
