
-- 1. Restrict profiles SELECT: only owner, admin, gestor can see full profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- Create a safe public view exposing only non-sensitive fields (id, full_name, avatar_url)
-- so the app can still display names/avatars of other users (e.g. assigned_to columns).
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT id, full_name, avatar_url
FROM public.profiles
WHERE COALESCE(is_deleted, false) = false;

GRANT SELECT ON public.profiles_public TO authenticated;

-- 2. Tighten client_feiras: require authentication (drop public role policy)
DROP POLICY IF EXISTS "Users can view all client-feira links" ON public.client_feiras;

CREATE POLICY "Authenticated can view client-feira links"
ON public.client_feiras
FOR SELECT
TO authenticated
USING (true);

-- 3. Realtime channel-level authorization
-- Restrict realtime.messages so a user can only subscribe to their own per-user topics.
-- Topic conventions used in this app:
--   import_progress_<sessionId>  -> session is per-user; we additionally require the user to own a row in import_progress for that session
--   user-alerts-<auth.uid()>     -> per-user alert channels
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own realtime channels" ON realtime.messages;
CREATE POLICY "Authenticated can read own realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- per-user alert topic
  realtime.topic() = 'user-alerts-' || auth.uid()::text
  -- per-user import progress topics: any session_id owned by this user
  OR EXISTS (
    SELECT 1 FROM public.import_progress ip
    WHERE realtime.topic() = 'import_progress_' || ip.session_id
      AND ip.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated can send to own realtime channels" ON realtime.messages;
CREATE POLICY "Authenticated can send to own realtime channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'user-alerts-' || auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.import_progress ip
    WHERE realtime.topic() = 'import_progress_' || ip.session_id
      AND ip.user_id = auth.uid()
  )
);
