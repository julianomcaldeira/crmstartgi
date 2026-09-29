-- Corrige a colisão entre o usuário "pool" da carteira de contas disponíveis e
-- usuários reais, que fazia contas sumirem das carteiras.
--
-- Diagnóstico: tanto a RPC quanto o frontend faziam fallback do usuário pool
-- virtual (carteira@pool.evolua) para o e-mail de uma pessoa real
-- (juliano@startgi.com.br). Com isso, contas reais passam a ser interpretadas
-- como "sem dono", desaparecem da lista do vendedor e têm as oportunidades em
-- aberto repassadas indevidamente.
--
-- Esta migration:
--   1) resolve o usuário pool SOMENTE pelo e-mail virtual (sem fallback real);
--   2) cria trilha de auditoria de ownership (clients não tinha histórico);
--   3) expõe função de diagnóstico para localizar contas órfãs/pool.

-- 1) Recria a RPC sem o fallback para usuário real
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
  -- NÃO usar fallback para e-mail de usuário real: isso faz contas reais serem
  -- normalizadas para "sem dono" e dispara transferência indevida de
  -- oportunidades. Se o usuário pool não existir, _pool_id fica NULL e a
  -- carteira passa a ser representada exclusivamente por created_by IS NULL.
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

  -- Normaliza pool legado (created_by = usuário pool virtual) como NULL
  IF _pool_id IS NOT NULL THEN
    IF _current_owner_id = _pool_id THEN
      _current_owner_id := NULL;
    END IF;
    IF _new_owner_id = _pool_id THEN
      _new_owner_id := NULL;
    END IF;
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

-- 2) Trilha de auditoria de ownership (clients não tinha histórico)
CREATE TABLE IF NOT EXISTS public.client_owner_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_cnpj TEXT,
  client_name TEXT,
  old_owner_id UUID,
  new_owner_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_owner_history_client
  ON public.client_owner_history(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_owner_history_created
  ON public.client_owner_history(created_at DESC);

ALTER TABLE public.client_owner_history ENABLE ROWLS SECURITY;

DROP POLICY IF EXISTS "CRM members can read client owner history" ON public.client_owner_history;
CREATE POLICY "CRM members can read client owner history"
  ON public.client_owner_history FOR SELECT
  TO authenticated
  USING (public.is_crm_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_client_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _pool_id uuid;
BEGIN
  IF OLD.created_by IS NOT DISTINCT FROM NEW.created_by THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _pool_id
  FROM public.profiles
  WHERE email = 'carteira@pool.evolua'
  LIMIT 1;

  INSERT INTO public.client_owner_history (
    client_id, client_cnpj, client_name,
    old_owner_id, new_owner_id, actor_id, action
  )
  VALUES (
    NEW.id,
    NEW.cnpj,
    NEW.company_name,
    OLD.created_by,
    NEW.created_by,
    auth.uid(),
    CASE
      WHEN NEW.created_by IS NULL THEN 'liberado_para_carteira'
      WHEN OLD.created_by IS NULL THEN 'assumido_da_carteira'
      ELSE 'transferido'
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_owner_change ON public.clients;
CREATE TRIGGER trg_log_client_owner_change
  AFTER UPDATE OF created_by ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.log_client_owner_change();

REVOKE ALL ON FUNCTION public.log_client_owner_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_owner_change() TO authenticated, service_role;

-- 3) Diagnóstico: localiza contas por CNPJ e classifica a situação do dono
CREATE OR REPLACE FUNCTION public.diagnose_account_ownership(p_cnpj_digits text DEFAULT NULL)
RETURNS TABLE (
  client_id uuid,
  cnpj text,
  company_name text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  owner_is_deleted boolean,
  open_opportunities bigint,
  classification text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id,
    c.cnpj,
    c.company_name,
    c.created_by,
    p.full_name,
    p.email,
    COALESCE(p.is_deleted, false),
    (
      SELECT count(*)
      FROM public.opportunities o
      WHERE o.client_id = c.id
        AND o.status NOT IN ('won', 'lost')
    ),
    CASE
      WHEN c.created_by IS NULL THEN 'pool_sem_dono'
      WHEN p.id IS NULL THEN 'dono_removido'
      WHEN COALESCE(p.is_deleted, false) THEN 'dono_desativado'
      WHEN NOT public.is_crm_member(p.id) THEN 'dono_sem_perfil_crm'
      WHEN p.email IN ('carteira@pool.evolua', 'juliano@startgi.com.br')
        THEN 'colide_com_pool'
      ELSE 'ok'
    END
  FROM public.clients c
  LEFT JOIN public.profiles p ON p.id = c.created_by
  WHERE
    p_cnpj_digits IS NULL
    OR c.cnpj LIKE '%' || p_cnpj_digits || '%'
  ORDER BY c.company_name;
$$;

REVOKE ALL ON FUNCTION public.diagnose_account_ownership(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.diagnose_account_ownership(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.diagnose_account_ownership(text) TO authenticated, service_role;
