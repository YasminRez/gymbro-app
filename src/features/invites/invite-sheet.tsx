import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, Sheet, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import {
  availableHours,
  formatInviteDate,
  Invite,
  inviteDate,
  INVITE_MESSAGE_MAX,
  INVITE_MESSAGES,
  InviteError,
  nextDays,
} from '@/domain/invite';
import { useSession } from '@/store/session';
import { colors, radius, spacing, typography } from '@/theme';

import { invitesApi } from './api';

/**
 * US-25 — Pop-up "Convidar para treinar": academia (uma das minhas), dia,
 * horário, modalidade e recado opcional.
 */
export function InviteSheet({
  visible,
  onClose,
  conexaoId,
  pessoa,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  conexaoId: string;
  pessoa: { id: string; nome: string };
  onSent?: (i: Invite) => void;
}) {
  const { gyms, profile } = useSession();
  const principal = gyms.find((g) => g.tipo === 'principal') ?? gyms[0];
  const [placeId, setPlaceId] = useState<string | null>(principal?.gym.placeId ?? null);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState<number | null>(null);
  const [modalidade, setModalidade] = useState<string | null>(profile?.modalidades[0] ?? null);
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primeiroNome = pessoa.nome.split(' ')[0];

  const days = useMemo(() => nextDays(14), []);
  const hours = availableHours(day);
  const hourOk = hour !== null && hours.includes(hour);
  const academia = gyms.find((g) => g.gym.placeId === placeId)?.gym;
  const quando = hourOk ? formatInviteDate(inviteDate(day, hour!).toISOString()) : null;

  const fechar = () => {
    if (sending) return;
    setError(null);
    onClose();
  };

  const enviar = async () => {
    if (!placeId || !hourOk) return;
    setSending(true);
    setError(null);
    try {
      const inv = await invitesApi.send({
        conexaoId,
        placeId,
        inicio: inviteDate(day, hour!),
        modalidade,
        mensagem,
        academiaNome: academia?.nome,
      });
      toast(INVITE_MESSAGES.sent(primeiroNome));
      setMensagem('');
      setHour(null);
      onSent?.(inv);
      onClose();
    } catch (e) {
      setError(e instanceof InviteError ? e.message : INVITE_MESSAGES.generic);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={fechar} title={`Treinar com ${primeiroNome}`}>
      <ScrollView
        style={{ maxHeight: 460 }}
        contentContainerStyle={{ gap: spacing.md }}
        keyboardShouldPersistTaps="handled">
        {/* Academia */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" color={colors.text.secondary}>
            Onde
          </Text>
          {gyms.length === 0 ? (
            <Text variant="body" color={colors.text.muted}>
              Defina sua academia em Perfil › Minha academia para convidar.
            </Text>
          ) : (
            gyms.map((g) => {
              const on = g.gym.placeId === placeId;
              return (
                <Pressable
                  key={g.gym.placeId}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setPlaceId(g.gym.placeId)}
                  style={[styles.gym, on && { borderColor: colors.brand.red, backgroundColor: '#1E1312' }]}>
                  <Ionicons name="barbell" size={18} color={on ? colors.brand.red : colors.text.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="labelButton" numberOfLines={1}>
                      {g.gym.nome}
                    </Text>
                    <Text variant="caption" color={colors.text.muted}>
                      {g.tipo === 'principal' ? 'Academia principal' : 'Academia secundária'}
                    </Text>
                  </View>
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={on ? colors.brand.red : colors.border.strong}
                  />
                </Pressable>
              );
            })
          )}
        </View>

        {/* Dia */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" color={colors.text.secondary}>
            Dia
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}>
            {days.map((d) => {
              const on = d.offset === day;
              return (
                <Pressable
                  key={d.offset}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${d.label} ${d.sub}`}
                  onPress={() => setDay(d.offset)}
                  style={[
                    styles.day,
                    on && { backgroundColor: colors.brand.red, borderColor: colors.brand.red },
                  ]}>
                  <Text variant="labelSmall" color={on ? colors.white : colors.text.primary}>
                    {d.label}
                  </Text>
                  <Text variant="caption" color={on ? colors.white : colors.text.muted}>
                    {d.sub}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Horário */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" color={colors.text.secondary}>
            Horário
          </Text>
          {hours.length === 0 ? (
            <Text variant="body" color={colors.text.muted}>
              Não há mais horários hoje. Escolha outro dia.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}>
              {hours.map((h) => (
                <Chip
                  key={h}
                  label={`${String(h).padStart(2, '0')}:00`}
                  selected={hourOk && hour === h}
                  onPress={() => setHour(h)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Modalidade */}
        {profile && profile.modalidades.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="labelSmall" color={colors.text.secondary}>
              Treino
            </Text>
            <View style={styles.chips}>
              {profile.modalidades.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  selected={modalidade === m}
                  onPress={() => setModalidade(modalidade === m ? null : m)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Recado */}
        <TextInput
          accessibilityLabel="Recado (opcional)"
          placeholder="Recado (opcional): ex. Bora pegar pesado na perna?"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.brand.red}
          maxLength={INVITE_MESSAGE_MAX}
          value={mensagem}
          onChangeText={setMensagem}
          style={styles.input}
        />
      </ScrollView>

      {quando && academia ? (
        <View style={styles.summary}>
          <Ionicons name="calendar" size={16} color={colors.brand.green} />
          <Text variant="labelSmall" style={{ flex: 1 }} numberOfLines={2}>
            {quando} · {academia.nome}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text variant="caption" color={colors.brand.red}>
          {error}
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <Button title="Enviar convite" onPress={enviar} disabled={!placeId || !hourOk} loading={sending} />
        <Button title="Cancelar" variant="ghost" onPress={fechar} disabled={sending} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gym: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  day: {
    width: 64,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.elevated,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: '#16241C',
  },
});
