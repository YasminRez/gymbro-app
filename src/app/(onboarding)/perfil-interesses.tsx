import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Notice } from '@/components/ui';
import { missingStep3 } from '@/domain/profile';
import { Interests } from '@/features/profile/forms';
import { PROFILE_MESSAGES, ProfileError, profileApi } from '@/features/profile/api';
import { StepScreen } from '@/features/profile/step-screen';
import { useProfileDraft } from '@/store/profile-draft';
import { useSession } from '@/store/session';

/** P3 · US-04, etapa 3 — Interesses e "Salvar perfil" */
export default function PerfilInteresses() {
  const { draft, update, reset } = useProfileDraft();
  const { user, setProfile } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salvar = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const saved = await profileApi.save(user.id, draft);
      setProfile(saved);
      reset(saved);
      Alert.alert('Perfil criado!', 'Agora escolha a sua academia.');
      router.push('/localizacao');
    } catch (e) {
      setError(e instanceof ProfileError ? e.message : PROFILE_MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StepScreen
      step={3}
      title="Seus interesses"
      subtitle="Escolha de 3 a 10. Eles aparecem no seu perfil e ajudam no cálculo de compatibilidade."
      missing={missingStep3(draft)}
      cta="Salvar perfil"
      loading={loading}
      onNext={salvar}>
      {error ? (
        <Notice tone="error" icon="alert-circle-outline">
          {error}
        </Notice>
      ) : null}
      <Interests value={draft} onChange={update} />
    </StepScreen>
  );
}
