// Catálogo de tabelas, campos e filtros disponíveis para o relatório analítico personalizado.
// Cada coluna mapeia diretamente para uma coluna do Supabase (ou caminho aninhado via select).

export type FilterType = "text" | "select" | "date_range" | "number_min" | "number_max";

export interface AnalyticColumn {
  key: string; // path no objeto retornado (ex: "client.company_name")
  label: string;
  format?: "currency" | "date" | "datetime" | "percent" | "boolean";
}

export interface AnalyticFilter {
  key: string; // coluna no banco
  label: string;
  type: FilterType;
  options?: Array<{ value: string; label: string }>;
}

export interface AnalyticTable {
  id: string;
  label: string;
  table: string; // nome da tabela Supabase
  select: string; // string de select, com joins quando necessário
  defaultColumns: string[]; // chaves marcadas por padrão
  columns: AnalyticColumn[];
  filters: AnalyticFilter[];
  dateField?: string; // coluna usada para filtro de período
  sellerField?: string; // coluna de vendedor (created_by/assigned_to)
}

const opportunityStatuses = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Qualificado" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "proposal", label: "Proposta" },
  { value: "negotiation", label: "Negociação" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
];

const taskStatuses = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

const taskTypes = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "visita_presencial", label: "Visita Presencial" },
  { value: "reuniao_online", label: "Reunião Online" },
  { value: "visita_feira", label: "Visita a Feira" },
  { value: "proposta", label: "Proposta" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "pesquisa_inicial", label: "Pesquisa Inicial" },
];

