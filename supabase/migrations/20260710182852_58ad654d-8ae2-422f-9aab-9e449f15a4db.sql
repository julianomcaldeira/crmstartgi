CREATE OR REPLACE FUNCTION public.get_active_transfer_users()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE COALESCE(p.is_deleted, false) = false
  ORDER BY p.full_name NULLS LAST
$$;

REVOKE ALL ON FUNCTION public.get_active_transfer_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_transfer_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_transfer_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_transfer_users() TO service_role;