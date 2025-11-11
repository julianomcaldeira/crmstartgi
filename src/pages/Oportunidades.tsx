import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, TrendingUp, LayoutGrid, List } from "lucide-react";

const Oportunidades = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("50");
  const [status, setStatus] = useState("lead");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  const stages = [
    { key: "lead", label: "Lead", color: "bg-muted text-muted-foreground" },
    { key: "contacted", label: "Contactado", color: "bg-info/20 text-info" },
    { key: "qualified", label: "Qualificado", color: "bg-primary/20 text-primary" },
    { key: "proposal", label: "Proposta", color: "bg-warning/20 text-warning" },
    { key: "negotiation", label: "Negociação", color: "bg-accent/20 text-accent" },
    { key: "won", label: "Ganho", color: "bg-success/20 text-success" },
    { key: "lost", label: "Perdido", color: "bg-destructive/20 text-destructive" },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [oppsResponse, clientsResponse, usersResponse] = await Promise.all([
        supabase
          .from("opportunities")
          .select(`
            *,
            client:clients(company_name, trade_name),
            assigned:profiles!opportunities_assigned_to_fkey(full_name)
          `)
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, company_name, trade_name"),
        supabase.from("profiles").select("id, full_name"),
      ]);

      if (oppsResponse.error) throw oppsResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;
      if (usersResponse.error) throw usersResponse.error;

      setOpportunities(oppsResponse.data || []);
      setClients(clientsResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("opportunities").insert([{
        title,
        description,
        client_id: clientId,
        value: value ? parseFloat(value) : null,
        probability: parseInt(probability),
        status: status as any,
        assigned_to: assignedTo || user.id,
        expected_close_date: expectedCloseDate || null,
        created_by: user.id,
      }]);

      if (error) throw error;

      toast.success("Oportunidade criada com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating opportunity:", error);
      toast.error(error.message || "Erro ao criar oportunidade");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setClientId("");
    setValue("");
    setProbability("50");
    setStatus("lead");
    setAssignedTo("");
    setExpectedCloseDate("");
  };

  const getOpportunitiesByStage = (stageKey: string) => {
    return opportunities.filter((opp) => opp.status === stageKey);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Pipeline de Vendas
          </h1>
          <p className="text-muted-foreground">
            Acompanhe suas oportunidades em cada fase
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-primary">
                <Plus size={20} />
                Nova Oportunidade
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Nova Oportunidade</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex: Venda de sistema para Empresa X"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da oportunidade..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente *</Label>
                  <Select value={clientId} onValueChange={setClientId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.trade_name || client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Valor (R$)</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Estágio</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.key} value={stage.key}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probability">Probabilidade (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigned">Vendedor Responsável</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedDate">Data Prevista de Fechamento</Label>
                  <Input
                    id="expectedDate"
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Criar Oportunidade</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : opportunities.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="mx-auto mb-4 text-muted-foreground" size={48} />
          <p className="text-muted-foreground mb-4">Nenhuma oportunidade criada</p>
          <p className="text-sm text-muted-foreground">
            Crie sua primeira oportunidade para começar a gerenciar seu pipeline
          </p>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {stages.map((stage) => {
            const stageOpps = getOpportunitiesByStage(stage.key);
            const stageValue = stageOpps.reduce(
              (sum, opp) => sum + (Number(opp.value) || 0),
              0
            );

            return (
              <div key={stage.key} className="space-y-3">
                <Card className="shadow-md">
                  <CardHeader className="p-4">
                    <h3 className="font-semibold text-sm mb-1">{stage.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {stageOpps.length} oportunidade{stageOpps.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs font-medium text-primary mt-1">
                      {formatCurrency(stageValue)}
                    </p>
                  </CardHeader>
                </Card>

                <div className="space-y-3">
                  {stageOpps.map((opp) => (
                    <Card
                      key={opp.id}
                      className="hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4 border-l-primary"
                    >
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm line-clamp-2">{opp.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {opp.client?.trade_name || opp.client?.company_name}
                        </p>
                        {opp.value && (
                          <p className="text-sm font-semibold text-primary">
                            {formatCurrency(opp.value)}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-xs">
                            {opp.probability}%
                          </Badge>
                          {opp.assigned && (
                            <p className="text-xs text-muted-foreground truncate">
                              {opp.assigned.full_name}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => {
            const stage = stages.find((s) => s.key === opp.status);
            return (
              <Card key={opp.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{opp.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {opp.client?.trade_name || opp.client?.company_name}
                      </p>
                    </div>
                    <Badge className={stage?.color}>
                      {stage?.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Valor</p>
                      <p className="font-semibold text-primary">
                        {formatCurrency(opp.value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Probabilidade</p>
                      <p className="font-semibold">{opp.probability}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                      <p className="text-sm">{opp.assigned?.full_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Data Prevista</p>
                      <p className="text-sm">
                        {opp.expected_close_date 
                          ? new Date(opp.expected_close_date).toLocaleDateString("pt-BR")
                          : "-"
                        }
                      </p>
                    </div>
                  </div>
                  {opp.description && (
                    <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                      {opp.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Oportunidades;