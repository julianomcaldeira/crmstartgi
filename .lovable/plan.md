## Objetivo

Criar um módulo completo de **Contratos StartGi** com:
- Editor de modelos com variáveis (estilo Propostas) — acesso só super admin e pré-vendas.
- Geração de contrato padrão por qualquer vendedor em qualquer fase da oportunidade.
- Envio do contrato por e-mail pelo sistema (aba Emails).
- Fluxo de **negociação de cláusulas** com aprovação do super admin, registro de tudo, notificações por e-mail e geração de Word com a devolutiva.
- Geração e arquivamento da **versão final consolidada**.

---

## Papéis e permissões

- **Super admin** (`juliano@startgi.com.br`): cria/edita modelos, aprova/rejeita cláusulas, vê tudo.
- **Pré-vendas**: cria/edita modelos, vê todos os contratos. (Nova role `pre_vendas` ou reaproveitar role já existente — verificar `user_roles`.)
- **Vendedor**: gera contrato a partir de modelo, envia, abre solicitação de mudança de cláusulas, recebe devolutiva, gera versão final.
- **Gestor**: visualiza tudo, sem editar modelos.

Menu lateral "Contratos" (modelos) → visível só para super admin + pré-vendas.
Botão "Gerar contrato" na oportunidade → visível para qualquer vendedor dono.

---

## Backend (Lovable Cloud)

### Tabelas

1. **`contract_templates`** — modelos de contrato editáveis
   - `name`, `description`, `blocks` (jsonb — mesmo formato dos `proposals.blocks`), `variables` (jsonb), `is_active`, `created_by`, timestamps.
   - RLS: SELECT para todos autenticados (vendedor precisa ler para gerar). INSERT/UPDATE/DELETE só admin + pré-vendas.

2. **`contracts`** — instâncias geradas a partir de um modelo
   - `template_id`, `opportunity_id`, `client_id`, `created_by`, `title`, `blocks` (jsonb — snapshot já com variáveis substituídas), `variables` (jsonb), `status` (`draft` | `sent` | `under_negotiation` | `approved` | `final` | `cancelled`), `version` (int), `parent_contract_id` (para versão final referenciar a inicial), `share_token`, timestamps.
   - RLS: vendedor vê os próprios; admin/pré-vendas/gestor veem todos.

3. **`contract_clause_revisions`** — solicitação de mudança de cláusulas
   - `contract_id`, `requested_by` (vendedor), `prospect_input` (text — texto bruto que o vendedor cola/anexa do prospect), `attachment_url` (opcional, storage), `extracted_changes` (jsonb — IA extrai cláusula → mudança proposta), `status` (`pending_admin_review` | `reviewed` | `final_consolidated`), `submitted_at`, `reviewed_at`, `reviewed_by`.

4. **`contract_clause_decisions`** — decisão cláusula a cláusula do super admin
   - `revision_id`, `clause_reference` (texto/identificador da cláusula), `original_text`, `proposed_change`, `decision` (`accepted` | `rejected` | `counter_proposal`), `admin_comment`, `counter_text` (opcional), timestamps.

5. **`contract_files`** — arquivos gerados (Word de devolutiva, PDF do contrato, contrato final)
   - `contract_id`, `revision_id` (nullable), `kind` (`generated_pdf` | `negotiation_docx` | `final_pdf` | `prospect_attachment`), `file_url`, `file_name`, `created_by`.

6. **Storage bucket `contracts`** (privado) — anexos do prospect, Word de devolutiva, PDFs gerados, contrato final.

### Edge Functions

- **`analyze-contract-changes`** — recebe `revision_id`, lê `prospect_input` (+ texto extraído do anexo), usa Lovable AI (`google/gemini-2.5-pro`) para identificar **cláusula por cláusula** as mudanças solicitadas → grava em `extracted_changes` + cria registros `contract_clause_decisions` (status inicial vazio).
- **`notify-contract-revision`** — dispara e-mails (Resend já em uso) ao submeter revisão (vendedor + super admin + pré-vendas) e ao concluir review (vendedor).
- **`generate-negotiation-docx`** — gera arquivo `.docx` com todas as cláusulas, decisões do admin, comentários e contrapropostas. Faz upload no bucket `contracts`. (Usa biblioteca `docx` em Deno via npm specifier.)
- **`generate-final-contract`** — quando todas as cláusulas estão `accepted` (ou prospect aceitou contrapropostas), aplica os ajustes nos `blocks` e cria novo `contracts` com `status='final'`, `version+1`, `parent_contract_id`. Gera PDF final.
- **`send-contract-email`** — envia o contrato (PDF) ao prospect via Resend; registra envio no histórico de e-mails da oportunidade.

