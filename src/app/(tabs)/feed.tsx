import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, Button, Chip, ConfirmSheet, Notice, Sheet, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import {
  appendPage,
  FEED_MESSAGES,
  FEED_PAGE,
  FEED_TABS,
  FeedError,
  FeedTab,
  Post,
  toggleLike,
} from '@/domain/feed';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { feedApi, Liker } from '@/features/feed/api';
import { PostCard } from '@/features/feed/post-card';
import { openProfile } from '@/features/profile/open-profile';
import { SafetyMode, SafetySheets } from '@/features/safety/safety-sheets';
import { usePublish } from '@/store/publish';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';

/**
 * F1 · US-17, US-18, US-20 — Feed
 * Todos / Conexões / Minha academia (RN-021), 20 por vez com cursor, puxar para
 * atualizar, curtir com toque duplo, ver quem curtiu, excluir a própria publicação
 * (F3, com o aviso do check-in) e denunciar/bloquear o autor.
 */
export default function Feed() {
  const [tab, setTab] = useState<FeedTab>('todos');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [deletePost, setDeletePost] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [likers, setLikers] = useState<{ post: Post; list: Liker[] | null } | null>(null);
  const [safety, setSafety] = useState<{ mode: SafetyMode; post: Post } | null>(null);
  const myId = useSession((s) => s.user?.id);
  const feedVersion = usePublish((s) => s.feedVersion);
  const commentCounts = usePublish((s) => s.commentCounts);
  const bumpFeed = usePublish((s) => s.bumpFeed);
  const reqId = useRef(0);

  const load = useCallback(async (t: FeedTab) => {
    const id = ++reqId.current;
    try {
      const page = await feedApi.feed(t);
      if (id !== reqId.current) return; // trocou de aba no meio do caminho
      setPosts(page);
      setDone(page.length < FEED_PAGE);
      setError(false);
    } catch {
      if (id !== reqId.current) return;
      setError(true);
      setPosts((p) => p ?? []);
    }
  }, []);

  // Carrega ao abrir, ao trocar de aba e depois de publicar/excluir
  useEffect(() => {
    const t = setTimeout(() => load(tab), 0);
    return () => clearTimeout(t);
  }, [tab, feedVersion, load]);

  const trocarAba = (t: FeedTab) => {
    if (t === tab) return;
    setPosts(null);
    setTab(t);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  };

  // US-17, cenário 3: as próximas 20
  const loadMore = async () => {
    if (loadingMore || done || !posts?.length) return;
    setLoadingMore(true);
    try {
      const page = await feedApi.feed(tab, posts[posts.length - 1]);
      setPosts((cur) => appendPage(cur ?? [], page));
      setDone(page.length < FEED_PAGE);
    } catch {
      // tenta de novo no próximo fim de rolagem
    } finally {
      setLoadingMore(false);
    }
  };

  // US-18: curte na hora e confirma no servidor
  const like = useCallback(async (p: Post, fromDoubleTap?: boolean) => {
    if (fromDoubleTap && p.curti) return; // toque duplo só curte, não descurte
    setPosts((cur) => cur?.map((x) => (x.id === p.id ? toggleLike(x) : x)) ?? cur);
    try {
      const r = await feedApi.like(p.id);
      setPosts(
        (cur) => cur?.map((x) => (x.id === p.id ? { ...x, curti: r.curti, curtidas: r.curtidas } : x)) ?? cur,
      );
    } catch (e) {
      setPosts((cur) => cur?.map((x) => (x.id === p.id ? p : x)) ?? cur);
      toast(e instanceof FeedError ? e.message : FEED_MESSAGES.generic, 'error');
    }
  }, []);

  const openLikers = useCallback(async (p: Post) => {
    setLikers({ post: p, list: null });
    const list = await feedApi.likers(p.id).catch(() => []);
    setLikers((cur) => (cur?.post.id === p.id ? { post: p, list } : cur));
  }, []);

  const openAuthor = useCallback((p: Post) => openProfile(p.autor.id, p.minha), []);

  const openComments = useCallback(
    (p: Post) => router.push({ pathname: '/comentarios/[id]', params: { id: p.id } }),
    [],
  );

  // F3 · US-20 (RN-019)
  const excluir = async () => {
    if (!deletePost) return;
    setDeleting(true);
    try {
      const r = await feedApi.deletePost(deletePost.id);
      setPosts(
        (cur) =>
          cur
            ?.filter((x) => x.id !== deletePost.id)
            .map((x) => (x.id === r.transferidoPara ? { ...x, checkin: true } : x)) ?? cur,
      );
      toast(
        r.eraCheckin && !r.transferidoPara
          ? 'Publicação excluída. Seus contadores foram atualizados.'
          : r.transferidoPara
            ? 'Publicação excluída. O check-in passou para sua outra foto de hoje.'
            : 'Publicação excluída.',
      );
      setDeletePost(null);
    } catch (e) {
      toast(e instanceof FeedError ? e.message : FEED_MESSAGES.generic, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const data = useMemo(
    () =>
      posts?.map((p) => (commentCounts[p.id] !== undefined ? { ...p, comentarios: commentCounts[p.id] } : p)),
    [posts, commentCounts],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.top}>
        <Text variant="h1">Feed</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notificações"
          hitSlop={10}
          onPress={() => router.push('/notificacoes')}>
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
        </Pressable>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {FEED_TABS.map((t) => (
          <Chip key={t.value} label={t.label} selected={tab === t.value} onPress={() => trocarAba(t.value)} />
        ))}
      </View>

      {data === null || data === undefined ? (
        <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={like}
              onLikers={openLikers}
              onComments={openComments}
              onMenu={setMenuPost}
              onAuthor={openAuthor}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand.red} />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}
          ListHeaderComponent={
            error ? (
              <View style={{ padding: spacing.md }}>
                <Notice tone="error" icon="cloud-offline-outline">
                  Não foi possível atualizar o feed. Puxe para baixo para tentar de novo.
                </Notice>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.brand.red} style={{ margin: spacing.lg }} />
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="barbell-outline" size={36} color={colors.brand.red} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>
                {FEED_MESSAGES.empty}
              </Text>
              <Button title="Publicar meu treino" onPress={() => router.navigate('/publicar')} />
            </View>
          }
        />
      )}

      {/* Menu da publicação */}
      <ActionSheet
        visible={!!menuPost}
        onClose={() => setMenuPost(null)}
        title={menuPost?.minha ? 'Sua publicação' : menuPost?.autor.nome}
        actions={
          menuPost?.minha
            ? [
                {
                  label: 'Excluir publicação',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => setDeletePost(menuPost),
                },
              ]
            : menuPost
              ? [
                  {
                    label: 'Ver perfil',
                    icon: 'person-outline',
                    onPress: () => openProfile(menuPost.autor.id),
                  },
                  {
                    label: 'Denunciar publicação',
                    icon: 'flag-outline',
                    onPress: () => setSafety({ mode: 'report', post: menuPost }),
                  },
                  {
                    label: 'Bloquear',
                    icon: 'ban-outline',
                    destructive: true,
                    onPress: () => setSafety({ mode: 'block', post: menuPost }),
                  },
                ]
              : []
        }
      />

      {/* F3: excluir (com o aviso do DRS quando é o check-in) */}
      <ConfirmSheet
        visible={!!deletePost}
        onClose={() => setDeletePost(null)}
        onConfirm={excluir}
        loading={deleting}
        destructive
        icon={deletePost?.checkin ? 'flame-outline' : 'trash-outline'}
        title={deletePost?.checkin ? 'Excluir o check-in de hoje?' : 'Excluir publicação?'}
        message={
          deletePost?.checkin
            ? FEED_MESSAGES.deleteCheckin
            : 'A foto, as curtidas e os comentários deixam de aparecer no feed.'
        }
        confirmLabel="Excluir"
      />

      {/* US-18, cenário 3: quem curtiu */}
      <Sheet visible={!!likers} onClose={() => setLikers(null)} title="Curtidas">
        {likers?.list === null ? (
          <ActivityIndicator color={colors.brand.red} />
        ) : (
          <View style={{ gap: spacing.sm, maxHeight: 360 }}>
            {(likers?.list ?? []).map((u) => (
              <Pressable
                key={u.id}
                accessibilityRole="button"
                onPress={() => {
                  setLikers(null);
                  openProfile(u.id, u.id === myId);
                }}
                style={({ pressed }) => [styles.liker, pressed && { opacity: 0.6 }]}>
                <PersonAvatar nome={u.nome} foto={u.foto} size={40} />
                <Text variant="labelButton" style={{ flex: 1 }} numberOfLines={1}>
                  {u.nome}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
              </Pressable>
            ))}
            {likers?.list?.length === 0 ? (
              <Text variant="body" color={colors.text.muted} style={{ textAlign: 'center' }}>
                Ninguém para mostrar.
              </Text>
            ) : null}
          </View>
        )}
        <Button title="Fechar" variant="secondary" onPress={() => setLikers(null)} />
      </Sheet>

      {safety ? (
        <SafetySheets
          mode={safety.mode}
          onClose={() => setSafety(null)}
          person={{ id: safety.post.autor.id, nome: safety.post.autor.nome, foto: safety.post.autor.foto }}
          publicacaoId={safety.mode === 'report' ? safety.post.id : undefined}
          onDone={() => {
            setSafety(null);
            bumpFeed();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg - 4,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  separator: { height: spacing.sm, backgroundColor: colors.bg.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2A1716',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.xs,
    borderRadius: radius.md,
  },
});
