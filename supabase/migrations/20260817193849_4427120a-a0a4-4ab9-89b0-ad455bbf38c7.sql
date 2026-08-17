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
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT c.created_by
  INTO _current_owner_id
  FROM public.clients c
  WHERE c.id = _client_id
  FOR UPDATE;

  IF _current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

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

  UPDATE public.clients
  SET created_by = _new_owner_id
  WHERE id = _client_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_client_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_client_owner(uuid, uuid) TO service_role;