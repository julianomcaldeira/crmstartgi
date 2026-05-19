
# Módulo Propostas Comerciais — i-Ganhei

Construção de um novo módulo dentro de **Propostas**, restrito inicialmente ao perfil **Pré-Vendas**, sem afetar o fluxo atual de Propostas (Builder / Renderer existentes continuam intactos).

## 1. Acesso e Navegação

- Nova sub-rota: `/propostas/comerciais` (lista) + `/propostas/comerciais/:id/editar` (editor) + `/propostas/comerciais/admin` (painel admin).
- Página pública já existe (`PropostaPublica`) — será estendida para renderizar o novo template "slide".
- Guard de acesso: apenas usuários com role `pre_vendas` (admin/gestor mantêm visão administrativa). Demais perfis não veem menu nem rota.
- Aba/botão "Propostas Comerciais (Beta)" dentro de `Propostas.tsx`, visível só para Pré-Vendas/Admin/Gestor.

## 2. Banco de Dados (migração)

Reaproveitar tabela `proposals` existente. Adicionar:

- `proposals.template_key text` (ex.: `iganhei_v1`)
- `proposals.sections jsonb` — array ordenado: `[{id, type, enabled, title, content, props}]`
- `proposals.theme jsonb` — cores/tipografia/overrides
- `proposals.tracking jsonb` — `{ga4_id, clarity_id}`
- `proposals.status` — ampliar enum/validação para: `rascunho, em_edicao, enviada, visualizada, em_negociacao, aprovada, reprovada, expirada`

Nova tabela `commercial_proposal_templates`:
- `id, key, name, product, sections jsonb, theme jsonb, is_active, created_by, timestamps`
- Seed: template `iganhei_v1` com as 12 seções obrigatórias.

RLS:
- SELECT/INSERT/UPDATE/DELETE em `proposals` (escopo `template_key like 'iganhei%'`): apenas owners com role `pre_vendas`, ou admin/gestor.
- Templates: leitura para autenticados Pré-Vendas/admin/gestor; escrita só admin.

Eventos de tracking reaproveitam `proposal_events` + função `record_proposal_event` (já cobre `section_view`, `pricing_view`, `cta_click`, `download`). Adicionar tipos `print`, `whatsapp_click`, `email_click`, `end_reached` via metadata (sem alterar enum).

## 3. Componentes (frontend)

```
src/components/proposal/commercial/
  CommercialProposalLayout.tsx     // wrapper slide padronizado (largura, padding, min-h)
  CommercialProposalRenderer.tsx   // monta seções a partir de sections[]
  sections/
    CapaSection.tsx
    TermoSection.tsx
    StartGiSection.tsx
    ContextoSection.tsx
    ObjetivosSection.tsx
    SobreIGanheiSection.tsx
    EstruturaSection.tsx
    BeneficiosSection.tsx
    ImplantacaoSection.tsx
    InvestimentoSection.tsx        // 2 cards premium (sem tabela)
    ValidadeSection.tsx
    ConsideracoesSection.tsx       // foto vendedor 3D + CTAs
  editor/
    CommercialProposalEditor.tsx   // edição inline + reorder + toggle
    SectionEditor.tsx
    ThemeEditor.tsx
    VariablesPanel.tsx
  admin/
    CommercialAdminPanel.tsx       // lista, status, duplicar, excluir, templates
    StatusBadge.tsx
    TemplatesManager.tsx
```

Tokens CSS específicos (em `src/index.css` namespaced `.iganhei-proposal`):
- `--ig-primary #4F5BFF`, `--ig-primary-dark #2434D8`, `--ig-accent #00E68A`, `--ig-bg #FFFFFF`, `--ig-surface #F5F7FA`, `--ig-text #1F2937`, `--ig-muted #6B7280`.
- Largura útil 1080px máx., padding 80px, min-height responsivo, cards `rounded-2xl`, shadow leve.

## 4. Variáveis Dinâmicas

Resolver no momento de abrir editor / renderizar pública a partir de `client_id` + `assigned_to`:

- `empresa_cliente` ← `clients.company_name`
- `logo_cliente` ← `clients.logo_url`
- `nome_vendedor`, `email_vendedor`, `telefone_vendedor`, `foto_vendedor` ← `profiles` do owner
- `data_proposta`, `valor_implantacao`, `valor_mensalidade`, `validade_proposta`, `vigencia_inicial`, `forma_pagamento` ← campos próprios da proposta
- Helper `resolveProposalVariables(proposal)` único, usado pelo editor e pelo Renderer público.
- Estrutura extensível: `variables: { key: { source: 'client'|'profile'|'manual', path, value } }`.

## 5. Tracking (HTML real)

- IDs por seção: `section-capa`, `section-termo`, … (conforme especificado).
- Hook `useProposalTracking(token, ga4Id, clarityId)`:
  - Carrega GA4 e Clarity dinamicamente se IDs presentes.
  - `IntersectionObserver` dispara `section_view` + `gtag('event','section_view',{id})`.
  - Eventos: `proposal_view` (open), `investment_view` (= `pricing_view`), `whatsapp_click`, `email_click`, `proposal_pdf_download`, `proposal_print`, `proposal_end_reached`.
- Continua usando `proposal-track` edge function existente.

## 6. PDF / Impressão

- Botão "Imprimir" → `window.print()` com CSS `@media print` dedicado (page-break antes de cada `.ig-slide`, sem header/sidebar).
- Botão "Baixar PDF" → `html2pdf.js` (já leve) ou `print-to-pdf` via browser; implementação: usar `html2pdf` capturando o container `.iganhei-proposal` página a página.

## 7. Botões e CTAs Fixos

Barra flutuante na proposta pública: WhatsApp, E-mail, Imprimir, Baixar PDF. Disparam eventos correspondentes.

## 8. Admin Painel

Sub-rota `/propostas/comerciais/admin`:
- Tabela com filtros (status, vendedor, cliente).
- Ações: criar, editar, duplicar (`INSERT … SELECT`), excluir (soft via status `arquivada` futuramente — por ora hard delete só do owner/admin), mudar status, copiar link (`/p/:token`).
- Aba "Templates": listar/duplicar/editar `commercial_proposal_templates`.
- Aba "Analytics": reaproveita `PropostaInsights` filtrado.

## 9. Status Badges

Componente `StatusBadge` com mapa de cores conforme spec (amarelo/verde/azul/roxo/laranja/vermelho/cinza/cinza-claro).

## 10. Entregáveis Técnicos

- 1 migração SQL (colunas + tabela templates + RLS + seed iganhei_v1).
- ~25 arquivos novos em `src/components/proposal/commercial/**` e `src/pages/PropostasComerciais*.tsx`.
- Atualizações: `App.tsx` (rotas), `Layout.tsx` (link condicional), `PropostaPublica.tsx` (detecta `template_key` e usa Renderer novo).
- Sem alterações destrutivas no fluxo Builder/Renderer atual.

## Fora do escopo desta entrega

- Liberação para outros perfis (arquitetura preparada, mas chave fica fechada).
- Editor visual avançado de cores por seção (Theme global apenas; overrides por seção ficam no schema, UI vem depois).
- Assinatura eletrônica.
