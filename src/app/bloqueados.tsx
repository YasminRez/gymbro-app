import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet, Header, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { BlockedUser, CHAT_MESSAGES } from '@/domain/chat';
import { connectionsApi } from '@/features/connections/api';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { colors, radius, spacing } from '@/theme';

/**
 * C3 · US-13, cenário 2 — Usuários bloqueados
 * Desbloquear remove o bloqueio, mas a conexão anterior não é restaurada.
 */
export default function Bloqueados() {
  const [list, setList] = useState<BlockedUser[] | null>(null);
  const [selected, setSelected] = useState<BlockedUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    connectionsApi
      .blocked()
      .catch(() => [] as BlockedUser[])
      .then(setList);
  }, []);

  const desbloquear = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await connectionsApi.unblock(selected.id);
      setList((cur) => (cur ?? []).filter((u) => u.id !== selected.id));
      toast(CHAT_MESSAGES.unblocked(selected.nome.split(' ')[0]));
      setSelected(null);
    } catch {
      toast(CHAT_MESSAGES.generic, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal: spacing.lg - 4 }}>
        <Header title="Usuários bloqueados" />
      </View>
      {list === null ? (
        <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            list.length > 0 ? (
              <Text variant="body" color={colors.text.secondary} style={{ marginBottom: spacing.sm }}>
                Quem está aqui não vê seu perfil nem suas publicações, e vocês não podem conversar.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Animated.View
              exiting={FadeOutLeft.duration(250)}
              layout={LinearTransition.delay(250)}
              style={styles.row}>
              <PersonAvatar nome={item.nome} foto={item.foto} size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="labelButton" numberOfLines={1}>
                  {item.nome}
                </Text>
                <Text variant="caption" color={colors.text.muted}>
                  Bloqueado em {new Date(item.desde).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Desbloquear ${item.nome}`}
                onPress={() => setSelected(item)}
                style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}>
                <Text variant="labelSmall">Desbloquear</Text>
              </Pressable>
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.brand.green} />
              <Text variant="h3">Ninguém bloqueado</Text>
              <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                Você pode bloquear alguém pelo perfil ou pela conversa, no menu ⋮.
              </Text>
            </View>
          }
        />
      )}

      <ConfirmSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        onConfirm={desbloquear}
        loading={busy}
        icon="lock-open-outline"
        title={selected ? `Desbloquear ${selected.nome.split(' ')[0]}?` : ''}
        message="Vocês voltam a se ver na descoberta. A conexão anterior não é restaurada."
        confirmLabel="Desbloquear"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  content: { padding: spacing.lg - 4, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
