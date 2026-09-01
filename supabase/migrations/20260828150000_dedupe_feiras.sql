-- Deduplica feiras com mesmo nome (case-insensitive, trim) e previne novas duplicatas

-- 1) Reatribui vínculos client_feiras e remove duplicatas, mantendo a mais antiga
DO $$
DECLARE
  grp RECORD;
  keeper_id UUID;
  dup_id UUID;
BEGIN
  FOR grp IN
    SELECT lower(trim(name)) AS norm
    FROM public.feiras
    GROUP BY lower(trim(name))
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM public.feiras
    WHERE lower(trim(name)) = grp.norm
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    FOR dup_id IN
      SELECT id FROM public.feiras
      WHERE lower(trim(name)) = grp.norm AND id <> keeper_id
    LOOP
      -- move vínculos para o keeper (ignora conflito client_id+feira_id já existente)
      INSERT INTO public.client_feiras (client_id, feira_id, created_by, notes, created_at)
      SELECT client_id, keeper_id, created_by, notes, created_at
      FROM public.client_feiras WHERE feira_id = dup_id
      ON CONFLICT (client_id, feira_id) DO NOTHING;

      DELETE FROM public.client_feiras WHERE feira_id = dup_id;
      DELETE FROM public.feiras WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- 2) Índice único para prevenir futuras duplicatas (normalizado)
CREATE UNIQUE INDEX IF NOT EXISTS feiras_name_unique_idx
  ON public.feiras (lower(trim(name)));
