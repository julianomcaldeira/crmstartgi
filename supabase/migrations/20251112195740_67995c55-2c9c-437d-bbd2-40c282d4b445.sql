-- Add contact_id column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_contact_id ON public.tasks(contact_id);