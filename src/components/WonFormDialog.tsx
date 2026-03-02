import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput, formatCurrency, formatCNPJ } from "@/components/ui/masked-input";
import { Upload, Paperclip, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface WonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
  onSubmitSuccess: () => void;
}

export function WonFormDialog({ open, onOpenChange, opportunity, onSubmitSuccess }: WonFormDialogProps) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [implBillingDate, setImplBillingDate] = useState("");
  const [paymentConditions, setPaymentConditions] = useState("");
  const [firstMonthlyDate, setFirstMonthlyDate] = useState("");
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    if (open && opportunity) {
      fetchClientData();
      fetchContacts();
      setSelectedContactId("");
      setContactEmail("");
      setImplBillingDate("");
      setPaymentConditions("");
      setFirstMonthlyDate("");
      setContractFiles([]);
    }
  }, [open, opportunity]);

  const fetchClientData = async () => {
    if (!opportunity?.client_id) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", opportunity.client_id)
      .single();
    setClientData(data);
  };

  const fetchContacts = async () => {
    if (!opportunity?.client_id) return;
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("client_id", opportunity.client_id)
      .order("name");
    setContacts(data || []);
  };

  const handleContactChange = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contacts.find(c => c.id === contactId);
    setContactEmail(contact?.email || "");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setContractFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setContractFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!implBillingDate || !paymentConditions || !selectedContactId || !firstMonthlyDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (contractFiles.length === 0) {
      toast.error("Anexe pelo menos o contrato assinado");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Upload contract files
      const uploadedFiles: { name: string; url: string }[] = [];
      for (const file of contractFiles) {
        const sanitizedName = file.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${user.id}/${opportunity.id}-${Date.now()}-${sanitizedName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("opportunity-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save attachment record
        await supabase.from("opportunity_attachments").insert({
          opportunity_id: opportunity.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        });

        const { data: urlData } = supabase.storage
          .from("opportunity-attachments")
          .getPublicUrl(filePath);

        uploadedFiles.push({ name: file.name, url: urlData.publicUrl });
      }

      // Get seller profile
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", opportunity.assigned_to)
        .single();

      const contact = contacts.find(c => c.id === selectedContactId);
      const productName = opportunity.product?.name || "N/A";

      // Send notification email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-won-notification", {
        body: {
          clientName: clientData?.company_name || clientData?.trade_name || "N/A",
          clientCnpj: formatCNPJ(clientData?.cnpj || ""),
          productName,
          implementationValue: formatCurrency(opportunity.implementation_value || 0),
          implBillingDate,
          paymentConditions,
          financialContactName: contact?.name || "N/A",
          financialContactEmail: contactEmail,
          monthlyValue: formatCurrency(opportunity.monthly_value || 0),
          firstMonthlyDate,
          sellerName: sellerProfile?.full_name || "N/A",
          sellerEmail: sellerProfile?.email || "",
          attachments: uploadedFiles,
          billingType: opportunity.billing_type || "recorrente",
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast.warning("Venda registrada, mas houve erro ao enviar o email de notificação");
      }

      // Now update the opportunity status to won
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({ status: "won" as any })
        .eq("id", opportunity.id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from("opportunity_activities").insert({
        opportunity_id: opportunity.id,
        activity_type: "status_change",
        description: "Oportunidade marcada como Ganho",
        old_value: opportunity.status,
        new_value: "Ganho",
        created_by: user.id,
      });

      toast.success("Venda registrada e notificação enviada com sucesso!");
      onOpenChange(false);
      onSubmitSuccess();
    } catch (error: any) {
      console.error("Error submitting won form:", error);
      toast.error(error.message || "Erro ao registrar venda");
    } finally {
      setSubmitting(false);
    }
  };

  const clientName = clientData?.company_name || clientData?.trade_name || "";
  const clientCnpj = clientData?.cnpj ? formatCNPJ(clientData.cnpj) : "";
  const productName = opportunity?.product?.name || "N/A";
  const implValue = opportunity?.implementation_value || 0;
  const monthlyVal = opportunity?.monthly_value || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">🎉 Registro de Venda Ganha</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Auto-filled fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
              <Input value={clientName} disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              <Input value={clientCnpj} disabled className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Produto</Label>
              <Input value={productName} disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor de Implantação</Label>
              <Input value={formatCurrency(implValue)} disabled className="bg-muted" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor da Mensalidade</Label>
            <Input value={formatCurrency(monthlyVal)} disabled className="bg-muted" />
          </div>

          {/* Manual fields */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-medium text-sm">Informações para o Financeiro</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="impl-date">Data de Cobrança da Implantação *</Label>
                <Input
                  id="impl-date"
                  type="date"
                  value={implBillingDate}
                  onChange={(e) => setImplBillingDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="first-monthly">Data da 1ª Mensalidade *</Label>
                <Input
                  id="first-monthly"
                  type="date"
                  value={firstMonthlyDate}
                  onChange={(e) => setFirstMonthlyDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="payment-conditions">Condições de Pagamento *</Label>
              <Textarea
                id="payment-conditions"
                value={paymentConditions}
                onChange={(e) => setPaymentConditions(e.target.value)}
                placeholder="Ex: Boleto, 30 dias, PIX..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="financial-contact">Contato do Financeiro *</Label>
                <Select value={selectedContactId} onValueChange={handleContactChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o contato" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} {contact.role ? `(${contact.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email do Contato</Label>
                <Input value={contactEmail} disabled className="bg-muted" />
              </div>
            </div>
          </div>

          {/* Contract upload */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-medium text-sm">Contrato *</h3>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                id="contract-upload"
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              <label htmlFor="contract-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clique para anexar o contrato</p>
              </label>
            </div>

            {contractFiles.length > 0 && (
              <div className="space-y-2">
                {contractFiles.map((file, index) => (
                  <Card key={index} className="p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Registrar Venda e Notificar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
