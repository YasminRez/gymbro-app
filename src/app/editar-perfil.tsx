import { router, usePreventRemove } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Header, Notice, Screen, Text } from '@/components/ui';
import {
  emptyProfile,
  isProfileValid,
  missingStep1,
  missingStep2,
  missingStep3,
  profileChanged,
} from '@/domain/profile';
import { Interests, PhotosBioGender, Training } from '@/features/profile/forms';
import { PROFILE_MESSAGES, ProfileError, profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** P10 · US-05 — Editar perfil, com aviso ao sair sem salvar (cenário 4) */
export default function EditarPerfil() {
  const { user, profile, setProfile } = useSession();
  const original = profile ?? emptyProfile;
  const [draft, setDraft] = useState(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const dirty = profileChanged(draft, original);
  const missing = [...missingStep1(draft), ...missingStep2(draft), ...missingStep3(draft)];

  // "Deseja descartar as alterações?" ao voltar com mudanças não salvas
  usePreventRemove(dirty && !leaving, ({ repeat }) => {
    Alert.alert('Descartar alterações', 'Deseja descartar as alterações?', [
      { text: 'Continuar editando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });

  // Depois de salvar, volta para o perfil
  useEffect(() => {
    if (leaving && !dirty) router.back();
  }, [leaving, dirty]);

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await profileApi.save(user.id, draft);
      setProfile(saved);
      setDraft(saved);
      setLeaving(true);
      Alert.alert(PROFILE_MESSAGES.updated);
    } catch (e) {
      setError(e instanceof ProfileError ? e.message : PROFILE_MESSAGES.generic);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Screen
      scroll
      footer={
        <>
          {missing.length > 0 ? (
            <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
              Falta: {missing.join(', ')}
            </Text>
          ) : null}
          <Button
            title="Salvar"
            onPress={salvar}
            disabled={!dirty || !isProfileValid(draft)}
            loading={saving}
          />
        </>
      }>
      <Header title="Editar perfil" />
      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}
      <View style={{ gap: spacing.xl }}>
        <PhotosBioGender value={draft} onChange={update} />
        <Training value={draft} onChange={update} />
        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">Interesses</Text>
          <Interests value={draft} onChange={update} />
        </View>
      </View>
    </Screen>
  );
}
