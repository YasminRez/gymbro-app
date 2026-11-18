import { router } from 'expo-router';

import { missingStep2 } from '@/domain/profile';
import { Training } from '@/features/profile/forms';
import { StepScreen } from '@/features/profile/step-screen';
import { useProfileDraft } from '@/store/profile-draft';

/** P2 · US-04, etapa 2 — Modalidades, objetivos, nível, dias e períodos */
export default function PerfilTreino() {
  const { draft, update } = useProfileDraft();
  return (
    <StepScreen
      step={2}
      title="Como você treina"
      subtitle="Usamos isso para sugerir parceiros com horários e objetivos parecidos."
      missing={missingStep2(draft)}
      onNext={() => router.push('/perfil-interesses')}>
      <Training value={draft} onChange={update} />
    </StepScreen>
  );
}
