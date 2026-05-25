-- Fix: Restrict opportunity_activities/attachments/history SELECT to authenticated users
-- Previously these policies applied to the 'public' role (including anon), exposing data
-- to anonymous users who could guess opportunity UUIDs.

DROP POLICY IF EXISTS "Users can view activity logs of opportunities they have access" ON public.opportunity_activities;
CREATE POLICY "Authenticated users can view activity logs of opportunities"
ON public.opportunity_activities
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.id = opportunity_activities.opportunity_id));

DROP POLICY IF EXISTS "Users can view attachments of opportunities they have access to" ON public.opportunity_attachments;
CREATE POLICY "Authenticated users can view attachments of opportunities"
ON public.opportunity_attachments
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.id = opportunity_attachments.opportunity_id));

DROP POLICY IF EXISTS "Users can view opportunity history" ON public.opportunity_history;
CREATE POLICY "Authenticated users can view opportunity history"
ON public.opportunity_history
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.id = opportunity_history.opportunity_id));