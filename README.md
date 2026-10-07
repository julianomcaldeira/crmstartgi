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

Algumas Edge Functions ainda usam o **Lovable AI Gateway** (`LOVABLE_API_KEY`) e o **e-mail transacional do Lovable**. Ao migrar o backend para uma instância própria (Supabase self-hosted ou serviço equivalente), essas funções precisam apontar para provedores diretos (ex.: OpenAI/Google para IA e Resend/SES/Zoho para e-mail). Isso é tratado na fase de migração do backend.
