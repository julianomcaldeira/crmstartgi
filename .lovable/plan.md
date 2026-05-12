## Objetivo

Permitir que **qualquer vendedor** solicite a transferência de um prospect que pertence a outro vendedor. O **dono atual** recebe a solicitação e pode **aprovar** (a posse muda automaticamente) ou **recusar**. Admin e gestor mantêm o poder de transferir direto, como hoje.

## Backend

### 1. Nova tabela `prospect_transfer_requests`

Campos de domínio:
- `client_id` (uuid) — prospect solicitado
- `requester_id` (uuid) — vendedor que está pedindo
- `owner_id` (uuid) — vendedor dono no momento do pedido (snapshot)
- `status` (text: `pending` | `approved` | `rejected` | `cancelled`)
- `request_message` (text) — justificativa do solicitante (opcional)
- `response_message` (text) — motivo da resposta do dono (opcional)
- `responded_at` (timestamptz)
- `responded_by` (uuid)

Índice único parcial: um único pedido `pending` por (`client_id`, `requester_id`) para evitar spam.

### 2. RLS

- **INSERT**: vendedor autenticado pode criar pedido onde `requester_id = auth.uid()`, desde que o prospect exista, ele **não seja** o dono atual e ainda não exista pedido `pending` dele para esse prospect.
- **SELECT**: visíveis para `requester_id`, `owner_id`, admin e gestor.
- **UPDATE**: apenas o `owner_id` (ou admin/gestor) pode mudar `status` de `pending` para `approved`/`rejected`. O `requester_id` pode mudar `pending` para `cancelled`.
- **DELETE**: apenas admin.

### 3. Trigger / função SECURITY DEFINER

Quando `status` muda para `approved`:
- Verifica se quem aprovou é realmente o `owner_id` atual do prospect (defesa contra disputa).
- Atualiza `clients.created_by = requester_id`.
- Marca outros pedidos `pending` do mesmo prospect como `cancelled` automaticamente.
- Grava `responded_at = now()` e `responded_by = auth.uid()`.

Função SECURITY DEFINER necessária porque o `requester_id` (novo dono) não tem permissão de UPDATE direto em `clients` pelas policies atuais — e queremos manter assim.

### 4. Reverter policy criada por engano

Remover a policy `Eduardo and Thiago can transfer any client` da tabela `clients` (foi adicionada na interpretação errada anterior).

## Frontend

### 1. Botão na lista/card de prospect (`src/pages/Prospects.tsx`)

- Se `canEditClient(client)` → mostra botão **"Transferir prospect"** (atual, inalterado).
- Senão, se usuário é vendedor e `client.created_by` é outro vendedor → mostra botão **"Solicitar transferência"** (ícone `UserPlus` / `HandshakeIcon`).
  - Se já existe pedido `pending` desse vendedor para esse prospect, troca para badge **"Solicitação pendente"** (desabilita botão).

### 2. Diálogo "Solicitar transferência"

- Mostra dono atual.
- Campo opcional `request_message` (textarea, motivo).
- Botão **Enviar solicitação** → insere em `prospect_transfer_requests`.
- Toast de sucesso explicando que o dono precisa aprovar.

### 3. Painel "Solicitações de transferência" para o dono

Novo componente `TransferRequestsPanel` exibido:
- Como aba/seção em **Prospects** (badge com contador no topo da página).
- Opcionalmente também como item no `NotificationSystem` existente (futuro).

Cada item: prospect (company_name), solicitante, mensagem, data. Botões **Aprovar** e **Recusar** (com diálogo de confirmação e campo opcional de `response_message`).

### 4. Histórico para o solicitante

Mesmo painel, aba **"Minhas solicitações"**, mostrando status (pending/approved/rejected/cancelled) e mensagens. Permite **cancelar** se ainda `pending`.

## Detalhes técnicos

- Realtime (opcional): assinar `prospect_transfer_requests` para atualizar contador em tempo real. Adicionar tabela ao publication `supabase_realtime`.
- Reaproveitar `useQueries.ts` com novo hook `useTransferRequests(userId)`.
- Usar `parseDateOnly` não se aplica aqui — datas são timestamps, `new Date()` funciona.
- Toast: `sonner` já em uso.

## Fora de escopo

- Notificação por e-mail (pode entrar depois, usando o padrão Resend já existente).
- Bulk transfer requests.
- Aprovação automática por regra de negócio.

## Arquivos a criar/editar

- Migração SQL (nova tabela + RLS + função/trigger + remoção da policy errada).
- `src/pages/Prospects.tsx` — botão condicional + integração do painel.
- `src/components/TransferRequestsPanel.tsx` — novo.
- `src/components/RequestTransferDialog.tsx` — novo.
- `src/hooks/useQueries.ts` — hook de pedidos.
