import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ConfirmSheet, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import {
  formatInviteDate,
  Invite,
  inviteActions,
  INVITE_MESSAGES,
  InviteError,
  STATUS_LABEL,
} from '@/domain/invite';
import { PersonAvatar } from '@/features/connections/person-avatar';
import { colors, radius, spacing } from '@/theme';

import { invitesApi } from './api';

const TONE: Record<
  Invite['status'],
  { color: string; bg: string; icon: 'time' | 'checkmark-circle' | 'close-circle' | 'ban' | 'hourglass' }
> = {
  pendente: { color: colors.text.secondary, bg: colors.bg.input, icon: 'time' },
  aceito: { color: colors.brand.green, bg: '#16241C', icon: 'checkmark-circle' },
  recusado: { color: colors.text.muted, bg: colors.bg.input, icon: 'close-circle' },
  cancelado: { color: colors.text.muted, bg: colors.bg.input, icon: 'ban' },
  expirado: { color: colors.text.muted, bg: colors.bg.input, icon: 'hourglass' },
};

/** Cartão do convite (chat, Treinos combinados): data, academia, status e ações */
export function InviteCard({
  invite,
  onChanged,
  showPerson = false,
}: {
  invite: Invite;
  onChanged: (i: Invite) => void;
  showPerson?: boolean;
}) {
  const [busy, setBusy] = useState<'aceitar' | 'recusar' | 'cancelar' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const acts = inviteActions(invite);
  const tone = TONE[invite.status];
  const nome = invite.pessoa.nome.split(' ')[0];
  const titulo = invite.enviado ? `Você convidou ${nome}` : `${nome} te convidou para treinar`;

  const run = async (kind: 'aceitar' | 'recusar' | 'cancelar') => {
    setBusy(kind);
    try {
      const r =
        kind === 'cancelar'
          ? await invitesApi.cancel(invite.id)
          : await invitesApi.respond(invite.id, kind === 'aceitar');
      onChanged(r);
      toast(
        kind === 'aceitar'
          ? INVITE_MESSAGES.accepted
          : kind === 'recusar'
            ? INVITE_MESSAGES.declined
            : INVITE_MESSAGES.canceled,
      );
    } catch (e) {
      toast(e instanceof InviteError ? e.message : INVITE_MESSAGES.generic, 'error');
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const ativo = invite.status === 'pendente' || invite.status === 'aceito';

  return (
    <View
      style={[
        styles.card,
        invite.status === 'aceito' && { borderColor: colors.brand.green + '66' },
        !ativo && { opacity: 0.7 },
      ]}>
      <View style={styles.top}>
        {showPerson ? (
          <PersonAvatar nome={invite.pessoa.nome} foto={invite.pessoa.foto} size={40} />
        ) : (
          <View style={styles.icon}>
            <Ionicons name="barbell" size={20} color={colors.brand.red} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={12} color={tone.color} />
            <Text variant="caption" color={tone.color}>
              {STATUS_LABEL[invite.status]}
            </Text>
          </View>
          <Text variant="labelButton" numberOfLines={1}>
            {titulo}
          </Text>
          <Text variant="body" color={colors.text.primary}>
            {formatInviteDate(invite.inicio)}
          </Text>
          <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
            {invite.academia.nome}
            {invite.modalidade ? ` · ${invite.modalidade}` : ''}
          </Text>
        </View>
      </View>

      {invite.mensagem ? (
        <Text variant="body" color={colors.text.secondary} style={styles.quote}>
          “{invite.mensagem}”
        </Text>
      ) : null}

      {acts.accept || acts.cancel ? (
        <View style={styles.actions}>
          {acts.accept ? (
            <>
              <View style={{ flex: 1 }}>
                <Button
                  title="Recusar"
                  variant="secondary"
                  onPress={() => run('recusar')}
                  loading={busy === 'recusar'}
                  disabled={!!busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Aceitar"
                  variant="success"
                  onPress={() => run('aceitar')}
                  loading={busy === 'aceitar'}
                  disabled={!!busy}
                />
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Button
                title={invite.status === 'aceito' ? 'Cancelar treino' : 'Cancelar convite'}
                variant="ghost"
                onPress={() => setConfirmCancel(true)}
                disabled={!!busy}
              />
            </View>
          )}
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => run('cancelar')}
        loading={busy === 'cancelar'}
        destructive
        icon="calendar-outline"
        title={invite.status === 'aceito' ? 'Cancelar o treino?' : 'Cancelar o convite?'}
        message={`${formatInviteDate(invite.inicio)} na ${invite.academia.nome}.${invite.status === 'aceito' ? ` ${nome} será avisado(a).` : ''}`}
        confirmLabel="Cancelar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 4 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#2A1716',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  quote: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
