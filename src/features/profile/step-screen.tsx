import { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/** Moldura das 3 etapas do perfil: título, barra de progresso, itens que faltam e "Continuar" */
export function StepScreen({
  step,
  title,
  subtitle,
  missing,
  cta = 'Continuar',
  onNext,
  loading,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
  missing: string[];
  cta?: string;
  onNext: () => void;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <Screen
      scroll
      footer={
        <>
          {missing.length > 0 ? (
            <View style={styles.missing}>
              <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
              <Text variant="caption" color={colors.text.muted} style={{ flexShrink: 1 }}>
                Falta: {missing.join(', ')}
              </Text>
            </View>
          ) : null}
          <Button title={cta} onPress={onNext} disabled={missing.length > 0} loading={loading} />
        </>
      }>
      <Header title="Seu perfil" />
      <View style={{ gap: spacing.sm }}>
        <View style={styles.progressRow} accessibilityLabel={`Etapa ${step} de 3`}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.progress,
                { backgroundColor: s <= step ? colors.brand.red : colors.border.default },
              ]}
            />
          ))}
        </View>
        <Text variant="overline" color={colors.text.muted}>
          Etapa {step} de 3
        </Text>
      </View>
      <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
        <Text variant="h1">{title}</Text>
        <Text variant="body" color={colors.text.secondary}>
          {subtitle}
        </Text>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: spacing.xs },
  progress: { flex: 1, height: 4, borderRadius: radius.pill },
  missing: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
