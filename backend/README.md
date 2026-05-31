# ACERVO API

Backend em Node.js + Fastify + TypeScript + Prisma + PostgreSQL + JWT para o projeto ACERVO.

## Stack

- Node 20+
- Fastify 5
- Prisma ORM
- PostgreSQL
- JWT para autenticação

## Variáveis de ambiente

Arquivo de exemplo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/acervo?schema=public"
JWT_SECRET="troque-esta-chave-em-producao"
JWT_EXPIRES_IN="12h"
AUTH_SESSION_IDLE_TIMEOUT_MINUTES=30
TRUST_PROXY_HOPS=1
PORT=10000
CORS_ORIGIN="http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
INSTITUTIONAL_EMAIL_DOMAINS="acervo.edu,ulife.com.br"
SEED_ACCESS_PASSWORD=""
```

## Fluxo recomendado

Da raiz do projeto:

```bash
npm install
npm run dev
```

Esse fluxo já:

- garante `backend/node_modules`
- cria `backend/.env` a partir de `.env.example` se faltar
- cria o banco `acervo` se ele não existir
- aplica `prisma migrate deploy`
- executa o seed só quando o banco estiver vazio
- o seed cria apenas usuários de acesso e não popula eventos/artigos de exemplo

## Fluxo manual do backend

```bash
cd backend
npm install
npm run bootstrap:dev
npm run dev
```

## Contas seed

- Admin: `admin@acervo.edu`
- Coordenador: `coord@acervo.edu`
- a senha inicial deve ser definida em `SEED_ACCESS_PASSWORD` somente no ambiente local antes de executar o seed
- não execute o seed em produção nem reutilize essa senha em um ambiente publicado

## Cadastro de acesso

- a tabela de contas internas continua sendo `users`
- o cadastro público em `/auth/register` cria apenas contas `COORDENADOR`
- contas `ADMIN` continuam sendo criadas internamente
- o campo `Cargo na instituição` agora é salvo em `users.job_title`
- o cadastro público exige e-mail institucional em um dos domínios configurados em `INSTITUTIONAL_EMAIL_DOMAINS`
- a variável antiga `INSTITUTIONAL_EMAIL_DOMAIN` continua compatível e recebe `ulife.com.br` como domínio adicional

## Segurança atual

- senhas com hash `bcrypt`
- JWT com expiração configurável e sessão validada no servidor
- apenas uma sessão ativa por conta; um novo login revoga o acesso anterior
- encerramento por inatividade configurável com `AUTH_SESSION_IDLE_TIMEOUT_MINUTES`
- bloqueio persistente por conta, independente do IP utilizado
- bloqueio adicional por IP, mesmo variando o e-mail tentado
- espera progressiva em novos ciclos de tentativas inválidas
- identificadores de conta e IP armazenados como HMAC nos contadores de segurança
- leitura do IP real atrás do proxy da hospedagem configurada por `TRUST_PROXY_HOPS`
- resposta estruturada com `Retry-After` e `retryAfterSeconds` para o frontend exibir o temporizador

## Limites atuais

- a sessão do frontend continua baseada em token no `localStorage`; uma evolução futura pode migrar o transporte para cookies `HttpOnly` com proteção contra CSRF
- o cadastro público de coordenadores ainda não verifica posse real do e-mail; para produção, o ideal e migrar para convite ou verificação por e-mail
