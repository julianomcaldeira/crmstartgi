-- Alinhamento defensivo da liberação de contas para a Carteira de Contas
-- Disponíveis (pool = created_by IS NULL).
--
-- IMPORTANTE — o que esta migration NÃO é:
-- Esta migration não é a correção do bloqueio que impedia o vendedor de
-- liberar a própria conta. Aquele bloqueio era de FRONTEND (botão restrito a
-- admin/gestor/pre_vendas e update em lote direto na tabela) e já foi
-- corrigido no código. Além disso, a RPC transfer_client_owner já autorizava
-- o dono desde a migration 20260929130000.
--
-- Por que este arquivo existe então:
--   1) created_by já é nullable desde 20260831100200 — o ALTER abaixo é
--      idempotente e não muda nada, mas documenta a invariante do pool;
--   2) as policies de UPDATE abaixo passam a aceitar created_by IS NULL.
--      Isso NÃO era o que travava a RPC (SECURITY DEFINER ignora RLS), mas
--      mantinha o update direto em clients restrito a donors ativos. Com a
--      coluna nullable, esse update direto passaria a falhar em WITH CHECK
--      para qualquer writes que não fosse pela RPC;
--   3) a RPC é recriada sem mudança de comportamento em relação à 130000
--      (mesma autorização, mesma propagação de oportunidades em aberto).
--
-- Em resumo: aplicação é segura e idempotente, mas o problema reportado já
-- estava resolvido pelo frontend + pela 20260929130000.

-- 1) Invariante do pool: created_by pode ser NULL (idempotente)
ALTER TABLE public.clients ALTER COLUMN created_by DROP NOT NULL;

-- 2) Policies de UPDATE coerentes com created_by nullable.
DROP POLICY IF EXISTS "Owners can update own clients and transfer to active users" ON public.clients;
CREATE POLICY "Owners can update own clients and transfer to active users"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND public.has_role(auth.uid(), 'vendedor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'vendedor'::public.app_role)
  -- created_by pode virar NULL ao liberar para a carteira; nesse caso não há
  -- "dono ativo" para validar, então aceitamos.
  AND (created_by IS NULL OR public.is_active_profile(created_by))
);

DROP POLICY IF EXISTS "Admins and gestores can update and transfer any client" ON public.clients;
CREATE POLICY "Admins and gestores can update and transfer any client"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'pre_vendas'::public.app_role)
)
WITH CHECK (
  created_by IS NULL OR public.is_active_profile(created_by)
);

-- 3) Recria a RPC sem alterar o comportamento já válido da 130000.
--    O usuário "pool" continua sendo SOMENTE o virtual (carteira@pool.evolua);
--    nunca um usuário real. O dono (vendedor) é autorizado a liberar a si mesmo.
CREATE OR REPLACE FUNCTION public.transfer_client_owner(_client_id uuid, _new_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _current_owner_id uuid;
  _can_manage_all boolean;
  _pool_id uuid;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Pool = usuário virtual da carteira de contas disponíveis.
  -- NÃO usar fallback para e-mail de usuário real.
  SELECT id INTO _pool_id
  FROM public.profiles
  WHERE email = 'carteira@pool.evolua'
  LIMIT 1;

  SELECT c.created_by INTO _current_owner_id
  FROM public.clients c
  WHERE c.id = _client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF _pool_id IS NOT NULL THEN
    IF _current_owner_id = _pool_id THEN
      _current_owner_id := NULL;
    END IF;
    IF _new_owner_id = _pool_id THEN
      _new_owner_id := NULL;
    END IF;
  END IF;

  _can_manage_all :=
    public.has_role(_caller_id, 'admin'::public.app_role)
    OR public.has_role(_caller_id, 'gestor'::public.app_role)
    OR public.has_role(_caller_id, 'pre_vendas'::public.app_role);

  -- Liberar para carteira (novo dono NULL)
  IF _new_owner_id IS NULL THEN
    IF _current_owner_id IS NULL THEN
      RAISE EXCEPTION 'Empresa já está na carteira disponível';
    END IF;

    -- Dono (vendedor) ou gestor/pre_vendas/admin podem liberar.
    IF NOT _can_manage_all AND _current_owner_id <> _caller_id THEN
      RAISE EXCEPTION 'Sem permissão para liberar esta empresa';
    END IF;

    UPDATE public.clients SET created_by = NULL WHERE id = _client_id;

    UPDATE public.opportunities
    SET assigned_to = NULL
    WHERE client_id = _client_id
      AND status NOT IN ('won','lost');

    RETURN FOUND;
  END IF;

  -- Assumir da carteira (dono atual NULL)
  IF _current_owner_id IS NULL THEN
    IF NOT public.is_active_profile(_new_owner_id) THEN
      RAISE EXCEPTION 'O usuário de destino não está ativo';
    END IF;

    IF _new_owner_id <> _caller_id AND NOT _can_manage_all THEN
      RAISE EXCEPTION 'Sem permissão para atribuir a outro usuário';
    END IF;

    UPDATE public.clients SET created_by = _new_owner_id WHERE id = _client_id;

    UPDATE public.opportunities
    SET assigned_to = _new_owner_id
    WHERE client_id = _client_id
      AND status NOT IN ('won','lost')
      AND (assigned_to IS NULL OR assigned_to <> _new_owner_id);

    RETURN FOUND;
  END IF;

  -- Transferência entre usuários
  IF NOT _can_manage_all AND _current_owner_id <> _caller_id THEN
    RAISE EXCEPTION 'Sem permissão para transferir esta empresa';
  END IF;

  IF _current_owner_id = _new_owner_id THEN
    RAISE EXCEPTION 'O novo responsável deve ser diferente do responsável atual';
  END IF;

  IF NOT public.is_active_profile(_new_owner_id) THEN
    RAISE EXCEPTION 'O usuário de destino não está ativo';
  END IF;

  UPDATE public.clients SET created_by = _new_owner_id WHERE id = _client_id;

  UPDATE public.opportunities
  SET assigned_to = _new_owner_id
  WHERE client_id = _client_id
    AND status NOT IN ('won','lost');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO service_role;
