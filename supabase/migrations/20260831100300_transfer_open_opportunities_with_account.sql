-- Quando a conta (clients) muda de dono, transfere também as oportunidades em aberto
-- 1) Permite assigned_to ficar sem dono quando vai para carteira (pool = NULL)
ALTER TABLE public.opportunities ALTER COLUMN assigned_to DROP NOT NULL;

-- 2) Atualiza a função de transferência para propagar para oportunidades abertas
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

  -- Busca id do usuário pool para compatibilidade com liberações antigas via poolUserId
  SELECT id INTO _pool_id FROM public.profiles WHERE email IN ('carteira@pool.evolua', 'juliano@startgi.com.br') ORDER BY CASE WHEN email='carteira@pool.evolua' THEN 1 ELSE 2 END LIMIT 1;

  SELECT c.created_by INTO _current_owner_id FROM public.clients c WHERE c.id = _client_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Normaliza pool antigo (poolUserId) como NULL para lógica de carteira
  IF _current_owner_id = _pool_id THEN
    _current_owner_id := NULL;
  END IF;
  IF _new_owner_id = _pool_id THEN
    _new_owner_id := NULL;
  END IF;

  -- Liberar para carteira (novo dono NULL)
  IF _new_owner_id IS NULL THEN
    _can_manage_all :=
      public.has_role(_caller_id, 'admin'::public.app_role)
      OR public.has_role(_caller_id, 'gestor'::public.app_role)
      OR public.has_role(_caller_id, 'pre_vendas'::public.app_role);

    IF _current_owner_id IS NULL THEN
      RAISE EXCEPTION 'Empresa já está na carteira disponível';
    END IF;

    IF NOT _can_manage_all AND _current_owner_id <> _caller_id THEN
      RAISE EXCEPTION 'Sem permissão para liberar esta empresa';
    END IF;

    UPDATE public.clients SET created_by = NULL WHERE id = _client_id;

    -- Transfere oportunidades em aberto para carteira (ficam sem responsável)
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

    _can_manage_all :=
      public.has_role(_caller_id, 'admin'::public.app_role)
      OR public.has_role(_caller_id, 'gestor'::public.app_role)
      OR public.has_role(_caller_id, 'pre_vendas'::public.app_role);

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

  -- Transferência normal entre usuários
  _can_manage_all :=
    public.has_role(_caller_id, 'admin'::public.app_role)
    OR public.has_role(_caller_id, 'gestor'::public.app_role)
    OR public.has_role(_caller_id, 'pre_vendas'::public.app_role);

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

-- 3) Ajusta RLS para permitir assigned_to NULL na carteira
DROP POLICY IF EXISTS "Pool opportunities can be claimed" ON public.opportunities;
CREATE POLICY "Pool opportunities can be claimed"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (assigned_to IS NULL)
  WITH CHECK (assigned_to = auth.uid() AND public.is_crm_member(auth.uid()));
