-- Permite que admin renomeie o nome de exibição (carteira) de qualquer usuário
-- via RPC (POST), como alternativa ao UPDATE direto caso o PATCH seja
-- bloqueado por firewall/rede no cliente.

CREATE OR REPLACE FUNCTION public.admin_rename_profile(_user_id uuid, _new_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.has_role(_caller_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem renomear carteiras';
  END IF;

  IF _new_name IS NULL OR length(trim(_new_name)) = 0 THEN
    RAISE EXCEPTION 'Novo nome não pode ser vazio';
  END IF;

  UPDATE public.profiles
  SET full_name = trim(_new_name),
      updated_at = NOW()
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rename_profile(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rename_profile(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rename_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rename_profile(uuid, text) TO service_role;
