-- Permite carteira de contas disponíveis (pool)
-- 1) Torna created_by nullable para representar pool
ALTER TABLE public.clients ALTER COLUMN created_by DROP NOT NULL;

-- 2) Atualiza RPC para suportar transferência para pool (NULL) e assumir do pool
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
  _exists boolean;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT c.created_by
  INTO _current_owner_id
  FROM public.clients c
  WHERE c.id = _client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Caso especial: liberar para carteira (novo dono NULL)
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
    RETURN FOUND;
  END IF;

  -- Caso especial: assumir da carteira (dono atual NULL)
  IF _current_owner_id IS NULL THEN
    IF NOT public.is_active_profile(_new_owner_id) THEN
      RAISE EXCEPTION 'O usuário de destino não está ativo';
    END IF;

    _can_manage_all :=
      public.has_role(_caller_id, 'admin'::public.app_role)
      OR public.has_role(_caller_id, 'gestor'::public.app_role)
      OR public.has_role(_caller_id, 'pre_vendas'::public.app_role);

    -- Se não é gestor/admin, só pode assumir para si mesmo
    IF _new_owner_id <> _caller_id AND NOT _can_manage_all THEN
      RAISE EXCEPTION 'Sem permissão para atribuir a outro usuário';
    END IF;

    UPDATE public.clients SET created_by = _new_owner_id WHERE id = _client_id;
    RETURN FOUND;
  END IF;

  -- Fluxo normal: transferência entre usuários
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
  RETURN FOUND;
END;
$$;

-- Garante permissões
REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO service_role;

-- 3) Permite visualização de pool para todos os membros CRM (já existe via is_crm_member, mas garante NULL visível)
-- Não é necessário alterar SELECT, mas garante que UPDATE via RLS não bloqueie pool se usado sem RPC
DROP POLICY IF EXISTS "Pool members can claim available accounts" ON public.clients;
CREATE POLICY "Pool members can claim available accounts"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (created_by IS NULL)
  WITH CHECK (created_by = auth.uid() AND public.is_crm_member(auth.uid()));
