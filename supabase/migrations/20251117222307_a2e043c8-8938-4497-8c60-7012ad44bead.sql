-- Create table for tracking import progress in real-time
CREATE TABLE IF NOT EXISTS public.import_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed, cancelled
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own import progress
CREATE POLICY "Users can view own import progress"
  ON public.import_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own import progress
CREATE POLICY "Users can insert own import progress"
  ON public.import_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own import progress
CREATE POLICY "Users can update own import progress"
  ON public.import_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_import_progress_updated_at
  BEFORE UPDATE ON public.import_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for import_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_progress;