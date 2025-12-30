import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Building2,
  Target,
  Users,
  CheckSquare,
  Package,
  TrendingUp,
  MapPin,
  Sparkles,
  FileDown,
  Eye,
} from "lucide-react";

export interface ReportConfig {
  type: 'vendas' | 'tarefas' | 'equipe' | 'feiras' | 'oportunidades' | 'clientes' | 'produtos' | 'completo' | 'custom';
  sections: string[];
  includeAIAnalysis: boolean;
  groupBy?: string;
  sortBy?: string;
}

interface ReportBuilderProps {
  onGenerate: (config: ReportConfig) => void;
  onPreview: (config: ReportConfig) => void;
  loading?: boolean;
}

const reportTypes = [
  { value: 'completo', label: 'Relatório Completo', icon: FileText, description: 'Todos os dados consolidados' },
  { value: 'vendas', label: 'Relatório de Vendas', icon: TrendingUp, description: 'Métricas de vendas e conversão' },
  { value: 'tarefas', label: 'Relatório de Tarefas', icon: CheckSquare, description: 'Produtividade e atividades' },
  { value: 'equipe', label: 'Relatório de Equipe', icon: Users, description: 'Performance individual' },
  { value: 'oportunidades', label: 'Relatório de Oportunidades', icon: Target, description: 'Pipeline e funil' },
  { value: 'clientes', label: 'Relatório de Clientes', icon: Building2, description: 'Base de clientes' },
  { value: 'produtos', label: 'Relatório de Produtos', icon: Package, description: 'Ranking de produtos' },
  { value: 'feiras', label: 'Relatório de Feiras', icon: MapPin, description: 'Leads por evento' },
  { value: 'custom', label: 'Relatório Personalizado', icon: FileText, description: 'Escolha as seções' },
];

const availableSections = [
  { id: 'kpis_vendas', label: 'KPIs de Vendas', category: 'vendas' },
  { id: 'funil_vendas', label: 'Funil de Vendas', category: 'vendas' },
  { id: 'tendencias', label: 'Tendências', category: 'vendas' },
  { id: 'top_produtos', label: 'Top Produtos', category: 'produtos' },
  { id: 'kpis_tarefas', label: 'KPIs de Tarefas', category: 'tarefas' },
  { id: 'tarefas_tipo', label: 'Tarefas por Tipo', category: 'tarefas' },
  { id: 'tarefas_atrasadas', label: 'Tarefas Atrasadas', category: 'tarefas' },
  { id: 'ranking_equipe', label: 'Ranking da Equipe', category: 'equipe' },
  { id: 'performance_individual', label: 'Performance Individual', category: 'equipe' },
  { id: 'novos_clientes', label: 'Novos Clientes', category: 'clientes' },
  { id: 'clientes_segmento', label: 'Clientes por Segmento', category: 'clientes' },
  { id: 'clientes_regiao', label: 'Clientes por Região', category: 'clientes' },
  { id: 'oportunidades_status', label: 'Oportunidades por Status', category: 'oportunidades' },
  { id: 'oportunidades_produto', label: 'Oportunidades por Produto', category: 'oportunidades' },
  { id: 'valor_pipeline', label: 'Valor no Pipeline', category: 'oportunidades' },
  { id: 'leads_feira', label: 'Leads por Feira', category: 'feiras' },
  { id: 'visitas_feira', label: 'Visitas em Feiras', category: 'feiras' },
];

const groupByOptions = [
  { value: 'none', label: 'Sem agrupamento' },
  { value: 'seller', label: 'Por Vendedor' },
  { value: 'product', label: 'Por Produto' },
  { value: 'segment', label: 'Por Segmento' },
  { value: 'region', label: 'Por Região' },
  { value: 'month', label: 'Por Mês' },
  { value: 'week', label: 'Por Semana' },
];

const sortByOptions = [
  { value: 'value_desc', label: 'Maior Valor' },
  { value: 'value_asc', label: 'Menor Valor' },
  { value: 'date_desc', label: 'Mais Recente' },
  { value: 'date_asc', label: 'Mais Antigo' },
  { value: 'name_asc', label: 'Nome (A-Z)' },
  { value: 'name_desc', label: 'Nome (Z-A)' },
];

export function ReportBuilder({ onGenerate, onPreview, loading }: ReportBuilderProps) {
  const [selectedType, setSelectedType] = useState<string>('completo');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [includeAI, setIncludeAI] = useState(true);
  const [groupBy, setGroupBy] = useState('none');
  const [sortBy, setSortBy] = useState('value_desc');

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    
    // Auto-select sections based on type
    if (type === 'completo') {
      setSelectedSections(availableSections.map(s => s.id));
    } else if (type === 'custom') {
      setSelectedSections([]);
    } else {
      setSelectedSections(
        availableSections.filter(s => s.category === type).map(s => s.id)
      );
    }
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
    if (selectedType !== 'custom') {
      setSelectedType('custom');
    }
  };

  const getConfig = (): ReportConfig => ({
    type: selectedType as ReportConfig['type'],
    sections: selectedType === 'custom' ? selectedSections : 
      selectedType === 'completo' ? availableSections.map(s => s.id) :
      availableSections.filter(s => s.category === selectedType).map(s => s.id),
    includeAIAnalysis: includeAI,
    groupBy: groupBy !== 'none' ? groupBy : undefined,
    sortBy,
  });

  const selectedTypeInfo = reportTypes.find(t => t.value === selectedType);

  return (
    <div className="space-y-6">
      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Tipo de Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              return (
                <button
                  key={type.value}
                  onClick={() => handleTypeChange(type.value)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section Selection (for custom reports) */}
      {selectedType === 'custom' && (
        <Card>
          <CardHeader>
            <CardTitle>Seções do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(
                availableSections.reduce((acc, section) => {
                  if (!acc[section.category]) acc[section.category] = [];
                  acc[section.category].push(section);
                  return acc;
                }, {} as Record<string, typeof availableSections>)
              ).map(([category, sections]) => (
                <div key={category} className="space-y-2">
                  <Badge variant="outline" className="capitalize mb-2">
                    {category}
                  </Badge>
                  {sections.map((section) => (
                    <div key={section.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={section.id}
                        checked={selectedSections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <Label htmlFor={section.id} className="text-sm cursor-pointer">
                        {section.label}
                      </Label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>Opções do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AI Analysis */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10">
              <Checkbox
                id="include-ai"
                checked={includeAI}
                onCheckedChange={(checked) => setIncludeAI(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="include-ai" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Incluir Análise IA
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Gera insights e recomendações automáticas baseadas nos dados
                </p>
              </div>
            </div>

            {/* Group By */}
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupByOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortByOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedTypeInfo && (
            <span className="flex items-center gap-2">
              <selectedTypeInfo.icon className="h-4 w-4" />
              {selectedTypeInfo.label}
              {includeAI && (
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Com IA
                </Badge>
              )}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onPreview(getConfig())}
            disabled={loading || (selectedType === 'custom' && selectedSections.length === 0)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
          <Button
            onClick={() => onGenerate(getConfig())}
            disabled={loading || (selectedType === 'custom' && selectedSections.length === 0)}
            className="bg-gradient-to-r from-primary to-primary-light"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
        </div>
      </div>
    </div>
  );
}
