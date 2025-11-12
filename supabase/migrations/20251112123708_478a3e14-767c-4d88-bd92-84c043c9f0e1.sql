-- Create enum for task types
CREATE TYPE task_type AS ENUM ('ligacao', 'email', 'whatsapp', 'visita_presencial', 'reuniao_online', 'visita_feira', 'visita_evento');

-- Add task_type column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN task_type task_type DEFAULT 'ligacao';