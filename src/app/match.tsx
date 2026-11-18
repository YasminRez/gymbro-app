import { ScreenPlaceholder } from '@/components/screen-placeholder';

/** D7 · US-10 — É um match! */
export default function Tela() {
  return (
    <ScreenPlaceholder
      code="D7"
      title="É um match!"
      stories={['US-10']}
      description="Vocês curtiram um ao outro."
      links={[{ title: 'Enviar mensagem', href: '/chat/demo', variant: 'success' }]}
    />
  );
}
