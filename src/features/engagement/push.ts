import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { notificationTarget, notificationText } from '@/domain/engagement';
import { engagementApi } from '@/features/engagement/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useNotifications } from '@/store/notifications';

/**
 * US-21 — Notificações no celular.
 *
 * • Development build / loja: registra o token do Expo Push e o banco envia o push
 *   (trigger enviar_push, migration 0013), mesmo com o app fechado.
 * • Expo Go: push remoto não existe no Android desde o SDK 53. Enquanto o app está
 *   aberto, a notificação nova chega pelo Realtime e vira uma notificação local.
 */

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'GymBrô',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#BE5049',
    });
  }
}

/** Pede a permissão (Android 13+ / iOS). Devolve se está liberado. */
export async function askNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function notificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Token do Expo Push — só fora do Expo Go e com projectId do EAS */
async function getPushToken(): Promise<string | null> {
  if (isExpoGo || !Device.isDevice || Platform.OS === 'web') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

type Data = {
  tipo?: string;
  referenciaId?: string | null;
  conexaoId?: string | null;
  origemId?: string | null;
};

function openFromData(data: Data) {
  if (!data?.tipo) return;
  const target = notificationTarget({
    tipo: data.tipo,
    referenciaId: data.referenciaId ?? null,
    // mensagem e match trazem a conexão em referenciaId
    conexaoId:
      data.conexaoId ??
      (data.tipo === 'mensagem' || data.tipo === 'conexao' ? (data.referenciaId ?? null) : null),
    origem: data.origemId ? { id: data.origemId, nome: '', foto: null } : null,
  });
  if (!target) return router.push('/notificacoes');
  if (target.kind === 'chat') router.push({ pathname: '/chat/[id]', params: { id: target.id } });
  else if (target.kind === 'comments')
    router.push({ pathname: '/comentarios/[id]', params: { id: target.id } });
  else if (target.kind === 'publish') router.push('/publicar');
  else router.push({ pathname: '/perfil/[id]', params: { id: target.id } });
}

/**
 * Liga as notificações enquanto o usuário está logado no app (layout raiz):
 * badge do sino, aviso local no Expo Go, registro do token e toque na notificação.
 */
export function useNotificationsBridge(enabled: boolean) {
  const refresh = useNotifications((s) => s.refresh);
  const increment = useNotifications((s) => s.increment);
  const hasPushToken = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    let alive = true;

    // Permissão + token (o banco só envia push se houver token)
    (async () => {
      const granted = await askNotificationPermission().catch(() => false);
      const token = granted ? await getPushToken() : null;
      hasPushToken.current = !!token;
      if (alive && isSupabaseConfigured) await engagementApi.registerPushToken(token).catch(() => undefined);
    })();

    // Tempo real: atualiza o badge e, sem push remoto, mostra uma notificação local
    const unsubscribe = engagementApi.subscribe(async (n) => {
      increment();
      if (hasPushToken.current || Platform.OS === 'web') return;
      let nome: string | null = null;
      if (n.origemId) {
        const { data } = await supabase.from('usuario').select('nome').eq('id', n.origemId).maybeSingle();
        nome = (data as { nome?: string } | null)?.nome ?? null;
      }
      Notifications.scheduleNotificationAsync({
        content: { title: 'GymBrô', body: notificationText(n.tipo, nome), data: { tipo: n.tipo } },
        trigger: null,
      }).catch(() => undefined);
    });

    // Toque na notificação → abre a tela certa
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      openFromData(r.notification.request.content.data as Data);
    });
    // Voltou para o app: recarrega o contador
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });

    return () => {
      alive = false;
      unsubscribe();
      sub.remove();
      appSub.remove();
    };
  }, [enabled, refresh, increment]);
}
