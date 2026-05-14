import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, User, Building2, Package, TrendingUp, Target, Briefcase, Paperclip, Upload, Download, Trash2, Clock, History, Mail, Send, ScrollText, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import OpportunityHistoryLog from "./OpportunityHistoryLog";
import EmailHistory from "./EmailHistory";
import ZohoEmailComposer from "./ZohoEmailComposer";
import { GenerateProposalDialog } from "./proposal/GenerateProposalDialog";
import { GenerateContractDialog } from "./contracts/GenerateContractDialog";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
interface OpportunityViewDialogProps {
  opportunity: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OpportunityViewDialog = ({ opportunity, open, onOpenChange }: OpportunityViewDialogProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailRefresh, setEmailRefresh] = useState(0);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && opportunity?.id) {
      fetchAttachments();
      fetchContracts();
    }
  }, [open, opportunity?.id]);

  const fetchContracts = async () => {
    const { data } = await supabase
      .from("contracts")
      .select("id, title, status, version, created_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false });
    setContracts(data || []);
  };

  if (!opportunity) return null;

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("opportunity_attachments")
        .select("*")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    setUploadingFiles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const files = Array.from(e.target.files);
      
      for (const file of files) {
        // Sanitize filename to remove special characters and spaces
        const sanitizedName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
          .replace(/_{2,}/g, '_'); // Replace multiple underscores with single
        const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("opportunity-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("opportunity_attachments")
          .insert({
            opportunity_id: opportunity.id,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;

        await supabase.from("opportunity_activities").insert({
          opportunity_id: opportunity.id,
          activity_type: "attachment_added",
          description: `Arquivo anexado: ${file.name}`,
          created_by: user.id,
        });
      }

      toast.success("Arquivos enviados com sucesso!");
      fetchAttachments();
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(error.message || "Erro ao enviar arquivos");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handlePreview = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("opportunity-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewFile({ url, name: attachment.file_name, type: attachment.file_type });
    } catch (error: any) {
      console.error("Error previewing file:", error);
      toast.error("Erro ao visualizar arquivo");
    }
  };

  const handleDownload = async (attachment: any) => {
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

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: storageError } = await supabase.storage
        .from("opportunity-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("opportunity_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      await supabase.from("opportunity_activities").insert({
        opportunity_id: opportunity.id,
        activity_type: "attachment_removed",
        description: `Arquivo removido: ${attachment.file_name}`,
        created_by: user.id,
      });

      toast.success("Arquivo removido!");
      fetchAttachments();
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusLabel = (status: string) => {
    const statuses: any = {
      lead: "Lead",
      contacted: "Contatado",
      qualified: "Qualificado",
      apresentacao: "Apresentação",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido"
    };
    return statuses[status] || status;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "won": return "default";
      case "lost": return "destructive";
      case "negotiation": return "default";
      case "proposal": return "secondary";
      default: return "outline";
    }
  };

  const getBusinessTypeLabel = (type: string) => {
    const types: any = {
      cliente_novo: "Cliente Novo",
      venda_na_base: "Venda na Base"
    };
    return types[type] || type;
  };

  const getBillingTypeLabel = (type: string) => {
    const types: any = {
      recorrente: "Recorrente",
      pontual: "Pontual"
    };
    return types[type] || "Recorrente";
  };

  const totalValue = (Number(opportunity.implementation_value || 0) + Number(opportunity.monthly_value || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <DialogTitle className="text-2xl">{opportunity.title}</DialogTitle>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                <ScrollText className="h-4 w-4 mr-1" /> Gerar Contrato
              </Button>
              <Button size="sm" onClick={() => setProposalOpen(true)}>
                <Sparkles className="h-4 w-4 mr-1" /> Gerar Proposta
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="attachments">
              Anexos ({attachments.length})
            </TabsTrigger>
            <TabsTrigger value="contracts">
              <ScrollText className="h-4 w-4 mr-1" />
              Contratos {contracts.length > 0 && `(${contracts.length})`}
            </TabsTrigger>
            <TabsTrigger value="emails">
              <Mail className="h-4 w-4 mr-1" />
              E-mails
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Status and Business Type Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getStatusVariant(opportunity.status)}>
                {getStatusLabel(opportunity.status)}
              </Badge>
              {opportunity.business_type && (
                <Badge variant="outline">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {getBusinessTypeLabel(opportunity.business_type)}
                </Badge>
              )}
              <Badge variant="secondary">
                <Target className="h-3 w-3 mr-1" />
                {opportunity.probability}% de chance
              </Badge>
              <Badge variant="outline" className={opportunity.billing_type === 'pontual' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                <DollarSign className="h-3 w-3 mr-1" />
                {getBillingTypeLabel(opportunity.billing_type)}
              </Badge>
              {opportunity.status === "won" && opportunity.close_cycle_days && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Fechado em {opportunity.close_cycle_days} {opportunity.close_cycle_days === 1 ? 'dia' : 'dias'}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Description */}
            {opportunity.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Descrição
                </div>
                <p className="text-foreground pl-6">{opportunity.description}</p>
              </div>
            )}

            {/* Client */}
            {opportunity.client && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Cliente
                </div>
                <p className="text-foreground pl-6">
                  {opportunity.client.company_name || opportunity.client.trade_name}
                </p>
              </div>
            )}

            {/* Product */}
            {opportunity.product && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Produto
                </div>
                <div className="pl-6">
                  <p className="text-foreground font-medium">{opportunity.product.name}</p>
                  {opportunity.product.description && (
                    <p className="text-sm text-muted-foreground mt-1">{opportunity.product.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Values */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Valores
              </div>
              <div className="pl-6 space-y-2">
                {opportunity.implementation_value && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Implantação:</span>
                    <span className="text-foreground font-medium">
                      R$ {Number(opportunity.implementation_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {opportunity.monthly_value && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Mensalidade:</span>
                    <span className="text-foreground font-medium">
                      R$ {Number(opportunity.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {totalValue > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-foreground">Total:</span>
                      <span className="text-foreground font-bold text-lg">
                        R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Expected Close Date */}
            {opportunity.expected_close_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Data Prevista de Fechamento
                </div>
                <p className="text-foreground pl-6">
                  {format(parseISO(opportunity.expected_close_date), "PPP", { locale: ptBR })}
                </p>
              </div>
            )}

            {/* Assigned To */}
            {opportunity.assigned && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Responsável
                </div>
                <p className="text-foreground pl-6">{opportunity.assigned.full_name}</p>
              </div>
            )}

            {/* Created Date */}
            {opportunity.created_at && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Criada em
                </div>
                <p className="text-foreground pl-6">
                  {format(parseISO(opportunity.created_at), "PPP 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="attachments" className="mt-4">
            {/* Attachments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  Anexos ({attachments.length})
                </div>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingFiles}
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingFiles ? "Enviando..." : "Adicionar"}
                    </span>
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => {
                    const isImage = attachment.file_type?.startsWith('image/');
                    const isPDF = attachment.file_type === 'application/pdf';
                    const canPreview = isImage || isPDF;

                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div 
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          onClick={() => canPreview && handlePreview(attachment)}
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate hover:underline">{attachment.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.file_size)} • {format(parseISO(attachment.created_at), "dd/MM/yyyy HH:mm")}
                              {canPreview && " • Clique para visualizar"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(attachment)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAttachment(attachment)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum anexo adicionado</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setContractOpen(true)}>
                <ScrollText className="h-4 w-4 mr-2" /> Gerar contrato
              </Button>
            </div>
            {contracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum contrato gerado para esta oportunidade.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate(`/contratos/${c.id}`)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.status}{c.version > 1 ? ` • v${c.version}` : ""} • {format(parseISO(c.created_at), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="emails" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setEmailOpen(true)}>
                <Send className="h-4 w-4 mr-2" /> Novo e-mail
              </Button>
            </div>
            <EmailHistory key={emailRefresh} opportunityId={opportunity.id} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <OpportunityHistoryLog opportunityId={opportunity.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>

      <ZohoEmailComposer
        open={emailOpen}
        onOpenChange={setEmailOpen}
        opportunityId={opportunity.id}
        clientId={opportunity.client_id}
        defaultTo={opportunity.client?.email || opportunity.clients?.email || ""}
        defaultSubject={`Re: ${opportunity.title}`}
        onSent={() => setEmailRefresh((n) => n + 1)}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[75vh]">
            {previewFile?.type.startsWith('image/') ? (
              <img 
                src={previewFile.url} 
                alt={previewFile.name}
                className="max-w-full h-auto rounded-lg"
              />
            ) : previewFile?.type === 'application/pdf' ? (
              <iframe
                src={previewFile.url}
                className="w-full h-[75vh] rounded-lg"
                title={previewFile.name}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <GenerateProposalDialog open={proposalOpen} onOpenChange={setProposalOpen} opportunity={opportunity} />
      <GenerateContractDialog open={contractOpen} onOpenChange={setContractOpen} opportunity={opportunity} onCreated={fetchContracts} />
    </Dialog>
  );
};

export default OpportunityViewDialog;
