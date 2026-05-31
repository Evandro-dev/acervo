# ACERVO

Repositório do projeto escolar ACERVO, com frontend em React + Vite e backend em Fastify + Prisma + PostgreSQL.

## Estrutura

```txt
ACERVO/
  frontend/  # React + Vite + Tailwind
  backend/   # Fastify + Prisma
  scripts/   # utilitários para rodar o ambiente completo na raiz
```

## Ambientes publicados

Frontend em produção:

```txt
https://acervouna.vercel.app/
```

Backend/API em produção:

```txt
https://acervo-0fud.onrender.com/
```

Banco de dados em produção:

```txt
NeonDB / PostgreSQL
```

## Pré-requisitos:

- Node.js 24+
- npm 11+
- acesso ao banco PostgreSQL/NeonDB
- arquivo `.env` configurado no backend

Na raiz do projeto:

```bash
npm run install:all
npm run dev
```

O comando `npm run dev` faz o bootstrap do backend antes de subir os servidores:

- instala dependências do `backend/` se estiverem faltando
- verifica/cria o banco configurado, quando aplicável
- gera o Prisma Client
- aplica as migrations do Prisma
- executa o seed inicial somente se o banco estiver vazio
- sobe backend em `http://localhost:10000`
- sobe frontend em `http://localhost:8080` ou na porta que o Vite escolher

Também é possível rodar cada parte isoladamente:

```bash
npm run dev --prefix frontend
npm run dev --prefix backend
```

## Deploy

### Frontend

Hospedagem:

```txt
Vercel
```

URL de produção:

```txt
https://acervouna.vercel.app/
```

Configuração recomendada na Vercel:

- diretório raiz: `frontend`
- instalar: `npm install`
- build: `npm run build`
- saída: `dist`

Variáveis de ambiente:

```env
VITE_API_URL="https://acervo-0fud.onrender.com"
```

Arquivo de exemplo local:

```txt
frontend/.env.example
```

O arquivo `.env.example` documenta a configuração, mas não é carregado automaticamente pelo Vite. Na Vercel, cadastre `VITE_API_URL` em **Project Settings > Environment Variables** para os ambientes `Production` e `Preview`, usando a URL publicada da API na Render. Depois de alterar a variável, faça um novo deploy para gerar o frontend com o valor atualizado.

No desenvolvimento local, `npm run dev` na raiz injeta automaticamente a URL do backend local. Para executar somente o frontend com uma configuração personalizada, crie um arquivo ignorado pelo Git:

```env
# frontend/.env.local
VITE_API_URL="http://localhost:10000"
```

### Backend

Hospedagem:

```txt
Render
```

URL de produção:

```txt
https://acervo-0fud.onrender.com/
```

Configuração recomendada no Render:

- diretório raiz: `backend`
- instalar: `npm install`
- build: `npm run build`
- start: `npm run start`

Variáveis obrigatórias:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@HOST/DATABASE?sslmode=verify-full&channel_binding=require"
JWT_SECRET="sua_chave_secreta"
CORS_ORIGIN="https://acervouna.vercel.app"
INSTITUTIONAL_EMAIL_DOMAINS="acervo.edu,ulife.com.br"
```

### Banco de dados

Hospedagem:

```txt
NeonDB
```

Banco:

```txt
PostgreSQL
```

Database usada pelo projeto:

```txt
acervodb
```

O projeto usa Prisma para migrations e acesso ao banco.

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
- CORS configurado para permitir o frontend publicado na Vercel

## Observações

- os PDFs enviados ficam em `backend/uploads/`
- o seed automático não roda se já existirem usuários no banco, para não apagar dados já cadastrados
- o seed atual cria apenas usuários de acesso e não adiciona eventos ou artigos fictícios
- para resetar tudo manualmente, use os comandos do Prisma dentro de `backend/`
- não versionar arquivos `.env`
- não colocar credenciais reais da NeonDB no README

## Stack e versões principais

### Ambiente

| Tecnologia | Versão  |
|------------|--------:|
| Node.js    | 24.16.0 |
| npm        | 11.13.0 |

### Frontend

| Pacote                   | Versão   |
|--------------------------|---------:|
| acervo-frontend          | 0.0.0    |
| React                    | 19.2.6   |
| React DOM                | 19.2.6   |
| Vite                     | 8.0.14   |
| TypeScript               | 6.0.3    |
| React Router DOM         | 7.16.0   |
| Tailwind CSS             | 4.3.0    |
| @tailwindcss/vite        | 4.3.0    |
| @tanstack/react-query    | 5.100.14 |
| @vitejs/plugin-react-swc | 4.3.1    |
| Axios                    | 1.16.1   |
| Zod                      | 4.4.3    |
| Sonner                   | 2.0.7    |
| Recharts                 | 3.8.1    |

### Backend

| Pacote             | Versão |
|--------------------|-------:|
| acervo-backend     | 1.0.0  |
| Fastify            | 5.8.5  |
| Prisma             | 7.8.0  |
| @prisma/client     | 7.8.0  |
| @prisma/adapter-pg | 7.8.0  |
| pg                 | 8.21.0 |
| TypeScript         | 6.0.3  |
| tsx                | 4.22.3 |
| Zod                | 4.4.3  |
| bcryptjs           | 3.0.3  |

## Observação sobre Prisma

Este projeto usa Prisma 7 com client gerado em caminho customizado durante o build:

```txt
backend/src/generated/prisma
```

Por isso, no backend, o Prisma Client deve ser importado a partir do client gerado, e não diretamente de `@prisma/client`. A pasta gerada fica fora do Git e `npm run build` executa `prisma generate` antes da compilação TypeScript.

Exemplo:

```ts
import { PrismaClient } from "../generated/prisma/client.js";
```

O backend também usa o adapter PostgreSQL do Prisma:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
```
