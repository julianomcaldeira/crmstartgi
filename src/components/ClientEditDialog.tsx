import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CNPJInput, PhoneInput, CEPInput, CurrencyInput, autoAddMobileNine } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Search, Copy, Check, Trash2, AlertTriangle } from "lucide-react";

interface ClientEditDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Helper function to convert date from DD/MM/YYYY to YYYY-MM-DD format
const convertDateToISO = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  
  // Check if already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Convert from DD/MM/YYYY to YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day && month && year && !isNaN(Number(day)) && !isNaN(Number(month)) && !isNaN(Number(year))) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return "";
};

export const ClientEditDialog = ({ client, open, onOpenChange, onSuccess }: ClientEditDialogProps) => {
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [feiraSearchTerm, setFeiraSearchTerm] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteContactTarget, setDeleteContactTarget] = useState<{ id: string; name: string; index: number } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingContact, setDeletingContact] = useState(false);

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiado!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  useEffect(() => {
    if (client && open) {
      setCnpj(client.cnpj || "");
      setCompanyName(client.company_name || "");
      setTradeName(client.trade_name || "");
      setWebsite(client.website || "");
      setEmail(client.email || "");
      setPhone(client.phone || "");
      setAddress(client.address || "");
      setCity(client.city || "");
      setState(client.state || "");
      setZipCode(client.zip_code || "");
      setSegment(client.segment || "");
      setShareCapital(client.share_capital?.toString() || "");
      setLegalNature(client.legal_nature || "");
      setCompanySize(client.company_size || "");
      setRegion(client.region || "");
      setCompetitors(client.competitors || "");
      setDistributor(client.distributor || "");
      setServices(client.services || "");
      setRating(client.rating || 0);
      setRegistrationStatus(client.registration_status || "");
      setFoundationDate(convertDateToISO(client.foundation_date));
      setCnaePrincipal(client.cnae_principal || "");
      setCnaeDescription(client.cnae_description || "");
      
      const feiraIds = client.client_feiras?.map((cf: any) => cf.feira_id) || [];
      setSelectedFeiras(feiraIds);
      
      setContacts(client.contacts || [{ name: "", role: "", email: "", phone: "", mobile: "", is_primary: true }]);
      
      fetchFeiras();
      fetchProducts();
    }
  }, [client, open]);

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

  const confirmDeleteContact = async () => {
    if (!deleteContactTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }
    setDeletingContact(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", deleteContactTarget.id);
      if (error) throw error;
      setContacts(contacts.filter((_, i) => i !== deleteContactTarget.index));
      toast.success(`Contato "${deleteContactTarget.name}" excluído`);
      setDeleteContactTarget(null);
      setDeleteConfirmText("");
    } catch (err: any) {
      console.error("Error deleting contact:", err);
      toast.error("Erro ao excluir contato: " + (err?.message || ""));
    } finally {
      setDeletingContact(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update client
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          cnpj: cnpj.replace(/\D/g, ""),
          company_name: companyName,
          trade_name: tradeName,
          website,
          email,
          phone,
          address,
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
          foundation_date: convertDateToISO(foundationDate) || null,
          cnae_principal: cnaePrincipal,
          cnae_description: cnaeDescription,
        })
        .eq("id", client.id);

      if (clientError) throw clientError;

      // SAFETY: This dialog NEVER deletes contacts automatically.
      // It only updates existing contacts and inserts new ones.
      // Removing a contact from the form locally has NO effect on the database —
      // exclusion must be done via a dedicated, confirmed action.
      const validContacts = contacts.filter(c => c.name && c.name.trim());

      // Update existing contacts (those with an id)
      for (const contact of validContacts) {
        if (contact.id) {
          const { error: updateError } = await supabase
            .from("contacts")
            .update({
              name: contact.name,
              role: contact.role,
              email: contact.email,
              phone: contact.phone ? autoAddMobileNine(contact.phone) : contact.phone,
              mobile: contact.mobile ? autoAddMobileNine(contact.mobile) : contact.mobile,
              is_primary: contact.is_primary,
            })
            .eq("id", contact.id);
          if (updateError) throw updateError;
        }
      }

      // Insert new contacts (those without an id)
      const newContacts = validContacts.filter((c: any) => !c.id);
      if (newContacts.length > 0) {
        const contactsData = newContacts.map((contact: any) => ({
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone ? autoAddMobileNine(contact.phone) : contact.phone,
          mobile: contact.mobile ? autoAddMobileNine(contact.mobile) : contact.mobile,
          is_primary: contact.is_primary,
          client_id: client.id,
          created_by: user.id,
        }));

        const { error: contactsError } = await supabase
          .from("contacts")
          .insert(contactsData);

        if (contactsError) throw contactsError;
      }

      // Update client-feira relationships - use smart diff approach
      const currentFeiraIds = client.client_feiras?.map((cf: any) => cf.feira_id) || [];
      
      // Calculate feiras to add and remove
      const feirasToAdd = selectedFeiras.filter(id => !currentFeiraIds.includes(id));
      const feirasToRemove = currentFeiraIds.filter((id: string) => !selectedFeiras.includes(id));
      
      // Remove feiras that are no longer selected
      if (feirasToRemove.length > 0) {
        const { error: deleteFeirasError } = await supabase
          .from("client_feiras")
          .delete()
          .eq("client_id", client.id)
          .in("feira_id", feirasToRemove);

        if (deleteFeirasError) {
          console.error("Error deleting feiras:", deleteFeirasError);
          throw new Error("Erro ao remover feiras vinculadas");
        }
      }

      // Add new feiras
      if (feirasToAdd.length > 0) {
        const clientFeirasData = feirasToAdd.map(feiraId => ({
          client_id: client.id,
          feira_id: feiraId,
          created_by: user.id,
        }));

        const { error: feirasError } = await supabase
          .from("client_feiras")
          .insert(clientFeirasData);

        if (feirasError) {
          console.error("Error adding feiras:", feirasError);
          throw feirasError;
        }
      }

      toast.success("Cliente atualizado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast.error(error.message || "Erro ao atualizar cliente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
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
                  <Label htmlFor="edit-cnpj">CNPJ *</Label>
                  <div className="flex gap-2">
                    <CNPJInput
                      id="edit-cnpj"
                      value={cnpj}
                      onValueChange={(value) => setCnpj(value)}
                      placeholder="00.000.000/0000-00"
                      disabled
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(cnpj, "cnpj")}
                      title="Copiar CNPJ"
                    >
                      {copiedField === "cnpj" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-companyName">Razão Social *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="edit-companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(companyName, "companyName")}
                        title="Copiar Razão Social"
                      >
                        {copiedField === "companyName" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-tradeName">Nome Fantasia</Label>
                    <Input
                      id="edit-tradeName"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-website">Site</Label>
                  <Input
                    id="edit-website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.exemplo.com.br"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-cnaePrincipal">CNAE Principal</Label>
                    <Input
                      id="edit-cnaePrincipal"
                      value={cnaePrincipal}
                      onChange={(e) => setCnaePrincipal(e.target.value)}
                      placeholder="0000-0/00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-cnaeDescription">CNAE Descrição</Label>
                    <Input
                      id="edit-cnaeDescription"
                      value={cnaeDescription}
                      onChange={(e) => setCnaeDescription(e.target.value)}
                      placeholder="Descrição da atividade principal"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-legalNature">Natureza Jurídica</Label>
                  <Input
                    id="edit-legalNature"
                    value={legalNature}
                    onChange={(e) => setLegalNature(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-registrationStatus">Situação</Label>
                    <Input
                      id="edit-registrationStatus"
                      value={registrationStatus}
                      onChange={(e) => setRegistrationStatus(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-foundationDate">Data de Abertura</Label>
                    <Input
                      id="edit-foundationDate"
                      type="date"
                      value={foundationDate}
                      onChange={(e) => setFoundationDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-shareCapital">Capital Social</Label>
                    <CurrencyInput
                      id="edit-shareCapital"
                      value={shareCapital}
                      onValueChange={(value) => setShareCapital(value)}
                      placeholder="R$ 0,00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-segment">Segmento</Label>
                    <Input
                      id="edit-segment"
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Telefone</Label>
                    <PhoneInput
                      id="edit-phone"
                      value={phone}
                      onValueChange={(value) => setPhone(value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-address">Endereço</Label>
                  <Input
                    id="edit-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">Cidade</Label>
                    <Input
                      id="edit-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-state">Estado</Label>
                    <Input
                      id="edit-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      maxLength={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-zipCode">CEP</Label>
                    <CEPInput
                      id="edit-zipCode"
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
                    <Label htmlFor="edit-companySize">Porte da Empresa</Label>
                    <select
                      id="edit-companySize"
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
                    <Label htmlFor="edit-region">Região</Label>
                    <Input
                      id="edit-region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Ex: Sudeste, Sul, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-competitors">Concorrentes</Label>
                  <Input
                    id="edit-competitors"
                    value={competitors}
                    onChange={(e) => setCompetitors(e.target.value)}
                    placeholder="Liste os principais concorrentes"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-distributor">Distribuidor</Label>
                    <Input
                      id="edit-distributor"
                      value={distributor}
                      onChange={(e) => setDistributor(e.target.value)}
                      placeholder="Nome do distribuidor"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-services">Serviços</Label>
                    <select
                      id="edit-services"
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
                  <Label htmlFor="edit-rating">Avaliação do Prospect</Label>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome, email ou cargo..."
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {contacts
                .filter(contact => {
                  if (!contactSearchTerm) return true;
                  const searchLower = contactSearchTerm.toLowerCase();
                  return (
                    contact.name?.toLowerCase().includes(searchLower) ||
                    contact.email?.toLowerCase().includes(searchLower) ||
                    contact.role?.toLowerCase().includes(searchLower)
                  );
                })
                .map((contact, index) => (
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

              {contacts.filter(contact => {
                if (!contactSearchTerm) return true;
                const searchLower = contactSearchTerm.toLowerCase();
                return (
                  contact.name?.toLowerCase().includes(searchLower) ||
                  contact.email?.toLowerCase().includes(searchLower) ||
                  contact.role?.toLowerCase().includes(searchLower)
                );
              }).length === 0 && contactSearchTerm && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum contato encontrado com "{contactSearchTerm}"
                </p>
              )}

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
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Selecione as feiras que este cliente participou ou irá participar
                  </p>
                  {selectedFeiras.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                      {selectedFeiras.length} selecionada{selectedFeiras.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar feira por nome ou cidade..."
                    value={feiraSearchTerm}
                    onChange={(e) => setFeiraSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {feiras.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma feira cadastrada no sistema
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto p-1">
                    {feiras
                      .filter(feira => {
                        if (!feiraSearchTerm) return true;
                        const searchLower = feiraSearchTerm.toLowerCase();
                        return (
                          feira.name?.toLowerCase().includes(searchLower) ||
                          feira.city?.toLowerCase().includes(searchLower)
                        );
                      })
                      .sort((a, b) => {
                        const aSelected = selectedFeiras.includes(a.id);
                        const bSelected = selectedFeiras.includes(b.id);
                        if (aSelected && !bSelected) return -1;
                        if (!aSelected && bSelected) return 1;
                        return 0;
                      })
                      .map((feira) => {
                        const isSelected = selectedFeiras.includes(feira.id);
                        return (
                          <div
                            key={feira.id}
                            className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                            }`}
                            onClick={() => {
                              setSelectedFeiras(prev =>
                                prev.includes(feira.id)
                                  ? prev.filter(id => id !== feira.id)
                                  : [...prev, feira.id]
                              );
                            }}
                          >
                            {/* Checkbox indicator */}
                            <div className={`flex-shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                            }`}>
                              {isSelected && (
                                <svg
                                  className="h-4 w-4 text-primary-foreground"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="3"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                {feira.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                {feira.city && (
                                  <span className="flex items-center gap-1">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {feira.city}
                                  </span>
                                )}
                                {feira.start_date && (
                                  <span className="flex items-center gap-1">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(feira.start_date).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Selected badge */}
                            {isSelected && (
                              <span className="flex-shrink-0 text-xs font-medium text-primary bg-primary/20 px-2 py-1 rounded-full">
                                Selecionada
                              </span>
                            )}
                          </div>
                        );
                      })}
                    {feiras.filter(feira => {
                      if (!feiraSearchTerm) return true;
                      const searchLower = feiraSearchTerm.toLowerCase();
                      return (
                        feira.name?.toLowerCase().includes(searchLower) ||
                        feira.city?.toLowerCase().includes(searchLower)
                      );
                    }).length === 0 && feiraSearchTerm && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma feira encontrada com "{feiraSearchTerm}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-6 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Salvar Alterações</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
