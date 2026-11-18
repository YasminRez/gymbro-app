import { ScreenPlaceholder } from '@/components/screen-placeholder';

/** D10 · US-11 — Conexões */
export default function Tela() {
  return (
    <ScreenPlaceholder
      code="D10"
      title="Conexões"
      stories={['US-11']}
      description="Seus parceiros de treino conectados."
      links={[{ title: 'Abrir chat de exemplo', href: '/chat/demo', variant: 'secondary' }]}
    />
  );
}
