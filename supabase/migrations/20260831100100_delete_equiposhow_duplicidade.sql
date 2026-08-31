-- Remove duplicata da feira Equipo Show marcada como DUPLICIDADE
DELETE FROM public.feiras
WHERE name = 'Equipo ShoW - DUPLICIDADE - construção, mineração e agro';

-- Fallback case-insensitive (se houver variação de caixa/acentuação)
DELETE FROM public.feiras
WHERE name ILIKE 'Equipo ShoW%DUPLICIDADE%construção%mineração%agro%';
