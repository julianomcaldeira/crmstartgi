-- Corrige tarefas já existentes onde a data/hora foi gravada como texto local sem timezone,
-- fazendo o banco interpretar como UTC. Isso causava o card mostrar -03:00 (ex: 06:30)
-- enquanto no modal aparecia 09:30.
--
-- A conversão abaixo reinterpreta o "relógio" atual (UTC) como America/Sao_Paulo,
-- resultando no instante correto (ex: 09:30 local -> 12:30 UTC).
UPDATE public.tasks
SET due_date = (due_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'
WHERE due_date IS NOT NULL;