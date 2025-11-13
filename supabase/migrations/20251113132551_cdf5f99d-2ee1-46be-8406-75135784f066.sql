-- Add missing foreign keys and make them deferrable to avoid trigger conflicts
-- Also add foreign key between knowledge_base and profiles

-- First, add foreign key from knowledge_base to profiles
ALTER TABLE public.knowledge_base
DROP CONSTRAINT IF EXISTS knowledge_base_created_by_fkey;

ALTER TABLE public.knowledge_base
ADD CONSTRAINT knowledge_base_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.knowledge_base
DROP CONSTRAINT IF EXISTS knowledge_base_updated_by_fkey;

ALTER TABLE public.knowledge_base
ADD CONSTRAINT knowledge_base_updated_by_fkey
FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

-- Now fix the knowledge_base_history foreign key to be deferrable
-- This allows the trigger to insert history records without immediate FK validation
ALTER TABLE public.knowledge_base_history
DROP CONSTRAINT IF EXISTS knowledge_base_history_knowledge_base_id_fkey;

ALTER TABLE public.knowledge_base_history
ADD CONSTRAINT knowledge_base_history_knowledge_base_id_fkey
FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Also add foreign key from knowledge_base_history to profiles
ALTER TABLE public.knowledge_base_history
DROP CONSTRAINT IF EXISTS knowledge_base_history_changed_by_fkey;

ALTER TABLE public.knowledge_base_history
ADD CONSTRAINT knowledge_base_history_changed_by_fkey
FOREIGN KEY (changed_by) REFERENCES public.profiles(id);