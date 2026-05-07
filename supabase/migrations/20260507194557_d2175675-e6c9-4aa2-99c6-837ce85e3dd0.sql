CREATE TABLE IF NOT EXISTS public.email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  signature_html text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signature"
  ON public.email_signatures FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin/Gestor view all signatures"
  ON public.email_signatures FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_email_signatures_updated_at
  BEFORE UPDATE ON public.email_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for email attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own email attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own email attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own email attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);