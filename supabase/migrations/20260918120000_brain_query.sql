-- Brain: função de consulta somente-leitura usada pelo agente de IA "Brain".
-- Roda com SECURITY INVOKER, portanto as políticas de RLS do usuário autenticado
-- são aplicadas automaticamente a todas as consultas.

CREATE OR REPLACE FUNCTION public.brain_query(p_sql TEXT, p_max_rows INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = 'pg_catalog, information_schema'
AS $$
DECLARE
  v_sql TEXT;
  v_max INTEGER;
  v_result JSON;
BEGIN
  v_sql := NULLIF(TRIM(p_sql), '');
  IF v_sql IS NULL THEN
    RAISE EXCEPTION 'SQL vazio';
  END IF;

  -- Remove um único ponto-e-vírgula final, se houver
  IF RIGHT(v_sql, 1) = ';' THEN
    v_sql := RTRIM(LEFT(v_sql, LENGTH(v_sql) - 1));
  END IF;

  -- Apenas SELECT (ou CTE iniciada por WITH terminando em SELECT) é permitido
  IF LOWER(LEFT(v_sql, 6)) <> 'select' AND LOWER(LEFT(v_sql, 4)) <> 'with' THEN
    RAISE EXCEPTION 'Somente consultas SELECT são permitidas';
  END IF;

  -- Bloqueia múltiplas instruções
  IF POSITION(';' IN v_sql) > 0 THEN
    RAISE EXCEPTION 'Múltiplas instruções não são permitidas';
  END IF;

  -- Bloqueia comandos de escrita, administrativos e perigosos
  IF v_sql ~* '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|refresh|reindex|cluster|comment|declare|commit|rollback|begin|savepoint|pg_sleep|pg_read_file|pg_read_binary_file|pg_write_file|pg_ls_dir|lo_import|lo_export|dblink|set_config)\M' THEN
    RAISE EXCEPTION 'Comando proibido';
  END IF;

  v_max := GREATEST(1, LEAST(COALESCE(p_max_rows, 30), 100));

  -- Executa a consulta tratada como subquery, limitando o número de linhas e
  -- agregando o resultado em um JSON.
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (SELECT * FROM (%s) _q LIMIT %s) t',
    v_sql,
    v_max
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.brain_query(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brain_query(TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.brain_query(TEXT, INTEGER) IS
  'Executa uma consulta SELECT somente-leitura (respeitando RLS do usuário) e retorna o resultado em JSON. Usada pelo agente Brain.';
