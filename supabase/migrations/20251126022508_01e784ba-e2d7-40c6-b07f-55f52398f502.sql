-- Criar tabela de notas para tarefas
CREATE TABLE IF NOT EXISTS public.task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view notes of tasks they have access to"
  ON public.task_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_notes.task_id
      AND (tasks.assigned_to = auth.uid() OR tasks.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can create notes on tasks they have access to"
  ON public.task_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_notes.task_id
      AND (tasks.assigned_to = auth.uid() OR tasks.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can update their own notes"
  ON public.task_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.task_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_task_notes_updated_at
  BEFORE UPDATE ON public.task_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhor performance
CREATE INDEX idx_task_notes_task_id ON public.task_notes(task_id);
CREATE INDEX idx_task_notes_created_at ON public.task_notes(created_at DESC);