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
PORT=3333
CORS_ORIGIN="http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173"
INSTITUTIONAL_EMAIL_DOMAIN="acervo.edu"
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

## Credenciais seed

- Admin: `admin@acervo.edu` / `acervo123`
- Coordenador: `coord@acervo.edu` / `acervo123`

## Cadastro de acesso

- a tabela de contas internas continua sendo `users`
- o cadastro público em `/auth/register` cria apenas contas `COORDENADOR`
- contas `ADMIN` continuam sendo criadas internamente
- o campo `Cargo na instituição` agora é salvo em `users.job_title`
- o cadastro público exige e-mail institucional no domínio configurado em `INSTITUTIONAL_EMAIL_DOMAIN`

## Segurança atual

- senhas com hash `bcrypt`
- JWT com expiração configurável
- bloqueio temporário após muitas tentativas seguidas de login no mesmo IP/e-mail
- bloqueio adicional por IP, mesmo variando o e-mail tentado
- resposta estruturada com `Retry-After` e `retryAfterSeconds` para o frontend exibir o temporizador

## Limites atuais

- o bloqueio de tentativas fica em memória, então reiniciar a API limpa esse contador
- a sessão do frontend continua baseada em token no `localStorage`, o que é aceitável para ambiente escolar/dev, mas não é o formato ideal para produção
- o cadastro público de coordenadores ainda não verifica posse real do e-mail; para produção, o ideal e migrar para convite ou verificação por e-mail
