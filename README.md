# GymBrô

App para encontrar parceiros de treino na sua academia. React Native + Expo (SDK 58), TypeScript, Expo Router e Supabase.

- Plano de desenvolvimento: [`docs/PLANO_DE_DESENVOLVIMENTO.md`](docs/PLANO_DE_DESENVOLVIMENTO.md)
- Banco de dados: [`supabase/migrations/0001_schema_inicial.sql`](supabase/migrations/0001_schema_inicial.sql)
- Documentação (Visão, DRS, Modelagem) e protótipo: pasta `app-trabalho-final` e Figma do grupo.

## Rodar no celular com Expo Go

Atalho no Windows: dois cliques em `abrir-no-celular.bat` (instala os pacotes na primeira vez e mostra o QR code). Para abrir a pasta no VS Code: `abrir-no-vscode.bat`.

Pré-requisitos: [Node.js 20 LTS ou mais novo](https://nodejs.org), [Git](https://git-scm.com) e o app **Expo Go** no celular (Play Store / App Store).

```bash
npm install        # só na primeira vez ou quando o package.json mudar
npx expo start     # abre o servidor e mostra um QR code
```

- **Android:** abra o Expo Go e leia o QR code.
- **iPhone:** leia o QR code com a câmera.
- Celular e computador precisam estar na **mesma rede Wi-Fi**. Se não conectar, use `npx expo start --tunnel`.

Sem o `.env` preenchido o app roda em **modo demonstração** (veja abaixo).

## Supabase

O projeto **gymbro** já está criado na organização _YasminRez's Org_, na região de São Paulo (`sa-east-1`). Os SQL de `supabase/migrations/` (0001 a 0015) já foram aplicados.

- Autenticação: "Confirm email" está desligado para facilitar os testes. O link de recuperação vale 30 minutos, e os Redirect URLs `exp://**` e `gymbro://**` estão cadastrados.
- Storage: o bucket `fotos-perfil` é público para leitura, e cada usuário só envia arquivos para a própria pasta.

**Cada pessoa do grupo precisa criar o seu `.env`** na raiz do projeto, que não vai para o GitHub. Copie o `.env.example` e preencha com:

```
EXPO_PUBLIC_SUPABASE_URL=https://mozeksxbaeeyvfuhdclw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<chave publishable do painel: Project Settings → API Keys>
```

Depois de criar ou alterar o `.env`, pare o Expo (Ctrl+C) e rode `npx expo start` de novo.

### Perfis de teste (descoberta e match)

Para ter gente para curtir enquanto o app não tem usuários, crie sua conta pelo app, escolha sua academia e rode no **SQL Editor** do Supabase:

```sql
select criar_perfis_teste('seu-email@exemplo.com');  -- cria 6 perfis na sua academia
select apagar_perfis_teste();                         -- remove todos depois
```

Ana e Diego já curtiram você: ao curtir de volta, aparece o "É um match!". As funções estão em `supabase/seed/perfis_teste.sql` e não podem ser chamadas pelo app.

### Notificações push

No Expo Go, as notificações aparecem enquanto o app está aberto (chegam pelo Realtime). Para receber push com o app fechado é preciso uma development build:

```bash
npx eas-cli init                              # cria o projectId no app.json
npx eas-cli build --profile development       # gera o APK de desenvolvimento
```

Com o token registrado, o banco envia o push pelo Expo Push Service (trigger `enviar_push`, migration 0013).

### Novas migrações

Crie um arquivo `supabase/migrations/000N_nome.sql` e rode no **SQL Editor** do painel, na ordem dos números. Nunca edite um arquivo de migração que já foi aplicado: crie um novo.

### Sem Supabase (modo demonstração)

Sem o `.env`, o app usa um login de mentira com as mesmas regras. A conta de teste é `demo@gymbro.app` com a senha `Gym@2026`; na tela Entrar, toque no aviso cinza para preencher. Também dá para criar contas novas, mas elas somem quando o app recarrega.

## Comandos

| Comando                     | O que faz                                        |
| --------------------------- | ------------------------------------------------ |
| `npx expo start`            | servidor de desenvolvimento                      |
| `npm run typecheck`         | checa os tipos do TypeScript                     |
| `npm run lint`              | ESLint                                           |
| `npm test`                  | testes das regras de negócio (Jest)              |
| `npm run format`            | formata o código com Prettier                    |
| `npx expo install <pacote>` | instala um pacote na versão compatível com o SDK |

## Estrutura

```
src/app/         telas (Expo Router) — cada arquivo traz o código da tela do Figma e as US
src/components/  componentes de interface
src/domain/      regras de negócio + testes
src/lib/         Supabase
src/store/       estado global
src/theme/       cores e fontes do protótipo
supabase/        SQL do banco
docs/            plano de desenvolvimento
```
