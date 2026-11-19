import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform } from 'react-native';

import { SettingsGroup, ToggleRow } from '@/components/settings-rows';
import { Button, Card, Header, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { NOTIFICATION_PREF_ITEMS, NotificationPrefs } from '@/domain/engagement';
import { ENGAGEMENT_MESSAGES, engagementApi } from '@/features/engagement/api';
import { askNotificationPermission, notificationPermissionGranted } from '@/features/engagement/push';
import { colors } from '@/theme';

/**
 * C2 · US-21 — Notificações
 * Liga e desliga cada tipo. Salva na hora (no banco, um trigger descarta o tipo
 * desligado antes de gravar). Se o sistema bloqueou as notificações, explica e
 * leva para os ajustes do celular.
 */
export default function ConfigNotificacoes() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    engagementApi
      .prefs()
      .then(setPrefs)
      .catch(() => toast(ENGAGEMENT_MESSAGES.generic, 'error'));
    const check = () =>
      notificationPermissionGranted()
        .then(setGranted)
        .catch(() => setGranted(false));
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  const toggle = (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    const before = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saving.current = saving.current.then(() =>
      engagementApi.savePrefs(next).then(
        () => undefined,
        () => {
          setPrefs(before);
          toast(ENGAGEMENT_MESSAGES.generic, 'error');
        },
      ),
    );
  };

  const ativar = async () => {
    const ok = await askNotificationPermission();
    setGranted(ok);
    if (!ok) Linking.openSettings();
  };

  return (
    <Screen scroll>
      <Header title="Notificações" />

      {granted === false && Platform.OS !== 'web' ? (
        <Card style={{ borderColor: colors.brand.red + '66' }}>
          <Text variant="labelButton">As notificações estão desligadas no celular</Text>
          <Text variant="body" color={colors.text.secondary}>
            Você continua vendo tudo no sino do Feed, mas não recebe avisos fora do app.
          </Text>
          <Button title="Ativar notificações" onPress={ativar} />
        </Card>
      ) : null}

      {prefs === null ? (
        <ActivityIndicator color={colors.brand.red} />
      ) : (
        <SettingsGroup title="Quero ser avisado sobre">
          {NOTIFICATION_PREF_ITEMS.map((item, i) => (
            <ToggleRow
              key={item.key}
              first={i === 0}
              label={item.label}
              hint={item.hint}
              value={prefs[item.key]}
              onChange={(v) => toggle(item.key, v)}
            />
          ))}
        </SettingsGroup>
      )}
      <Text variant="caption" color={colors.text.muted}>
        Notificações desligadas aqui não são enviadas nem aparecem na lista.
      </Text>
    </Screen>
  );
}
