import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CNPJInput, PhoneInput, CEPInput, CurrencyInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";

interface ClientEditDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ClientEditDialog = ({ client, open, onOpenChange, onSuccess }: ClientEditDialogProps) => {
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
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

  useEffect(() => {
    if (client && open) {
      setCnpj(client.cnpj || "");
      setCompanyName(client.company_name || "");
      setTradeName(client.trade_name || "");
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
      setFoundationDate(client.foundation_date || "");
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
          foundation_date: foundationDate || null,
          cnae_principal: cnaePrincipal,
          cnae_description: cnaeDescription,
        })
        .eq("id", client.id);

      if (clientError) throw clientError;

      // Delete existing contacts and insert new ones
      const { error: deleteContactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("client_id", client.id);

      if (deleteContactsError) throw deleteContactsError;

      const validContacts = contacts.filter(c => c.name.trim());
      if (validContacts.length > 0) {
        const contactsData = validContacts.map(contact => ({
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile,
          is_primary: contact.is_primary,
          client_id: client.id,
          created_by: user.id,
        }));

        const { error: contactsError } = await supabase
          .from("contacts")
          .insert(contactsData);

        if (contactsError) throw contactsError;
      }

      // Update client-feira relationships
      const { error: deleteFeirasError } = await (supabase as any)
        .from("client_feiras")
        .delete()
        .eq("client_id", client.id);

      if (deleteFeirasError) throw deleteFeirasError;

      if (selectedFeiras.length > 0) {
        const clientFeirasData = selectedFeiras.map(feiraId => ({
          client_id: client.id,
          feira_id: feiraId,
          created_by: user.id,
        }));

        const { error: feirasError } = await (supabase as any)
          .from("client_feiras")
          .insert(clientFeirasData);

        if (feirasError) throw feirasError;
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
                  <CNPJInput
                    id="edit-cnpj"
                    value={cnpj}
                    onValueChange={(value) => setCnpj(value)}
                    placeholder="00.000.000/0000-00"
                    disabled
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-companyName">Razão Social *</Label>
                    <Input
                      id="edit-companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
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
                  Selecione as feiras que este cliente participou ou irá participar
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
