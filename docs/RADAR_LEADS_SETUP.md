# Configuração do Radar de Leads - Sincronização Automática Diária

## Visão Geral

O módulo Radar de Leads integra dados de empresas que vendem ao governo através de três fontes principais:
- **BNDES**: Empresas que recebem financiamento do banco
- **Portal de Compras**: Contratos governamentais federais
- **SICAF**: Sistema de Cadastramento Unificado de Fornecedores

## Edge Functions Criadas

1. **sync-radar-bndes**: Busca dados do BNDES
2. **sync-radar-portal-compras**: Busca dados do Portal de Compras e SICAF
3. **sync-radar-leads**: Função orquestradora que executa todas as sincronizações

## Configuração da Sincronização Diária Automática

Para configurar a sincronização automática uma vez por dia, execute o seguinte SQL no Supabase:

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para sincronização diária às 6h da manhã
SELECT cron.schedule(
  'sync-radar-leads-daily',
  '0 6 * * *', -- Executa todos os dias às 6h AM
  $$
  SELECT
    net.http_post(
        url:='https://eifsbqqrimniclsssoru.supabase.co/functions/v1/sync-radar-leads',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZnNicXFyaW1uaWNsc3Nzb3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTIyNTcsImV4cCI6MjA3ODQ2ODI1N30.3vo2K20w6x7Vlz-NXoEcH5eSKc-2e_HMmmKBWZuUOhA"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

## Verificar e Gerenciar Cron Jobs

### Listar todos os cron jobs
```sql
SELECT * FROM cron.job;
```

### Remover um cron job (se necessário)
```sql
SELECT cron.unschedule('sync-radar-leads-daily');
```

### Ver histórico de execuções
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'sync-radar-leads-daily' 
ORDER BY start_time DESC 
LIMIT 10;
```

## Tabelas Criadas

### radar_leads
Armazena os leads capturados das APIs governamentais.

**Campos principais:**
- `cnpj`: CNPJ da empresa
- `company_name`: Razão social
- `source`: Fonte do lead (bndes, sicaf, portal_compras)
- `source_data`: Dados completos da fonte em JSONB
- `contract_value`: Valor do contrato (quando disponível)
- `status`: Status do lead (novo, contatado, qualificado, descartado)
- `assigned_to`: Vendedor responsável

### radar_sync_history
Registra o histórico de sincronizações.

**Campos principais:**
- `source`: Fonte sincronizada
- `sync_started_at`: Início da sincronização
- `sync_completed_at`: Término da sincronização
- `status`: Status (running, completed, failed)
- `leads_found`: Total de leads encontrados
- `leads_new`: Novos leads inseridos
- `leads_updated`: Leads atualizados

## Permissões (RLS)

### Vendedores
- Podem ver leads não atribuídos ou atribuídos a eles
- Podem se auto-atribuir leads não atribuídos
- Podem atualizar apenas seus próprios leads

### Gestores e Admins
- Podem ver todos os leads
- Podem atualizar qualquer lead
- Admins podem ver histórico de sincronização

## Sincronização Manual

Além da sincronização automática diária, os usuários podem executar sincronização manual através da interface do módulo clicando no botão "Sincronizar Agora".

## APIs Integradas

### BNDES Dados Abertos
- **URL**: https://dadosabertos.bndes.gov.br/
- **Tipo**: Dados públicos de operações de financiamento
- **Autenticação**: Não requerida

### Portal de Compras Governamentais
- **URL**: https://api.compras.dados.gov.br/
- **Tipo**: Contratos e licitações federais
- **Autenticação**: Não requerida

### SICAF
- **URL**: Integrado no Portal de Compras
- **Tipo**: Fornecedores cadastrados
- **Autenticação**: Não requerida

## Notas Importantes

1. **Cache de Dados**: O sistema mantém cache dos leads por 30 segundos para melhor performance
2. **Duplicatas**: O sistema verifica CNPJs existentes antes de inserir novos leads
3. **Atualizações**: Leads existentes são atualizados com novos dados quando disponíveis
4. **Logging**: Todas as edge functions incluem logging detalhado para debugging

## Monitoramento

Para monitorar a saúde do sistema:

1. Verificar histórico de sincronizações na tabela `radar_sync_history`
2. Verificar logs das edge functions no painel do Supabase
3. Acompanhar estatísticas no dashboard do módulo Radar de Leads

## Troubleshooting

### Sincronização não está executando
1. Verificar se o cron job está ativo: `SELECT * FROM cron.job WHERE jobname = 'sync-radar-leads-daily'`
2. Verificar logs de erro: `SELECT * FROM cron.job_run_details WHERE status = 'failed'`

### Poucos leads sendo capturados
1. Verificar logs das edge functions para erros de API
2. Verificar se as APIs governamentais estão disponíveis
3. Ajustar parâmetros de busca nas edge functions se necessário

### Leads duplicados
O sistema já possui lógica de prevenção de duplicatas baseada em CNPJ + source. Se houver duplicatas, investigar a lógica de upsert nas edge functions.