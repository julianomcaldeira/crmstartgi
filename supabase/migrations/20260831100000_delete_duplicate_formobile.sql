-- Remove duplicata da feira Formóbile Moveleiro 2
-- Mantém a feira original "Formóbile" e remove apenas a cópia com sufixo " 2"
-- Se houver mais de uma duplicata com nome exato, remove todas com sufixo

-- 1) Caso exato: nome = 'Formóbile Moveleiro 2' (ou variações sem acento)
DELETE FROM public.feiras
WHERE name IN ('Formóbile Moveleiro 2', 'Formobile Moveleiro 2', 'Formóbile Moveleiro  2');

-- 2) Segurança: se ainda houver duas com nome idêntico "Formóbile" ou "Formóbile Moveleiro",
--    mantém a mais antiga (created_at mais antigo / menor id) e remove a duplicata mais nova
--    (descomente se necessário)
-- WITH duplicates AS (
--   SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn
--   FROM public.feiras
--   WHERE name ILIKE 'Formóbile%Moveleiro%'
-- )
-- DELETE FROM public.feiras WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
