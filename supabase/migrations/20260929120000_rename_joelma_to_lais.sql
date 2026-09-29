-- Renomeia a carteira de Joelma Ferraz para Laís Miranda
-- O nome exibido nos filtros/listas vem de public.profiles.full_name
-- (via get_active_transfer_users), então basta atualizar o profile.

UPDATE public.profiles
SET full_name = 'Laís Miranda',
    updated_at = NOW()
WHERE full_name = 'Joelma Ferraz';