export const ANALYTIC_TABLES: AnalyticTable[] = [
  {
    id: "clients",
    label: "Clientes / Prospects",
    table: "clients",
    select:
      "id, cnpj, company_name, trade_name, email, phone, city, state, segment, company_size, region, rating, registration_status, website, created_at, updated_at, created_by_profile:profiles!clients_created_by_fkey(full_name)",
    dateField: "created_at",
    sellerField: "created_by",
    defaultColumns: ["company_name", "cnpj", "city", "state", "segment", "created_at", "created_by_profile.full_name"],
    columns: [
      { key: "company_name", label: "Razão Social" },
      { key: "trade_name", label: "Nome Fantasia" },
      { key: "cnpj", label: "CNPJ" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "UF" },
      { key: "region", label: "Região" },
      { key: "segment", label: "Segmento" },
      { key: "company_size", label: "Porte" },
      { key: "registration_status", label: "Situação CNPJ" },
      { key: "rating", label: "Rating" },
      { key: "website", label: "Site" },
      { key: "created_at", label: "Criado em", format: "datetime" },
      { key: "updated_at", label: "Atualizado em", format: "datetime" },
      { key: "created_by_profile.full_name", label: "Vendedor" },
    ],
    filters: [
      { key: "created_at", label: "Período (criação)", type: "date_range" },
      { key: "state", label: "UF", type: "text" },
      { key: "segment", label: "Segmento", type: "text" },
      { key: "created_by", label: "Vendedor", type: "select" },
    ],
  },
  {
    id: "contacts",
    label: "Contatos",
    table: "contacts",
    select:
      "id, name, role, email, phone, mobile, is_primary, rating, created_at, client:clients(company_name, cnpj), created_by_profile:profiles!contacts_created_by_fkey(full_name)",
    dateField: "created_at",
    sellerField: "created_by",
    defaultColumns: ["name", "role", "email", "phone", "client.company_name", "is_primary"],
    columns: [
      { key: "name", label: "Nome" },
      { key: "role", label: "Cargo" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "mobile", label: "Celular" },
      { key: "is_primary", label: "Principal", format: "boolean" },
      { key: "rating", label: "Rating" },
      { key: "client.company_name", label: "Cliente" },
      { key: "client.cnpj", label: "CNPJ Cliente" },
      { key: "created_at", label: "Criado em", format: "datetime" },
      { key: "created_by_profile.full_name", label: "Cadastrado por" },
    ],
    filters: [
      { key: "created_at", label: "Período (criação)", type: "date_range" },
      { key: "created_by", label: "Cadastrado por", type: "select" },
    ],
  },
  {
    id: "opportunities",
    label: "Oportunidades",
    table: "opportunities",
    select:
      "id, title, status, value, monthly_value, implementation_value, probability, expected_close_date, business_type, billing_type, close_cycle_days, created_at, updated_at, client:clients(company_name, cnpj), product:products(name), assigned_to_profile:profiles!opportunities_assigned_to_fkey(full_name), created_by_profile:profiles!opportunities_created_by_fkey(full_name), loss_reason:loss_reasons(reason)",
    dateField: "created_at",
    sellerField: "assigned_to",
    defaultColumns: [
      "title",
      "client.company_name",
      "status",
      "implementation_value",
      "monthly_value",
      "expected_close_date",
      "assigned_to_profile.full_name",
      "created_at",
    ],
    columns: [
      { key: "title", label: "Título" },
      { key: "client.company_name", label: "Cliente" },
      { key: "client.cnpj", label: "CNPJ Cliente" },
      { key: "status", label: "Status" },
      { key: "value", label: "Valor", format: "currency" },
      { key: "implementation_value", label: "Implantação", format: "currency" },
      { key: "monthly_value", label: "Mensalidade", format: "currency" },
      { key: "probability", label: "Probabilidade %" },
      { key: "expected_close_date", label: "Previsão de fechamento", format: "date" },
      { key: "business_type", label: "Tipo de negócio" },
      { key: "billing_type", label: "Cobrança" },
      { key: "product.name", label: "Produto" },
      { key: "close_cycle_days", label: "Ciclo (dias)" },
      { key: "loss_reason.reason", label: "Motivo de perda" },
      { key: "assigned_to_profile.full_name", label: "Vendedor responsável" },
      { key: "created_by_profile.full_name", label: "Criado por" },
      { key: "created_at", label: "Criado em", format: "datetime" },
      { key: "updated_at", label: "Atualizado em", format: "datetime" },
    ],
    filters: [
      { key: "created_at", label: "Período (criação)", type: "date_range" },
      { key: "status", label: "Status", type: "select", options: opportunityStatuses },
      { key: "assigned_to", label: "Vendedor responsável", type: "select" },
      { key: "implementation_value", label: "Valor mínimo (impl.)", type: "number_min" },
    ],
  },
  {
    id: "tasks",
    label: "Tarefas",
    table: "tasks",
    select:
      "id, title, description, task_type, status, priority, due_date, completed_at, linkedin_connection_accepted, created_at, client:clients(company_name), assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name), created_by_profile:profiles!tasks_created_by_fkey(full_name)",
    dateField: "created_at",
    sellerField: "assigned_to",
    defaultColumns: [
      "title",
      "task_type",
      "status",
      "priority",
      "due_date",
      "client.company_name",
      "assigned_to_profile.full_name",
    ],
    columns: [
      { key: "title", label: "Título" },
      { key: "description", label: "Descrição" },
      { key: "task_type", label: "Tipo" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Prioridade" },
      { key: "due_date", label: "Vencimento", format: "datetime" },
      { key: "completed_at", label: "Concluída em", format: "datetime" },
      { key: "linkedin_connection_accepted", label: "LinkedIn aceito?", format: "boolean" },
      { key: "client.company_name", label: "Cliente" },
      { key: "assigned_to_profile.full_name", label: "Responsável" },
      { key: "created_by_profile.full_name", label: "Criado por" },
      { key: "created_at", label: "Criado em", format: "datetime" },
    ],
    filters: [
      { key: "created_at", label: "Período (criação)", type: "date_range" },
      { key: "status", label: "Status", type: "select", options: taskStatuses },
      { key: "task_type", label: "Tipo", type: "select", options: taskTypes },
      { key: "assigned_to", label: "Responsável", type: "select" },
    ],
  },
  {
    id: "feiras",
    label: "Feiras",
    table: "feiras",
    select:
      "id, name, city, state, location, segmento, status, start_date, end_date, website, created_at, created_by_profile:profiles!feiras_created_by_fkey(full_name)",
    dateField: "start_date",
    sellerField: "created_by",
    defaultColumns: ["name", "city", "state", "segmento", "status", "start_date", "end_date"],
    columns: [
      { key: "name", label: "Nome" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "UF" },
      { key: "location", label: "Local" },
      { key: "segmento", label: "Segmento" },
      { key: "status", label: "Status" },
      { key: "start_date", label: "Início", format: "date" },
      { key: "end_date", label: "Fim", format: "date" },
      { key: "website", label: "Site" },
      { key: "created_by_profile.full_name", label: "Criado por" },
      { key: "created_at", label: "Criado em", format: "datetime" },
    ],
    filters: [
      { key: "start_date", label: "Período (início)", type: "date_range" },
      { key: "state", label: "UF", type: "text" },
      { key: "segmento", label: "Segmento", type: "text" },
    ],
  },
  {
    id: "products",
    label: "Produtos",
    table: "products",
    select: "id, name, description, implementation_fee, monthly_fee, active, created_at",
    dateField: "created_at",
    defaultColumns: ["name", "implementation_fee", "monthly_fee", "active"],
    columns: [
      { key: "name", label: "Nome" },
      { key: "description", label: "Descrição" },
      { key: "implementation_fee", label: "Implantação", format: "currency" },
      { key: "monthly_fee", label: "Mensalidade", format: "currency" },
      { key: "active", label: "Ativo", format: "boolean" },
      { key: "created_at", label: "Criado em", format: "datetime" },
    ],
    filters: [],
  },
  {
    id: "campaigns",
    label: "Campanhas",
    table: "campaigns",
    select:
      "id, name, description, status, start_date, end_date, created_at, created_by_profile:profiles!campaigns_created_by_fkey(full_name)",
    dateField: "start_date",
    defaultColumns: ["name", "status", "start_date", "end_date", "created_by_profile.full_name"],
    columns: [
      { key: "name", label: "Nome" },
      { key: "description", label: "Descrição" },
      { key: "status", label: "Status" },
      { key: "start_date", label: "Início", format: "date" },
      { key: "end_date", label: "Fim", format: "date" },
      { key: "created_by_profile.full_name", label: "Criado por" },
      { key: "created_at", label: "Criado em", format: "datetime" },
    ],
    filters: [
      { key: "start_date", label: "Período (início)", type: "date_range" },
    ],
  },
  {
    id: "goals",
    label: "Metas",
    table: "goals",
    select:
      "id, title, description, goal_type, period, target_value, start_date, end_date, task_type_filter, activity_type_filter, created_at, assigned_to_profile:profiles!goals_assigned_to_fkey(full_name)",
    dateField: "start_date",
    sellerField: "assigned_to",
    defaultColumns: ["title", "goal_type", "period", "target_value", "start_date", "end_date", "assigned_to_profile.full_name"],
    columns: [
      { key: "title", label: "Título" },
      { key: "description", label: "Descrição" },
      { key: "goal_type", label: "Tipo" },
      { key: "period", label: "Período" },
      { key: "target_value", label: "Meta", format: "currency" },
      { key: "start_date", label: "Início", format: "date" },
      { key: "end_date", label: "Fim", format: "date" },
      { key: "task_type_filter", label: "Filtro tipo tarefa" },
      { key: "activity_type_filter", label: "Filtro atividade" },
      { key: "assigned_to_profile.full_name", label: "Responsável" },
      { key: "created_at", label: "Criada em", format: "datetime" },
    ],
    filters: [
      { key: "start_date", label: "Período (início)", type: "date_range" },
      { key: "assigned_to", label: "Responsável", type: "select" },
    ],
  },
  {
    id: "indicadores_fundo",
    label: "Indicadores de Fundo",
    table: "indicadores_fundo",
    select:
      "id, mes_referencia, gasto_midia, leads_novos_qualificados, propostas_enviadas, leads_negociacao, contratos_assinados, vendas, venda_na_base, custo_comercial, cac, created_at",
    dateField: "mes_referencia",
    defaultColumns: [
      "mes_referencia",
      "leads_novos_qualificados",
      "propostas_enviadas",
      "contratos_assinados",
      "vendas",
      "cac",
    ],
    columns: [
      { key: "mes_referencia", label: "Mês ref.", format: "date" },
      { key: "gasto_midia", label: "Gasto mídia", format: "currency" },
      { key: "leads_novos_qualificados", label: "Leads novos qualif." },
      { key: "propostas_enviadas", label: "Propostas enviadas" },
      { key: "leads_negociacao", label: "Leads em negociação" },
      { key: "contratos_assinados", label: "Contratos assinados" },
      { key: "vendas", label: "Vendas", format: "currency" },
      { key: "venda_na_base", label: "Venda na base", format: "currency" },
      { key: "custo_comercial", label: "Custo comercial", format: "currency" },
      { key: "cac", label: "CAC", format: "currency" },
      { key: "created_at", label: "Criado em", format: "datetime" },
    ],
    filters: [
      { key: "mes_referencia", label: "Período (mês)", type: "date_range" },
    ],
  },
];

export const getAnalyticTable = (id: string) => ANALYTIC_TABLES.find((t) => t.id === id);
