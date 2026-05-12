
-- 1. Reverter policy criada por engano
DROP POLICY IF EXISTS "Eduardo and Thiago can transfer any client" ON public.clients;

-- 2. Tabela de solicitações
CREATE TABLE public.prospect_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  request_message text,
  response_message text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_transfer_requests_status_check
    CHECK (status IN ('pending','approved','rejected','cancelled'))
);

CREATE INDEX idx_ptr_client ON public.prospect_transfer_requests(client_id);
CREATE INDEX idx_ptr_requester ON public.prospect_transfer_requests(requester_id);
CREATE INDEX idx_ptr_owner ON public.prospect_transfer_requests(owner_id);
CREATE INDEX idx_ptr_status ON public.prospect_transfer_requests(status);

-- Único pedido pendente por (cliente, solicitante)
CREATE UNIQUE INDEX idx_ptr_unique_pending
  ON public.prospect_transfer_requests(client_id, requester_id)
  WHERE status = 'pending';

-- Trigger updated_at
CREATE TRIGGER trg_ptr_updated_at
BEFORE UPDATE ON public.prospect_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS
ALTER TABLE public.prospect_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own transfer requests"
ON public.prospect_transfer_requests
FOR SELECT TO authenticated
USING (
  auth.uid() = requester_id
  OR auth.uid() = owner_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Vendedores can create own requests"
ON public.prospect_transfer_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = requester_id
  AND requester_id <> owner_id
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_id AND c.created_by = owner_id
  )
);

-- Owner aprova/recusa, requester cancela
CREATE POLICY "Owner or admin can respond"
ON public.prospect_transfer_requests
FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
)
WITH CHECK (
  auth.uid() = owner_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Requester can cancel own pending"
ON public.prospect_transfer_requests
FOR UPDATE TO authenticated
USING (auth.uid() = requester_id AND status = 'pending')
WITH CHECK (auth.uid() = requester_id AND status IN ('pending','cancelled'));

CREATE POLICY "Admins can delete requests"
ON public.prospect_transfer_requests
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Trigger SECURITY DEFINER: ao aprovar, transfere o cliente
CREATE OR REPLACE FUNCTION public.process_prospect_transfer_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner uuid;
BEGIN
  -- Só age quando muda de pending para approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Confirma que o dono atual ainda é o owner_id do pedido
    SELECT created_by INTO v_current_owner FROM public.clients WHERE id = NEW.client_id;
    IF v_current_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'O prospect já não pertence mais ao dono original deste pedido.';
    END IF;

    -- Confirma que quem aprovou é o owner ou admin/gestor
    IF NOT (
      auth.uid() = NEW.owner_id
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    ) THEN
      RAISE EXCEPTION 'Apenas o dono do prospect pode aprovar a transferência.';
    END IF;

    -- Transfere o prospect
    UPDATE public.clients
    SET created_by = NEW.requester_id,
        updated_at = now()
    WHERE id = NEW.client_id;

    -- Cancela outros pedidos pendentes do mesmo prospect
    UPDATE public.prospect_transfer_requests
    SET status = 'cancelled',
        response_message = COALESCE(response_message, 'Cancelado automaticamente: outro pedido foi aprovado.'),
        responded_at = now(),
        responded_by = auth.uid()
    WHERE client_id = NEW.client_id
      AND id <> NEW.id
      AND status = 'pending';

    NEW.responded_at := now();
    NEW.responded_by := auth.uid();
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.responded_at := COALESCE(NEW.responded_at, now());
    NEW.responded_by := COALESCE(NEW.responded_by, auth.uid());
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    NEW.responded_at := COALESCE(NEW.responded_at, now());
    NEW.responded_by := COALESCE(NEW.responded_by, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_prospect_transfer_approval
BEFORE UPDATE ON public.prospect_transfer_requests
FOR EACH ROW EXECUTE FUNCTION public.process_prospect_transfer_approval();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_transfer_requests;
