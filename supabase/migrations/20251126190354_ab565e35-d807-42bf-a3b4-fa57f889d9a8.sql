-- Create task history/audit table
CREATE TABLE IF NOT EXISTS public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  change_type TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view task history they have access to"
  ON public.task_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_history.task_id
      AND (tasks.assigned_to = auth.uid() OR tasks.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
    )
  );

CREATE POLICY "System can insert task history"
  ON public.task_history
  FOR INSERT
  WITH CHECK (true);

-- Create function to log task changes
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only log if there are actual changes to important fields
    IF (OLD.title IS DISTINCT FROM NEW.title OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.task_type IS DISTINCT FROM NEW.task_type OR
        OLD.due_date IS DISTINCT FROM NEW.due_date OR
        OLD.priority IS DISTINCT FROM NEW.priority OR
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      
      INSERT INTO public.task_history (
        task_id,
        changed_by,
        change_type,
        old_data,
        new_data
      ) VALUES (
        NEW.id,
        COALESCE(auth.uid(), NEW.created_by),
        'UPDATE',
        jsonb_build_object(
          'title', OLD.title,
          'description', OLD.description,
          'task_type', OLD.task_type,
          'due_date', OLD.due_date,
          'priority', OLD.priority,
          'status', OLD.status,
          'assigned_to', OLD.assigned_to
        ),
        jsonb_build_object(
          'title', NEW.title,
          'description', NEW.description,
          'task_type', NEW.task_type,
          'due_date', NEW.due_date,
          'priority', NEW.priority,
          'status', NEW.status,
          'assigned_to', NEW.assigned_to
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger for task updates
DROP TRIGGER IF EXISTS task_changes_trigger ON public.tasks;
CREATE TRIGGER task_changes_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_changes();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_changed_at ON public.task_history(changed_at DESC);