---

## Frontend

### Páginas novas

1. **`/contratos/modelos`** (`ContratoModelos.tsx`) — só admin/pré-vendas.
   - Lista de modelos + criar/editar.
   - Editor reaproveitando `ProposalBuilder` (renomear/abstrair se necessário) com variáveis.

2. **`/contratos`** (`Contratos.tsx`) — lista de contratos gerados.
   - Filtros por status, oportunidade, vendedor.
   - Indicador visual quando há revisão pendente.

3. **`/contratos/:id`** (`ContratoDetalhes.tsx`) — visualização do contrato + abas:
   - **Conteúdo**: visualizador (`ProposalRenderer`).
   - **Revisões**: lista de `clause_revisions`, status, botão "Nova solicitação de revisão" (vendedor).
   - **Aprovação** (admin): cláusula a cláusula, decisão + comentário + contraproposta. Botão "Concluir revisão" → gera Word + envia e-mail.
   - **Versão final**: botão "Gerar contrato final" quando aplicável.
   - **Arquivos**: lista de `contract_files`.

### Componentes

- **`GenerateContractDialog`** — botão "Gerar contrato" na página de Oportunidade (qualquer fase). Escolhe template, preenche variáveis automaticamente (cliente, valor, etc.), cria `contracts` com `status='draft'`.
- **`SendContractEmailDialog`** — usa fluxo Zoho/Resend já existente, anexa PDF.
- **`RequestClauseRevisionDialog`** — vendedor cola texto do prospect e/ou anexa arquivo (PDF/DOCX). Submete → chama `analyze-contract-changes` → mostra preview do que a IA extraiu antes de confirmar.
- **`ClauseReviewPanel`** (admin) — para cada cláusula extraída: aceitar / rejeitar / contraproposta + comentário obrigatório quando rejeitar.
- **`ContractNegotiationTimeline`** — histórico visual de revisões.

### Integrações com Oportunidade

- Em `OpportunityViewDialog` / página de oportunidade: nova aba "Contratos" listando contratos vinculados + botão gerar.
- Em `EmailHistory` / aba Emails da oportunidade: ao enviar contrato, registra mensagem com anexo.

---

## Fluxo end-to-end (resumo)

1. Admin/pré-vendas cria **modelo** com variáveis.
2. Vendedor abre oportunidade → "Gerar contrato" → escolhe modelo → contrato `draft` criado.
3. Vendedor envia contrato por e-mail (sistema registra no histórico).
4. Prospect devolve com pedidos de mudança → vendedor abre **"Solicitar revisão de cláusulas"**, cola texto/anexa arquivo.
5. IA extrai mudanças cláusula por cláusula → vendedor confirma → status `under_negotiation`. E-mail para vendedor + admin + pré-vendas.
6. Super admin abre painel, decide cláusula a cláusula com comentários, conclui revisão.
7. Sistema gera **Word de devolutiva** + envia e-mail ao vendedor com resumo ponto a ponto.
8. Vendedor envia devolutiva ao prospect. Se prospect aceita tudo → vendedor clica **"Gerar contrato final"** → novo contrato `status='final'` consolidando todas as decisões aceitas + contrapropostas aceitas. PDF arquivado em `contract_files`.

---

## Pontos a confirmar com o usuário

1. **Role pré-vendas**: já existe na tabela `user_roles` ou devo criar `pre_vendas` no enum `app_role`?
2. **Anexo do prospect**: aceitar PDF e DOCX? (extração de texto via Lovable AI multimodal ou parser dedicado?)
3. **Contrato final**: deve gerar PDF (como Propostas) ou também Word editável?
4. **Notificação**: usar o template de e-mail do Resend já configurado, ou desenhar visual específico StartGi?
5. **Versionamento**: manter histórico de **todas** as versões intermediárias do contrato, ou só inicial + final?

---

## Fora do escopo (sugestões para depois)

- Assinatura eletrônica (DocuSign/ClickSign).
- Fluxo de aprovação multi-nível (mais de um aprovador).
- Comparação visual diff entre versões.

---

## Arquivos a criar/editar

**SQL**: 1 migração (5 tabelas + RLS + bucket).
**Edge functions**: `analyze-contract-changes`, `notify-contract-revision`, `generate-negotiation-docx`, `generate-final-contract`, `send-contract-email`.
**Frontend**: `src/pages/ContratoModelos.tsx`, `src/pages/Contratos.tsx`, `src/pages/ContratoDetalhes.tsx`, componentes listados acima, novos itens em `App.tsx` e na sidebar (`Layout.tsx`), botão na página de Oportunidades.
