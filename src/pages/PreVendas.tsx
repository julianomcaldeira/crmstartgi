import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import PreVendasAgenda from "@/components/PreVendasAgenda";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Target as TargetIcon,
  Users as UsersIcon,
  TrendingUp,
  Star,
} from "lucide-react";

type Request = any;

const STATUS_OPTIONS = [
  { value: "solicitada", label: "Solicitada", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  { value: "aceita", label: "Aceita", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  { value: "agendada", label: "Agendada", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  { value: "realizada", label: "Realizada", color: "bg-green-500/10 text-green-700 border-green-500/20" },
  { value: "cancelada", label: "Cancelada", color: "bg-red-500/10 text-red-700 border-red-500/20" },
];

function statusBadge(status: string) {
  const s = STATUS_OPTIONS.find((s) => s.value === status);
  return <Badge className={s?.color}>{s?.label || status}</Badge>;
}

export default function PreVendas() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("vendedor");
  const [requests, setRequests] = useState<Request[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [preVendasUsers, setPreVendasUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Request | null>(null);

  // form
  const [form, setForm] = useState({
    title: "",
    description: "",
    opportunity_id: "",
    desired_datetime: "",
    meeting_link: "",
    assigned_pre_vendas: "",
    product_id: "",
    attendees_roles: "",
    expectations: "",
  });

  const isPreVendas = role === "pre_vendas";
  const isAdmin = role === "admin";
  const canSeeDashboard = isPreVendas || isAdmin;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setRole(roleRow?.role || "vendedor");
      await loadAll();
      setLoading(false);
    })();
  }, []);

  async function loadAll() {
    const [{ data: reqs }, { data: opps }, { data: profs }, { data: pvRoles }] =
      await Promise.all([
        supabase
          .from("pre_vendas_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("opportunities")
          .select("id, title, value, monthly_value, status, probability, assigned_to, client_id, clients(company_name)")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email").or("is_deleted.is.null,is_deleted.eq.false"),
        supabase.from("user_roles").select("user_id, role").in("role", ["pre_vendas", "admin"]),
      ]);
    setRequests(reqs || []);
    setOpportunities(opps || []);
    setProfiles(profs || []);
    const pvIds = new Set((pvRoles || []).map((r: any) => r.user_id));
    setPreVendasUsers((profs || []).filter((p: any) => pvIds.has(p.id)));
  }

  async function handleCreate() {
    if (!form.title || !userId) {
      toast.error("Título é obrigatório");
      return;
    }
    const payload: any = {
      title: form.title,
      description: form.description || null,
      opportunity_id: form.opportunity_id || null,
      client_id:
        opportunities.find((o) => o.id === form.opportunity_id)?.client_id ||
        null,
      desired_datetime: form.desired_datetime
        ? new Date(form.desired_datetime).toISOString()
        : null,
      meeting_link: form.meeting_link || null,
      assigned_pre_vendas: form.assigned_pre_vendas || null,
      requested_by: userId,
      status: "solicitada",
    };
    const { error } = await supabase.from("pre_vendas_requests").insert(payload);
    if (error) {
      toast.error("Erro ao criar solicitação: " + error.message);
      return;
    }
    toast.success("Solicitação criada!");
    setCreateOpen(false);
    setForm({
      title: "",
      description: "",
      opportunity_id: "",
      desired_datetime: "",
      meeting_link: "",
      assigned_pre_vendas: "",
    });
    await loadAll();
  }

  async function updateRequest(id: string, patch: any) {
    const { error } = await supabase
      .from("pre_vendas_requests")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Atualizado");
    await loadAll();
  }

  // Dashboard metrics
  const metrics = useMemo(() => {
    const myReqs = isPreVendas
      ? requests.filter((r) => r.assigned_pre_vendas === userId)
      : requests;
    const oppIds = new Set(myReqs.map((r) => r.opportunity_id).filter(Boolean));
    const involvedOpps = opportunities.filter((o) => oppIds.has(o.id));

    const realizadas = myReqs.filter((r) => r.status === "realizada").length;
    const pendentes = myReqs.filter((r) =>
      ["solicitada", "aceita", "agendada"].includes(r.status)
    ).length;
    const wonFromInvolved = involvedOpps.filter((o) => o.status === "won").length;
    const conversionRate =
      realizadas > 0 ? Math.round((wonFromInvolved / realizadas) * 100) : 0;

    // Pipeline ponderado das contas envolvidas (oportunidades abertas)
    const openInvolved = involvedOpps.filter(
      (o) => !["won", "lost"].includes(o.status)
    );
    const weightedPipeline = openInvolved.reduce((sum, o) => {
      const v = Number(o.value) || Number(o.monthly_value) * 12 || 0;
      return sum + v * ((Number(o.probability) || 0) / 100);
    }, 0);
    const totalPipeline = openInvolved.reduce(
      (sum, o) => sum + (Number(o.value) || Number(o.monthly_value) * 12 || 0),
      0
    );

    // Ranking por vendedor (assigned_to do opp)
    const byVendor: Record<string, { count: number; won: number }> = {};
    myReqs.forEach((r) => {
      const opp = opportunities.find((o) => o.id === r.opportunity_id);
      const v = opp?.assigned_to;
      if (!v) return;
      byVendor[v] = byVendor[v] || { count: 0, won: 0 };
      byVendor[v].count++;
      if (opp?.status === "won") byVendor[v].won++;
    });
    const ranking = Object.entries(byVendor)
      .map(([uid, x]) => ({
        name: profiles.find((p) => p.id === uid)?.full_name || "—",
        count: x.count,
        won: x.won,
        winRate: x.count ? Math.round((x.won / x.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total: myReqs.length,
      realizadas,
      pendentes,
      conversionRate,
      involvedOpps,
      openInvolved,
      weightedPipeline,
      totalPipeline,
      ranking,
    };
  }, [requests, opportunities, profiles, userId, isPreVendas]);

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pré-Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Solicitações de agenda e acompanhamento de projetos
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Solicitar agenda com Pré-Vendas</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div>
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Apresentação demo - Cliente X"
                />
              </div>
              <div>
                <Label>Oportunidade vinculada</Label>
                <SearchableCombobox
                  items={opportunities
                    .filter((o) => !["won", "lost"].includes(o.status))
                    .map((o) => ({
                      value: o.id,
                      label: o.title,
                      subLabel: o.clients?.company_name,
                      searchText: `${o.title} ${o.clients?.company_name ?? ""} ${o.clients?.trade_name ?? ""} ${o.clients?.cnpj ?? ""}`,
                    }))}
                  value={form.opportunity_id}
                  onValueChange={(v) => setForm({ ...form, opportunity_id: v })}
                  placeholder="Selecione uma oportunidade"
                  searchPlaceholder="Buscar por título, cliente ou CNPJ..."
                  emptyText="Nenhuma oportunidade encontrada."
                />
              </div>
              <div>
                <Label>Pré-Vendas responsável</Label>
                <Select
                  value={form.assigned_pre_vendas}
                  onValueChange={(v) =>
                    setForm({ ...form, assigned_pre_vendas: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {preVendasUsers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data/hora desejada</Label>
                <Input
                  type="datetime-local"
                  value={form.desired_datetime}
                  onChange={(e) =>
                    setForm({ ...form, desired_datetime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Link da reunião</Label>
                <Input
                  value={form.meeting_link}
                  onChange={(e) =>
                    setForm({ ...form, meeting_link: e.target.value })
                  }
                  placeholder="https://meet..."
                />
              </div>
              <div>
                <Label>Contexto / pauta</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          {canSeeDashboard && (
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="agenda">
          {userId && (
            <PreVendasAgenda
              userId={userId}
              role={role}
              preVendasUsers={preVendasUsers}
            />
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Oportunidade</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Pré-Vendas</TableHead>
                    <TableHead>Data desejada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma solicitação ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {requests.map((r) => {
                    const opp = opportunities.find((o) => o.id === r.opportunity_id);
                    const requester = profiles.find((p) => p.id === r.requested_by);
                    const pv = profiles.find((p) => p.id === r.assigned_pre_vendas);
                    const canEdit =
                      isAdmin ||
                      isPreVendas ||
                      r.requested_by === userId;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>{opp?.title || "—"}</TableCell>
                        <TableCell>{requester?.full_name || "—"}</TableCell>
                        <TableCell>{pv?.full_name || "—"}</TableCell>
                        <TableCell>
                          {r.desired_datetime
                            ? format(new Date(r.desired_datetime), "dd/MM/yy HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Select
                              value={r.status}
                              onValueChange={(v) => {
                                const patch: any = { status: v };
                                if (v === "realizada") patch.completed_at = new Date().toISOString();
                                updateRequest(r.id, patch);
                              }}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            statusBadge(r.status)
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeDashboard && (
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Total solicitações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.pendentes} pendentes
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Reuniões realizadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.realizadas}</div>
                  <p className="text-xs text-muted-foreground">
                    Conversão pós-reunião: {metrics.conversionRate}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TargetIcon className="h-4 w-4" /> Projetos envolvidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.involvedOpps.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.openInvolved.length} abertos
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Pipeline ponderado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmt(metrics.weightedPipeline)}</div>
                  <p className="text-xs text-muted-foreground">
                    Total: {fmt(metrics.totalPipeline)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" /> Ranking de apoio por vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Solicitações</TableHead>
                      <TableHead className="text-right">Ganhas</TableHead>
                      <TableHead className="text-right">Win rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.ranking.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          Sem dados ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {metrics.ranking.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right">{r.won}</TableCell>
                        <TableCell className="text-right">{r.winRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projetos envolvidos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Oportunidade</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Probab.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.involvedOpps.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.title}</TableCell>
                        <TableCell>{o.clients?.company_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{o.probability || 0}%</TableCell>
                        <TableCell className="text-right">
                          {fmt(Number(o.value) || Number(o.monthly_value) * 12 || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Detail dialog with feedback */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.title}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div><strong>Status:</strong> {statusBadge(editing.status)}</div>
              {editing.description && (
                <div>
                  <strong>Contexto:</strong>
                  <p className="text-muted-foreground whitespace-pre-wrap mt-1">{editing.description}</p>
                </div>
              )}
              {editing.desired_datetime && (
                <div>
                  <strong>Data desejada:</strong>{" "}
                  {format(new Date(editing.desired_datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              )}
              {editing.meeting_link && (
                <div>
                  <strong>Link:</strong>{" "}
                  <a href={editing.meeting_link} target="_blank" rel="noreferrer" className="text-primary underline">
                    {editing.meeting_link}
                  </a>
                </div>
              )}
              <div>
                <Label>Feedback do vendedor</Label>
                <Textarea
                  defaultValue={editing.feedback || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (editing.feedback || "")) {
                      updateRequest(editing.id, { feedback: e.target.value });
                    }
                  }}
                  rows={3}
                />
              </div>
              <div>
                <Label>Nota de qualidade (1-5)</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateRequest(editing.id, { quality_rating: n })}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          (editing.quality_rating || 0) >= n
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
