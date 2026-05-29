-- Restrict radar_leads and radar_sync_history INSERT to authenticated role
-- (edge functions use service_role which bypasses RLS, so this is safe)
DROP POLICY IF EXISTS "Sistema pode inserir leads" ON public.radar_leads;
CREATE POLICY "Authenticated pode inserir leads"
ON public.radar_leads
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.radar_sync_history;
CREATE POLICY "Authenticated pode inserir histórico"
ON public.radar_sync_history
FOR INSERT
TO authenticated
WITH CHECK (true);