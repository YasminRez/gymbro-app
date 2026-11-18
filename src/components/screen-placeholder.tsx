import { Href, router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Link = { title: string; href: Href; variant?: 'primary' | 'secondary' | 'success' | 'ghost' };

type Props = {
  /** Código da tela no protótipo do Figma (ex.: "D1") */
  code: string;
  title: string;
  /** Histórias de usuário do DRS atendidas por esta tela */
  stories: string[];
  description?: string;
  links?: Link[];
};

/**
 * Tela provisória: mostra o código do protótipo e as US que ela implementa.
 * Substitua pelo layout real ao trabalhar em cada história.
 */
export function ScreenPlaceholder({ code, title, stories, description, links = [] }: Props) {
  return (
    <Screen scroll>
      <Text variant="overline" color={colors.brand.red}>
        {code} · {stories.join(', ')}
      </Text>
      <Text variant="h1">{title}</Text>
      {description ? (
        <Text variant="bodyLarge" color={colors.text.secondary}>
          {description}
        </Text>
      ) : null}
      <Card>
        <Text variant="caption" color={colors.text.muted}>
          Tela provisória. O layout final está no protótipo do Figma, na tela {code}.
        </Text>
      </Card>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {links.map((l) => (
          <Button
            key={l.title}
            title={l.title}
            variant={l.variant ?? 'secondary'}
            onPress={() => router.push(l.href)}
          />
        ))}
      </View>
    </Screen>
  );
}
