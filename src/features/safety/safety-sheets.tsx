import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, ConfirmSheet, Sheet, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import {
  CHAT_MESSAGES,
  ChatError,
  ChatPerson,
  REPORT_DESCRIPTION_MAX,
  REPORT_REASONS,
  ReportReason,
} from '@/domain/chat';
import { connectionsApi } from '@/features/connections/api';
import { colors, radius, spacing, typography } from '@/theme';

export type SafetyMode = 'report' | 'block' | 'undo' | null;

/**
 * D5 Denunciar (US-14), D6 Bloquear (US-13) e D13 Desfazer conexão (US-11).
 * Um único componente para o perfil completo e para o chat.
 *
 * - Denunciar: motivo obrigatório + descrição opcional → "Obrigado..." → oferece "Bloquear também".
 * - Bloquear: confirma → desfaz a conexão (RN-015) → "{nome} foi bloqueado."
 * - Desfazer: confirma → encerra a conversa para os dois (RN-014) → "Conexão desfeita."
 */
export function SafetySheets({
  mode,
  onClose,
  person,
  conexaoId,
  mensagemId,
  onDone,
}: {
  mode: SafetyMode;
  onClose: () => void;
  person: ChatPerson;
  conexaoId?: string;
  mensagemId?: string;
  /** Depois de bloquear ou desfazer: a tela decide para onde voltar */
  onDone: (what: 'blocked' | 'undone') => void;
}) {
  const [motivo, setMotivo] = useState<ReportReason | null>(null);
  const [descricao, setDescricao] = useState('');
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primeiroNome = person.nome.split(' ')[0];

  const close = () => {
    if (busy) return;
    onClose();
    // Limpa o formulário depois que o pop-up some
    setTimeout(() => {
      setMotivo(null);
      setDescricao('');
      setStep('form');
      setError(null);
    }, 300);
  };

  const run = async (fn: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after();
    } catch (e) {
      setError(e instanceof ChatError ? e.message : CHAT_MESSAGES.generic);
    } finally {
      setBusy(false);
    }
  };

  const bloquear = () =>
    run(
      () => connectionsApi.block(person.id),
      () => {
        onClose();
        toast(CHAT_MESSAGES.blocked(primeiroNome));
        onDone('blocked');
      },
    );

  const desfazer = () =>
    run(
      () => connectionsApi.undo(conexaoId!),
      () => {
        onClose();
        toast(CHAT_MESSAGES.undone);
        onDone('undone');
      },
    );

  const denunciar = () =>
    run(
      () => connectionsApi.report({ userId: person.id, motivo: motivo!, descricao, mensagemId }),
      () => setStep('done'),
    );

  if (mode === 'block') {
    return (
      <ConfirmSheet
        visible
        onClose={close}
        onConfirm={bloquear}
        loading={busy}
        destructive
        icon="ban-outline"
        title={`Bloquear ${primeiroNome}?`}
        message={
          error ??
          `Vocês deixam de ver o perfil e as publicações um do outro e não podem mais conversar. ${primeiroNome} não será avisado(a).`
        }
        confirmLabel="Bloquear"
      />
    );
  }

  if (mode === 'undo') {
    return (
      <ConfirmSheet
        visible
        onClose={close}
        onConfirm={desfazer}
        loading={busy}
        destructive
        icon="person-remove-outline"
        title="Desfazer conexão?"
        message={error ?? `A conversa com ${primeiroNome} será encerrada para os dois.`}
        confirmLabel="Desfazer conexão"
      />
    );
  }

  if (mode === 'report' && step === 'done') {
    return (
      <Sheet
        visible
        onClose={close}
        icon="shield-checkmark-outline"
        tone="success"
        title="Denúncia enviada"
        message={error ?? CHAT_MESSAGES.reported}>
        <View style={{ gap: spacing.sm }}>
          <Button title={`Bloquear ${primeiroNome} também`} onPress={bloquear} loading={busy} />
          <Button title="Agora não" variant="ghost" onPress={close} disabled={busy} />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={mode === 'report'}
      onClose={close}
      icon="flag-outline"
      tone="danger"
      title={`Denunciar ${primeiroNome}`}
      message={mensagemId ? 'Você está denunciando uma mensagem.' : 'A denúncia é anônima.'}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="labelSmall" color={colors.text.secondary}>
          Motivo
        </Text>
        <View style={styles.chips}>
          {REPORT_REASONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={motivo === r.value}
              onPress={() => setMotivo(r.value)}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <TextInput
          accessibilityLabel="Descreva o ocorrido (opcional)"
          placeholder="Descreva o ocorrido (opcional)"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.brand.red}
          multiline
          maxLength={REPORT_DESCRIPTION_MAX}
          value={descricao}
          onChangeText={setDescricao}
          style={styles.input}
        />
        <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'right' }}>
          {descricao.length}/{REPORT_DESCRIPTION_MAX}
        </Text>
      </View>
      {error ? (
        <Text variant="caption" color={colors.brand.red}>
          {error}
        </Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <Button title="Enviar denúncia" onPress={denunciar} disabled={!motivo} loading={busy} />
        <Button title="Cancelar" variant="ghost" onPress={close} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    minHeight: 88,
    maxHeight: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    color: colors.text.primary,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...typography.body,
  },
});
