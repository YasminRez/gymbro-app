import { ScreenPlaceholder } from '@/components/screen-placeholder';

/** F1 · US-17, US-18, US-19 — Feed */
export default function Tela() {
  return (
    <ScreenPlaceholder
      code="F1"
      title="Feed"
      stories={['US-17', 'US-18', 'US-19']}
      description="Publicações da sua academia e das suas conexões."
      links={[{ title: 'Notificações', href: '/notificacoes', variant: 'secondary' }]}
    />
  );
}
