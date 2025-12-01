-- =====================================================
-- CONFIGURAÇÃO DO CRON JOB PARA RADAR DE LEADS
-- Execute este SQL no Supabase para ativar sincronização diária
-- =====================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar cron job para sincronização diária às 6h da manhã
SELECT cron.schedule(
  'sync-radar-leads-daily',
  '0 6 * * *', -- Executa todos os dias às 6h AM (horário UTC)
  $$
  SELECT
    net.http_post(
        url:='https://eifsbqqrimniclsssoru.supabase.co/functions/v1/sync-radar-leads',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZnNicXFyaW1uaWNsc3Nzb3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTIyNTcsImV4cCI6MjA3ODQ2ODI1N30.3vo2K20w6x7Vlz-NXoEcH5eSKc-2e_HMmmKBWZuUOhA"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- =====================================================
-- COMANDOS ÚTEIS PARA GERENCIAR O CRON JOB
-- =====================================================

-- Listar todos os cron jobs
-- SELECT * FROM cron.job;

-- Remover o cron job (se necessário)
-- SELECT cron.unschedule('sync-radar-leads-daily');

-- Ver histórico de execuções
-- SELECT * FROM cron.job_run_details 
-- WHERE jobname = 'sync-radar-leads-daily' 
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- Ver últimas execuções com erro
-- SELECT * FROM cron.job_run_details 
-- WHERE jobname = 'sync-radar-leads-daily' 
-- AND status = 'failed'
-- ORDER BY start_time DESC;