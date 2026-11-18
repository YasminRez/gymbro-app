import { ReactNode } from 'react';
import { View } from 'react-native';

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
            <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
              Falta: {missing.join(', ')}
            </Text>
          ) : null}
          <Button title={cta} onPress={onNext} disabled={missing.length > 0} loading={loading} />
        </>
      }>
      <Header title="Seu perfil" />
      <View style={{ flexDirection: 'row', gap: spacing.xs }} accessibilityLabel={`Etapa ${step} de 3`}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: s <= step ? colors.brand.red : colors.border.default,
            }}
          />
        ))}
      </View>
      <Text variant="overline" color={colors.text.muted}>
        Etapa {step} de 3
      </Text>
      <Text variant="h1">{title}</Text>
      <Text variant="body" color={colors.text.secondary}>
        {subtitle}
      </Text>
      {children}
    </Screen>
  );
}
