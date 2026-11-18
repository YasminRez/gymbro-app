import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Header, Screen, Text } from '@/components/ui';
import { CURRENT_TERMS_DATE, CURRENT_TERMS_VERSION, LEGAL_DOCS, LegalDoc } from '@/constants/legal';
import { colors, spacing } from '@/theme';

/** US-03, cenário 1 — Termos de Uso e Política de Privacidade completos */
export default function Documento() {
  const { tipo } = useLocalSearchParams<{ tipo: LegalDoc }>();
  const doc = LEGAL_DOCS[tipo] ?? LEGAL_DOCS['termos-de-uso'];

  return (
    <Screen scroll>
      <Header title={doc.title} />
      <Text variant="caption" color={colors.text.muted}>
        Versão {CURRENT_TERMS_VERSION} · {CURRENT_TERMS_DATE}
      </Text>
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ gap: spacing.xs }}>
          <Text variant="h3">{s.heading}</Text>
          <Text variant="bodyLarge" color={colors.text.secondary}>
            {s.body}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
