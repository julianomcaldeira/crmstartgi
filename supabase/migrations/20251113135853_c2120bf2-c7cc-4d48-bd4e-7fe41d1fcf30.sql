-- Add tags field to knowledge_base
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create knowledge_base_favorites table
CREATE TABLE IF NOT EXISTS public.knowledge_base_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, knowledge_base_id)
);

-- Enable RLS on favorites
ALTER TABLE public.knowledge_base_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
ON public.knowledge_base_favorites
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own favorites
CREATE POLICY "Users can create own favorites"
ON public.knowledge_base_favorites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
ON public.knowledge_base_favorites
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON knowledge_base_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_knowledge_base_id ON knowledge_base_favorites(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);