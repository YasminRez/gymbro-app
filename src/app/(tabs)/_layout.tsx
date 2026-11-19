import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';

import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** RNF-008 — Navegação por abas: Descobrir, Feed, Publicar, Conexões e Perfil */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'descobrir', title: 'Descobrir', icon: 'flame-outline' },
  { name: 'feed', title: 'Feed', icon: 'images-outline' },
  { name: 'publicar', title: 'Publicar', icon: 'add-circle' },
  { name: 'conexoes', title: 'Conexões', icon: 'chatbubbles-outline' },
  { name: 'perfil', title: 'Perfil', icon: 'person-circle-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Teclado aberto esconde as abas e libera espaço para o campo
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.brand.red,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: { backgroundColor: colors.bg.surface, borderTopColor: colors.border.default },
        tabBarLabelStyle: { fontFamily: fonts.interSemiBold, fontSize: 11 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={t.icon}
                color={color as string}
                size={t.name === 'publicar' ? size + 8 : size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
