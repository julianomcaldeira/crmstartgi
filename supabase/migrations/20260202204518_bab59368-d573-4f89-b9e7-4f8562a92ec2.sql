-- Drop the existing SELECT policy and create a new one that includes gestor role
DROP POLICY IF EXISTS "Users can view assigned tasks or created tasks" ON public.tasks;

CREATE POLICY "Users can view assigned tasks or created tasks"
  ON public.tasks
  FOR SELECT
  USING (
    (auth.uid() = assigned_to) OR 
    (auth.uid() = created_by) OR 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'gestor'::app_role)
  );