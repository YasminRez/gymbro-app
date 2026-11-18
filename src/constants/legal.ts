/**
 * Versão atual dos Termos de Uso e da Política de Privacidade (RN-005).
 * Ao publicar uma nova versão: aumente CURRENT_TERMS_VERSION e atualize TERMS_CHANGES.
 * Quem aceitou uma versão anterior verá a tela A5 até aceitar a nova (US-03, cenário 2).
 */
export const CURRENT_TERMS_VERSION = '1.0';
export const CURRENT_TERMS_DATE = '17/11/2026';

/** O que mudou nesta versão (mostrado na tela A5) */
export const TERMS_CHANGES = [
  'Remoção definitiva dos dados em até 30 dias após excluir a conta.',
  'Regras de denúncia e suspensão preventiva.',
  'Uso da localização apenas para buscar academias.',
];

export type LegalDoc = 'termos-de-uso' | 'politica-de-privacidade';

/**
 * RASCUNHO para o trabalho acadêmico. Os textos jurídicos precisam ser revisados
 * antes de qualquer publicação real (DRS, US-03 — notas técnicas).
 */
export const LEGAL_DOCS: Record<LegalDoc, { title: string; sections: { heading: string; body: string }[] }> =
  {
    'termos-de-uso': {
      title: 'Termos de Uso',
      sections: [
        {
          heading: '1. Quem pode usar',
          body: 'O GymBrô é permitido apenas para maiores de 18 anos. Cada pessoa pode ter uma única conta, vinculada a um e-mail.',
        },
        {
          heading: '2. Sua conta',
          body: 'Você é responsável pelas informações do seu perfil e por manter sua senha em segurança. Após 5 tentativas de login inválidas, o acesso fica bloqueado por 5 minutos.',
        },
        {
          heading: '3. Conexões e conversas',
          body: 'Conversas só são liberadas entre pessoas que se curtiram mutuamente. Você pode desfazer uma conexão ou bloquear alguém a qualquer momento.',
        },
        {
          heading: '4. Conduta e denúncias',
          body: 'Não é permitido publicar conteúdo ofensivo, sexual, violento ou que não tenha relação com treino. Contas com 3 denúncias em 30 dias são suspensas preventivamente até análise da moderação.',
        },
        {
          heading: '5. Publicações',
          body: 'A primeira publicação do dia conta como check-in. Você escolhe se cada publicação fica visível para sua academia e conexões ou somente para conexões.',
        },
        {
          heading: '6. Exclusão de conta',
          body: 'Você pode excluir sua conta nas configurações. Ela é desativada na hora e os dados pessoais são removidos definitivamente em até 30 dias, salvo obrigação legal.',
        },
      ],
    },
    'politica-de-privacidade': {
      title: 'Política de Privacidade',
      sections: [
        {
          heading: '1. Dados que coletamos',
          body: 'Nome, e-mail, data de nascimento, gênero, fotos, informações de treino, interesses, academia frequentada, publicações e mensagens.',
        },
        {
          heading: '2. Localização',
          body: 'Usamos sua localização apenas no momento de buscar academias próximas. Sua localização exata nunca é guardada nem mostrada a outras pessoas; os outros usuários veem só a academia e uma distância aproximada.',
        },
        {
          heading: '3. Para que usamos',
          body: 'Para sugerir parceiros compatíveis, mostrar o feed da sua academia, calcular seus dias ativos e enviar notificações que você permitiu.',
        },
        {
          heading: '4. Com quem compartilhamos',
          body: 'Não vendemos seus dados. Eles ficam armazenados no Supabase, nosso provedor de banco de dados, com acesso restrito por regras de segurança.',
        },
        {
          heading: '5. Seus direitos (LGPD)',
          body: 'Você pode acessar, corrigir, exportar e excluir seus dados a qualquer momento pelo aplicativo, além de revogar permissões nas configurações do aparelho.',
        },
      ],
    },
  };
