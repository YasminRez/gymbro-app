import { router } from 'expo-router';
import { useEffect } from 'react';

import { missingStep1 } from '@/domain/profile';
import { PhotosBioGender } from '@/features/profile/forms';
import { StepScreen } from '@/features/profile/step-screen';
import { useProfileDraft } from '@/store/profile-draft';
import { useSession } from '@/store/session';

/** P1 · US-04, etapa 1 — Fotos, bio e gênero */
export default function PerfilFotos() {
  const { draft, update, reset } = useProfileDraft();
  const saved = useSession((s) => s.profile);

  // Se a pessoa já tinha começado o perfil antes, continua de onde parou
  useEffect(() => {
    if (saved) reset(saved);
  }, [saved, reset]);

  return (
    <StepScreen
      step={1}
      title="Mostre quem você é"
      subtitle="Fotos ajudam quem treina com você a te reconhecer na academia."
      missing={missingStep1(draft)}
      onNext={() => router.push('/perfil-treino')}>
      <PhotosBioGender value={draft} onChange={update} />
    </StepScreen>
  );
}
