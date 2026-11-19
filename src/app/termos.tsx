import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Notice, Text } from '@/components/ui';
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
    <View style={styles.screen}>
      {/* Fundo com o símbolo, painel por cima (mesmo padrão dos pop-ups do app) */}
      <SafeAreaView edges={['top']} style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.halo}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark" size={34} color={colors.brand.green} />
          </View>
        </Animated.View>
      </SafeAreaView>

      <Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}>
        <SafeAreaView edges={['bottom']} style={{ gap: spacing.md }}>
          <View style={styles.handle} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="h2" style={styles.center} accessibilityRole="header">
              Atualizamos nossos termos
            </Text>
            <Text variant="body" color={colors.text.secondary} style={styles.center}>
              Para continuar usando o GymBrô, aceite a nova versão (v{CURRENT_TERMS_VERSION} ·{' '}
              {CURRENT_TERMS_DATE}).
            </Text>
          </View>

          <View style={styles.list}>
            <Text variant="overline" color={colors.text.muted}>
              O que mudou
            </Text>
            {TERMS_CHANGES.map((c) => (
              <View key={c} style={{ flexDirection: 'row', gap: spacing.sm + 4 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.brand.green} />
                <Text variant="body" style={{ flex: 1 }}>
                  {c}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.docs}>
            <DocRow href="/documento/termos-de-uso" icon="document-text-outline" label="Termos de Uso" />
            <View style={styles.divider} />
            <DocRow
              href="/documento/politica-de-privacidade"
              icon="lock-closed-outline"
              label="Política de Privacidade"
            />
          </View>

          {error ? (
            <Notice tone="error" icon="alert-circle-outline">
              {AUTH_MESSAGES.generic}
            </Notice>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <Button title="Li e aceito" onPress={aceitar} loading={loading} />
            <Button title="Sair da conta" variant="ghost" onPress={signOut} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function DocRow({
  href,
  icon,
  label,
}: {
  href: '/documento/termos-de-uso' | '/documento/politica-de-privacidade';
  icon: 'document-text-outline' | 'lock-closed-outline';
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [styles.docRow, pressed && { opacity: 0.7 }]}>
        <Ionicons name={icon} size={20} color={colors.text.secondary} />
        <Text variant="labelButton" style={{ flex: 1 }}>
          Ler {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base, justifyContent: 'flex-end' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16241C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.strong,
  },
  center: { textAlign: 'center' },
  list: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
  docs: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.strong, marginLeft: 48 },
});
