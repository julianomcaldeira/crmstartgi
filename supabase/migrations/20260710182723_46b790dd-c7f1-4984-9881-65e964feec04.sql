REVOKE ALL ON FUNCTION public.is_active_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_profile(uuid) TO service_role;