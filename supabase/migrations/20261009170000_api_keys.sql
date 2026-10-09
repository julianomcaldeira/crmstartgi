-- API keys managed by admins inside the CRM (Admin → API tab).
--
-- The plaintext key is generated in the browser and shown to the admin only
-- once; only its SHA-256 hash is stored here. The `api` edge function validates
-- incoming bearer tokens against this table (service role).

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys (key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admins may read the list; writes happen only through the RPCs below.
DROP POLICY IF EXISTS "Admins can view api keys" ON public.api_keys;
CREATE POLICY "Admins can view api keys"
  ON public.api_keys FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Store a new key (receives only the hash + a display prefix).
CREATE OR REPLACE FUNCTION public.create_api_key(
  p_name text,
  p_key_prefix text,
  p_key_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _row public.api_keys;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar chaves de API';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Informe um nome para a chave';
  END IF;
  IF p_key_hash IS NULL OR length(p_key_hash) < 32 THEN
    RAISE EXCEPTION 'Hash de chave inválido';
  END IF;

  INSERT INTO public.api_keys (name, key_prefix, key_hash, created_by)
  VALUES (trim(p_name), p_key_prefix, lower(p_key_hash), _caller)
  RETURNING * INTO _row;

  RETURN jsonb_build_object(
    'id', _row.id,
    'name', _row.name,
    'key_prefix', _row.key_prefix,
    'created_at', _row.created_at
  );
END;
$$;

-- List keys without ever exposing the hash.
CREATE OR REPLACE FUNCTION public.list_api_keys()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver chaves de API';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', k.id,
      'name', k.name,
      'key_prefix', k.key_prefix,
      'created_at', k.created_at,
      'last_used_at', k.last_used_at,
      'revoked_at', k.revoked_at
    ) ORDER BY k.created_at DESC)
    FROM public.api_keys k
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF NOT public.has_role(_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem revogar chaves de API';
  END IF;

  UPDATE public.api_keys SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.create_api_key(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_api_keys() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_api_key(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_api_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_key(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_api_keys() TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO service_role;
