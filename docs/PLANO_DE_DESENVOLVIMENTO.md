# GymBrô — Plano de desenvolvimento

Base: Documento de Visão, DRS (24 histórias, RN-001 a RN-024, RNF-001 a RNF-012), Análise e Modelagem (classes e MER), mapa de fluxo `fluxo_navegacao.mmd` e o protótipo do Figma com 41 telas (A1–A5, P1–P11, D1–D13, F1–F8, C1–C4).

## 1. Stack

| Camada           | Escolha                                                                                                                         | Por quê (requisito)         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| App              | React Native + **Expo SDK 58**, TypeScript, **Expo Router**                                                                     | RNF-001, RNF-012, Visão 5.3 |
| Back-end         | **Supabase**: Postgres, Auth, Storage, Realtime, Edge Functions                                                                 | Visão 5.3, RNF-003, RNF-004 |
| Dados no app     | TanStack Query (cache e paginação) + Zustand (estado local)                                                                     | RNF-005, RNF-009            |
| Formulários      | react-hook-form + zod                                                                                                           | mensagens de erro do DRS    |
| Recursos nativos | expo-location, expo-image-picker, expo-camera, expo-image-manipulator, expo-notifications, expo-secure-store, react-native-maps | notas técnicas das US       |
| Gestos           | react-native-gesture-handler + reanimated                                                                                       | US-09, RNF-008              |
| Qualidade        | ESLint + Prettier, Jest (jest-expo)                                                                                             | RNF-012                     |

Todas as bibliotecas acima funcionam no **Expo Go**, com uma exceção: notificações push remotas no Android não funcionam no Expo Go (desde o SDK 53). Para testar a US-21 de verdade, será preciso uma _development build_ (`npx eas-cli build --profile development`). Até lá, use notificações locais.

## 2. Estrutura do código

```
src/
  app/                 rotas (cada arquivo = uma tela)
    (auth)/            A2–A5 — sem sessão (RN-001)
    (onboarding)/      P1–P8 — logado, sem perfil mínimo (RN-006)
    (tabs)/            Descobrir, Feed, Publicar, Conexões, Perfil (RNF-008)
    perfil/[id].tsx    D4
    chat/[id].tsx      D12
    ...                modais e telas empilhadas (match, filtros, ranking...)
  components/ui/       Button, Input, Chip, Card, Text, Screen (componentes do Figma)
  domain/              regras de negócio puras + testes (senha, idade, match, compatibilidade, sequência)
  lib/supabase.ts      cliente do Supabase
  store/               estado global (sessão)
  theme/               cores, fontes e espaçamentos do protótipo
supabase/migrations/   SQL do banco gerado a partir do MER
```

**Regra:** cada tela do Figma vira um arquivo em `src/app`, com o código da tela (ex.: `D1`) e as US no comentário do topo. Hoje elas são telas provisórias navegáveis. Cada sprint troca as telas provisórias pelo layout real.

## 3. Sprints

Sprints de 2 semanas. A ordem segue as dependências das US no DRS (US-01 → US-04 → US-07 → US-08 → US-10 → US-12 …).

### Sprint 0 — Fundação ✅ (feita nesta entrega)

- Projeto Expo com TypeScript, Expo Router, ESLint, Prettier e Jest.
- Tema com as cores e fontes do Figma (Archivo e Inter).
- Navegação completa: grupos auth, onboarding e abas, com proteção de rotas.
- Regras de negócio com testes: RN-002, RN-004, RN-011, RN-012, RN-018 e RN-024.
- Schema SQL inicial com RLS (`supabase/migrations/0001_schema_inicial.sql`).
- **Falta fazer (grupo):** criar o projeto no Supabase, rodar o SQL, preencher o `.env` e publicar no GitHub.

### Sprint 1 — Acesso e conta · US-01, US-02, US-03 ✅ (código pronto)

Telas: A1 Splash, A2 Entrar, A3 Recuperar senha, A4 Criar conta, A5 Termos atualizados, P4 Localização, Nova senha, Termos de Uso e Política de Privacidade.

