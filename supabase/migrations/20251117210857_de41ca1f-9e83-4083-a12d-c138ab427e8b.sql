-- Create knowledge base comments table
CREATE TABLE knowledge_base_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE knowledge_base_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view comments"
  ON knowledge_base_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON knowledge_base_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON knowledge_base_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON knowledge_base_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_knowledge_base_comments_kb_id ON knowledge_base_comments(knowledge_base_id);
CREATE INDEX idx_knowledge_base_comments_created_at ON knowledge_base_comments(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_base_comments_updated_at
  BEFORE UPDATE ON knowledge_base_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_base_comments;