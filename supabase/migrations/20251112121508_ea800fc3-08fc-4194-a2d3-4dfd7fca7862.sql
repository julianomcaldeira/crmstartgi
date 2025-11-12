-- Update RLS policies for clients table to differentiate vendedor and gestor
-- Drop existing policies
DROP POLICY IF EXISTS "Users can update clients they created or admins" ON clients;
DROP POLICY IF EXISTS "Users can create clients" ON clients;

-- Vendedores can only update clients they created
CREATE POLICY "Vendedores can update own clients"
ON clients
FOR UPDATE
USING (
  auth.uid() = created_by 
  AND has_role(auth.uid(), 'vendedor')
);

-- Gestores and admins can update any client
CREATE POLICY "Gestores and admins can update any client"
ON clients
FOR UPDATE
USING (
  has_role(auth.uid(), 'gestor') 
  OR has_role(auth.uid(), 'admin')
);

-- All authenticated users can create clients
CREATE POLICY "Users can create clients"
ON clients
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Update similar policies for opportunities
DROP POLICY IF EXISTS "Users can update assigned opportunities or admins" ON opportunities;

CREATE POLICY "Vendedores can update own opportunities"
ON opportunities
FOR UPDATE
USING (
  (auth.uid() = assigned_to OR auth.uid() = created_by)
  AND has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "Gestores and admins can update any opportunity"
ON opportunities
FOR UPDATE
USING (
  has_role(auth.uid(), 'gestor') 
  OR has_role(auth.uid(), 'admin')
);

-- Update policies for tasks
DROP POLICY IF EXISTS "Users can update assigned tasks" ON tasks;

CREATE POLICY "Vendedores can update own tasks"
ON tasks
FOR UPDATE
USING (
  (auth.uid() = assigned_to OR auth.uid() = created_by)
  AND has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "Gestores and admins can update any task"
ON tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'gestor') 
  OR has_role(auth.uid(), 'admin')
);

-- Update policies for contacts
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;

CREATE POLICY "Vendedores can update own contacts"
ON contacts
FOR UPDATE
USING (
  auth.uid() = created_by
  AND has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "Gestores and admins can update any contact"
ON contacts
FOR UPDATE
USING (
  has_role(auth.uid(), 'gestor') 
  OR has_role(auth.uid(), 'admin')
);

-- Update delete policies to allow gestores
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;

CREATE POLICY "Gestores and admins can delete clients"
ON clients
FOR DELETE
USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores and admins can delete opportunities"
ON opportunities
FOR DELETE
USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores and admins can delete tasks"
ON tasks
FOR DELETE
USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores and admins can delete contacts"
ON contacts
FOR DELETE
USING (has_role(auth.uid(), 'gestor') OR has_role(auth.uid(), 'admin'));