- [x] Cadastro com validação no app e no banco: senha forte (RN-002), e-mail único (RN-003), 18+ (RN-004), aceite obrigatório (RN-005). A data de nascimento tem máscara automática DD/MM/AAAA.
- [x] Botão "Criar conta" desabilitado até tudo estar preenchido. Erros aparecem ao sair do campo, com as mensagens do DRS.
- [x] Trigger `criar_usuario` cria o registro em `usuario` e em `aceite_termos` (`supabase/migrations/0002_autenticacao.sql`).
- [x] Login com bloqueio de 5 minutos após 5 erros (RN-023), via funções `login_bloqueado_ate` e `registrar_tentativa_login`.
- [x] Recuperar senha com resposta neutra e link que abre a tela "Nova senha" no app.
- [x] Sessão mantida no cofre seguro (expo-secure-store, RNF-003) e "Sair" com confirmação.
- [x] Nova versão dos termos bloqueia o app até o aceite (A5).
- [x] Permissão de localização explicada antes de pedir. Se negada, oferece busca manual e o atalho "Ativar localização".
- [x] Modo demonstração sem back-end, com as mesmas regras (conta de teste `demo@gymbro.app` / `Gym@2026`).
- [x] Testes: 40 passando (máscara de data, bloqueio de login e regras anteriores).
- [x] Projeto Supabase **gymbro** criado (sa-east-1), com os SQL 0001 a 0004 aplicados e as configurações de e-mail feitas. Cadastro, trigger, aceite dos termos, bloqueio de login e vínculo de academia foram testados direto no banco.
- [ ] **Grupo:** testar os cenários do DRS no celular com contas reais.
- [ ] Revisar os textos dos Termos e da Política (estão em `src/constants/legal.ts`, marcados como rascunho).

### Sprint 2 — Perfil e academias · US-04, US-05, US-06, US-07 ✅ (código pronto)

Telas: P1–P3 (perfil em 3 etapas), P4 Localização, P5/P6 Academias em lista e mapa, P7 Nenhuma academia, P8 Sugerir academia, P9 Minha academia, P10 Editar perfil, P11 Preferências (D3 Filtros abre a mesma tela).

- [x] Perfil em 3 etapas com rascunho mantido ao voltar. "Continuar" fica desabilitado e mostra o que falta.
- [x] Fotos da galeria ou câmera, de 1 a 6 (RN-007). Antes do envio, são redimensionadas para 1080 px e comprimidas (RNF-007), e vão para o Supabase Storage (bucket `fotos-perfil`, cada usuário escreve só na própria pasta).
- [x] A primeira foto é a principal. Para reordenar, toque na foto e use "Definir como principal" ou "Mover para a esquerda/direita".
- [x] Bio com contador, que fica vermelho acima de 500 caracteres e impede salvar.
- [x] Perfil salvo de uma vez pela função `salvar_perfil`, que valida a RN-007 também no banco.
- [x] RN-006 calculada de verdade: sem foto, modalidade, objetivo, período ou academia principal, o app volta para o item que falta.
- [x] Academias próximas pelo OpenStreetMap (gratuito, sem chave): raio padrão de 5 km, aumentável até 50 km (RN-010), ordenadas pela distância, com endereço e número de pessoas do GymBrô. Também dá para ver no mapa e buscar por nome, bairro ou cidade fora do raio.
- [x] Academia escolhida vira cache no banco. A função `definir_academia` aplica a RN-009: 1 principal, até 2 secundárias e troca da principal só depois de 7 dias.
- [x] "Sugerir academia" grava como "Em análise" e já vincula de forma provisória.
- [x] Editar perfil pergunta "Deseja descartar as alterações?" ao sair sem salvar.
- [x] Preferências: faixa etária (18+), gêneros, distância de 1 a 50 km, "Somente minha academia" e "Aparecer na descoberta".
- [x] Testes: 54 passando (etapas do perfil, RN-006, RN-007, RN-009, distâncias).
- [ ] Reordenar fotos arrastando (o DRS pede arrastar; hoje é por menu). Fica para o acabamento da Sprint 6.
- [ ] Painel de moderação para aprovar academias sugeridas (fora do app; dá para fazer pelo Table Editor do Supabase mudando `status` para `aprovada`).

