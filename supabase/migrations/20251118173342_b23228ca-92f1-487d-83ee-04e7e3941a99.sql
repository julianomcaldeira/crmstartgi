-- Atualizar política RLS para permitir vendedores deletarem suas próprias tarefas
DROP POLICY IF EXISTS "Gestores and admins can delete tasks" ON tasks;

-- Nova política: Admins e gestores podem deletar qualquer tarefa
CREATE POLICY "Admins and gestores can delete any task"
ON tasks
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gestor'::app_role)
);

-- Nova política: Vendedores podem deletar suas próprias tarefas
CREATE POLICY "Vendedores can delete own tasks"
ON tasks
FOR DELETE
TO authenticated
USING (
  (auth.uid() = assigned_to OR auth.uid() = created_by) AND
  has_role(auth.uid(), 'vendedor'::app_role)
);