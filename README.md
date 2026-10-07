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
