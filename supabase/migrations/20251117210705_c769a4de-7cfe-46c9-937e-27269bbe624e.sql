-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all knowledge base items" ON knowledge_base;
DROP POLICY IF EXISTS "Users can insert their own knowledge base items" ON knowledge_base;
DROP POLICY IF EXISTS "Users can update their own knowledge base items" ON knowledge_base;
DROP POLICY IF EXISTS "Users can delete their own knowledge base items" ON knowledge_base;

-- Enable RLS on knowledge_base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all knowledge base items
CREATE POLICY "Users can view all knowledge base items"
  ON knowledge_base
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create knowledge base items
CREATE POLICY "Users can insert their own knowledge base items"
  ON knowledge_base
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow authenticated users to update any knowledge base items
CREATE POLICY "Users can update knowledge base items"
  ON knowledge_base
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete any knowledge base items
CREATE POLICY "Users can delete knowledge base items"
  ON knowledge_base
  FOR DELETE
  TO authenticated
  USING (true);