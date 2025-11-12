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
import { Plus, TrendingUp, LayoutGrid, List, ChevronRight, ChevronLeft, Search, Calendar as CalendarIcon, Edit, Paperclip, Upload, X, Download, FileText } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OpportunityEditDialog } from "@/components/OpportunityEditDialog";
import { OpportunityActivityLog } from "@/components/OpportunityActivityLog";
import { ProposalViewer } from "@/components/ProposalViewer";
import OpportunityViewDialog from "@/components/OpportunityViewDialog";
import { DroppableColumn } from "@/components/DroppableColumn";
import { DraggableCard } from "@/components/DraggableCard";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const Oportunidades = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [selectedOpportunityForLog, setSelectedOpportunityForLog] = useState<string | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalHtml, setProposalHtml] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  // Filters
  const [searchClient, setSearchClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterProbability, setFilterProbability] = useState("");
  const [filterBusinessType, setFilterBusinessType] = useState("");

  // Form state
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [implementationValue, setImplementationValue] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [probability, setProbability] = useState("50");
  const [status, setStatus] = useState("lead");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [businessType, setBusinessType] = useState("cliente_novo");

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
      const [oppsResponse, clientsResponse, usersResponse, productsResponse] = await Promise.all([
        supabase
          .from("opportunities")
          .select(`
            *,
            client:clients(company_name, trade_name),
            assigned:profiles!opportunities_assigned_to_fkey(full_name),
            product:products(name, description, logo_url)
          `)
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, company_name, trade_name"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("products").select("id, name, description").eq("active", true).order("name", { ascending: true }),
      ]);

      if (oppsResponse.error) throw oppsResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;
      if (usersResponse.error) throw usersResponse.error;
      if (productsResponse.error) throw productsResponse.error;

      setOpportunities(oppsResponse.data || []);
      setClients(clientsResponse.data || []);
      setUsers(usersResponse.data || []);
      setProducts(productsResponse.data || []);
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
        title: `Oportunidade - ${clients.find(c => c.id === clientId)?.trade_name || clients.find(c => c.id === clientId)?.company_name || 'Cliente'}`,
        client_id: clientId,
        product_id: productId || null,
        implementation_value: implementationValue ? parseFloat(implementationValue) : null,
        monthly_value: monthlyValue ? parseFloat(monthlyValue) : null,
        value: (implementationValue || monthlyValue) ? 
          (parseFloat(implementationValue || "0") + parseFloat(monthlyValue || "0")) : null,
        probability: parseInt(probability),
        status: status as any,
        assigned_to: assignedTo || user.id,
        expected_close_date: expectedCloseDate || null,
        created_by: user.id,
        business_type: businessType as any,
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
    setClientId("");
    setProductId("");
    setImplementationValue("");
    setMonthlyValue("");
    setProbability("50");
    setStatus("lead");
    setAssignedTo("");
    setExpectedCloseDate("");
    setBusinessType("cliente_novo");
  };

  const getFilteredOpportunities = () => {
    return opportunities.filter((opp) => {
      const matchesClient = searchClient === "" || 
        opp.client?.company_name?.toLowerCase().includes(searchClient.toLowerCase()) ||
        opp.client?.trade_name?.toLowerCase().includes(searchClient.toLowerCase());
      
      const oppDate = new Date(opp.created_at);
      const matchesStartDate = !startDate || oppDate >= new Date(startDate);
      const matchesEndDate = !endDate || oppDate <= new Date(endDate);
      
      const matchesAssignedTo = !filterAssignedTo || opp.assigned_to === filterAssignedTo;
      const matchesProduct = !filterProduct || opp.product_id === filterProduct;
      const matchesProbability = !filterProbability || opp.probability?.toString() === filterProbability;
      const matchesBusinessType = !filterBusinessType || opp.business_type === filterBusinessType;
      
      return matchesClient && matchesStartDate && matchesEndDate && 
             matchesAssignedTo && matchesProduct && matchesProbability && matchesBusinessType;
    });
  };

  const getOpportunitiesByStage = (stageKey: string) => {
    const filtered = getFilteredOpportunities();
    return filtered.filter((opp) => opp.status === stageKey);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const updateOpportunityStatus = async (oppId: string, newStatus: string, showToast = true) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get current status
      const { data: currentOpp } = await supabase
        .from("opportunities")
        .select("status")
        .eq("id", oppId)
        .single();

      const { error } = await supabase
        .from("opportunities")
        .update({ status: newStatus as any })
        .eq("id", oppId);

      if (error) throw error;

      // Log activity
      if (currentOpp) {
        await supabase.from("opportunity_activities").insert({
          opportunity_id: oppId,
          activity_type: "status_change",
          description: "Estágio da oportunidade alterado",
          old_value: stages.find(s => s.key === currentOpp.status)?.label,
          new_value: stages.find(s => s.key === newStatus)?.label,
          created_by: user.id,
        });
      }

      if (showToast) {
        toast.success("Fase atualizada com sucesso!");
      }
      fetchData();
    } catch (error) {
      console.error("Error updating opportunity:", error);
      if (showToast) {
        toast.error("Erro ao atualizar fase");
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const opportunityId = active.id as string;
      const newStatus = over.id as string;
      updateOpportunityStatus(opportunityId, newStatus, true);
    }
    
    setActiveId(null);
  };

  const getNextStage = (currentStage: string) => {
    const currentIndex = stages.findIndex(s => s.key === currentStage);
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };

  const getPreviousStage = (currentStage: string) => {
    const currentIndex = stages.findIndex(s => s.key === currentStage);
    if (currentIndex > 0) {
      return stages[currentIndex - 1];
    }
    return null;
  };

  const handleEditOpportunity = async (opp: any) => {
    setEditingOpportunity(opp);
    setClientId(opp.client_id);
    setProductId(opp.product_id || "");
    setImplementationValue(opp.implementation_value?.toString() || "");
    setMonthlyValue(opp.monthly_value?.toString() || "");
    setProbability(opp.probability?.toString() || "50");
    setStatus(opp.status);
    setAssignedTo(opp.assigned_to);
    setExpectedCloseDate(opp.expected_close_date || "");
    setBusinessType(opp.business_type || "cliente_novo");
    
    // Fetch attachments
    fetchAttachments(opp.id);
    setEditDialogOpen(true);
  };

  const handleGenerateProposal = async (opp: any) => {
    try {
      toast.loading("Gerando proposta...");
      
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { opportunityId: opp.id },
      });

      toast.dismiss();

      if (error) throw error;

      if (data?.html) {
        setProposalHtml(data.html);
        setProposalTitle(opp.title);
        setShowProposal(true);
      }
    } catch (error: any) {
      toast.dismiss();
      console.error("Error generating proposal:", error);
      toast.error(error.message || "Erro ao gerar proposta");
    }
  };

  const fetchAttachments = async (opportunityId: string) => {
    try {
      const { data, error } = await supabase
        .from("opportunity_attachments")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !editingOpportunity) return;

    setUploadingFiles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const files = Array.from(e.target.files);
      
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        // Sanitize filename to remove special characters and spaces
        const sanitizedName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
          .replace(/_{2,}/g, '_'); // Replace multiple underscores with single
        const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("opportunity-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from("opportunity_attachments")
          .insert({
            opportunity_id: editingOpportunity.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;

        // Log activity
        await supabase.from("opportunity_activities").insert({
          opportunity_id: editingOpportunity.id,
          activity_type: "attachment_added",
          description: `Arquivo anexado: ${file.name}`,
          created_by: user.id,
        });
      }

      toast.success("Arquivos enviados com sucesso!");
      fetchAttachments(editingOpportunity.id);
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(error.message || "Erro ao enviar arquivos");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("opportunity-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("opportunity_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      // Log activity
      await supabase.from("opportunity_activities").insert({
        opportunity_id: editingOpportunity.id,
        activity_type: "attachment_removed",
        description: `Arquivo removido: ${attachment.file_name}`,
        created_by: user.id,
      });

      toast.success("Arquivo removido!");
      fetchAttachments(editingOpportunity.id);
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("opportunity-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleUpdateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get current opportunity data to compare changes
      const { data: currentOpp } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", editingOpportunity.id)
        .single();

      // Update opportunity
      const { error } = await supabase
        .from("opportunities")
        .update({
          client_id: clientId,
          product_id: productId || null,
          implementation_value: implementationValue ? parseFloat(implementationValue) : null,
          monthly_value: monthlyValue ? parseFloat(monthlyValue) : null,
          value: (implementationValue || monthlyValue) ? 
            (parseFloat(implementationValue || "0") + parseFloat(monthlyValue || "0")) : null,
          probability: parseInt(probability),
          status: status as any,
          assigned_to: assignedTo,
          expected_close_date: expectedCloseDate || null,
          business_type: businessType as any,
        })
        .eq("id", editingOpportunity.id);

      if (error) throw error;

      // Log activity for changes
      const activities = [];
      
      if (currentOpp.status !== status) {
        activities.push({
          opportunity_id: editingOpportunity.id,
          activity_type: "status_change",
          description: "Estágio da oportunidade alterado",
          old_value: stages.find(s => s.key === currentOpp.status)?.label,
          new_value: stages.find(s => s.key === status)?.label,
          created_by: user.id,
        });
      }

      if (currentOpp.probability !== parseInt(probability)) {
        activities.push({
          opportunity_id: editingOpportunity.id,
          activity_type: "edit",
          description: "Probabilidade atualizada",
          old_value: `${currentOpp.probability}%`,
          new_value: `${probability}%`,
          created_by: user.id,
        });
      }

      if (currentOpp.implementation_value !== (implementationValue ? parseFloat(implementationValue) : null) ||
          currentOpp.monthly_value !== (monthlyValue ? parseFloat(monthlyValue) : null)) {
        activities.push({
          opportunity_id: editingOpportunity.id,
          activity_type: "edit",
          description: "Valores atualizados",
          created_by: user.id,
        });
      }

      if (activities.length > 0) {
        await supabase.from("opportunity_activities").insert(activities);
      }

      toast.success("Oportunidade atualizada!");
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error updating opportunity:", error);
      toast.error(error.message || "Erro ao atualizar oportunidade");
    }
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
                  <Label htmlFor="product">Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="implementationValue">Valor de Implantação (R$)</Label>
                  <Input
                    id="implementationValue"
                    type="number"
                    step="0.01"
                    value={implementationValue}
                    onChange={(e) => setImplementationValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyValue">Valor Mensal (R$)</Label>
                  <Input
                    id="monthlyValue"
                    type="number"
                    step="0.01"
                    value={monthlyValue}
                    onChange={(e) => setMonthlyValue(e.target.value)}
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
                  <Label htmlFor="probability">Probabilidade</Label>
                  <Select value={probability} onValueChange={setProbability}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                      <SelectItem value="90">90%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Tipo de Negócio</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente_novo">Cliente Novo</SelectItem>
                    <SelectItem value="venda_na_base">Venda na Base</SelectItem>
                  </SelectContent>
                </Select>
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

      <Card className="shadow-lg">
        <CardHeader className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar cliente..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="date"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="date"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todos os vendedores</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todos os produtos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProbability} onValueChange={setFilterProbability}>
              <SelectTrigger>
                <SelectValue placeholder="Probabilidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todas as probabilidades</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="90">90%</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterBusinessType} onValueChange={setFilterBusinessType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Negócio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Todos os tipos</SelectItem>
                <SelectItem value="cliente_novo">Cliente Novo</SelectItem>
                <SelectItem value="venda_na_base">Venda na Base</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

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
        <DndContext 
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
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

                  <DroppableColumn id={stage.key}>
                    <div className="space-y-3">
                      {stageOpps.map((opp) => {
                        const nextStage = getNextStage(opp.status);
                        const previousStage = getPreviousStage(opp.status);
                        
                        return (
                          <DraggableCard key={opp.id} id={opp.id}>
                            <Card
                              className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary group cursor-pointer"
                              onClick={() => {
                                setSelectedOpportunity(opp);
                                setViewDialogOpen(true);
                              }}
                            >
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm line-clamp-2 flex-1">{opp.title}</CardTitle>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOpportunity(opp);
                                }}
                              >
                                <Edit size={14} />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ChevronRight size={14} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-background z-50">
                                  {stages
                                    .filter(s => s.key !== opp.status)
                                    .map(stage => (
                                      <DropdownMenuItem
                                        key={stage.key}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateOpportunityStatus(opp.id, stage.key);
                                        }}
                                      >
                                        Mover para {stage.label}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {opp.client?.trade_name || opp.client?.company_name}
                          </p>
                          {opp.product && (
                            <div className="flex items-center gap-2">
                              {opp.product.logo_url ? (
                                <img
                                  src={opp.product.logo_url}
                                  alt={opp.product.name}
                                  className="h-6 w-6 object-contain bg-white rounded p-0.5"
                                />
                              ) : null}
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                {opp.product.name}
                              </Badge>
                            </div>
                          )}
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
                          
                          <div className="flex items-center gap-1 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                            {previousStage && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOpportunityStatus(opp.id, previousStage.key);
                                }}
                              >
                                <ChevronLeft size={12} className="mr-1" />
                                {previousStage.label}
                              </Button>
                            )}
                            {nextStage && (
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOpportunityStatus(opp.id, nextStage.key);
                                }}
                              >
                                {nextStage.label}
                                <ChevronRight size={12} className="ml-1" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </DraggableCard>
                  );
                })}
              </div>
            </DroppableColumn>
          </div>
        );
      })}
    </div>
  </DndContext>
      ) : (
        <div className="space-y-4">
          {getFilteredOpportunities().map((opp) => {
            const stage = stages.find((s) => s.key === opp.status);
            const nextStage = getNextStage(opp.status);
            const previousStage = getPreviousStage(opp.status);
            
            return (
              <Card 
                key={opp.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedOpportunity(opp);
                  setViewDialogOpen(true);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{opp.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {opp.client?.trade_name || opp.client?.company_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditOpportunity(opp);
                        }}
                      >
                        <Edit size={16} className="mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateProposal(opp);
                        }}
                      >
                        <FileText size={16} className="mr-1" />
                        Proposta
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge 
                            className={`${stage?.color} cursor-pointer hover:opacity-80`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {stage?.label}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background z-50">
                          {stages
                            .filter(s => s.key !== opp.status)
                            .map(stage => (
                              <DropdownMenuItem
                                key={stage.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateOpportunityStatus(opp.id, stage.key);
                                }}
                              >
                                Mover para {stage.label}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Produto</p>
                      {opp.product ? (
                        <div className="flex items-center gap-2">
                          {opp.product.logo_url && (
                            <img
                              src={opp.product.logo_url}
                              alt={opp.product.name}
                              className="h-6 w-6 object-contain bg-white rounded p-0.5"
                            />
                          )}
                          <p className="text-sm font-medium">{opp.product.name}</p>
                        </div>
                      ) : (
                        <p className="text-sm font-medium">-</p>
                      )}
                    </div>
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
                  
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOpportunityForLog(opp.id);
                        setShowActivityLog(true);
                      }}
                    >
                      Ver Histórico
                    </Button>
                    {previousStage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateOpportunityStatus(opp.id, previousStage.key);
                        }}
                      >
                        <ChevronLeft size={16} className="mr-1" />
                        Voltar para {previousStage.label}
                      </Button>
                    )}
                    {nextStage && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateOpportunityStatus(opp.id, nextStage.key);
                        }}
                      >
                        Avançar para {nextStage.label}
                        <ChevronRight size={16} className="ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OpportunityEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleUpdateOpportunity}
        clients={clients}
        products={products}
        users={users}
        stages={stages}
        clientId={clientId}
        setClientId={setClientId}
        productId={productId}
        setProductId={setProductId}
        implementationValue={implementationValue}
        setImplementationValue={setImplementationValue}
        monthlyValue={monthlyValue}
        setMonthlyValue={setMonthlyValue}
        probability={probability}
        setProbability={setProbability}
        status={status}
        setStatus={setStatus}
        assignedTo={assignedTo}
        setAssignedTo={setAssignedTo}
        expectedCloseDate={expectedCloseDate}
        setExpectedCloseDate={setExpectedCloseDate}
        businessType={businessType}
        setBusinessType={setBusinessType}
        attachments={attachments}
        onFileUpload={handleFileUpload}
        onDownloadAttachment={handleDownloadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        uploadingFiles={uploadingFiles}
      />

      {showActivityLog && selectedOpportunityForLog && (
        <Dialog open={showActivityLog} onOpenChange={setShowActivityLog}>
          <DialogContent className="max-w-2xl">
            <OpportunityActivityLog opportunityId={selectedOpportunityForLog} />
          </DialogContent>
        </Dialog>
      )}

      <ProposalViewer
        open={showProposal}
        onOpenChange={setShowProposal}
        proposalHtml={proposalHtml}
        opportunityTitle={proposalTitle}
      />

      <OpportunityViewDialog
        opportunity={selectedOpportunity}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </div>
  );
};

export default Oportunidades;