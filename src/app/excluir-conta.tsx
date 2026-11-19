import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ConfirmSheet, Header, Input, Notice, Screen, Text } from '@/components/ui';
import {
  canConfirmDeletion,
  DELETE_CONFIRM_WORD,
  DELETION_GRACE_DAYS,
  deletionDate,
  formatDateBR,
} from '@/domain/engagement';
import { EngagementError, ENGAGEMENT_MESSAGES, engagementApi } from '@/features/engagement/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const PERDAS = [
  'Seu perfil, fotos e preferências',
  'Conexões e conversas',
  'Publicações, curtidas e comentários',
  'Dias ativos, sequência e posição no ranking',
];

/**
 * C4 · US-24 — Excluir conta (RN-022, RNF-002)
 * Pede a senha de novo e a palavra EXCLUIR. A conta é desativada na hora (some da
 * descoberta, do feed e das conexões) e apagada de vez depois de 30 dias. Entrar
 * de novo dentro desse prazo permite reativar.
 */
export default function ExcluirConta() {
  const setDeletion = useSession((s) => s.setDeletion);
  const [palavra, setPalavra] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const excluir = async () => {
    setLoading(true);
    setErro(null);
    try {
      const excluirEm = await engagementApi.requestDeletion(senha);
      setConfirm(false);
      setDeletion(excluirEm); // o layout leva para a tela "Conta em exclusão"
    } catch (e) {
      setConfirm(false);
      setErro(e instanceof EngagementError ? e.message : ENGAGEMENT_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  };

  const data = formatDateBR(deletionDate(new Date()).toISOString());

  return (
    <Screen
      scroll
      footer={
        <Button
          title="Excluir minha conta"
          disabled={!canConfirmDeletion(palavra, senha)}
          onPress={() => setConfirm(true)}
        />
      }>
      <Header title="Excluir conta" />
      <View style={{ alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#2A1716',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="trash-outline" size={30} color={colors.brand.red} />
        </View>
        <Text variant="h2" style={{ textAlign: 'center' }}>
          Tem certeza?
        </Text>
        <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          Sua conta some do GymBrô na hora. Você tem {DELETION_GRACE_DAYS} dias para mudar de ideia: basta
          entrar de novo. Depois de {data}, tudo é apagado de vez:
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {PERDAS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Ionicons name="close-circle" size={18} color={colors.brand.red} />
            <Text variant="body" color={colors.text.secondary}>
              {p}
            </Text>
          </View>
        ))}
      </View>

      {erro ? (
        <Notice tone="error" icon="alert-circle-outline">
          {erro}
        </Notice>
      ) : null}

      <Input
        label={`Digite ${DELETE_CONFIRM_WORD} para confirmar`}
        icon="warning-outline"
        value={palavra}
        onChangeText={setPalavra}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={DELETE_CONFIRM_WORD}
      />
      <Input
        label="Sua senha"
        icon="lock-closed-outline"
        password
        value={senha}
        onChangeText={(t) => {
          setSenha(t);
          setErro(null);
        }}
        autoCapitalize="none"
        placeholder="Digite sua senha atual"
      />

      <ConfirmSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={excluir}
        loading={loading}
        destructive
        icon="trash-outline"
        title="Excluir sua conta?"
        message={`Ela será apagada de vez em ${data}. Até lá, é só entrar de novo para reativar.`}
        confirmLabel="Excluir conta"
      />
    </Screen>
  );
}
