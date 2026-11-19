import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Notice, Text } from '@/components/ui';
import { CHAT_MESSAGES, ConnectionItem, formatListTime, splitConnections } from '@/domain/chat';
import { pendingReceived } from '@/domain/invite';
import { connectionsApi } from '@/features/connections/api';
import { invitesApi } from '@/features/invites/api';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { colors, radius, spacing } from '@/theme';

/**
 * D10/D11 · US-11 — Conexões
 * Novas conexões em destaque no topo; abaixo, as conversas pela mensagem mais
 * recente, com o número de não lidas. Atualiza sozinha quando chega mensagem.
 */
export default function Conexoes() {
  const [items, setItems] = useState<ConnectionItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [convites, setConvites] = useState(0);

  const load = useCallback(async () => {
    invitesApi
      .list()
      .then((l) => setConvites(pendingReceived(l)))
      .catch(() => undefined);
    try {
      setItems(await connectionsApi.list());
      setError(false);
    } catch {
      setError(true);
      setItems((old) => old ?? []);
    }
  }, []);

  // Recarrega sempre que a aba volta a aparecer (ex.: depois de sair de um chat)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Tempo real: mensagem nova em qualquer conversa atualiza a lista
  useEffect(() => connectionsApi.subscribeList(load), [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { novas, conversas } = useMemo(() => splitConnections(items ?? []), [items]);
  const abrir = (c: ConnectionItem) => router.push({ pathname: '/chat/[id]', params: { id: c.id } });

  if (items === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.brand.red} />
      </SafeAreaView>
    );
  }

  const vazio = novas.length === 0 && conversas.length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={conversas}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow item={item} onPress={() => abrir(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.red} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: 2 }}>
              <View style={styles.titleRow}>
                <Text variant="h1">Conexões</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Treinos combinados${convites ? `, ${convites} convites esperando resposta` : ''}`}
                  onPress={() => router.push('/treinos')}
                  style={styles.treinosBtn}>
                  <Ionicons name="calendar-outline" size={18} color={colors.brand.green} />
                  <Text variant="labelSmall" color={colors.brand.green}>
                    Treinos
                  </Text>
                  {convites > 0 ? (
                    <View style={styles.dot}>
                      <Text variant="overline" color={colors.white}>
                        {convites}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
              {!vazio ? (
                <Text variant="body" color={colors.text.secondary}>
                  {novas.length + conversas.length}{' '}
                  {novas.length + conversas.length === 1 ? 'parceiro de treino' : 'parceiros de treino'}
                </Text>
              ) : null}
            </View>

            {error ? (
              <Notice tone="error" icon="cloud-offline-outline">
                Não foi possível atualizar. Puxe para baixo para tentar de novo.
              </Notice>
            ) : null}

            {novas.length > 0 ? (
              <View style={{ gap: spacing.sm + 4 }}>
                <Text variant="overline" color={colors.brand.green}>
                  Novas conexões · {novas.length}
                </Text>
                <FlatList
                  horizontal
                  data={novas}
                  keyExtractor={(c) => c.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.md }}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Nova conexão: ${item.pessoa.nome}. Abrir conversa`}
                      onPress={() => abrir(item)}
                      style={({ pressed }) => [styles.newItem, pressed && { opacity: 0.7 }]}>
                      <Animated.View entering={FadeIn.duration(250)}>
                        <PersonAvatar nome={item.pessoa.nome} foto={item.pessoa.foto} size={68} ring />
                      </Animated.View>
                      <Text
                        variant="labelSmall"
                        numberOfLines={1}
                        style={{ maxWidth: 72, textAlign: 'center' }}>
                        {item.pessoa.nome.split(' ')[0]}
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            ) : null}

            {conversas.length > 0 ? (
              <Text variant="overline" color={colors.text.muted}>
                Mensagens
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          vazio ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={36} color={colors.brand.red} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>
                {CHAT_MESSAGES.empty}
              </Text>
              <Button title="Ir para Descobrir" onPress={() => router.navigate('/descobrir')} />
            </View>
          ) : (
            <Text
              variant="body"
              color={colors.text.muted}
              style={{ textAlign: 'center', marginTop: spacing.md }}>
              Mande a primeira mensagem para suas novas conexões e combinem um treino.
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function ConversationRow({ item, onPress }: { item: ConnectionItem; onPress: () => void }) {
  const last = item.ultimaMensagem!;
  const unread = item.naoLidas > 0;
  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Conversa com ${item.pessoa.nome}${unread ? `, ${item.naoLidas} não lidas` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg.elevated }]}>
        <PersonAvatar nome={item.pessoa.nome} foto={item.pessoa.foto} size={54} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.rowTop}>
            <Text variant={unread ? 'labelButton' : 'bodyLarge'} numberOfLines={1} style={{ flex: 1 }}>
              {item.pessoa.nome}
            </Text>
            <Text variant="caption" color={unread ? colors.brand.red : colors.text.muted}>
              {formatListTime(last.enviadaEm)}
            </Text>
          </View>
          <View style={styles.rowTop}>
            <Text
              variant="body"
              numberOfLines={1}
              color={unread ? colors.text.primary : colors.text.muted}
              style={{ flex: 1 }}>
              {last.minha ? 'Você: ' : ''}
              {last.conteudo}
            </Text>
            {unread ? (
              <View style={styles.badge}>
                <Text variant="overline" color={colors.white}>
                  {item.naoLidas > 99 ? '99+' : item.naoLidas}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  center: { flex: 1, backgroundColor: colors.bg.base, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg - 4, paddingBottom: spacing.xxl, flexGrow: 1 },
  newItem: { alignItems: 'center', gap: spacing.xs + 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  treinosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#16241C',
  },
  dot: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.default, marginLeft: 70 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2A1716',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