### Sprint 3 — Descoberta e match · US-08, US-09, US-10 ✅ (código pronto)

Telas: D1 Descobrir, D3 Filtros, D4 Perfil completo, D7 É um match!, D8 Limite de curtidas, D9 Sem novos perfis. A D2 (Perfil incompleto) é coberta pelo bloqueio de rotas da RN-006, que leva direto ao item que falta.

- [x] A função `buscar_parceiros` (migration 0005) monta a lista no banco e ordena pela compatibilidade da RN-024, com a mesma fórmula de `src/domain/rules.ts`. Ela esconde:
  - quem está bloqueado nos dois sentidos (RN-015);
  - quem já é conexão;
  - quem você já curtiu;
  - quem você passou há menos de 30 dias (RN-013);
  - quem está com o perfil pausado.
- [x] Aplica as preferências (idade, gênero, distância entre academias, "Somente minha academia") e os filtros rápidos de período, modalidade e objetivo.
- [x] O card mostra foto, nome, idade, academia, distância aproximada (RN-008), horários, modalidades, objetivos, interesses em comum em verde e o percentual de compatibilidade.
- [x] Deslizar para curtir ou passar (gesture-handler + reanimated, RNF-008), botões Passar, Desfazer e Curtir.
- [x] A função `registrar_acao` grava a curtida e cria a conexão numa única transação, só com curtida mútua (RN-011). Também aplica o limite de 100 curtidas por dia no fuso do usuário (RN-012) e gera a notificação para a outra pessoa.
- [x] "Desfazer" vale para a última ação, até 10 minutos depois, desde que ainda não tenha virado conexão.
- [x] Perfil completo com todas as fotos, bio, dias ativos e sequência.
- [x] Perfis de teste para experimentar no Supabase: `supabase/seed/perfis_teste.sql` (veja o README).
- [x] Testes: 61 passando. A busca, o match, o filtro e a notificação também foram testados direto no banco.
- [ ] Notificação push do match (US-10, cenário 2): a notificação já é gravada no banco; o envio do push entra na Sprint 6.

### Sprint 4 — Conexões, chat e segurança · US-11, US-12, US-13, US-14

Telas: D10/D11 Conexões, D12 Chat, D13 Desfazer conexão, D5/D6 Denunciar e Bloquear, C3 Bloqueados.

- Chat com Supabase Realtime (entrega em até 2 s, RNF-004). RLS: só membros de conexão ativa leem e escrevem (RN-014).
- Bloqueio desfaz a conexão e esconde tudo dos dois lados (RN-015).
- Denúncia + suspensão automática com 3 denúncias em 30 dias (RN-016).

### Sprint 5 — Feed e constância · US-15 a US-20

Telas: F1 Feed, F2 Comentários, F3 Excluir check-in, F4 Publicar, F5 Dia concluído, F6 Meu perfil.

- Publicar com câmera ou galeria. O banco marca o 1º post do dia como check-in (RN-017, índice único já criado).
- Recalcular `estatistica_atividade` com a mesma regra de `src/domain/streak.ts` (RN-018), num trigger ou num agendamento diário.
- Feed com paginação por cursor e visibilidade (RN-021). Curtidas, comentários (RN-020) e exclusão lógica com recálculo (RN-019).

### Sprint 6 — Engajamento, conta e acabamento · US-21, US-22, US-23, US-24 + RNFs ✅ (código pronto)

Telas: F7 Notificações, F8 Ranking, C1 Configurações (com Privacidade), C2 Notificações, C4 Excluir conta e "Conta em exclusão".

