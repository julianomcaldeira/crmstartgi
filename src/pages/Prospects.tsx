import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CNPJInput, PhoneInput, CEPInput, CurrencyInput } from "@/components/ui/masked-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Building2, MapPin, Phone, Mail, Loader2, User, ChevronLeft, ChevronRight, Edit, CheckCircle2, XCircle, Trash2, UserCog, LayoutGrid, List, Upload, ArrowUpDown, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClientEditDialog } from "@/components/ClientEditDialog";
import { ImportWizard } from "@/components/ImportWizard";
import { QuickImportDialog } from "@/components/QuickImportDialog";
import { validateCNPJ } from "@/lib/cnpjValidator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableCard } from "@/components/SwipeableCard";
import { useViewMode } from "@/hooks/useViewMode";

const Prospects = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [selectedFeiraFilter, setSelectedFeiraFilter] = useState<string>("all");
  const [selectedCompanySize, setSelectedCompanySize] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [cnpjValidationStatus, setCnpjValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prospectToDelete, setProspectToDelete] = useState<any>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [prospectToTransfer, setProspectToTransfer] = useState<any>(null);
  const [selectedNewSeller, setSelectedNewSeller] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [quickImportOpen, setQuickImportOpen] = useState(false);
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState("");
  
  // Client form fields
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [segment, setSegment] = useState("");
  const [shareCapital, setShareCapital] = useState("");
  const [legalNature, setLegalNature] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [region, setRegion] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [distributor, setDistributor] = useState("");
  const [services, setServices] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [foundationDate, setFoundationDate] = useState("");
  const [cnaePrincipal, setCnaePrincipal] = useState("");
  const [cnaeDescription, setCnaeDescription] = useState("");
  const [selectedFeiras, setSelectedFeiras] = useState<string[]>([]);
  const [feiras, setFeiras] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [viewMode, setViewMode] = useViewMode("prospects-view-mode", "cards");
  
  // Quick filters for compact view
  const [quickRatingFilter, setQuickRatingFilter] = useState<number | null>(null);
  const [quickRegionFilter, setQuickRegionFilter] = useState("all");
  const [quickSegmentFilter, setQuickSegmentFilter] = useState("all");
  
  // Date filter for creation date
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  // Contacts
  const [contacts, setContacts] = useState<any[]>([{
    name: "", role: "", email: "", phone: "", mobile: "", is_primary: true
  }]);

  const [initialFilterApplied, setInitialFilterApplied] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      // Executar fetches independentes em paralelo para maior velocidade
      await Promise.all([
        fetchCurrentUser(),
        fetchSellers(),
        fetchFeiras(),
        fetchProducts()
      ]);
      
      // Buscar clientes por último (é a query mais pesada)
      await fetchClients();
    };
    
    initialize();
  }, []);

  // Aplicar filtro automático para vendedor
  useEffect(() => {
    if (currentUserId && userRoles.includes('vendedor') && !userRoles.includes('admin') && !userRoles.includes('gestor') && !initialFilterApplied) {
      setSelectedSeller("my_portfolio");
      setInitialFilterApplied(true);
    }
  }, [currentUserId, userRoles, initialFilterApplied]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (rolesError) throw rolesError;
      setUserRoles(rolesData?.map(r => r.role) || []);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchFeiras = async () => {
    try {
      const { data, error } = await supabase
        .from("feiras")
        .select("id, name, start_date, city")
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      setFeiras(data || []);
    } catch (error) {
      console.error("Error fetching feiras:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      
      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error("Error fetching sellers:", error);
    }
  };

  const fetchClients = async () => {
    try {
      console.log("Fetching clients with pagination...");

      const pageSize = 1000;
      let from = 0;
      let allClients: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("clients")
          .select(`
          *,
          contacts(*),
          created_by_profile:profiles!clients_created_by_fkey(full_name, email),
          client_feiras(feira_id)
        `)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching clients page:", error);
          throw error;
        }

        if (!data || data.length === 0) {
          break;
        }

        allClients = allClients.concat(data);

        // Se retornou menos do que o tamanho da página, não há mais registros
        if (data.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      console.log("Clients data fetched:", allClients.length, "records");
      setClients(allClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar prospects");
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjChange = (value: string) => {
    setCnpj(value);
    const cleanedCnpj = value.replace(/\D/g, '');
    
    // Validação em tempo real
    if (cleanedCnpj.length === 0) {
      setCnpjValidationStatus('idle');
    } else if (cleanedCnpj.length === 14) {
      const isValid = validateCNPJ(cleanedCnpj);
      setCnpjValidationStatus(isValid ? 'valid' : 'invalid');
      
      // Se válido, busca automaticamente
      if (isValid) {
        handleCnpjBlur(cleanedCnpj);
      }
    } else {
      setCnpjValidationStatus('idle');
    }
  };

  const handleCnpjBlur = async (cnpjToSearch?: string) => {
    const cleanedCnpj = cnpjToSearch || cnpj.replace(/\D/g, '');
    
    console.log("=== INICIANDO BUSCA DE CNPJ ===");
    console.log("CNPJ limpo:", cleanedCnpj);
    
    if (cleanedCnpj.length !== 14) {
      console.log("CNPJ incompleto, abortando busca");
      return;
    }
    
    // Valida CNPJ antes de buscar
    if (!validateCNPJ(cleanedCnpj)) {
      console.error("CNPJ inválido (falhou na validação do algoritmo)");
      toast.error("CNPJ inválido. Verifique os dígitos.");
      setCnpjValidationStatus('invalid');
      return;
    }
    
    setCnpjValidationStatus('valid');
    setLoadingCnpj(true);
    
    try {
      console.log("Chamando edge function buscar-cnpj...");
      
      const { data, error } = await supabase.functions.invoke("buscar-cnpj", {
        body: { cnpj: cleanedCnpj }
      });

      console.log("Resposta da edge function:", { data, error });

      if (error) {
        console.error("Erro da edge function:", error);
        throw new Error(error.message || "Erro ao buscar CNPJ");
      }

      if (data && !data.error) {
        console.log("✅ Dados recebidos com sucesso:", data);
        
        setCompanyName(data.company_name || "");
        setTradeName(data.trade_name || "");
        setEmail(data.email || "");
        setPhone(data.phone?.replace(/\D/g, '') || "");
        
        // Separar endereço em logradouro, número e complemento
        const addressParts = (data.address || "").split(',');
        if (addressParts.length > 0) {
          const firstPart = addressParts[0].trim();
          // Tentar extrair número do final do logradouro
          const numberMatch = firstPart.match(/(.+?)\s+(\d+.*?)$/);
          if (numberMatch) {
            setLogradouro(numberMatch[1].trim());
            setNumero(numberMatch[2].trim());
          } else {
            setLogradouro(firstPart);
            setNumero("");
          }
          // Complemento é tudo após a primeira vírgula
          setComplemento(addressParts.slice(1).join(',').trim());
        } else {
          setLogradouro("");
          setNumero("");
          setComplemento("");
        }
        
        setCity(data.city || "");
        setState(data.state || "");
        setZipCode(data.zip_code?.replace(/\D/g, '') || "");
        setSegment(data.segment || "");
        setShareCapital(data.share_capital?.toString() || "");
        setLegalNature(data.legal_nature || "");
        setRegistrationStatus(data.registration_status || "");
        setFoundationDate(data.foundation_date || "");
        setCnaePrincipal(data.cnae_principal || "");
        setCnaeDescription(data.cnae_description || "");
        
        const source = data.source === 'cache' ? ' (do cache)' : ' (da Receita Federal)';
        toast.success(`Dados da empresa carregados${source}!`);
      } else if (data?.error) {
        console.error("Erro retornado pela API:", data.error);
        toast.error(data.error);
      } else {
        console.error("Resposta inesperada da API:", data);
        toast.error("Resposta inesperada ao buscar CNPJ");
      }
    } catch (error: any) {
      console.error("❌ ERRO ao buscar CNPJ:", error);
      toast.error(
        error.message || 
        "Erro ao buscar dados do CNPJ. A API pode estar temporariamente indisponível. Tente novamente."
      );
    } finally {
      setLoadingCnpj(false);
      console.log("=== FIM DA BUSCA DE CNPJ ===");
    }
  };

  const addContact = () => {
    setContacts([...contacts, { name: "", role: "", email: "", phone: "", mobile: "", is_primary: false }]);
  };

  const updateContact = (index: number, field: string, value: any) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index));
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const cleanedCnpj = cnpj.replace(/\D/g, "");

      // Check if CNPJ already exists with responsible user info
      const { data: existingClient, error: checkError } = await supabase
        .from("clients")
        .select(`
          id, company_name, trade_name,
          created_by_profile:profiles!clients_created_by_fkey(full_name, email)
        `)
        .eq("cnpj", cleanedCnpj)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingClient) {
        const responsibleName = existingClient.created_by_profile?.full_name || "Usuário desconhecido";
        const responsibleEmail = existingClient.created_by_profile?.email || "";
        const companyDisplayName = existingClient.company_name || existingClient.trade_name;
        
        toast.error(
          `Este CNPJ já está cadastrado!`,
          {
            description: `A empresa "${companyDisplayName}" já existe na base e está sob responsabilidade de ${responsibleName}${responsibleEmail ? ` (${responsibleEmail})` : ''}.`,
            duration: 8000,
          }
        );
        return;
      }

      // Concatenar endereço completo
      const fullAddress = [
        logradouro,
        numero,
        complemento
      ].filter(Boolean).join(', ').trim();

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .insert({
          cnpj: cleanedCnpj,
          company_name: companyName,
          trade_name: tradeName,
          email,
          phone,
          address: fullAddress,
          city,
          state,
          zip_code: zipCode,
          segment,
          share_capital: shareCapital ? parseFloat(shareCapital) : null,
          legal_nature: legalNature,
          company_size: companySize,
          region: region,
          competitors: competitors,
          distributor: distributor,
          services: services,
          rating: rating > 0 ? rating : null,
          registration_status: registrationStatus,
          foundation_date: foundationDate || null,
          cnae_principal: cnaePrincipal,
          cnae_description: cnaeDescription,
          created_by: user.id,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Insert contacts
      const validContacts = contacts.filter(c => c.name.trim());
      if (validContacts.length > 0) {
        const contactsData = validContacts.map(contact => ({
          ...contact,
          client_id: clientData.id,
          created_by: user.id,
        }));

        const { error: contactsError } = await supabase
          .from("contacts")
          .insert(contactsData);

        if (contactsError) throw contactsError;
      }

      // Insert client-feira relationships
      if (selectedFeiras.length > 0) {
        const clientFeirasData = selectedFeiras.map(feiraId => ({
          client_id: clientData.id,
          feira_id: feiraId,
          created_by: user.id,
        }));

        const { error: feirasError } = await (supabase as any)
          .from("client_feiras")
          .insert(clientFeirasData);

        if (feirasError) throw feirasError;
      }

      toast.success("Prospect cadastrado com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast.error(error.message || "Erro ao cadastrar prospect");
    }
  };

  const resetForm = () => {
    setCnpj("");
    setCompanyName("");
    setTradeName("");
    setEmail("");
    setPhone("");
    setLogradouro("");
    setNumero("");
    setComplemento("");
    setCity("");
    setState("");
    setZipCode("");
    setSegment("");
    setShareCapital("");
    setLegalNature("");
    setRegistrationStatus("");
    setFoundationDate("");
    setCnaePrincipal("");
    setCnaeDescription("");
    setCompanySize("");
    setRegion("");
    setCompetitors("");
    setDistributor("");
    setServices("");
    setRating(0);
    setSelectedFeiras([]);
    setContacts([{ name: "", role: "", email: "", phone: "", mobile: "", is_primary: true }]);
  };

  const hasActiveFilters = searchTerm !== "" || selectedSeller !== "all" || selectedFeiraFilter !== "all" || 
    selectedCompanySize !== "all" || selectedRegion !== "" || quickRatingFilter !== null || 
    quickRegionFilter !== "all" || quickSegmentFilter !== "all" || dateFilterStart !== "" || dateFilterEnd !== "";

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedSeller("all");
    setSelectedFeiraFilter("all");
    setSelectedCompanySize("all");
    setSelectedRegion("");
    setQuickRatingFilter(null);
    setQuickRegionFilter("all");
    setQuickSegmentFilter("all");
    setDateFilterStart("");
    setDateFilterEnd("");
    toast.success("Todos os filtros foram limpos");
  };

  const filteredClients = useMemo(() => {
    // Remove máscara do CNPJ se o usuário digitar com formatação
    const cleanedSearchTerm = searchTerm.replace(/\D/g, '');
    const isSearchingByCnpj = cleanedSearchTerm.length > 0 && /^\d+$/.test(cleanedSearchTerm);
    
    const filtered = clients.filter((client) => {
      const matchesSearch = searchTerm === "" || 
        client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (isSearchingByCnpj ? client.cnpj?.includes(cleanedSearchTerm) : client.cnpj?.includes(searchTerm)) ||
        (client.trade_name && client.trade_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Enhanced seller filter with "my_portfolio" and "no_seller" options
      let matchesSeller = true;
      if (selectedSeller === "all") {
        matchesSeller = true;
      } else if (selectedSeller === "my_portfolio") {
        matchesSeller = client.created_by === currentUserId;
      } else if (selectedSeller === "no_seller") {
        matchesSeller = !client.created_by;
      } else {
        matchesSeller = client.created_by === selectedSeller;
      }
      
      const matchesFeira = selectedFeiraFilter === "all" || 
        (client.client_feiras && client.client_feiras.some((cf: any) => cf.feira_id === selectedFeiraFilter));
      
      const matchesCompanySize = selectedCompanySize === "all" || client.company_size === selectedCompanySize;
      
      const matchesRegion = selectedRegion === "" || selectedRegion === "all" || 
        (client.region && client.region.toLowerCase().includes(selectedRegion.toLowerCase()));
      
      // Quick filters for compact view
      const matchesQuickRating = quickRatingFilter === null || client.rating === quickRatingFilter;
      const matchesQuickRegion = quickRegionFilter === "all" || client.region === quickRegionFilter;
      const matchesQuickSegment = quickSegmentFilter === "all" || client.segment === quickSegmentFilter;
      
      // Date filter
      let matchesDateFilter = true;
      if (dateFilterStart || dateFilterEnd) {
        const clientDate = client.created_at ? new Date(client.created_at) : null;
        if (clientDate) {
          if (dateFilterStart) {
            const startDate = new Date(dateFilterStart);
            startDate.setHours(0, 0, 0, 0);
            if (clientDate < startDate) matchesDateFilter = false;
          }
          if (dateFilterEnd) {
            const endDate = new Date(dateFilterEnd);
            endDate.setHours(23, 59, 59, 999);
            if (clientDate > endDate) matchesDateFilter = false;
          }
        } else {
          matchesDateFilter = false;
        }
      }
      
      return matchesSearch && matchesSeller && matchesFeira && matchesCompanySize && matchesRegion &&
        matchesQuickRating && matchesQuickRegion && matchesQuickSegment && matchesDateFilter;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.company_name || "").localeCompare(b.company_name || "");
        case "name-desc":
          return (b.company_name || "").localeCompare(a.company_name || "");
        case "cnpj-asc":
          return (a.cnpj || "").localeCompare(b.cnpj || "");
        case "cnpj-desc":
          return (b.cnpj || "").localeCompare(a.cnpj || "");
        case "date-newest":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "date-oldest":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [clients, searchTerm, selectedSeller, selectedFeiraFilter, selectedCompanySize, selectedRegion, 
      quickRatingFilter, quickRegionFilter, quickSegmentFilter, currentUserId, sortBy, dateFilterStart, dateFilterEnd]);

  // Pagination with memoization
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClients = useMemo(() => {
    return filteredClients.slice(startIndex, endIndex);
  }, [filteredClients, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSeller, selectedFeiraFilter, selectedCompanySize, selectedRegion, quickRatingFilter, quickRegionFilter, quickSegmentFilter, sortBy, dateFilterStart, dateFilterEnd]);

  const canEditClient = (client: any) => {
    if (!currentUserId) return false;
    const isOwner = client.created_by === currentUserId;
    const isAdminOrGestor = userRoles.includes('admin') || userRoles.includes('gestor');
    return isOwner || isAdminOrGestor;
  };

  const handleDeleteClick = (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    setProspectToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProspect = async () => {
    if (!prospectToDelete) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", prospectToDelete.id);

      if (error) throw error;

      toast.success("Prospect excluído com sucesso!");
      setDeleteDialogOpen(false);
      setProspectToDelete(null);
      fetchClients();
    } catch (error: any) {
      console.error("Error deleting prospect:", error);
      toast.error("Erro ao excluir prospect");
    }
  };

  const handleTransferClick = (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    setProspectToTransfer(client);
    setSelectedNewSeller("");
    setTransferDialogOpen(true);
  };

  const handleTransferProspect = async () => {
    if (!prospectToTransfer || !selectedNewSeller) {
      toast.error("Selecione um vendedor");
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .update({ created_by: selectedNewSeller })
        .eq("id", prospectToTransfer.id);

      if (error) throw error;

      toast.success("Prospect transferido com sucesso!");
      setTransferDialogOpen(false);
      setProspectToTransfer(null);
      setSelectedNewSeller("");
      fetchClients();
    } catch (error) {
      console.error("Erro ao transferir prospect:", error);
      toast.error("Erro ao transferir prospect");
    }
  };

  const handleSelectProspect = (prospectId: string) => {
    setSelectedProspects(prev => 
      prev.includes(prospectId) 
        ? prev.filter(id => id !== prospectId)
        : [...prev, prospectId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProspects.length === paginatedClients.length) {
      setSelectedProspects([]);
    } else {
      setSelectedProspects(paginatedClients.map(c => c.id));
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteConfirmation !== "EXCLUIR TUDO") {
      toast.error("Digite 'EXCLUIR TUDO' para confirmar a exclusão");
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .in("id", selectedProspects);

      if (error) throw error;

      toast.success(`${selectedProspects.length} prospect(s) excluído(s) com sucesso!`);
      setSelectedProspects([]);
      setBulkDeleteDialogOpen(false);
      setBulkDeleteConfirmation("");
      fetchClients();
    } catch (error) {
      console.error("Erro ao excluir prospects:", error);
      toast.error("Erro ao excluir prospects");
    }
  };

  const handleEditClient = (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Prospects
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua base de prospects
          </p>
        </div>
        
        <div className="flex gap-2">
          {userRoles.includes('admin') && selectedProspects.length > 0 && (
            <Button 
              variant="destructive" 
              className="gap-2"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 size={20} />
              Excluir {selectedProspects.length} selecionado(s)
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setQuickImportOpen(true)}
          >
            <Plus size={20} />
            Importar Planilha
          </Button>
          
          <QuickImportDialog
            open={quickImportOpen}
            onOpenChange={setQuickImportOpen}
            onSuccess={fetchClients}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-primary">
                <Plus size={20} />
                Novo Prospect
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Cadastrar Novo Prospect</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient}>
              <Tabs defaultValue="empresa" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos</TabsTrigger>
                  <TabsTrigger value="feiras">Feiras</TabsTrigger>
                </TabsList>

                <TabsContent value="empresa" className="space-y-4 mt-4">
                  {/* Seção 1: Dados da Receita Federal */}
                  <div className="space-y-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-sm font-medium text-muted-foreground">Dados da Receita Federal</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <div className="relative">
                        <CNPJInput
                          id="cnpj"
                          value={cnpj}
                          onValueChange={handleCnpjChange}
                          placeholder="00.000.000/0000-00"
                          disabled={loadingCnpj}
                          className={
                            cnpjValidationStatus === 'valid' 
                              ? 'border-green-500 pr-10' 
                              : cnpjValidationStatus === 'invalid' 
                              ? 'border-red-500 pr-10' 
                              : ''
                          }
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {loadingCnpj && (
                            <Loader2 className="animate-spin text-primary" size={20} />
                          )}
                          {!loadingCnpj && cnpjValidationStatus === 'valid' && (
                            <CheckCircle2 className="text-green-500" size={20} />
                          )}
                          {!loadingCnpj && cnpjValidationStatus === 'invalid' && (
                            <XCircle className="text-red-500" size={20} />
                          )}
                        </div>
                      </div>
                      {cnpjValidationStatus === 'invalid' && (
                        <p className="text-sm text-red-500">CNPJ inválido. Verifique os dígitos.</p>
                      )}
                      {cnpjValidationStatus === 'valid' && !loadingCnpj && (
                        <p className="text-sm text-green-600">CNPJ válido ✓</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="flex items-center gap-2">
                          Razão Social *
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tradeName" className="flex items-center gap-2">
                          Nome Fantasia
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="tradeName"
                          value={tradeName}
                          onChange={(e) => setTradeName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnaePrincipal" className="flex items-center gap-2">
                          CNAE Principal
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="cnaePrincipal"
                          value={cnaePrincipal}
                          onChange={(e) => setCnaePrincipal(e.target.value)}
                          placeholder="0000-0/00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cnaeDescription" className="flex items-center gap-2">
                          CNAE Descrição
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="cnaeDescription"
                          value={cnaeDescription}
                          onChange={(e) => setCnaeDescription(e.target.value)}
                          placeholder="Descrição da atividade principal"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="legalNature" className="flex items-center gap-2">
                        Natureza Jurídica
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          RF
                        </span>
                      </Label>
                      <Input
                        id="legalNature"
                        value={legalNature}
                        onChange={(e) => setLegalNature(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="registrationStatus" className="flex items-center gap-2">
                          Situação
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="registrationStatus"
                          value={registrationStatus}
                          onChange={(e) => setRegistrationStatus(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="foundationDate" className="flex items-center gap-2">
                          Data de Abertura
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="foundationDate"
                          type="date"
                          value={foundationDate}
                          onChange={(e) => setFoundationDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shareCapital" className="flex items-center gap-2">
                          Capital Social
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <CurrencyInput
                          id="shareCapital"
                          value={shareCapital}
                          onValueChange={(value) => setShareCapital(value)}
                          placeholder="R$ 0,00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="segment" className="flex items-center gap-2">
                          Segmento
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="segment"
                          value={segment}
                          onChange={(e) => setSegment(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                          Email
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          Telefone
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <PhoneInput
                          id="phone"
                          value={phone}
                          onValueChange={(value) => setPhone(value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logradouro" className="flex items-center gap-2">
                        Logradouro
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          RF
                        </span>
                      </Label>
                      <Input
                        id="logradouro"
                        value={logradouro}
                        onChange={(e) => setLogradouro(e.target.value)}
                        placeholder="Rua, Avenida, etc."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numero" className="flex items-center gap-2">
                          Número
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="numero"
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          placeholder="123"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="complemento" className="flex items-center gap-2">
                          Complemento
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="complemento"
                          value={complemento}
                          onChange={(e) => setComplemento(e.target.value)}
                          placeholder="Apto, Sala, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="flex items-center gap-2">
                          Cidade
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state" className="flex items-center gap-2">
                          Estado
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <Input
                          id="state"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          maxLength={2}
                          placeholder="UF"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zipCode" className="flex items-center gap-2">
                          CEP
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            RF
                          </span>
                        </Label>
                        <CEPInput
                          id="zipCode"
                          value={zipCode}
                          onValueChange={(value) => setZipCode(value)}
                          placeholder="00000-000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Informações Adicionais */}
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-sm font-medium text-muted-foreground">Informações Adicionais</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companySize">Porte da Empresa</Label>
                        <select
                          id="companySize"
                          value={companySize}
                          onChange={(e) => setCompanySize(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Selecione...</option>
                          <option value="MEI">MEI - Microempreendedor Individual</option>
                          <option value="ME">ME - Microempresa</option>
                          <option value="EPP">EPP - Empresa de Pequeno Porte</option>
                          <option value="Medio">Médio Porte</option>
                          <option value="Grande">Grande Porte</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="region">Região</Label>
                        <Input
                          id="region"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          placeholder="Ex: Sudeste, Sul, etc."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="competitors">Concorrentes</Label>
                      <Input
                        id="competitors"
                        value={competitors}
                        onChange={(e) => setCompetitors(e.target.value)}
                        placeholder="Liste os principais concorrentes"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="distributor">Distribuidor</Label>
                        <Input
                          id="distributor"
                          value={distributor}
                          onChange={(e) => setDistributor(e.target.value)}
                          placeholder="Nome do distribuidor"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="services">Serviços</Label>
                        <select
                          id="services"
                          value={services}
                          onChange={(e) => setServices(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Selecione um produto/serviço...</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.name}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rating">Avaliação do Prospect</Label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="focus:outline-none transition-colors"
                          >
                            <svg
                              className={`w-8 h-8 ${
                                star <= rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-none text-gray-300'
                              }`}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>
                        ))}
                        {rating > 0 && (
                          <span className="text-sm text-muted-foreground ml-2">
                            {rating} {rating === 1 ? 'estrela' : 'estrelas'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contatos" className="space-y-4 mt-4">
                  {contacts.map((contact, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            Contato {index + 1}
                            {contact.is_primary && <span className="text-primary ml-2">(Principal)</span>}
                          </CardTitle>
                          {contacts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeContact(index)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nome *</Label>
                            <Input
                              value={contact.name}
                              onChange={(e) => updateContact(index, "name", e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Cargo</Label>
                            <Input
                              value={contact.role}
                              onChange={(e) => updateContact(index, "role", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={contact.email}
                              onChange={(e) => updateContact(index, "email", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Telefone</Label>
                            <PhoneInput
                              value={contact.phone || ""}
                              onValueChange={(value) => updateContact(index, "phone", value)}
                              placeholder="(00) 00000-0000"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Celular</Label>
                            <PhoneInput
                              value={contact.mobile || ""}
                              onValueChange={(value) => updateContact(index, "mobile", value)}
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Avaliação do Contato</Label>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => updateContact(index, "rating", star)}
                                className="focus:outline-none transition-colors"
                              >
                                <svg
                                  className={`w-6 h-6 ${
                                    star <= (contact.rating || 0)
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'fill-none text-gray-300'
                                  }`}
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                  />
                                </svg>
                              </button>
                            ))}
                            {(contact.rating || 0) > 0 && (
                              <span className="text-sm text-muted-foreground ml-2">
                                {contact.rating} {contact.rating === 1 ? 'estrela' : 'estrelas'}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addContact}
                    className="w-full"
                  >
                    <Plus size={16} className="mr-2" />
                    Adicionar Contato
                  </Button>
                </TabsContent>

                <TabsContent value="feiras" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Selecione as feiras que este prospect participou ou irá participar
                    </p>
                    
                    {feiras.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma feira cadastrada no sistema
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto p-1">
                        {feiras.map((feira) => (
                          <Card
                            key={feira.id}
                            className={`p-4 cursor-pointer transition-all ${
                              selectedFeiras.includes(feira.id)
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => {
                              setSelectedFeiras(prev =>
                                prev.includes(feira.id)
                                  ? prev.filter(id => id !== feira.id)
                                  : [...prev, feira.id]
                              );
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h4 className="font-medium text-foreground">{feira.name}</h4>
                                {feira.city && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {feira.city}
                                  </p>
                                )}
                                {feira.start_date && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(feira.start_date).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {selectedFeiras.includes(feira.id) && (
                                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                    <svg
                                      className="h-4 w-4 text-primary-foreground"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path d="M5 13l4 4L19 7"></path>
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {selectedFeiras.length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium text-foreground">
                          {selectedFeiras.length} feira(s) selecionada(s)
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar Prospect</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Buscar por nome ou CNPJ (com ou sem máscara)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative w-full sm:w-64">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Todos os vendedores</option>
                <option value="my_portfolio">Minha Carteira</option>
                <option value="no_seller">Sem Vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <select
                value={selectedFeiraFilter}
                onChange={(e) => setSelectedFeiraFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Todas as feiras</option>
                {feiras.map((feira) => (
                  <option key={feira.id} value={feira.id}>
                    {feira.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="name-asc">Nome (A-Z)</option>
                <option value="name-desc">Nome (Z-A)</option>
                <option value="cnpj-asc">CNPJ (Crescente)</option>
                <option value="cnpj-desc">CNPJ (Decrescente)</option>
                <option value="date-newest">Mais Recentes</option>
                <option value="date-oldest">Mais Antigos</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative w-full sm:w-64">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <select
                value={selectedCompanySize}
                onChange={(e) => setSelectedCompanySize(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Todos os portes</option>
                <option value="MEI">MEI</option>
                <option value="ME">Microempresa (ME)</option>
                <option value="EPP">Pequeno Porte (EPP)</option>
                <option value="medio">Médio Porte</option>
                <option value="grande">Grande Porte</option>
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <Input
                placeholder="Filtrar por região..."
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <Input
                type="date"
                placeholder="Data início"
                value={dateFilterStart}
                onChange={(e) => setDateFilterStart(e.target.value)}
                className="pl-10"
                title="Data de cadastro - início"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
              <Input
                type="date"
                placeholder="Data fim"
                value={dateFilterEnd}
                onChange={(e) => setDateFilterEnd(e.target.value)}
                className="pl-10"
                title="Data de cadastro - fim"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Results Counter */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-4 py-2 bg-primary/10 rounded-lg">
            <p className="text-sm font-medium text-foreground">
              <span className="text-2xl font-bold text-primary">{filteredClients.length}</span>
              <span className="ml-2 text-muted-foreground">
                {filteredClients.length === 1 ? 'prospect encontrado' : 'prospects encontrados'}
              </span>
            </p>
          </div>
          {(searchTerm || selectedSeller !== "all" || selectedFeiraFilter !== "all" || selectedCompanySize !== "all" || selectedRegion) && (
            <p className="text-xs text-muted-foreground">
              (de {clients.length} {clients.length === 1 ? 'prospect total' : 'prospects totais'})
            </p>
          )}
          {userRoles.includes('vendedor') && !userRoles.includes('admin') && !userRoles.includes('gestor') && selectedSeller === "my_portfolio" && (
            <Badge variant="secondary" className="gap-1">
              <User size={12} />
              Minha Carteira
            </Badge>
          )}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="gap-2 bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20"
            >
              <XCircle size={16} />
              Limpar Filtros
            </Button>
          )}
          {userRoles.includes('admin') && filteredClients.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedProspects.length === paginatedClients.length ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'compact' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <select 
                value={quickRatingFilter?.toString() || "all"} 
                onChange={(e) => setQuickRatingFilter(e.target.value === "all" ? null : parseInt(e.target.value))}
                className="h-8 px-3 text-sm border rounded-md bg-background"
              >
                <option value="all">Todos Ratings</option>
                <option value="5">⭐⭐⭐⭐⭐</option>
                <option value="4">⭐⭐⭐⭐</option>
                <option value="3">⭐⭐⭐</option>
                <option value="2">⭐⭐</option>
                <option value="1">⭐</option>
              </select>
              <select 
                value={quickRegionFilter} 
                onChange={(e) => setQuickRegionFilter(e.target.value)}
                className="h-8 px-3 text-sm border rounded-md bg-background"
              >
                <option value="all">Todas Regiões</option>
                <option value="Norte">Norte</option>
                <option value="Nordeste">Nordeste</option>
                <option value="Centro-Oeste">Centro-Oeste</option>
                <option value="Sudeste">Sudeste</option>
                <option value="Sul">Sul</option>
              </select>
              <select 
                value={quickSegmentFilter} 
                onChange={(e) => setQuickSegmentFilter(e.target.value)}
                className="h-8 px-3 text-sm border rounded-md bg-background"
              >
                <option value="all">Todos Segmentos</option>
                {Array.from(new Set(clients?.map(c => c.segment).filter(Boolean))).map((segment) => (
                  <option key={segment} value={segment!}>{segment}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
            <Button
              size="sm"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              className="h-8 px-3"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Cards</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              onClick={() => setViewMode("compact")}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>
      </div>

      <div 
        key={viewMode}
        className="space-y-3 animate-fade-in"
      >
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : filteredClients.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">Nenhum prospect encontrado</p>
          </Card>
        ) : (
          <>
            {viewMode === "cards" ? (
              paginatedClients.map((client) => (
            <SwipeableCard
              key={client.id}
              onEdit={canEditClient(client) ? () => {
                handleEditClient({ stopPropagation: () => {} } as any, client);
              } : undefined}
              onDelete={userRoles.includes('admin') ? () => {
                handleDeleteClick({ stopPropagation: () => {} } as any, client);
              } : undefined}
            >
            <Card 
              className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary cursor-pointer"
              onClick={() => navigate(`/prospects/${client.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-6">
                  {/* Main Client Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {userRoles.includes('admin') && (
                      <div className="flex items-center pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedProspects.includes(client.id)}
                          onChange={() => handleSelectProspect(client.id)}
                          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Building2 className="text-primary" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground mb-1 truncate">
                        {client.company_name}
                      </h3>
                      {client.trade_name && (
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          {client.trade_name}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-muted-foreground">CNPJ:</span>
                          <span className="text-foreground">{client.cnpj}</span>
                        </div>
                        
                        {client.segment && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-muted-foreground">Segmento:</span>
                            <span className="text-foreground">{client.segment}</span>
                          </div>
                        )}

                        {(client.city || client.state) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin size={16} />
                            <span>{[client.city, client.state].filter(Boolean).join(", ")}</span>
                          </div>
                        )}

                        {client.created_at && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar size={16} />
                            <span>Cadastrado em {format(new Date(client.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-3">
                        {client.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail size={16} />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}

                        {client.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone size={16} />
                            <span>{client.phone}</span>
                          </div>
                        )}

                        {client.contacts && client.contacts.length > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User size={16} />
                            <span>{client.contacts.length} contato(s)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seller Info and Edit Button */}
                  <div className="flex items-start gap-3 flex-shrink-0">
                    {client.created_by_profile && (
                      <div className="px-4 py-3 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="text-primary" size={16} />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Vendedor Responsável
                          </span>
                        </div>
                        <p className="font-semibold text-primary text-lg">
                          {client.created_by_profile.full_name}
                        </p>
                        {client.created_by_profile.email && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {client.created_by_profile.email}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {canEditClient(client) && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => handleEditClient(e, client)}
                            className="h-10 w-10"
                            title="Editar prospect"
                          >
                            <Edit size={18} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => handleTransferClick(e, client)}
                            className="h-10 w-10"
                            title="Transferir prospect"
                          >
                            <UserCog size={18} />
                          </Button>
                        </>
                      )}
                      
                      {userRoles.includes('admin') && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => handleDeleteClick(e, client)}
                          className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Excluir prospect"
                        >
                          <Trash2 size={18} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </SwipeableCard>
              ))
            ) : (
              // Compact View
              paginatedClients.map((client) => (
            <SwipeableCard
              key={client.id}
              onEdit={canEditClient(client) ? () => {
                handleEditClient({ stopPropagation: () => {} } as any, client);
              } : undefined}
              onDelete={userRoles.includes('admin') ? () => {
                handleDeleteClick({ stopPropagation: () => {} } as any, client);
              } : undefined}
            >
            <Card 
              className="hover:shadow-md transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/prospects/${client.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {userRoles.includes('admin') && (
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedProspects.includes(client.id)}
                          onChange={() => handleSelectProspect(client.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Building2 className="text-primary h-5 w-5" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {client.company_name || client.trade_name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.cnpj}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {[client.city, client.state].filter(Boolean).join(", ") || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.rating > 0 && (
                          <div className="flex items-center gap-1">
                            {[...Array(client.rating)].map((_, i) => (
                              <svg
                                key={i}
                                className="w-3 h-3 fill-yellow-400 text-yellow-400"
                                viewBox="0 0 24 24"
                              >
                                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    {canEditClient(client) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => handleEditClient(e, client)}
                        className="h-8 w-8"
                        title="Editar prospect"
                      >
                        <Edit size={16} />
                      </Button>
                    )}
                    {userRoles.includes('admin') && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => handleDeleteClick(e, client)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Excluir prospect"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </SwipeableCard>
              ))
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Card className="mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, filteredClients.length)} de {filteredClients.length} prospects
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {/* First page */}
                        <Button
                          variant={currentPage === 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          className="min-w-[40px]"
                        >
                          1
                        </Button>
                        
                        {/* Left ellipsis */}
                        {currentPage > 3 && <span className="px-2">...</span>}
                        
                        {/* Pages around current */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show current page and one page on each side
                            return page > 1 && page < totalPages && Math.abs(page - currentPage) <= 1;
                          })
                          .map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          ))
                        }
                        
                        {/* Right ellipsis */}
                        {currentPage < totalPages - 2 && <span className="px-2">...</span>}
                        
                        {/* Last page */}
                        {totalPages > 1 && (
                          <Button
                            variant={currentPage === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="min-w-[40px]"
                          >
                            {totalPages}
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {selectedClient && (
        <ClientEditDialog
          client={selectedClient}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchClients}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o prospect <strong>{prospectToDelete?.company_name || prospectToDelete?.trade_name}</strong>?
              <br /><br />
              Esta ação é irreversível e excluirá permanentemente:
              <ul className="list-disc pl-6 mt-2">
                <li>Todos os contatos vinculados</li>
                <li>Todas as oportunidades e seus anexos</li>
                <li>Todas as tarefas relacionadas</li>
                <li>Todo o histórico de atividades</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProspect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ ATENÇÃO: Exclusão em Lote</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="font-semibold text-foreground">
                Você está prestes a excluir {selectedProspects.length} prospect(s) permanentemente.
              </p>
              <p>
                Esta ação é <span className="font-bold text-destructive">IRREVERSÍVEL</span> e removerá todos os dados relacionados:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Informações da empresa</li>
                <li>Contatos vinculados</li>
                <li>Histórico de feiras</li>
                <li>Todas as associações</li>
              </ul>
              <div className="space-y-2 pt-4">
                <Label htmlFor="bulk-delete-confirmation" className="text-foreground font-semibold">
                  Digite "EXCLUIR TUDO" para confirmar:
                </Label>
                <Input
                  id="bulk-delete-confirmation"
                  value={bulkDeleteConfirmation}
                  onChange={(e) => setBulkDeleteConfirmation(e.target.value)}
                  placeholder="EXCLUIR TUDO"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteConfirmation("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={bulkDeleteConfirmation !== "EXCLUIR TUDO"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Prospect</Label>
              <p className="text-sm font-medium">
                {prospectToTransfer?.company_name || prospectToTransfer?.trade_name}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newSeller">Transferir para</Label>
              <select
                id="newSeller"
                value={selectedNewSeller}
                onChange={(e) => setSelectedNewSeller(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um vendedor</option>
                {sellers
                  .filter(seller => seller.id !== prospectToTransfer?.created_by)
                  .map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Atenção:</strong> Ao transferir este prospect, você perderá o acesso para editá-lo. 
                O novo vendedor será o responsável por todas as informações e histórico deste prospect.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleTransferProspect}
              disabled={!selectedNewSeller}
            >
              Transferir Prospect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Prospects;