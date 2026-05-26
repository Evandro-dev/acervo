# ACERVO

Repositório do projeto escolar ACERVO, com frontend em React + Vite e backend em Fastify + Prisma + PostgreSQL.

## Estrutura

```txt
ACERVO/
  frontend/  # React + Vite + Tailwind
  backend/   # Fastify + Prisma
  scripts/   # utilitários para rodar o ambiente completo na raiz
```

## Subir o projeto

Pré-requisitos:

- Node 20+
- PostgreSQL local ativo
- usuário `postgres`
- senha `postgres`

Na raiz do projeto:

```bash
npm run install:all
npm run dev
```

O comando `npm run dev` faz o bootstrap do backend antes de subir os servidores:

- instala dependências do `backend/` se estiverem faltando
- cria o banco `acervo` se ele ainda não existir
- aplica as migrations do Prisma
- executa o seed inicial somente se o banco estiver vazio
- sobe backend em `http://localhost:3333`
- sobe frontend em `http://localhost:8080` ou na porta que o Vite escolher

Também é possível rodar cada parte isoladamente:

```bash
npm run dev --prefix frontend
npm run dev --prefix backend
```

## Deploy

Frontend:

- diretório raiz: `frontend`
- instalar: `npm install`
- build: `npm run build`
- saída: `dist`
- variável recomendada: `VITE_API_URL=https://sua-api`
- exemplo local: `frontend/.env.example`

Backend:

- diretório raiz: `backend`
- instalar: `npm install`
- build: `npm run build`
- start: `npm run start`
- variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`

## Login administrativo de desenvolvimento

Usuários seed reais:

- `admin@acervo.edu` / `acervo123`
- `coord@acervo.edu` / `acervo123`

## Cadastro de contas

- as contas internas ficam na tabela `users`
- a tela administrativa possui abas `Entrar` e `Cadastrar`
- o cadastro público cria contas `COORDENADOR`
- contas `ADMIN` são criadas internamente

## Segurança atual

- senhas com hash `bcrypt`
- JWT com expiração configurável
- bloqueio temporário por IP + e-mail
- bloqueio adicional por IP mesmo variando o e-mail
- temporizador de bloqueio visível no frontend

## Observações

- os PDFs enviados ficam em `backend/uploads/`
- o seed automático não roda se já existirem usuários no banco, para não apagar dados já cadastrados
- o seed atual cria apenas usuários de acesso e não adiciona eventos ou artigos fictícios
- se você quiser resetar tudo manualmente, use os comandos do Prisma dentro de `backend/`
