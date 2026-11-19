import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { timeAgo } from '@/domain/feed';
import {
  AppNotification,
  groupNotifications,
  NOTIFICATION_ICONS,
  notificationTarget,
} from '@/domain/engagement';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { ENGAGEMENT_MESSAGES, engagementApi } from '@/features/engagement/api';
import { useNotifications } from '@/store/notifications';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * F7 · US-21 — Notificações
 * Matches, mensagens, convites, curtidas, comentários e lembrete de sequência.
 * Tocar abre a tela relacionada e marca como lida; "Marcar todas como lidas" zera o sino.
 * Quem bloqueou/foi bloqueado some da lista (RN-015). Os tipos desligados em C2 não são gravados.
 */
export default function Notificacoes() {
  const [list, setList] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [end, setEnd] = useState(false);
  const setUnread = useNotifications((s) => s.setUnread);

  const load = useCallback(async () => {
    try {
      const page = await engagementApi.notifications();
      setList(page);
      setEnd(page.length < 30);
      setUnread(page.filter((n) => !n.lida).length);
    } catch {
      setList((cur) => cur ?? []);
      toast(ENGAGEMENT_MESSAGES.generic, 'error');
    }
  }, [setUnread]);

  // Recarrega ao voltar de um chat/comentário aberto pela notificação
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!list?.length || end || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await engagementApi.notifications(list[list.length - 1].criadoEm);
      setList((cur) => [...(cur ?? []), ...page.filter((p) => !cur?.some((c) => c.id === p.id))]);
      setEnd(page.length < 30);
    } catch {
      // tenta de novo no próximo scroll
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (n: AppNotification) => {
    if (!n.lida) {
      engagementApi.markRead([n.id]).catch(() => undefined);
      setList((cur) => cur?.map((x) => (x.id === n.id ? { ...x, lida: true } : x)) ?? null);
      setUnread(Math.max(0, (list?.filter((x) => !x.lida).length ?? 1) - 1));
    }
    const t = notificationTarget(n);
    if (!t) return;
    if (t.kind === 'chat') router.push({ pathname: '/chat/[id]', params: { id: t.id } });
    else if (t.kind === 'comments') router.push({ pathname: '/comentarios/[id]', params: { id: t.id } });
    else if (t.kind === 'publish') router.push('/publicar');
    else router.push({ pathname: '/perfil/[id]', params: { id: t.id } });
  };

  const markAll = async () => {
    setList((cur) => cur?.map((x) => ({ ...x, lida: true })) ?? null);
    setUnread(0);
    try {
      await engagementApi.markRead();
    } catch {
      toast(ENGAGEMENT_MESSAGES.generic, 'error');
    }
  };

  const sections = useMemo(() => groupNotifications(list ?? []), [list]);
  const hasUnread = list?.some((n) => !n.lida);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Header title="Notificações" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar notificações"
          hitSlop={10}
          onPress={() => router.push('/config-notificacoes')}>
          <Ionicons name="options-outline" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      {list === null ? (
        <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            hasUnread ? (
              <Pressable
                accessibilityRole="button"
                onPress={markAll}
                hitSlop={8}
                style={{ alignSelf: 'flex-end', paddingVertical: spacing.xs }}>
                <Text variant="labelSmall" color={colors.brand.red}>
                  Marcar todas como lidas
                </Text>
              </Pressable>
            ) : undefined
          }
          renderSectionHeader={({ section }) => (
            <Text
              variant="overline"
              color={colors.text.muted}
              style={styles.section}
              accessibilityRole="header">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => <Row n={item} onPress={() => open(item)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={32} color={colors.text.muted} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>
                Nada por aqui ainda
              </Text>
              <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                Matches, mensagens, curtidas e comentários aparecem aqui.
              </Text>
              <Button
                title="Descobrir parceiros"
                variant="secondary"
                onPress={() => router.push('/descobrir')}
              />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.brand.red} style={{ margin: spacing.md }} />
            ) : undefined
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.red} />
          }
        />
      )}
    </SafeAreaView>
  );
}

function Row({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const icon = (NOTIFICATION_ICONS[n.tipo] ?? 'notifications') as IconName;
  const green = n.tipo === 'conexao' || n.tipo === 'convite_aceito' || n.tipo === 'lembrete_sequencia';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n.lida ? '' : 'Não lida. '}${n.texto} ${timeAgo(n.criadoEm)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !n.lida && styles.unread, pressed && { opacity: 0.75 }]}>
      <View>
        {n.origem ? (
          <PersonAvatar nome={n.origem.nome} foto={n.origem.foto} size={46} />
        ) : (
          <View style={[styles.systemIcon]}>
            <Ionicons name={icon} size={22} color={colors.brand.green} />
          </View>
        )}
        {n.origem ? (
          <View style={[styles.badge, { backgroundColor: green ? colors.brand.green : colors.brand.red }]}>
            <Ionicons name={icon} size={11} color={colors.white} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={n.lida ? colors.text.secondary : colors.text.primary}>
          {n.texto}
        </Text>
        <Text variant="caption" color={colors.text.muted}>
          {timeAgo(n.criadoEm)}
        </Text>
      </View>
      {!n.lida ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg - 4,
  },
  content: { paddingHorizontal: spacing.lg - 4, paddingBottom: spacing.xl, gap: spacing.xs, flexGrow: 1 },
  section: { marginTop: spacing.md, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
  },
  unread: { backgroundColor: colors.bg.elevated },
  systemIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#16241C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.base,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand.red },
  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