- [x] **US-21 Notificações (F7):** lista agrupada em Hoje / Esta semana / Anteriores, com paginação, "Marcar todas como lidas" e toque que abre a tela certa (chat, comentários, publicar ou perfil). Bloqueados somem da lista (RN-015). Badge com o número de não lidas no sino do Feed.
- [x] Mensagem nova também gera notificação (uma por conversa enquanto não for lida).
- [x] **C2:** liga/desliga matches, mensagens, convites, curtidas, comentários e lembrete de sequência. No banco, um trigger descarta o tipo desligado antes de gravar. Se o celular bloqueou as notificações, a tela explica e leva aos ajustes.
- [x] Push: com o app aberto, a notificação chega pelo Realtime e vira notificação local (funciona no Expo Go). Numa development build, o app registra o token do Expo Push e o banco envia o push com pg_net, mesmo com o app fechado.
- [x] Lembrete de sequência às 20h no fuso de cada pessoa, se ainda não houve check-in no dia (pg_cron de hora em hora).
- [x] **US-22 Ranking (F8):** check-ins válidos de segunda a domingo na academia principal (ou nas secundárias, pelas abas), com empate dividindo a posição, medalhas, sua posição destacada e "termina em N dias". Acesso pelo Perfil e por Minha academia.
- [x] **US-23 Privacidade:** "Mostrar distância aproximada" (RN-008, aplicado em `buscar_parceiros`), visibilidade padrão das publicações (RN-021) e "Aparecer na descoberta".
- [x] **US-24 Excluir conta (C4):** pede a palavra EXCLUIR e a senha de novo (RNF-002). A conta é desativada na hora (some da descoberta, do feed e das conexões) e apagada de vez após 30 dias por um cron (RN-022). Entrar de novo dentro do prazo mostra "Conta em exclusão" com "Reativar".
- [x] **RNF-009 Offline:** aviso "Sem internet" em qualquer tela e `onlineManager` do TanStack Query ligado ao NetInfo. O rascunho da publicação e as mensagens pendentes do chat já ficavam salvos.
- [x] **RNF-011:** telas novas com `accessibilityRole`, `accessibilityLabel` e estado nos interruptores e rádios.
- [x] `eas.json` com os perfis development, preview (APK) e production.
- [x] Migrations 0013, 0014 e 0015 aplicadas no Supabase e testadas no banco (filtro de preferências, ranking, privacidade, exclusão e reativação).
- [x] Testes: 109 passando (novos testes de notificações, ranking e exclusão).
- [ ] **Grupo:** rodar `npx eas-cli init` (cria o projectId) e `npx eas-cli build --profile development` para testar o push com o app fechado.
- [ ] Reordenar fotos arrastando (hoje é por menu) e painel de moderação continuam como melhorias futuras.

## 4. Forma de trabalho no GitHub

- **Branches:** `main` (sempre funcionando) e uma branch por história: `feature/us-01-cadastro`.
- **Commits:** curtos e no imperativo, citando a US: `US-01: valida idade mínima no cadastro`.
- **Pull request** para a `main` com: US atendida, print da tela e `npm run typecheck && npm run lint && npm test` passando.
- **Issues:** uma por US, com os critérios de aceite (Dado/Quando/Então) do DRS como checklist. Use um GitHub Project em quadro (A fazer / Fazendo / Revisão / Feito) com uma coluna por sprint.

## 5. Definição de pronto

Uma história está pronta quando:

1. Todos os critérios de aceite do DRS passam no Expo Go (Android e iOS se possível).
2. A tela segue o protótipo (cores e fontes vindas de `src/theme`).
3. As regras de negócio estão no banco (constraint, RLS ou função), não só no app.
4. `npm run typecheck`, `npm run lint` e `npm test` passam.
5. Os componentes têm `accessibilityLabel` (RNF-011).

## 6. Riscos

| Risco                                                                            | Plano                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Busca de academias depende de API externa (Google Places tem custo)              | Começar com academias cadastradas no banco + sugestão do usuário (P8). Integrar OpenStreetMap/Overpass ou Places depois. |
| Push não funciona no Expo Go                                                     | Notificações locais até a Sprint 6. Depois, development build.                                                           |
| Regras só no app podem ser burladas                                              | Toda regra crítica também vai para o banco (RLS, triggers e funções).                                                    |
| Pasta do projeto dentro do OneDrive deixa o `npm install` lento e quebra o Metro | O código fica em `Documentos\Github\gymbro-app`, fora do OneDrive.                                                       |
