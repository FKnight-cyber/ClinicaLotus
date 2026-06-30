# Clínica — MVP Anamnese

Aplicação em monorepo com Next.js, Nest.js e PostgreSQL.

## Status atual do MVP

O fluxo de anamnese já usa backend e banco reais. Os registros clínicos não são mais salvos em `localStorage`.

Implementado nesta etapa:

- autenticação por JWT;
- cadastro pendente e aprovação de usuários;
- grupos e permissões por ação;
- templates oficiais de anamnese persistidos no banco;
- fonte compartilhada dos templates em `shared/anamnese-templates.json`;
- CRUD de anamnese via API;
- autosave de rascunho durante preenchimento/edição;
- persistência de perguntas customizadas por registro;
- bloqueio de edição após finalização;
- auditoria de criação, atualização, finalização e emissão de PDF;
- vínculo com paciente;
- tela inicial de prontuário com timeline clínica;
- geração de documento/PDF rastreável com código e hash;
- UI escondendo links e botões sem permissão.

O relatório detalhado fica em [docs/relatorio-implementacao-mvp-anamnese.md](docs/relatorio-implementacao-mvp-anamnese.md).

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

O seed cria permissoes iniciais, o grupo `Administrador`, o grupo `Developer`, o usuario `admin` e os templates oficiais de anamnese. O grupo `Developer` recebe todos os acessos, incluindo a visibilidade completa do menu lateral.

O seed não cria registros clínicos, pacientes de demonstração nem rascunhos de anamnese. Registros clínicos devem nascer apenas pelo uso da aplicação/API.

## Deploy

Esta aplicação tem dois serviços de produção:

- API NestJS + Prisma no Railway;
- PostgreSQL no Railway;
- Frontend Next.js no CloudPages/Cloudflare Pages ou serviço equivalente com suporte a Next.js.

### 1. Backend e banco no Railway

Crie um projeto no Railway com dois serviços:

1. `PostgreSQL` usando o template/plugin oficial do Railway.
2. `API` apontando para este repositório.

No serviço da API, configure o diretório raiz como o repositório inteiro, não `apps/api`, porque o seed lê `shared/anamnese-templates.json`.

Variáveis do serviço `API`:

```txt
DATABASE_URL=<URL interna do PostgreSQL Railway>
JWT_SECRET=<segredo forte de produção>
ADMIN_PASSWORD=<senha inicial forte do admin>
WEB_ORIGIN=https://seu-front.cloudpages.app
NODE_ENV=production
```

Observações:

- Railway injeta `PORT` automaticamente; a API já usa `PORT` como prioridade e `API_PORT` apenas como fallback local.
- `WEB_ORIGIN` deve ser a URL pública do frontend. Para mais de uma origem, separe por vírgula.
- Não use `clinica_dev_secret_change_me` em produção.
- Não use `admin123` em produção.

Build command da API no Railway:

```bash
npm ci && npm run build --workspace @clinica/api
```

Start command da API no Railway:

```bash
npm run start:prod --workspace @clinica/api
```

Esse start command faz, ao subir:

- geração do Prisma Client;
- sincronização do schema atual no banco;
- seed de permissões, grupos, usuário admin e templates oficiais;
- início da API compilada.

Para validar o deploy da API:

```txt
https://sua-api.up.railway.app/api/health
```

Deve retornar o healthcheck da API.

#### Nota sobre migrations

O MVP atual usa `prisma db push` para sincronizar schema. Para produção madura, o próximo passo recomendado é versionar migrations Prisma e trocar o start/deploy para `prisma migrate deploy`.

### 2. Frontend no CloudPages/Cloudflare Pages

Crie um projeto no CloudPages apontando para o mesmo repositório.

Configuração recomendada:

```txt
Framework: None
Root directory: /apps/web
Build command: npm run build:cloudflare
Output directory: .vercel/output/static
Node version: 22
```

O build do Cloudflare Pages usa `@cloudflare/next-on-pages` para transformar o build do Next.js em uma saída compatível com Pages. Não use `apps/web/.next` como diretório de saída, porque `.next` é interno do Next.js e não é servido como site estático pelo Cloudflare Pages.

Variáveis do frontend:

```txt
NEXT_PUBLIC_API_URL=https://sua-api.up.railway.app
```

Inclua sempre `https://` na URL da API.

Depois de publicar o frontend, volte no Railway e atualize `WEB_ORIGIN` com a URL final do CloudPages, por exemplo:

```txt
WEB_ORIGIN=https://clinica-anamnese.pages.dev
```

Se houver URL de preview/staging, inclua também:

```txt
WEB_ORIGIN=https://clinica-anamnese.pages.dev,https://preview-clinica-anamnese.pages.dev
```

#### Importante sobre hospedagem estática

O frontend atual é uma aplicação Next.js com rotas como `/anamnese/[recordId]` e `/usuarios/[userId]`. Use CloudPages/Cloudflare Pages com suporte a Next.js. Se a plataforma escolhida servir apenas arquivos estáticos, será necessário adaptar o build para export estático ou trocar para uma hospedagem compatível com Next.js.

### 3. Ordem recomendada de deploy

1. Criar PostgreSQL no Railway.
2. Criar API no Railway.
3. Configurar variáveis da API.
4. Fazer deploy da API.
5. Validar `/api/health`.
6. Criar frontend no CloudPages.
7. Configurar `NEXT_PUBLIC_API_URL` com a URL pública da API.
8. Fazer deploy do frontend.
9. Atualizar `WEB_ORIGIN` na API com a URL final do frontend.
10. Redeploy/restart da API.
11. Acessar o frontend e entrar com o usuário `admin` e a senha definida em `ADMIN_PASSWORD`.

### 4. Checklist pós-deploy

Valide no ambiente publicado:

- login em `/login`;
- carregamento de templates em `/anamnese`;
- criação de uma nova anamnese;
- autosave de rascunho;
- criação/vínculo de paciente;
- finalização bloqueando edição;
- emissão de PDF rastreável;
- prontuário em `/modulos/prontuario`;
- tela de usuários e permissões para admin;
- ausência de botões/links para usuário sem permissão.

## Autenticacao e autorizacao

A API expõe login interno por JWT em `POST /api/auth/login`, cadastro pendente em `POST /api/auth/register` e perfil em `GET /api/auth/me`.

No frontend, novos usuarios podem solicitar cadastro em http://localhost:3000/cadastro. O cadastro nasce com status `PENDING` e so consegue entrar depois que um administrador aprovar o usuario na tela de detalhes.

As permissoes ficam no banco e podem ser combinadas em grupos customizaveis. O modulo `/api/access` oferece a base para administradores listarem permissoes, criarem grupos e alterarem permissoes de grupos. A concessao de grupos a usuarios fica concentrada na tela de detalhes do usuario, separando administracao de usuarios da configuracao geral de autorizacoes.

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