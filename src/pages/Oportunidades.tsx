import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/hooks/useViewMode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, TrendingUp, LayoutGrid, List, ChevronRight, ChevronLeft, Search, Calendar as CalendarIcon, Edit, Paperclip, Upload, X, Download, FileText, Building2, Maximize2, Minimize2, Filter, Clock, TrendingUp as TrendingUpIcon, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CurrencyInput, formatCurrency, calculateAnnualizedValue, formatAnnualizedValue } from "@/components/ui/masked-input";
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
import { LossReasonDialog } from "@/components/LossReasonDialog";
import { WonFormDialog } from "@/components/WonFormDialog";
import { DroppableColumn } from "@/components/DroppableColumn";
import { DraggableCard } from "@/components/DraggableCard";
import { SwipeableCard } from "@/components/SwipeableCard";
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
  const navigate = useNavigate();
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
  const [viewModeKanban, setViewModeKanban] = useState<"kanban" | "list">("kanban");
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [selectedOpportunityForLog, setSelectedOpportunityForLog] = useState<string | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalHtml, setProposalHtml] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lossReasonDialogOpen, setLossReasonDialogOpen] = useState(false);
  const [selectedLossReason, setSelectedLossReason] = useState<string>("");
  const [pendingStatus, setPendingStatus] = useState<string>("");
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [initialFilterApplied, setInitialFilterApplied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<any>(null);
  const [proposalRequiredDialogOpen, setProposalRequiredDialogOpen] = useState(false);
  const [pendingProposalOpportunity, setPendingProposalOpportunity] = useState<any>(null);
  const [wonFormDialogOpen, setWonFormDialogOpen] = useState(false);
  const [wonFormOpportunity, setWonFormOpportunity] = useState<any>(null);

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
  
  // Quick filters for list view
  const [quickStatusFilter, setQuickStatusFilter] = useState("all");
  const [quickProbabilityFilter, setQuickProbabilityFilter] = useState("all");
  const [quickBusinessTypeFilter, setQuickBusinessTypeFilter] = useState("all");
  const [compactView, setCompactView] = useViewMode("opportunities-compact-view", "cards");
  
  // Quick filters for Kanban
  const [quickFilterSeller, setQuickFilterSeller] = useState("");
  const [quickFilterProduct, setQuickFilterProduct] = useState("");
  const [quickFilterProbability, setQuickFilterProbability] = useState("");
  
  // Sort configuration
  type SortField = "value" | "created_at" | "probability" | "expected_close_date";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
  const [chargeCommission, setChargeCommission] = useState(false);
  const [commissionPercentage, setCommissionPercentage] = useState("");
  const [billingType, setBillingType] = useState("recorrente");
  const [hasNegotiatedFees, setHasNegotiatedFees] = useState(false);
  const [negotiatedFeeValues, setNegotiatedFeeValues] = useState<number[]>([]);

  const stages = [
    { 
      key: "lead", 
      label: "Lead", 
      color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      borderColor: "border-l-slate-400",
      bgGradient: "from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
    },
    { 
      key: "contacted", 
      label: "Contatado", 
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      borderColor: "border-l-blue-500",
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950"
    },
    { 
      key: "qualified", 
      label: "Qualificado", 
      color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
      borderColor: "border-l-cyan-500",
      bgGradient: "from-cyan-50 to-cyan-100 dark:from-cyan-900 dark:to-cyan-950"
    },
    { 
      key: "apresentacao", 
      label: "Apresentação", 
      color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      borderColor: "border-l-purple-500",
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-950"
    },
    { 
      key: "proposal", 
      label: "Proposta", 
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      borderColor: "border-l-amber-500",
      bgGradient: "from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-950"
    },
    { 
      key: "negotiation", 
      label: "Negociação", 
      color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      borderColor: "border-l-orange-500",
      bgGradient: "from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-950"
    },
    { 
      key: "won", 
      label: "Ganho", 
      color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      borderColor: "border-l-green-500",
      bgGradient: "from-green-50 to-green-100 dark:from-green-900 dark:to-green-950"
    },
    { 
      key: "lost", 
      label: "Perdido", 
      color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      borderColor: "border-l-red-500",
      bgGradient: "from-red-50 to-red-100 dark:from-red-900 dark:to-red-950"
    },
  ];

  useEffect(() => {
    checkUserRoleAndFetch();
  }, []);

  // Apply initial filter for vendedor role
  useEffect(() => {
    if (currentUserId && userRole === "vendedor" && !initialFilterApplied) {
      setQuickFilterSeller(currentUserId);
      setFilterAssignedTo(currentUserId);
      setInitialFilterApplied(true);
    }
  }, [currentUserId, userRole, initialFilterApplied]);

  const checkUserRoleAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setUserRole(roleData?.role || null);
      
      await fetchData();
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

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
        supabase.from("profiles").select("id, full_name").or("is_deleted.is.null,is_deleted.eq.false"),
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
        title: `Oportunidade - ${clients.find(c => c.id === clientId)?.company_name || clients.find(c => c.id === clientId)?.trade_name || 'Cliente'}`,
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
        charge_commission: chargeCommission,
        billing_type: billingType,
        has_negotiated_fees: hasNegotiatedFees,
        negotiated_fee_values: hasNegotiatedFees ? negotiatedFeeValues : [],
        negotiated_fee_average: hasNegotiatedFees && negotiatedFeeValues.length > 0
          ? negotiatedFeeValues.reduce((a, b) => a + b, 0) / negotiatedFeeValues.length
          : null,
      } as any]);

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
    setChargeCommission(false);
    setBillingType("recorrente");
    setHasNegotiatedFees(false);
    setNegotiatedFeeValues([]);
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
      
      // Quick filters for list view
      const matchesQuickStatus = quickStatusFilter === "all" || opp.status === quickStatusFilter;
      const matchesQuickProbability = quickProbabilityFilter === "all" || opp.probability?.toString() === quickProbabilityFilter;
      const matchesQuickBusinessType = quickBusinessTypeFilter === "all" || opp.business_type === quickBusinessTypeFilter;
      
      // Quick filters for Kanban
      const matchesQuickSeller = !quickFilterSeller || opp.assigned_to === quickFilterSeller;
      const matchesQuickProduct = !quickFilterProduct || opp.product_id === quickFilterProduct;
      const matchesQuickProbabilityKanban = !quickFilterProbability || opp.probability?.toString() === quickFilterProbability;
      
      return matchesClient && matchesStartDate && matchesEndDate && 
             matchesAssignedTo && matchesProduct && matchesProbability && matchesBusinessType &&
             matchesQuickStatus && matchesQuickProbability && matchesQuickBusinessType &&
             matchesQuickSeller && matchesQuickProduct && matchesQuickProbabilityKanban;
    });
  };

  const calculateStageMetrics = (stageKey: string) => {
    const stageOpps = opportunities.filter(opp => opp.status === stageKey);
    const stageIndex = stages.findIndex(s => s.key === stageKey);
    const nextStage = stages[stageIndex + 1];
    
    // Calculate average days in stage
    let avgDays = 0;
    if (stageOpps.length > 0) {
      const totalDays = stageOpps.reduce((sum, opp) => {
        const createdDate = new Date(opp.created_at);
        const now = new Date();
        const days = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avgDays = Math.round(totalDays / stageOpps.length);
    }
    
    // Calculate conversion rate to next stage
    let conversionRate = 0;
    if (nextStage && stageIndex < stages.length - 2) { // Exclude "won" and "lost"
      const allOppsFromThisStage = opportunities.filter(opp => 
        opp.status === stageKey || opp.status === nextStage.key
      );
      if (allOppsFromThisStage.length > 0) {
        const converted = opportunities.filter(opp => opp.status === nextStage.key).length;
        conversionRate = Math.round((converted / allOppsFromThisStage.length) * 100);
      }
    }
    
    // Determine color based on metrics
    let daysColor = "text-green-600 dark:text-green-400";
    let conversionColor = "text-green-600 dark:text-green-400";
    
    if (avgDays > 30) daysColor = "text-red-600 dark:text-red-400";
    else if (avgDays > 15) daysColor = "text-amber-600 dark:text-amber-400";
    
    if (conversionRate < 30) conversionColor = "text-red-600 dark:text-red-400";
    else if (conversionRate < 60) conversionColor = "text-amber-600 dark:text-amber-400";
    
    return { avgDays, conversionRate, daysColor, conversionColor };
  };

  const getOpportunitiesByStage = (stageKey: string) => {
    const filtered = getFilteredOpportunities();
    const stageOpps = filtered.filter((opp) => opp.status === stageKey);
    
    // Apply sorting
    return stageOpps.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortField) {
        case "value":
          compareValue = (Number(a.value) || 0) - (Number(b.value) || 0);
          break;
        case "created_at":
          compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "probability":
          compareValue = (Number(a.probability) || 0) - (Number(b.probability) || 0);
          break;
        case "expected_close_date":
          const dateA = a.expected_close_date ? new Date(a.expected_close_date).getTime() : 0;
          const dateB = b.expected_close_date ? new Date(b.expected_close_date).getTime() : 0;
          compareValue = dateA - dateB;
          break;
      }
      
      return sortDirection === "asc" ? compareValue : -compareValue;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortLabel = (field: SortField) => {
    const labels = {
      value: "Valor",
      created_at: "Data Criação",
      probability: "Probabilidade",
      expected_close_date: "Data Fechamento"
    };
    return labels[field];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const updateOpportunityStatus = async (oppId: string, newStatus: string, showToast = true) => {
    // Check if changing to "won" status - show won form dialog
    if (newStatus === "won") {
      const opp = opportunities.find(o => o.id === oppId);
      setWonFormOpportunity(opp);
      setWonFormDialogOpen(true);
      return;
    }

    // Check if changing to "lost" status - show loss reason dialog
    if (newStatus === "lost") {
      setPendingOpportunityId(oppId);
      setPendingStatus(newStatus);
      setLossReasonDialogOpen(true);
      return;
    }

    // Check if changing to "proposal" status - require proposal attachment
    if (newStatus === "proposal") {
      const { data: oppAttachments } = await supabase
        .from("opportunity_attachments")
        .select("id")
        .eq("opportunity_id", oppId)
        .limit(1);

      if (!oppAttachments || oppAttachments.length === 0) {
        const opp = opportunities.find(o => o.id === oppId);
        setPendingProposalOpportunity(opp);
        setProposalRequiredDialogOpen(true);
        return;
      }
    }

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
    setChargeCommission(opp.charge_commission || false);
    setCommissionPercentage(opp.commission_percentage?.toString() || "");
    setBillingType(opp.billing_type || "recorrente");
    setHasNegotiatedFees(opp.has_negotiated_fees || false);
    setNegotiatedFeeValues(
      Array.isArray(opp.negotiated_fee_values) ? opp.negotiated_fee_values : []
    );
    
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

    // Check if status is being changed to "won" via edit dialog
    if (status === "won" && editingOpportunity.status !== "won") {
      setEditDialogOpen(false);
      setWonFormOpportunity(editingOpportunity);
      setWonFormDialogOpen(true);
      return;
    }

    // Check if status is being changed to "lost"
    if (status === "lost" && editingOpportunity.status !== "lost" && !selectedLossReason) {
      setPendingStatus("lost");
      setLossReasonDialogOpen(true);
      return;
    }

    // Check if status is being changed to "proposal" - require attachment
    if (status === "proposal" && editingOpportunity.status !== "proposal") {
      // Check if there are any attachments
      if (attachments.length === 0) {
        toast.error("É obrigatório anexar uma proposta para mover para a etapa de Proposta. Por favor, adicione um arquivo na aba Anexos.");
        return;
      }
    }

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
      const updateData: any = {
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
        charge_commission: chargeCommission,
        commission_percentage: chargeCommission && commissionPercentage ? parseFloat(commissionPercentage) : null,
        billing_type: billingType,
        has_negotiated_fees: hasNegotiatedFees,
        negotiated_fee_values: hasNegotiatedFees ? negotiatedFeeValues : [],
        negotiated_fee_average: hasNegotiatedFees && negotiatedFeeValues.length > 0
          ? negotiatedFeeValues.reduce((a, b) => a + b, 0) / negotiatedFeeValues.length
          : null,
      };

      // Add loss_reason_id if status is "lost"
      if (status === "lost") {
        updateData.loss_reason_id = selectedLossReason || null;
      }

      const { error } = await supabase
        .from("opportunities")
        .update(updateData)
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
      setSelectedLossReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error updating opportunity:", error);
      toast.error(error.message || "Erro ao atualizar oportunidade");
    }
  };

  const handleLossReasonSelected = async (reasonId: string) => {
    setSelectedLossReason(reasonId);
    setLossReasonDialogOpen(false);
    
    // Check if this is from drag-and-drop
    if (pendingOpportunityId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Get current status
        const { data: currentOpp } = await supabase
          .from("opportunities")
          .select("status")
          .eq("id", pendingOpportunityId)
          .single();

        const { error } = await supabase
          .from("opportunities")
          .update({ 
            status: "lost" as any,
            loss_reason_id: reasonId 
          })
          .eq("id", pendingOpportunityId);

        if (error) throw error;

        // Log activity
        if (currentOpp) {
          await supabase.from("opportunity_activities").insert({
            opportunity_id: pendingOpportunityId,
            activity_type: "status_change",
            description: "Estágio da oportunidade alterado",
            old_value: stages.find(s => s.key === currentOpp.status)?.label,
            new_value: "Perdido",
            created_by: user.id,
          });
        }

        toast.success("Fase atualizada com sucesso!");
        fetchData();
      } catch (error) {
        console.error("Error updating opportunity:", error);
        toast.error("Erro ao atualizar fase");
      } finally {
        setPendingOpportunityId(null);
        setPendingStatus("");
        setSelectedLossReason("");
      }
    } else {
      // From edit form - submit the form with the loss reason
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleUpdateOpportunity(fakeEvent);
    }
  };

  const handleDeleteOpportunity = async () => {
    if (!opportunityToDelete) return;

    try {
      const { error } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", opportunityToDelete.id);

      if (error) throw error;

      toast.success("Oportunidade excluída com sucesso!");
      setDeleteDialogOpen(false);
      setOpportunityToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting opportunity:", error);
      toast.error(error.message || "Erro ao excluir oportunidade");
    }
  };

  const canDeleteOpportunity = (opp: any) => {
    // Admin and gestor can delete any opportunity
    if (userRole === "admin" || userRole === "gestor") return true;
    // Vendedor can only delete opportunities they created
    if (userRole === "vendedor" && opp.created_by === currentUserId) return true;
    return false;
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
          {quickFilterSeller && userRole === "vendedor" && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                Exibindo apenas suas oportunidades
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setQuickFilterSeller("");
                  setFilterAssignedTo("");
                }}
              >
                Ver todas
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {viewModeKanban === "kanban" && (
            <Button
              variant={compactView === "compact" ? "default" : "outline"}
              size="sm"
              onClick={() => setCompactView(compactView === "compact" ? "cards" : "compact")}
              className="gap-2"
              title={compactView === "compact" ? "Visualização Expandida" : "Visualização Compacta"}
            >
              {compactView === "compact" ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              {compactView === "compact" ? "Expandir" : "Compacto"}
            </Button>
          )}
          
          <div className="flex border rounded-lg overflow-hidden">
            {viewModeKanban === "list" && (
              <div className="flex items-center gap-2 mr-2 animate-fade-in">
                <select 
                  value={quickStatusFilter} 
                  onChange={(e) => setQuickStatusFilter(e.target.value)}
                  className="h-9 px-3 text-sm border rounded-md bg-background"
                >
                  <option value="all">Todos Status</option>
                  {stages.map((stage) => (
                    <option key={stage.key} value={stage.key}>{stage.label}</option>
                  ))}
                </select>
                <select 
                  value={quickProbabilityFilter} 
                  onChange={(e) => setQuickProbabilityFilter(e.target.value)}
                  className="h-9 px-3 text-sm border rounded-md bg-background"
                >
                  <option value="all">Todas Probabilidades</option>
                  <option value="10">10%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="80">80%</option>
                  <option value="90">90%</option>
                </select>
                <select 
                  value={quickBusinessTypeFilter} 
                  onChange={(e) => setQuickBusinessTypeFilter(e.target.value)}
                  className="h-9 px-3 text-sm border rounded-md bg-background"
                >
                  <option value="all">Todos Tipos</option>
                  <option value="cliente_novo">Cliente Novo</option>
                  <option value="venda_na_base">Venda na Base</option>
                </select>
              </div>
            )}
            <Button
              variant={viewModeKanban === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewModeKanban("kanban")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewModeKanban === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewModeKanban("list")}
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
                          {client.company_name || client.trade_name}
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
                  <Label htmlFor="implementationValue">Valor de Implantação</Label>
                  <CurrencyInput
                    id="implementationValue"
                    value={implementationValue}
                    onValueChange={setImplementationValue}
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyValue">Valor Mensal</Label>
                  <CurrencyInput
                    id="monthlyValue"
                    value={monthlyValue}
                    onValueChange={setMonthlyValue}
                    placeholder="R$ 0,00"
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="chargeCommission"
                  checked={chargeCommission}
                  onChange={(e) => setChargeCommission(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="chargeCommission" className="text-sm font-normal cursor-pointer">
                  Cobrar comissão do cliente
                </Label>
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
      ) : viewModeKanban === "kanban" ? (
        <>
          {/* Quick Filters for Kanban */}
          <div className="mb-4 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtros Rápidos:</span>
              
              {/* Seller Filter */}
              <Badge
                variant={quickFilterSeller ? "default" : "outline"}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setQuickFilterSeller("")}
              >
                {quickFilterSeller 
                  ? users.find(u => u.id === quickFilterSeller)?.full_name || "Vendedor"
                  : "Todos Vendedores"}
                {quickFilterSeller && <X className="ml-1 h-3 w-3" />}
              </Badge>
              {!quickFilterSeller && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {users.map((user) => (
                      <DropdownMenuItem
                        key={user.id}
                        onClick={() => setQuickFilterSeller(user.id)}
                      >
                        {user.full_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Product Filter */}
              <Badge
                variant={quickFilterProduct ? "default" : "outline"}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setQuickFilterProduct("")}
              >
                {quickFilterProduct 
                  ? products.find(p => p.id === quickFilterProduct)?.name || "Produto"
                  : "Todos Produtos"}
                {quickFilterProduct && <X className="ml-1 h-3 w-3" />}
              </Badge>
              {!quickFilterProduct && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {products.map((product) => (
                      <DropdownMenuItem
                        key={product.id}
                        onClick={() => setQuickFilterProduct(product.id)}
                      >
                        {product.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Probability Filter */}
              <Badge
                variant={quickFilterProbability ? "default" : "outline"}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setQuickFilterProbability("")}
              >
                {quickFilterProbability 
                  ? `${quickFilterProbability}%`
                  : "Todas Probabilidades"}
                {quickFilterProbability && <X className="ml-1 h-3 w-3" />}
              </Badge>
              {!quickFilterProbability && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setQuickFilterProbability("10")}>10%</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuickFilterProbability("25")}>25%</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuickFilterProbability("50")}>50%</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuickFilterProbability("80")}>80%</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuickFilterProbability("90")}>90%</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {/* Contador de oportunidades filtradas */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUpIcon className="h-4 w-4" />
              <span className="font-medium">
                {getFilteredOpportunities().length} oportunidades encontradas
              </span>
            </div>
          </div>
          
          <DndContext 
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
          <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scroll-smooth">
            {stages.map((stage) => {
              const stageOpps = getOpportunitiesByStage(stage.key);
              const stageAnnualizedValue = stageOpps.reduce(
                (sum, opp) => sum + calculateAnnualizedValue(opp.monthly_value, opp.implementation_value, opp.billing_type),
                0
              );
              const metrics = calculateStageMetrics(stage.key);

              return (
                <div key={stage.key} className="flex-shrink-0 w-64 space-y-2 animate-fade-in snap-center">
                  <Card className={`shadow-md bg-gradient-to-br ${stage.bgGradient} border ${stage.borderColor}`}>
                    <CardHeader className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold text-sm ${stage.color.split(' ')[1]}`}>
                          {stage.label}
                        </h3>
                        <div className="flex items-center gap-1">
                          <Badge className={`${stage.color} font-semibold text-xs h-5`}>
                            {stageOpps.length}
                          </Badge>
                          
                          {/* Sort Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-background/50"
                                title="Ordenar"
                              >
                                {sortDirection === "asc" ? (
                                  <ArrowUp className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                Ordenar por
                              </div>
                              <DropdownMenuItem
                                onClick={() => toggleSort("value")}
                                className={sortField === "value" ? "bg-accent" : ""}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Valor</span>
                                  {sortField === "value" && (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleSort("probability")}
                                className={sortField === "probability" ? "bg-accent" : ""}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Probabilidade</span>
                                  {sortField === "probability" && (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleSort("created_at")}
                                className={sortField === "created_at" ? "bg-accent" : ""}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Data Criação</span>
                                  {sortField === "created_at" && (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleSort("expected_close_date")}
                                className={sortField === "expected_close_date" ? "bg-accent" : ""}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Data Fechamento</span>
                                  {sortField === "expected_close_date" && (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {/* Active Sort Indicator */}
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <ArrowUpDown className="h-2.5 w-2.5" />
                        <span>
                          {getSortLabel(sortField)} ({sortDirection === "asc" ? "Crescente" : "Decrescente"})
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded px-1.5 py-1">
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Total Anualizado</span>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(stageAnnualizedValue)}
                        </p>
                      </div>
                      
                      {/* Performance Metrics - Fixed height for symmetry */}
                      <div className="pt-2 space-y-1 border-t border-border/30 min-h-[44px]">
                        {stage.key !== "won" && stage.key !== "lost" && (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[9px] text-muted-foreground">Tempo médio</span>
                              </div>
                              <span className={`text-[10px] font-bold ${metrics.daysColor}`}>
                                {metrics.avgDays}d
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <TrendingUpIcon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[9px] text-muted-foreground">Taxa conversão</span>
                              </div>
                              <span className={`text-[10px] font-bold ${metrics.conversionColor}`}>
                                {metrics.conversionRate}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </CardHeader>
                  </Card>

                  <DroppableColumn id={stage.key}>
                    <div className="space-y-2 min-h-[200px]">
                      {stageOpps.map((opp) => {
                        const nextStage = getNextStage(opp.status);
                        const previousStage = getPreviousStage(opp.status);
                        
                        return (
                          <DraggableCard key={opp.id} id={opp.id}>
                            <Card
                              className={`hover:shadow-lg hover:scale-[1.01] transition-all duration-200 border-l-4 ${stage.borderColor} group cursor-pointer bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in`}
                              onClick={() => {
                                setSelectedOpportunity(opp);
                                setViewDialogOpen(true);
                              }}
                            >
                        {compactView === "compact" ? (
                          // Modo Ultra-Compacto
                          <CardContent className="p-2 space-y-1.5">
                            <div className="flex items-center gap-1">
                              <Building2 size={10} className="text-muted-foreground flex-shrink-0" />
                              <p className="text-[9px] font-medium text-foreground line-clamp-1 flex-1">
                                {opp.client?.company_name || opp.client?.trade_name}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 px-1 text-[8px] font-semibold text-primary hover:text-primary/80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/prospects/${opp.client_id}`);
                                }}
                                title="Ver Prospect"
                              >
                                <ExternalLink size={8} className="mr-0.5" />
                                Ver
                              </Button>
                            </div>
                            
                            {/* Valor Anualizado Destacado */}
                            <div className="p-1.5 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 rounded border border-emerald-500/30">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400">
                                  {opp.billing_type === 'pontual' ? 'Pontual' : 'Anualizado'}
                                </span>
                                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatAnnualizedValue(opp.monthly_value, opp.implementation_value, opp.billing_type)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-center pt-1">
                              <Badge variant="outline" className="text-[9px] font-semibold h-4">
                                {opp.probability}%
                              </Badge>
                            </div>
                          </CardContent>
                        ) : (
                          // Modo Completo
                          <>
                            <CardHeader className="p-3 pb-2">
                              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                <CardTitle className="text-xs font-bold line-clamp-2 flex-1 group-hover:text-primary transition-colors">{opp.title}</CardTitle>
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
                                      {canDeleteOpportunity(opp) && (
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpportunityToDelete(opp);
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 size={14} className="mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-2">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <Building2 size={12} className="text-muted-foreground flex-shrink-0" />
                                  <p className="text-[10px] font-medium text-foreground line-clamp-1">
                                    {opp.client?.company_name || opp.client?.trade_name}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] font-semibold whitespace-nowrap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/prospects/${opp.client_id}`);
                                  }}
                                  title="Ver Prospect"
                                >
                                  <ExternalLink size={12} className="mr-1" />
                                  Ver Prospect
                                </Button>
                              </div>
                              
                              {opp.product && (
                                <div className="flex items-center gap-1.5 p-1.5 bg-primary/5 rounded border border-primary/10">
                                  {opp.product.logo_url ? (
                                    <img
                                      src={opp.product.logo_url}
                                      alt={opp.product.name}
                                      className="h-4 w-4 object-contain bg-white rounded p-0.5"
                                    />
                                  ) : null}
                                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold h-4">
                                    {opp.product.name}
                                  </Badge>
                                </div>
                              )}
                              
                              {/* Valor Anualizado Destacado */}
                              <div className="p-2 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent rounded-lg border border-emerald-500/30">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                                    {opp.billing_type === 'pontual' ? 'Valor Pontual' : 'Valor Anualizado'}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                  {formatAnnualizedValue(opp.monthly_value, opp.implementation_value, opp.billing_type)}
                                </p>
                                {(opp.monthly_value || opp.implementation_value) && (
                                  <div className="flex gap-2 mt-1 text-[8px] text-muted-foreground">
                                    {opp.monthly_value && <span>Mensal: {formatCurrency(opp.monthly_value)}</span>}
                                    {opp.implementation_value && <span>Impl: {formatCurrency(opp.implementation_value)}</span>}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/30">
                                <Badge variant="outline" className="text-[10px] font-semibold h-4">
                                  {opp.probability}%
                                </Badge>
                                {opp.assigned && (
                                  <p className="text-[10px] text-muted-foreground truncate font-medium">
                                    {opp.assigned.full_name}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5 pt-2 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                {previousStage && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-6 text-[10px] font-semibold hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateOpportunityStatus(opp.id, previousStage.key);
                                    }}
                                  >
                                    <ChevronLeft size={12} className="mr-0.5" />
                                    Voltar
                                  </Button>
                                )}
                                {nextStage && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="flex-1 h-6 text-[10px] font-semibold bg-primary hover:bg-primary/90"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateOpportunityStatus(opp.id, nextStage.key);
                                    }}
                                  >
                                    Avançar
                                    <ChevronRight size={12} className="ml-0.5" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </>
                        )}
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
        </>
      ) : (
        <div 
          key={viewModeKanban}
          className="space-y-4 animate-fade-in"
        >
          {getFilteredOpportunities().map((opp) => {
            const stage = stages.find((s) => s.key === opp.status);
            const nextStage = getNextStage(opp.status);
            const previousStage = getPreviousStage(opp.status);
            
            return (
              <SwipeableCard
                key={opp.id}
                onEdit={() => handleEditOpportunity(opp)}
              >
              <Card 
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
                        {opp.client?.company_name || opp.client?.trade_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/prospects/${opp.client_id}`);
                        }}
                      >
                        <ExternalLink size={16} className="mr-1" />
                        Ver Prospect
                      </Button>
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
                      {canDeleteOpportunity(opp) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpportunityToDelete(opp);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 size={16} className="mr-1" />
                          Excluir
                        </Button>
                      )}
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
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                    <div className="p-2 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 rounded-lg border border-emerald-500/30">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1 font-medium">
                        {opp.billing_type === 'pontual' ? 'Valor Pontual' : 'Valor Anualizado'}
                      </p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatAnnualizedValue(opp.monthly_value, opp.implementation_value, opp.billing_type)}
                      </p>
                      {(opp.monthly_value || opp.implementation_value) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {opp.monthly_value ? `M: ${formatCurrency(opp.monthly_value)}` : ''} 
                          {opp.monthly_value && opp.implementation_value ? ' • ' : ''}
                          {opp.implementation_value ? `I: ${formatCurrency(opp.implementation_value)}` : ''}
                        </p>
                      )}
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
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tipo</p>
                      <Badge variant={opp.business_type === 'cliente_novo' ? 'default' : 'secondary'} className="text-xs">
                        {opp.business_type === 'cliente_novo' ? 'Cliente Novo' : 'Venda na Base'}
                      </Badge>
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
              </SwipeableCard>
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
        chargeCommission={chargeCommission}
        setChargeCommission={setChargeCommission}
        commissionPercentage={commissionPercentage}
        setCommissionPercentage={setCommissionPercentage}
        billingType={billingType}
        setBillingType={setBillingType}
        attachments={attachments}
        onFileUpload={handleFileUpload}
        onDownloadAttachment={handleDownloadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        uploadingFiles={uploadingFiles}
      />

      <LossReasonDialog
        open={lossReasonDialogOpen}
        onOpenChange={(open) => {
          setLossReasonDialogOpen(open);
          if (!open) {
            // Reset pending states when dialog is closed
            setPendingOpportunityId(null);
            setPendingStatus("");
          }
        }}
        onReasonSelected={handleLossReasonSelected}
      />

      <WonFormDialog
        open={wonFormDialogOpen}
        onOpenChange={(open) => {
          setWonFormDialogOpen(open);
          if (!open) setWonFormOpportunity(null);
        }}
        opportunity={wonFormOpportunity}
        onSubmitSuccess={() => {
          setWonFormDialogOpen(false);
          setWonFormOpportunity(null);
          fetchData();
        }}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Oportunidade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta oportunidade? Esta ação não pode ser desfeita.
              {opportunityToDelete && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>{opportunityToDelete.title}</strong>
                  <br />
                  Cliente: {opportunityToDelete.client?.company_name || opportunityToDelete.client?.trade_name}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOpportunity}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proposal Required Dialog */}
      <AlertDialog open={proposalRequiredDialogOpen} onOpenChange={(open) => {
        setProposalRequiredDialogOpen(open);
        if (!open) setPendingProposalOpportunity(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              Proposta Obrigatória
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Para mover a oportunidade para a etapa de <strong>Proposta</strong>, é necessário anexar pelo menos um arquivo de proposta.</p>
              {pendingProposalOpportunity && (
                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                  <strong>{pendingProposalOpportunity.title}</strong>
                  <br />
                  <span className="text-muted-foreground">
                    Cliente: {pendingProposalOpportunity.client?.company_name || pendingProposalOpportunity.client?.trade_name}
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingProposalOpportunity) {
                  handleEditOpportunity(pendingProposalOpportunity);
                  setProposalRequiredDialogOpen(false);
                  // Switch to attachments tab - the user needs to upload a file first
                  toast.info("Adicione a proposta na aba 'Anexos' e depois altere o estágio para 'Proposta'.");
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Editar e Anexar Proposta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Oportunidades;