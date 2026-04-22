
CREATE OR REPLACE FUNCTION public.get_company_goals(_year integer)
RETURNS TABLE (
  id uuid,
  title text,
  goal_type public.goal_type,
  period text,
  target_value numeric,
  start_date date,
  end_date date,
  assigned_to uuid,
  task_type_filter text,
  activity_type_filter text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.title,
    g.goal_type,
    g.period,
    g.target_value,
    g.start_date,
    g.end_date,
    g.assigned_to,
    g.task_type_filter,
    g.activity_type_filter
  FROM public.goals g
  WHERE g.start_date <= make_date(_year, 12, 31)
    AND g.end_date   >= make_date(_year, 1, 1)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = g.assigned_to AND ur.role = 'vendedor'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_company_goals(integer) TO authenticated;
