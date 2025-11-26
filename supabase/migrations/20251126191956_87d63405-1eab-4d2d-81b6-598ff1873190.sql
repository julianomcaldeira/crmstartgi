-- Add foreign key constraint for task_history.changed_by
ALTER TABLE task_history 
ADD CONSTRAINT task_history_changed_by_fkey 
FOREIGN KEY (changed_by) 
REFERENCES profiles(id);

-- Update the RLS policy to be more explicit
DROP POLICY IF EXISTS "Users can view task history they have access to" ON task_history;

CREATE POLICY "Users can view task history they have access to"
ON task_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_history.task_id
    AND (
      tasks.assigned_to = auth.uid()
      OR tasks.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
    )
  )
);