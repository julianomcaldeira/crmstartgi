-- Create table to store Zoho OAuth tokens for each user
CREATE TABLE public.zoho_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  zoho_account_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.zoho_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own tokens
CREATE POLICY "Users can view own Zoho tokens"
  ON public.zoho_oauth_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Zoho tokens"
  ON public.zoho_oauth_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Zoho tokens"
  ON public.zoho_oauth_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Zoho tokens"
  ON public.zoho_oauth_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_zoho_oauth_tokens_updated_at
  BEFORE UPDATE ON public.zoho_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();