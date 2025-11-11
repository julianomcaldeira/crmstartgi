-- Add new fields to clients table
ALTER TABLE public.clients
ADD COLUMN segment TEXT,
ADD COLUMN share_capital DECIMAL(15, 2),
ADD COLUMN legal_nature TEXT,
ADD COLUMN registration_status TEXT,
ADD COLUMN foundation_date DATE;

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Users can view all contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_contacts_client ON public.contacts(client_id);
CREATE INDEX idx_contacts_primary ON public.contacts(is_primary);

-- Add updated_at trigger for contacts
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();