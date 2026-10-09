-- Discovery endpoint for the integration API (supabase/functions/api).
-- Returns the public tables, their columns and relationships so external
-- clients (e.g. Claude Code) can introspect the CRM before running queries.
-- Only the service role (used by the api edge function) may execute it.

create or replace function public.api_schema()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(tbl order by tbl->>'table'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'table', c.table_name,
      'primary_key', coalesce((
        select jsonb_agg(kcu.column_name order by kcu.ordinal_position)
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
        where tc.constraint_type = 'PRIMARY KEY'
          and tc.table_schema = 'public'
          and tc.table_name = c.table_name
      ), '[]'::jsonb),
      'columns', jsonb_agg(jsonb_build_object(
        'name', c.column_name,
        'type', c.data_type,
        'nullable', (c.is_nullable = 'YES'),
        'default', c.column_default
      ) order by c.ordinal_position),
      'foreign_keys', coalesce((
        select jsonb_agg(jsonb_build_object(
          'column', kcu.column_name,
          'references_table', ccu.table_name,
          'references_column', ccu.column_name
        ))
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
         and ccu.table_schema = tc.table_schema
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and tc.table_name = c.table_name
      ), '[]'::jsonb)
    ) as tbl
    from information_schema.columns c
    where c.table_schema = 'public'
    group by c.table_name
  ) s;
$$;

revoke all on function public.api_schema() from public;
grant execute on function public.api_schema() to service_role;
