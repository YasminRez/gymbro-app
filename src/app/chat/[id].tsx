import Ionicons from '@expo/vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, Text } from '@/components/ui';
import {
  canSend,
  CHAT_MESSAGES,
  ChatError,
  ChatMessage,
  Conversation,
  formatMessageTime,
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX,
  mergeMessages,
  newClientId,
  withDaySeparators,
} from '@/domain/chat';
import { connectionsApi, NetworkError } from '@/features/connections/api';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { Invite } from '@/domain/invite';
import { invitesApi } from '@/features/invites/api';
import { InviteCard } from '@/features/invites/invite-card';
import { InviteSheet } from '@/features/invites/invite-sheet';
import { SafetyMode, SafetySheets } from '@/features/safety/safety-sheets';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * D12 · US-12 — Chat com uma conexão
 * - Mensagens em tempo real pelo Supabase Realtime (RNF-004) e marcadas como lidas.
 * - Sem internet, a mensagem fica "pendente" e é reenviada sozinha quando a rede volta.
 * - Conexão desfeita ou bloqueio (RN-014/RN-015): o envio é bloqueado com a mensagem do DRS.
 * - Menu: ver perfil, desfazer conexão (D13), denunciar (D5) e bloquear (D6).
 */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversa, setConversa] = useState<Conversation | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState(false);
  const [safety, setSafety] = useState<SafetyMode>(null);
  const [reportMsg, setReportMsg] = useState<string | undefined>();
  const [online, setOnline] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviting, setInviting] = useState(false);
  const loadedIds = useRef(new Set<string>());
  const flushing = useRef(false);
  const msgsRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  const ativa = !!conversa?.ativa;

  /* ---------- carregar ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await connectionsApi.conversation(id).catch(() => null);
      if (!alive) return;
      setConversa(c);
      if (c) {
        const list = await connectionsApi.messages(id).catch(() => []);
        if (!alive) return;
        list.forEach((m) => loadedIds.current.add(m.id));
        setMsgs(list);
        if (c.ativa) connectionsApi.markRead(id).catch(() => undefined);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------- tempo real ---------- */
  useEffect(() => {
    if (!conversa) return;
    return connectionsApi.subscribe(id, (m) => {
      setMsgs((cur) => mergeMessages(cur, [m]));
      // US-12, cenário 2: com a conversa aberta, o que chega já é marcado como lido
      if (!m.minha && !m.lidaEm) connectionsApi.markRead(id).catch(() => undefined);
    });
  }, [id, conversa]);

  /* ---------- convites de treino (US-25) ---------- */
  const loadInvites = useCallback(() => {
    invitesApi
      .list(id)
      // só os que ainda vão acontecer
      .then((l) => setInvites(l.filter((i) => Date.parse(i.inicio) > Date.now())))
      .catch(() => undefined);
  }, [id]);
  useEffect(() => {
    if (!conversa) return;
    const t = setTimeout(loadInvites, 0);
    const unsub = invitesApi.subscribe(id, loadInvites);
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [id, conversa, loadInvites]);
  // No topo da conversa: só os que ainda importam (pendentes e confirmados no futuro)
  const ativos = invites.filter((i) => i.status === 'pendente' || i.status === 'aceito');

  /* ---------- envio ---------- */
  const deliver = useCallback(
    async (m: ChatMessage) => {
      try {
        const saved = await connectionsApi.send(id, m.conteudo, m.clientId!);
        setMsgs((cur) => mergeMessages(cur, [{ ...saved, status: undefined }]));
      } catch (e) {
        if (e instanceof NetworkError) return; // continua pendente
        setMsgs((cur) => mergeMessages(cur, [{ ...m, status: 'erro' }]));
        if (e instanceof ChatError && e.message === CHAT_MESSAGES.cannotSend) {
          setConversa((c) => (c ? { ...c, ativa: false } : c));
        }
      }
    },
    [id],
  );

  // US-12, cenário 4: reenvia as pendentes quando a internet volta
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    const pendentes = msgsRef.current.filter((m) => m.status === 'pendente').reverse();
    for (const m of pendentes) await deliver(m);
    flushing.current = false;
  }, [deliver]);

  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        const ok = !!s.isConnected && s.isInternetReachable !== false;
        setOnline(ok);
        if (ok) flush();
      }),
    [flush],
  );

  const enviar = async () => {
    if (!canSend(texto) || !ativa) return;
    const m: ChatMessage = {
      id: `local-${Date.now()}`,
      clientId: newClientId(),
      conexaoId: id,
      minha: true,
      conteudo: texto.trim(),
      enviadaEm: new Date().toISOString(),
      lidaEm: null,
      status: 'pendente',
    };
    setTexto('');
    setMsgs((cur) => mergeMessages(cur, [m]));
    const net = await NetInfo.fetch();
    if (net.isConnected && net.isInternetReachable !== false) deliver(m);
  };

  const rows = useMemo(() => withDaySeparators(msgs), [msgs]);

  /* ---------- telas de estado ---------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.brand.red} />
      </SafeAreaView>
    );
  }
  if (!conversa) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="chatbubbles-outline" size={36} color={colors.text.muted} />
        <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          Esta conversa não está disponível.
        </Text>
        <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
          <Text variant="labelSmall" color={colors.brand.red}>
            Voltar
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { pessoa } = conversa;
  const primeiroNome = pessoa.nome.split(' ')[0];
  const sair = () => (router.canGoBack() ? router.back() : router.replace('/conexoes'));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12} onPress={sair}>
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver perfil de ${pessoa.nome}`}
          disabled={!ativa}
          onPress={() => router.push({ pathname: '/perfil/[id]', params: { id: pessoa.id, conexao: id } })}
          style={styles.headerPerson}>
          <PersonAvatar nome={pessoa.nome} foto={pessoa.foto} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="labelButton" numberOfLines={1}>
              {pessoa.nome}
            </Text>
            <Text variant="caption" color={ativa ? colors.brand.green : colors.text.muted}>
              {ativa
                ? online
                  ? 'Parceiro de treino'
                  : 'Sem internet · mensagens ficam pendentes'
                : 'Conversa encerrada'}
            </Text>
          </View>
        </Pressable>
        {ativa ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Convidar para treinar"
            hitSlop={8}
            onPress={() => setInviting(true)}
            style={styles.iconBtn}>
            <Ionicons name="calendar-outline" size={21} color={colors.brand.green} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
          hitSlop={12}
          onPress={() => setMenu(true)}
          style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text.primary} />
        </Pressable>
      </View>

      {ativa && ativos.length > 0 ? (
        <View style={styles.invites}>
          {ativos.slice(0, 2).map((i) => (
            <InviteCard
              key={i.id}
              invite={i}
              onChanged={(n) => setInvites((cur) => cur.map((x) => (x.id === n.id ? n : x)))}
            />
          ))}
          {ativos.length > 2 ? (
            <Pressable onPress={() => router.push('/treinos')} style={{ alignSelf: 'center' }}>
              <Text variant="labelSmall" color={colors.brand.green}>
                Ver os {ativos.length} treinos combinados
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            item.type === 'day' ? (
              <View style={styles.dayWrap}>
                <Text variant="overline" color={colors.text.muted} style={styles.day}>
                  {item.label}
                </Text>
              </View>
            ) : (
              <Bubble
                msg={item.msg}
                animate={!loadedIds.current.has(item.msg.id)}
                onLongPress={
                  !item.msg.minha
                    ? () => {
                        setReportMsg(item.msg.id);
                        setSafety('report');
                      }
                    : undefined
                }
                onRetry={
                  item.msg.status === 'erro' && ativa
                    ? () => deliver({ ...item.msg, status: 'pendente' })
                    : undefined
                }
              />
            )
          }
          ListFooterComponent={
            msgs.length === 0 ? (
              <View style={styles.intro}>
                <PersonAvatar nome={pessoa.nome} foto={pessoa.foto} size={88} ring />
                <Text variant="h3" style={{ textAlign: 'center' }}>
                  Você e {primeiroNome} são parceiros de treino
                </Text>
                <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                  Mande um oi e combinem o dia, o horário e o treino.
                </Text>
              </View>
            ) : undefined
          }
        />

        {/* Barra de digitação */}
        {ativa ? (
          <View style={styles.composer}>
            <View style={styles.inputBox}>
              <TextInput
                accessibilityLabel="Mensagem"
                placeholder="Mensagem"
                placeholderTextColor={colors.text.muted}
                selectionColor={colors.brand.red}
                multiline
                maxLength={MESSAGE_MAX}
                value={texto}
                onChangeText={setTexto}
                style={styles.input}
              />
              {texto.length >= MESSAGE_COUNTER_FROM ? (
                <Text
                  variant="caption"
                  color={texto.length >= MESSAGE_MAX ? colors.brand.red : colors.text.muted}>
                  {texto.length}/{MESSAGE_MAX}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              accessibilityState={{ disabled: !canSend(texto) }}
              disabled={!canSend(texto)}
              onPress={enviar}
              style={({ pressed }) => [
                styles.send,
                !canSend(texto) && { backgroundColor: colors.bg.elevated },
                pressed && { opacity: 0.8 },
              ]}>
              <Ionicons name="send" size={18} color={canSend(texto) ? colors.white : colors.text.muted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.closed}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.text.muted} />
            <Text variant="body" color={colors.text.secondary} style={{ flex: 1 }}>
              {CHAT_MESSAGES.cannotSend}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={pessoa.nome}
        actions={[
          ...(ativa
            ? [
                {
                  label: 'Ver perfil',
                  icon: 'person-outline' as const,
                  onPress: () =>
                    router.push({ pathname: '/perfil/[id]', params: { id: pessoa.id, conexao: id } }),
                },
                {
                  label: 'Convidar para treinar',
                  icon: 'calendar-outline' as const,
                  onPress: () => setInviting(true),
                },
                {
                  label: 'Desfazer conexão',
                  icon: 'person-remove-outline' as const,
                  onPress: () => setSafety('undo'),
                },
              ]
            : []),
          {
            label: 'Denunciar',
            icon: 'flag-outline',
            onPress: () => {
              setReportMsg(undefined);
              setSafety('report');
            },
          },
          { label: 'Bloquear', icon: 'ban-outline', destructive: true, onPress: () => setSafety('block') },
        ]}
      />

      <InviteSheet
        visible={inviting}
        onClose={() => setInviting(false)}
        conexaoId={id}
        pessoa={pessoa}
        onSent={(i) => setInvites((cur) => [...cur, i])}
      />

      <SafetySheets
        mode={safety}
        onClose={() => setSafety(null)}
        person={pessoa}
        conexaoId={id}
        mensagemId={reportMsg}
        onDone={sair}
      />
    </SafeAreaView>
  );
}

function Bubble({
  msg,
  animate,
  onLongPress,
  onRetry,
}: {
  msg: ChatMessage;
  animate: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}) {
  const mine = msg.minha;
  const status = msg.status;
  const icon =
    status === 'pendente'
      ? 'time-outline'
      : status === 'erro'
        ? 'alert-circle'
        : msg.lidaEm
          ? 'checkmark-done'
          : 'checkmark';
  const iconColor =
    status === 'erro' ? colors.white : msg.lidaEm && !status ? '#BFF5D6' : 'rgba(255,255,255,0.75)';
  const a11yStatus =
    status === 'pendente'
      ? ', pendente'
      : status === 'erro'
        ? ', não enviada'
        : msg.lidaEm
          ? ', lida'
          : ', enviada';

  return (
    <Animated.View
      entering={animate ? FadeInDown.duration(200) : undefined}
      style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <Pressable
        onLongPress={onLongPress}
        onPress={onRetry}
        delayLongPress={350}
        accessibilityLabel={`${mine ? 'Você' : 'Mensagem'}: ${msg.conteudo}, ${formatMessageTime(msg.enviadaEm)}${mine ? a11yStatus : ''}`}
        accessibilityHint={
          onLongPress ? 'Toque e segure para denunciar' : onRetry ? 'Toque para reenviar' : undefined
        }
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          status === 'pendente' && { opacity: 0.7 },
          status === 'erro' && { backgroundColor: colors.brand.redDark },
        ]}>
        <Text variant="bodyLarge" color={mine ? colors.white : colors.text.primary}>
          {msg.conteudo}
        </Text>
        <View style={styles.meta}>
          {status === 'erro' ? (
            <Text variant="caption" color={colors.white}>
              Não enviada · toque para tentar de novo
            </Text>
          ) : (
            <Text variant="caption" color={mine ? 'rgba(255,255,255,0.75)' : colors.text.muted}>
              {status === 'pendente' ? 'Pendente' : formatMessageTime(msg.enviadaEm)}
            </Text>
          )}
          {mine ? <Ionicons name={icon} size={14} color={iconColor} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  center: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  headerPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  invites: {
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.xs + 2, flexGrow: 1 },
  dayWrap: { alignItems: 'center', marginVertical: spacing.sm },
  day: {
    backgroundColor: colors.bg.elevated,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  intro: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    gap: 2,
  },
  mine: { backgroundColor: colors.brand.red, borderBottomRightRadius: 6 },
  theirs: {
    backgroundColor: colors.bg.elevated,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    backgroundColor: colors.bg.base,
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    justifyContent: 'center',
  },
  input: { color: colors.text.primary, maxHeight: 120, ...typography.bodyLarge },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
});
