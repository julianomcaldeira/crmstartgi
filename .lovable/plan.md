# Propostas Inteligentes — Plano de Implementação

## O que já existe hoje
- Tabela `proposals` com `share_token` UUID (não sequencial), `view_count`, `viewed_at`, `pdf_url`, `status`.
- Página pública `/p/:token` chama `register_proposal_view` (incrementa contagem).
- Builder + Renderer dinâmico (sem PDF obrigatório).
- RLS por dono/admin/gestor.

## Lacunas vs. especificação
- Sem registro por evento (apenas contador agregado).
- Sem identificação de visitante único.
- Sem geo/IP/dispositivo, tempo de leitura por seção.
- Sem versionamento, recipients, scoring, alertas, dashboard de analytics.
- Página pública sem NOINDEX.
- Token sem expiração opcional.

## Fase 1 — Núcleo de Tracking + Privacidade (ENTREGAR PRIMEIRO)

### Banco
- `proposal_events` — `id, proposal_id, visitor_id (uuid), event_type ('open'|'section_view'|'cta_click'|'download'|'share'|'pricing_view'), section_id?, metadata jsonb, ip inet, user_agent, country, city, device, browser, duration_ms, created_at`.
- `proposal_views` — uma linha por (proposal_id, visitor_id) com `first_view_at, last_view_at, total_time_ms, view_count`.
- `proposals`: novas colunas `expires_at timestamptz?`, `is_locked boolean default false`, `version int default 1`, `engagement_score int default 0`, `unique_visitors int default 0`, `total_time_ms bigint default 0`.
- RLS: leitura de eventos só dono/admin; insert via Edge Function (anon).

### Edge Function `proposal-track` (verify_jwt = false)
- POST `{ token, visitor_id, event_type, section_id?, duration_ms?, metadata? }`.
- Resolve `proposal_id` por token; valida `expires_at`; grava em `proposal_events`; faz upsert em `proposal_views`; recalcula `unique_visitors`, `total_time_ms`, `engagement_score` na proposta.
- Captura IP via header `x-forwarded-for`, UA, geolocaliza via API gratuita (ipapi.co) com timeout/cache.

### Frontend público (`PropostaPublica`)
- Adiciona `<meta name="robots" content="noindex,nofollow">` via Helmet.
- Gera/persistente `visitor_id` em `localStorage`.
- Registra `open` no mount; `section_view` via IntersectionObserver por seção (`<section>` recebe `data-section-id`); `cta_click` em links/botões; heartbeat de tempo a cada 15s (acumula `duration_ms`).
- Detecta visualização da seção `pricing` para enviar `pricing_view`.

### Scoring (server-side)
- abriu: +10; >3 acessos: +20; tempo>5min: +30; pricing_view: +40.
- Classificação derivada: <30 frio, 30–60 morno, >60 quente.

## Fase 2 — Dashboard da Proposta + Alertas
- Nova rota `/propostas/:id/insights` (vendedor/admin) com:
  - Status, score, classificação (badge frio/morno/quente).
  - Aberturas, visitantes únicos, tempo total, última atividade.
  - Tabela de eventos com filtro por tipo.
  - Top seções visualizadas (gráfico de barras).
- Trigger no `proposal_events INSERT`: cria `notifications` para o vendedor em eventos chave (`open` na 1ª vez, `pricing_view`, `share`, `>3 reaberturas`). Reaproveita `NotificationSystem` existente.
- Toast em tempo real via canal Realtime na página de propostas.

## Fase 3 — Versionamento + Recipients + Trava
- `proposal_versions` — snapshot completo (`blocks`, `variables`, `total_value`) cada vez que a proposta passa de `draft`→`sent` ou via botão "Publicar nova versão". Mostra timeline de versões na proposta.
- `proposal_recipients` — `proposal_id, name, email, phone, role`. Permite múltiplos destinatários e marca em qual recipient a abertura aconteceu (via `?r=<id>` no link).
- Trava: ao enviar, `is_locked=true` impede edição; "Nova versão" cria v(N+1) em rascunho.

## Fase 4 (futuro, fora deste plano) — Assinatura, comentários, IA, heatmap, follow-up automático.

---

## Decisões técnicas
- Geolocalização: ipapi.co (sem chave, ~1k req/dia grátis) + cache em memória por IP por 1h. Se exceder, grava só país via `cf-ipcountry` (Cloudflare/Supabase). Sem rate-limit no backend (política do projeto).
- Visitor ID: UUID v4 em `localStorage` chave `evolua_pid`.
- Heartbeat: usar `navigator.sendBeacon` para não perder o último intervalo.
- NOINDEX via `react-helmet-async` (instalar — ainda não está no projeto).
- Edge Function única `proposal-track` recebe lote (`events: []`) para reduzir chamadas.

## Segurança / RLS
- `proposal_events` e `proposal_views`: SELECT apenas dono da proposta + admin/gestor; INSERT bloqueado para anon (só Edge Function via service role).
- Token mantém UUID v4. `expires_at` validado no `get_proposal_by_token` e na função de tracking.

## Perguntas antes de começar
1. Quero começar pela **Fase 1** (tracking, NOINDEX, expiração) e ir validando, ou prefere prosseguir até a Fase 3 sem pausar?
2. Notificação de abertura por **e-mail** (Resend) também, ou só sino interno?
3. Versionamento agora ou pode ficar para uma segunda iteração?