import { ScreenPlaceholder } from '@/components/screen-placeholder';

/** D4 · US-08, US-13, US-14 — Perfil completo */
export default function Tela() {
  return (
    <ScreenPlaceholder
      code="D4"
      title="Perfil completo"
      stories={['US-08', 'US-13', 'US-14']}
      description="Fotos, treino, interesses e as opções de denunciar e bloquear."
      links={[]}
    />
  );
}
