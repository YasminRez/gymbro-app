import { ScreenPlaceholder } from '@/components/screen-placeholder';

/** F4 · US-15 — Nova publicação */
export default function Tela() {
  return (
    <ScreenPlaceholder
      code="F4"
      title="Nova publicação"
      stories={['US-15']}
      description="A primeira foto do dia conta como check-in (RN-017)."
      links={[]}
    />
  );
}
