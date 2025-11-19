-- Update RLS policies for import_history to allow all authenticated users to see their own imports

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view import history" ON public.import_history;
DROP POLICY IF EXISTS "System can insert import history" ON public.import_history;

-- Allow users to view their own import history
CREATE POLICY "Users can view their own import history"
ON public.import_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to insert their own import history
CREATE POLICY "Users can insert their own import history"
ON public.import_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own import history
CREATE POLICY "Users can update their own import history"
ON public.import_history
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());