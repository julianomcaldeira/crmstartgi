# Evolua CRM (StartGI)

CRM de vendas da StartGI: clientes por CNPJ, funil de oportunidades, agenda integrada ao Zoho Mail, propostas comerciais, contratos, relatórios e inteligência de mercado.

Frontend em **React + Vite + TypeScript + Tailwind**, com backend **Supabase** (Auth, Postgres/RLS, Storage, Realtime e Edge Functions em Deno).

## Desenvolvimento

Requer Node.js 20+.

```sh
npm install
npm run dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```sh
VITE_SUPABASE_URL="https://<projeto>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable/anon key>"
VITE_SUPABASE_PROJECT_ID="<project id>"
```

As variáveis `VITE_*` são **embutidas no bundle em tempo de build** (comportamento do Vite). A publishable/anon key é pública e protegida por RLS.

## Build

```sh
npm run build   # gera dist/
npm run preview # serve o dist/ localmente
```

## Deploy (Magalu Cloud)

A saída é uma SPA estática em `dist/`. Duas opções na Magalu Cloud:

### Opção A — Object Storage + CDN (mais barato)

1. `npm run build` com as `VITE_*` definidas.
2. Sincronize `dist/` para um bucket S3-compatible (Magalu Object Storage) com um cliente compatível (ex.: `aws s3 sync dist/ s3://<bucket> --delete --endpoint-url <endpoint-magalu>`).
3. Configure o CDN apontando para o bucket e habilite **fallback de SPA**: erros 403/404 devem devolver `index.html` com status 200.

### Opção B — Docker + Nginx (VM ou Kubernetes/MKS)

A imagem builda o frontend e serve via Nginx com fallback SPA e cache de assets.

```sh
docker build \
  --build-arg VITE_SUPABASE_URL="https://<projeto>.supabase.co" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="<publishable key>" \
  --build-arg VITE_SUPABASE_PROJECT_ID="<project id>" \
  -t evoluacrm-web .

docker run --rm -p 8080:80 evoluacrm-web
```

Em Kubernetes/MKS, publique a imagem em um registry (ex.: MCR/Container Registry) e exponha o serviço na porta 80.

## Observação: dependências de backend

O backend usa provedores diretos, sem depender do Lovable:

- **IA**: edge functions usam um endpoint OpenAI-compatível (`_shared/llm.ts`), padronizado para o **OpenRouter** via secret `AI_API_KEY` (formato `sk-or-v1-...`). `AI_BASE_URL` e `AI_TRANSCRIBE_BASE_URL` permitem trocar de provedor; o Brain usa a OpenCode Zen (`OPENCODE_API_KEY`).
- **E-mail transacional**: envio via **Resend** (`_shared/email.ts`, secret `RESEND_API_KEY`), com webhooks de bounce/complaint assinados (Svix) validados em `handle-email-suppression` (`RESEND_WEBHOOK_SECRET`). Remetente `notify.appiganhei.com` — ao trocar de provedor, verifique o domínio e sobrescreva com `EMAIL_SENDER_DOMAIN`/`EMAIL_FROM_DOMAIN`.

Essas secrets devem ser configuradas no Supabase (self-hosted ou hospedado). Isso é tratado na fase de migração do backend.

## API de integração (agentes externos, ex.: Claude Code)

A Edge Function `api` expõe **todos os dados** do CRM via REST, para que agentes
externos leiam e escrevam dados (inclusive agendamento: `tasks`,
`pre_vendas_agenda`, `opportunity_activities`, ...).

### Ativação

1. Aplique a migration `supabase/migrations/20261009160000_api_schema.sql` (cria o
   endpoint de descoberta `api_schema()`).
2. Gere e configure o token da API como secret no Supabase:

   ```sh
   openssl rand -hex 32                 # gere um token forte
   supabase secrets set API_TOKEN=<token>
   ```

3. Faça o deploy da função:

   ```sh
   supabase functions deploy api
   ```

### Autenticação

Envie o token em **um** dos headers:

```
Authorization: Bearer <API_TOKEN>
x-api-key: <API_TOKEN>
```

> A função usa `verify_jwt = false` (ver `supabase/config.toml`) e acessa o banco
> com a service role no servidor. Nunca exponha a `service_role` key ao agente —
> use apenas o `API_TOKEN`, que pode ser rotacionado.

### Base URL

```
https://<projeto>.supabase.co/functions/v1/api
```

### Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/` | descobre as rotas disponíveis |
| `GET` | `/_schema` | tabelas, colunas, PKs e relacionamentos |
| `GET` | `/:table` | lista com `select`, filtros, `order`, `limit`, `offset`, `count` |
| `GET` | `/:table/:id` | um registro por `id` |
| `POST` | `/:table` | cria (objeto ou array); `?upsert=true&on_conflict=col` |
| `PATCH` | `/:table/:id` | atualiza por `id` (ou `/:table?<filtros>`) |
| `DELETE` | `/:table/:id` | remove por `id` (ou `/:table?<filtros>`) |

Filtros seguem a sintaxe do PostgREST, por exemplo
`?status=eq.pending&due_date=lt.2026-10-10&assigned_to=in.(uuid1,uuid2)`
(operadores: `eq, neq, gt, gte, lt, lte, like, ilike, in, is`, com prefixo `not.`).

### Exemplos

```sh
export API="https://<projeto>.supabase.co/functions/v1/api"
export TOKEN="<API_TOKEN>"

# descobrir schema
curl -s "$API/_schema" -H "Authorization: Bearer $TOKEN" | jq

# listar tarefas pendentes com vencimento hoje ou antes
curl -s "$API/tasks?status=neq.done&due_date=lte.2026-10-09&order=due_date.asc&select=id,title,due_date,assigned_to" \
  -H "Authorization: Bearer $TOKEN" | jq

# criar agendamento
curl -s -X POST "$API/pre_vendas_agenda" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"pre_vendas_user_id":"<uuid>","created_by":"<uuid>","title":"Call","start_datetime":"2026-10-10T13:00:00Z","end_datetime":"2026-10-10T14:00:00Z"}'

# concluir tarefa
curl -s -X PATCH "$API/tasks/<uuid>" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done","completed_at":"2026-10-09T12:00:00Z"}'
```

### Uso no Claude Code

Aponte o agente para a base URL e o token (via variáveis de ambiente) e permita
chamadas `curl` na configuração de permissões; comece lendo `/_schema` para
descobrir tabelas e colunas antes de montar as consultas.
