import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputInstance,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, ConfirmSheet, Header, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { canComment, Comment, COMMENT_MAX, FEED_MESSAGES, FeedError, timeAgo } from '@/domain/feed';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { feedApi } from '@/features/feed/api';
import { openProfile } from '@/features/profile/open-profile';
import { SafetyMode, SafetySheets } from '@/features/safety/safety-sheets';
import { usePublish } from '@/store/publish';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * F2 · US-19 — Comentários
 * 1 a 300 caracteres, sem termos bloqueados (RN-020, conferido no banco).
 * Segurar o próprio comentário: Editar ou Excluir. O autor da publicação pode
 * remover comentários de outras pessoas.
 */
export default function Comentarios() {
  // podeRemover vem do banco: quem escreveu ou o autor da publicação
  const { id } = useLocalSearchParams<{ id: string }>();
  const [list, setList] = useState<Comment[] | null>(null);
  const [texto, setTexto] = useState('');
  const [editing, setEditing] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Comment | null>(null);
  const [remove, setRemove] = useState<Comment | null>(null);
  const [safety, setSafety] = useState<{ mode: SafetyMode; comment: Comment } | null>(null);
  const setCommentCount = usePublish((s) => s.setCommentCount);
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    feedApi
      .comments(id)
      .catch(() => [] as Comment[])
      .then(setList);
  }, [id]);

  // Mantém o contador do feed em dia
  useEffect(() => {
    if (list) setCommentCount(id, list.length);
  }, [list, id, setCommentCount]);

  const enviar = async () => {
    if (!canComment(texto) || sending) return;
    setSending(true);
    setError(null);
    try {
      if (editing) {
        await feedApi.editComment(editing.id, texto);
        setList(
          (cur) =>
            cur?.map((c) => (c.id === editing.id ? { ...c, texto: texto.trim(), editado: true } : c)) ?? cur,
        );
        setEditing(null);
      } else {
        const c = await feedApi.comment(id, texto);
        setList((cur) => [...(cur ?? []), c]);
      }
      setTexto('');
    } catch (e) {
      // US-19, cenário 4: "Seu comentário contém termos não permitidos."
      setError(e instanceof FeedError ? e.message : FEED_MESSAGES.generic);
    } finally {
      setSending(false);
    }
  };

  const excluir = async () => {
    if (!remove) return;
    try {
      await feedApi.deleteComment(remove.id);
      setList((cur) => cur?.filter((c) => c.id !== remove.id) ?? cur);
      toast(remove.meu ? 'Comentário excluído.' : 'Comentário removido.');
    } catch {
      toast(FEED_MESSAGES.generic, 'error');
    } finally {
      setRemove(null);
    }
  };

  const startEdit = (c: Comment) => {
    setEditing(c);
    setTexto(c.texto);
    setError(null);
    setTimeout(() => input.current?.focus(), 300);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: spacing.lg - 4 }}>
        <Header title="Comentários" />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {list === null ? (
          <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOutLeft.duration(200)}
                layout={LinearTransition}>
                <Pressable
                  onLongPress={() => setMenu(item)}
                  delayLongPress={300}
                  accessibilityHint="Toque e segure para mais opções"
                  style={({ pressed }) => [
                    styles.comment,
                    pressed && { backgroundColor: colors.bg.elevated },
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.meu ? 'Ver meu perfil' : `Ver perfil de ${item.autor.nome}`}
                    hitSlop={6}
                    onPress={() => openProfile(item.autor.id, item.meu)}>
                    <PersonAvatar nome={item.autor.nome} foto={item.autor.foto} size={36} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="labelSmall">
                      {item.meu ? 'Você' : item.autor.nome}
                      <Text variant="caption" color={colors.text.muted}>
                        {'  '}
                        {timeAgo(item.criadoEm)}
                        {item.editado ? ' · editado' : ''}
                      </Text>
                    </Text>
                    <Text variant="body" color={colors.text.secondary}>
                      {item.texto}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.text.muted} />
                <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                  Nenhum comentário ainda. Mande um incentivo!
                </Text>
              </View>
            }
          />
        )}

        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={16} color={colors.brand.red} />
            <Text variant="caption" color={colors.brand.red} style={{ flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}
        {editing ? (
          <View style={styles.editing}>
            <Ionicons name="pencil" size={14} color={colors.text.secondary} />
            <Text variant="caption" color={colors.text.secondary} style={{ flex: 1 }}>
              Editando comentário
            </Text>
            <Pressable
              hitSlop={10}
              onPress={() => {
                setEditing(null);
                setTexto('');
              }}>
              <Text variant="labelSmall" color={colors.brand.red}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <View style={styles.inputBox}>
            <TextInput
              ref={input}
              accessibilityLabel="Comentário"
              placeholder="Escreva um comentário"
              placeholderTextColor={colors.text.muted}
              selectionColor={colors.brand.red}
              multiline
              maxLength={COMMENT_MAX}
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                if (error) setError(null);
              }}
              style={styles.input}
            />
            {texto.length > COMMENT_MAX - 50 ? (
              <Text
                variant="caption"
                color={texto.length >= COMMENT_MAX ? colors.brand.red : colors.text.muted}>
                {texto.length}/{COMMENT_MAX}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Salvar comentário' : 'Enviar comentário'}
            disabled={!canComment(texto) || sending}
            onPress={enviar}
            style={[styles.send, (!canComment(texto) || sending) && { backgroundColor: colors.bg.elevated }]}>
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons
                name={editing ? 'checkmark' : 'send'}
                size={18}
                color={canComment(texto) ? colors.white : colors.text.muted}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.meu ? 'Seu comentário' : `Comentário de ${menu?.autor.nome.split(' ')[0] ?? ''}`}
        actions={
          menu?.meu
            ? [
                { label: 'Editar', icon: 'pencil-outline', onPress: () => startEdit(menu) },
                {
                  label: 'Excluir',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => setRemove(menu),
                },
              ]
            : menu
              ? [
                  {
                    label: 'Ver perfil',
                    icon: 'person-outline' as const,
                    onPress: () => openProfile(menu.autor.id),
                  },
                  {
                    label: 'Denunciar comentário',
                    icon: 'flag-outline' as const,
                    onPress: () => setSafety({ mode: 'report', comment: menu }),
                  },
                  ...(menu.podeRemover
                    ? [
                        {
                          label: 'Remover',
                          icon: 'trash-outline' as const,
                          destructive: true,
                          onPress: () => setRemove(menu),
                        },
                      ]
                    : []),
                ]
              : []
        }
      />
      <ConfirmSheet
        visible={!!remove}
        onClose={() => setRemove(null)}
        onConfirm={excluir}
        destructive
        icon="trash-outline"
        title={remove?.meu ? 'Excluir comentário?' : 'Remover comentário?'}
        message={remove ? `"${remove.texto.slice(0, 80)}${remove.texto.length > 80 ? '…' : ''}"` : undefined}
        confirmLabel={remove?.meu ? 'Excluir' : 'Remover'}
      />
      {safety ? (
        <SafetySheets
          mode={safety.mode}
          onClose={() => setSafety(null)}
          person={{
            id: safety.comment.autor.id,
            nome: safety.comment.autor.nome,
            foto: safety.comment.autor.foto,
          }}
          comentarioId={safety.mode === 'report' ? safety.comment.id : undefined}
          onDone={() => {
            // Bloqueou: os comentários dessa pessoa somem da lista
            const autor = safety.comment.autor.id;
            setSafety(null);
            setList((cur) => cur?.filter((c) => c.autor.id !== autor) ?? cur);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  list: { padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  comment: { flexDirection: 'row', gap: spacing.sm + 2, padding: spacing.sm, borderRadius: radius.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  editing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    justifyContent: 'center',
  },
  input: { color: colors.text.primary, maxHeight: 100, ...typography.bodyLarge },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
