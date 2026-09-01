-- Transfere todas as contas de Jessé e Mariane para Carteira de Contas Disponíveis (pool = created_by NULL)
-- Busca por nome ou email contendo jessé/jesse e mariane (accent-insensitive via ILIKE duplo)

DO $$
DECLARE
  target_ids UUID[];
  affected INTEGER;
BEGIN
  SELECT array_agg(id) INTO target_ids
  FROM public.profiles
  WHERE full_name ILIKE '%jessé%' OR full_name ILIKE '%jesse%'
     OR email ILIKE '%jessé%' OR email ILIKE '%jesse%'
     OR full_name ILIKE '%mariane%' OR email ILIKE '%mariane%';

  IF target_ids IS NULL OR array_length(target_ids, 1) IS NULL THEN
    RAISE NOTICE 'Nenhum perfil encontrado para Jessé/Mariane — nada a transferir';
    RETURN;
  END IF;

  RAISE NOTICE 'Perfis encontrados para transferência: %', target_ids;

  UPDATE public.clients
  SET created_by = NULL,
      updated_at = now()
  WHERE created_by = ANY(target_ids)
    AND created_by IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Clientes transferidos para carteira disponível: %', affected;
END $$;
