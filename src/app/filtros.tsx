import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Header, Screen, Text } from '@/components/ui';
import { MODALIDADES, OBJETIVOS, PERIODOS } from '@/constants/catalogos';
import { DiscoveryFilters, emptyFilters } from '@/domain/discovery';
import { useDiscovery } from '@/store/discovery';
import { colors, spacing } from '@/theme';

/** D3 · US-08, cenário 2 — Filtros rápidos (período, modalidade, objetivo) + atalho para as preferências */
export default function Filtros() {
  const { filters, setFilters } = useDiscovery();
  const [draft, setDraft] = useState<DiscoveryFilters>(filters);

  const pick = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? null : value }));

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            title="Aplicar filtros"
            onPress={() => {
              setFilters(draft);
              router.back();
            }}
          />
          <Button title="Limpar" variant="ghost" onPress={() => setDraft(emptyFilters)} />
        </>
      }>
      <Header title="Filtros" />
      <Text variant="body" color={colors.text.secondary}>
        Os filtros valem junto com suas preferências de descoberta (idade, gênero e distância).
      </Text>

      <Group title="Período">
        {PERIODOS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={draft.periodo === p.value}
            onPress={() => pick('periodo', p.value)}
          />
        ))}
      </Group>
      <Group title="Modalidade">
        {MODALIDADES.map((m) => (
          <Chip key={m} label={m} selected={draft.modalidade === m} onPress={() => pick('modalidade', m)} />
        ))}
      </Group>
      <Group title="Objetivo">
        {OBJETIVOS.map((o) => (
          <Chip key={o} label={o} selected={draft.objetivo === o} onPress={() => pick('objetivo', o)} />
        ))}
      </Group>

      <Button
        title="Preferências de descoberta"
        variant="secondary"
        onPress={() => router.push('/preferencias')}
      />
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="h3">{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
    </View>
  );
}
