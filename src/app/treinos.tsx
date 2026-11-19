import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header, Sheet, Text } from '@/components/ui';
import { ConnectionItem } from '@/domain/chat';
import { Invite, pendingReceived, sortUpcoming } from '@/domain/invite';
import { connectionsApi } from '@/features/connections/api';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { invitesApi } from '@/features/invites/api';
import { InviteCard } from '@/features/invites/invite-card';
import { InviteSheet } from '@/features/invites/invite-sheet';
import { colors, radius, spacing } from '@/theme';

/**
 * US-25 — Treinos combinados
 * Convites recebidos esperando resposta, treinos confirmados e convites enviados.
 * "Convidar uma conexão" escolhe a pessoa e abre o pop-up do convite.
 */
export default function Treinos() {
  const [list, setList] = useState<Invite[] | null>(null);
  const [picker, setPicker] = useState<ConnectionItem[] | null | 'closed'>('closed');
  const [inviteTo, setInviteTo] = useState<ConnectionItem | null>(null);

  const load = useCallback(() => {
    invitesApi
      .list()
      .then((l) => setList(sortUpcoming(l)))
      .catch(() => setList((cur) => cur ?? []));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => invitesApi.subscribe(null, load), [load]);

  const abrirPicker = async () => {
    setPicker(null);
    const conns = await connectionsApi.list().catch(() => []);
    setPicker(conns);
  };

  const pendentes = list ? pendingReceived(list) : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ paddingHorizontal: spacing.lg - 4 }}>
        <Header title="Treinos combinados" />
      </View>
      {list === null ? (
        <ActivityIndicator color={colors.brand.red} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
              <Text variant="body" color={colors.text.secondary}>
                Chame uma conexão para treinar com você na sua academia. Quando a pessoa aceitar, o treino
                aparece aqui para os dois.
              </Text>
              <Button title="Convidar uma conexão" onPress={abrirPicker} />
              {pendentes > 0 ? (
                <Text variant="overline" color={colors.brand.red}>
                  {pendentes}{' '}
                  {pendentes === 1 ? 'convite esperando sua resposta' : 'convites esperando sua resposta'}
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Animated.View entering={FadeInDown.duration(200)} layout={LinearTransition}>
              <InviteCard
                invite={item}
                showPerson
                onChanged={(i) =>
                  setList((cur) => sortUpcoming((cur ?? []).map((x) => (x.id === i.id ? i : x))))
                }
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={34} color={colors.brand.green} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>
                Nenhum treino combinado
              </Text>
              <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
                Convide alguém que você conheceu no GymBrô para treinar junto.
              </Text>
            </View>
          }
        />
      )}

      {/* Escolher a conexão */}
      <Sheet visible={picker !== 'closed'} onClose={() => setPicker('closed')} title="Convidar quem?">
        {picker === null ? (
          <ActivityIndicator color={colors.brand.red} />
        ) : picker !== 'closed' && picker.length === 0 ? (
          <View style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
              Você ainda não tem conexões. Curta perfis na aba Descobrir!
            </Text>
            <Button
              title="Ir para Descobrir"
              onPress={() => {
                setPicker('closed');
                router.navigate('/descobrir');
              }}
            />
          </View>
        ) : (
          <FlatList
            style={{ maxHeight: 360 }}
            data={picker === 'closed' ? [] : picker}
            keyExtractor={(c) => c.id}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Convidar ${item.pessoa.nome}`}
                onPress={() => {
                  setPicker('closed');
                  setTimeout(() => setInviteTo(item), 300);
                }}
                style={({ pressed }) => [styles.person, pressed && { backgroundColor: colors.bg.input }]}>
                <PersonAvatar nome={item.pessoa.nome} foto={item.pessoa.foto} size={44} />
                <Text variant="labelButton" style={{ flex: 1 }} numberOfLines={1}>
                  {item.pessoa.nome}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
              </Pressable>
            )}
          />
        )}
        <Button title="Fechar" variant="ghost" onPress={() => setPicker('closed')} />
      </Sheet>

      {inviteTo ? (
        <InviteSheet
          visible
          onClose={() => setInviteTo(null)}
          conexaoId={inviteTo.id}
          pessoa={inviteTo.pessoa}
          onSent={(i) => setList((cur) => sortUpcoming([...(cur ?? []), i]))}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.base },
  content: { padding: spacing.lg - 4, gap: spacing.sm + 4, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#16241C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
});
