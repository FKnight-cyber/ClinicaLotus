# Clínica — MVP Anamnese

Aplicação em monorepo com Next.js, Nest.js e PostgreSQL.

## Rodando com Docker em ambiente dev

Pré-requisitos:

- Docker Desktop instalado e em execução.

Subir frontend, API e banco:

```bash
docker compose up -d --build
```

O parâmetro `-d` deixa os containers rodando em background. Se usar `docker compose up --build` sem `-d`, o terminal fica anexado aos containers e `Ctrl+C` encerra os serviços.

Para ver o processo executando no terminal sem abrir outro comando de logs, rode sem `-d`:

```bash
docker compose up --build
```

Nesse modo, mantenha o terminal aberto. Use `Ctrl+C` apenas quando quiser parar os serviços.

URLs locais:

- Web: http://localhost:3000/login
- API healthcheck: http://localhost:3333/api/health
- PostgreSQL: `localhost:5432`

Login inicial do sistema:

```txt
Usuario: admin
Senha: admin123
```

No primeiro acesso o usuario admin fica marcado com `mustChangePassword=true`, preparando o fluxo futuro de troca obrigatoria de senha.

Credenciais locais do banco:

```txt
POSTGRES_DB=clinica
POSTGRES_USER=clinica
POSTGRES_PASSWORD=clinica_dev
DATABASE_URL=postgresql://clinica:clinica_dev@localhost:5432/clinica
```

O compose monta o diretório do projeto dentro dos containers, então alterações em `apps/web` e `apps/api` são refletidas em tempo real pelos servidores de desenvolvimento.

Acompanhar logs dos serviços:

```bash
docker compose logs -f web api
```

Se uma alteração de frontend não aparecer por causa do watcher do Docker/Windows, reinicie somente o serviço web:

```bash
docker compose restart web
```

Isso é bem mais leve do que derrubar tudo e mantém o banco rodando.

Ver containers em execução:

```bash
docker compose ps
```

Se alterar dependências em algum `package.json`, normalmente basta reiniciar os serviços para o `npm install` rodar dentro dos containers:

```bash
docker compose restart web api
```

Se ainda assim o volume de dependências ficar inconsistente, recrie os volumes:

```bash
docker compose down -v
docker compose up -d --build
```

Parar os containers:

```bash
docker compose down
```

Parar e remover também volumes locais, incluindo dados do PostgreSQL:

```bash
docker compose down -v
```

## Banco de dados, Prisma e seed

O backend usa Prisma com PostgreSQL. Em Docker, o schema e o seed rodam automaticamente ao iniciar a API:

```bash
docker compose up -d --build
```

Comandos úteis dentro do container:

```bash
docker compose exec api sh -lc "cd apps/api && npx prisma generate"
docker compose exec api sh -lc "cd apps/api && npx prisma db push"
docker compose exec api sh -lc "cd apps/api && npm run prisma:seed"
```

O seed cria permissoes iniciais, o grupo `Administrador` e o usuario `admin` com acesso total.

## Autenticacao e autorizacao

A API expõe login interno por JWT em `POST /api/auth/login` e perfil em `GET /api/auth/me`.

As permissoes ficam no banco e podem ser combinadas em grupos customizaveis. O modulo `/api/access` ja oferece a base para administradores listarem permissoes, criarem grupos, criarem usuarios e alterarem permissoes de grupos ou grupos de usuarios.

## Rodando sem Docker

No Windows, use `npm.cmd` caso o PowerShell bloqueie scripts `.ps1`.

```bash
npm.cmd install
npm.cmd run dev:web
npm.cmd run dev:api
```

## Validações úteis

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```