-- Update delete policy on clients table to allow only admins
DROP POLICY IF EXISTS "Gestores and admins can delete clients" ON public.clients;

CREATE POLICY "Only admins can delete clients"
ON public.clients
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure foreign keys have ON DELETE CASCADE for proper cleanup
-- First, drop existing foreign keys if they exist without CASCADE
ALTER TABLE public.contacts 
DROP CONSTRAINT IF EXISTS contacts_client_id_fkey;

ALTER TABLE public.opportunities 
DROP CONSTRAINT IF EXISTS opportunities_client_id_fkey;

ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;

ALTER TABLE public.opportunity_activities
DROP CONSTRAINT IF EXISTS opportunity_activities_opportunity_id_fkey;

ALTER TABLE public.opportunity_attachments
DROP CONSTRAINT IF EXISTS opportunity_attachments_opportunity_id_fkey;

-- Now add foreign keys with ON DELETE CASCADE
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.opportunities
ADD CONSTRAINT opportunities_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.opportunity_activities
ADD CONSTRAINT opportunity_activities_opportunity_id_fkey
FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;

ALTER TABLE public.opportunity_attachments
ADD CONSTRAINT opportunity_attachments_opportunity_id_fkey
FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;