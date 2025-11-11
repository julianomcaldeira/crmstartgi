import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Building2, MapPin, Phone, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Clientes = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  
  // Client form fields
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

  // Contacts
  const [contacts, setContacts] = useState<any[]>([{
    name: "", role: "", email: "", phone: "", mobile: "", is_primary: true
  }]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*, contacts(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjBlur = async () => {
    if (cnpj.length < 14) return;
    
    setLoadingCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-cnpj", {
        body: { cnpj }
      });

      if (error) throw error;

      if (data) {
        setCompanyName(data.company_name || "");
        setTradeName(data.trade_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
        setZipCode(data.zip_code || "");
        setSegment(data.segment || "");
        setShareCapital(data.share_capital?.toString() || "");
        setLegalNature(data.legal_nature || "");
        
        toast.success("Dados da empresa carregados!");
      }
    } catch (error: any) {
      console.error("Error fetching CNPJ:", error);
      toast.error(error.message || "Erro ao buscar CNPJ");
    } finally {
      setLoadingCnpj(false);
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

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .insert({
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

      toast.success("Cliente cadastrado com sucesso!");
      setDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast.error(error.message || "Erro ao cadastrar cliente");
    }
  };

  const resetForm = () => {
    setCnpj("");
    setCompanyName("");
    setTradeName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setState("");
    setZipCode("");
    setSegment("");
    setShareCapital("");
    setLegalNature("");
    setContacts([{ name: "", role: "", email: "", phone: "", mobile: "", is_primary: true }]);
  };

  const filteredClients = clients.filter((client) =>
    client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj.includes(searchTerm) ||
    (client.trade_name && client.trade_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
            Clientes
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua base de clientes
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-primary">
              <Plus size={20} />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Cadastrar Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient}>
              <Tabs defaultValue="empresa" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos</TabsTrigger>
                </TabsList>

                <TabsContent value="empresa" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <div className="relative">
                      <Input
                        id="cnpj"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        onBlur={handleCnpjBlur}
                        placeholder="00.000.000/0000-00"
                        required
                      />
                      {loadingCnpj && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" size={20} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Razão Social *</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tradeName">Nome Fantasia</Label>
                      <Input
                        id="tradeName"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="segment">Segmento</Label>
                      <Input
                        id="segment"
                        value={segment}
                        onChange={(e) => setSegment(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shareCapital">Capital Social</Label>
                      <Input
                        id="shareCapital"
                        type="number"
                        step="0.01"
                        value={shareCapital}
                        onChange={(e) => setShareCapital(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legalNature">Natureza Jurídica</Label>
                    <Input
                      id="legalNature"
                      value={legalNature}
                      onChange={(e) => setLegalNature(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        maxLength={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zipCode">CEP</Label>
                      <Input
                        id="zipCode"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                      />
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
                            <Input
                              value={contact.phone}
                              onChange={(e) => updateContact(index, "phone", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Celular</Label>
                            <Input
                              value={contact.mobile}
                              onChange={(e) => updateContact(index, "mobile", e.target.value)}
                            />
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
              </Tabs>

              <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar Cliente</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="col-span-full text-center text-muted-foreground">Carregando...</p>
        ) : filteredClients.length === 0 ? (
          <Card className="col-span-full p-12 text-center">
            <Building2 className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">Nenhum cliente encontrado</p>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-xl transition-all duration-300 border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-start gap-2">
                  <Building2 className="text-primary mt-1 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    {client.company_name}
                    {client.trade_name && (
                      <p className="text-sm font-normal text-muted-foreground mt-1">
                        {client.trade_name}
                      </p>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">CNPJ:</span>
                  <span>{client.cnpj}</span>
                </div>
                
                {client.segment && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">Segmento:</span>
                    <span>{client.segment}</span>
                  </div>
                )}

                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail size={16} />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}

                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone size={16} />
                    <span>{client.phone}</span>
                  </div>
                )}

                {(client.city || client.state) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} />
                    <span>{[client.city, client.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                {client.contacts && client.contacts.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {client.contacts.length} contato(s)
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t mt-3">
                  <Button
                    className="w-full"
                    variant="default"
                    onClick={() => navigate(`/clientes/${client.id}`)}
                  >
                    Ver Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Clientes;