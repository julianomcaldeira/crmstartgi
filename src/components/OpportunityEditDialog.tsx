import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, Paperclip } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyInput } from "@/components/ui/masked-input";

interface OpportunityEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  clients: any[];
  products: any[];
  users: any[];
  stages: any[];
  // Form values
  clientId: string;
  setClientId: (value: string) => void;
  productId: string;
  setProductId: (value: string) => void;
  implementationValue: string;
  setImplementationValue: (value: string) => void;
  monthlyValue: string;
  setMonthlyValue: (value: string) => void;
  probability: string;
  setProbability: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  assignedTo: string;
  setAssignedTo: (value: string) => void;
  expectedCloseDate: string;
  setExpectedCloseDate: (value: string) => void;
  businessType: string;
  setBusinessType: (value: string) => void;
  chargeCommission: boolean;
  setChargeCommission: (value: boolean) => void;
  // Attachments
  attachments: any[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadAttachment: (attachment: any) => void;
  onDeleteAttachment: (attachment: any) => void;
  uploadingFiles: boolean;
}

export function OpportunityEditDialog({
  open,
  onOpenChange,
  onSubmit,
  clients,
  products,
  users,
  stages,
  clientId,
  setClientId,
  productId,
  setProductId,
  implementationValue,
  setImplementationValue,
  monthlyValue,
  setMonthlyValue,
  probability,
  setProbability,
  status,
  setStatus,
  assignedTo,
  setAssignedTo,
  expectedCloseDate,
  setExpectedCloseDate,
  businessType,
  setBusinessType,
  chargeCommission,
  setChargeCommission,
  attachments,
  onFileUpload,
  onDownloadAttachment,
  onDeleteAttachment,
  uploadingFiles,
}: OpportunityEditDialogProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Editar Oportunidade</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="attachments">
              Anexos ({attachments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-client">Cliente *</Label>
                  <Select value={clientId} onValueChange={setClientId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name || client.trade_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-product">Produto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
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
                  <Label htmlFor="edit-implValue">Valor de Implantação</Label>
                  <CurrencyInput
                    id="edit-implValue"
                    value={implementationValue}
                    onValueChange={setImplementationValue}
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-monthlyValue">Valor Mensal</Label>
                  <CurrencyInput
                    id="edit-monthlyValue"
                    value={monthlyValue}
                    onValueChange={setMonthlyValue}
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Estágio</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {stages.map((stage) => (
                        <SelectItem key={stage.key} value={stage.key}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-probability">Probabilidade</Label>
                  <Select value={probability} onValueChange={setProbability}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
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
                <Label htmlFor="edit-businessType">Tipo de Negócio</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="cliente_novo">Cliente Novo</SelectItem>
                    <SelectItem value="venda_na_base">Venda na Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-assigned">Vendedor Responsável</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expectedDate">Data Prevista de Fechamento</Label>
                  <Input
                    id="edit-expectedDate"
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-chargeCommission"
                  checked={chargeCommission}
                  onChange={(e) => setChargeCommission(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="edit-chargeCommission" className="text-sm font-normal cursor-pointer">
                  Cobrar comissão do cliente
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4 mt-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={onFileUpload}
                disabled={uploadingFiles}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploadingFiles ? "Enviando..." : "Clique para fazer upload de arquivos"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Múltiplos arquivos podem ser selecionados
                </p>
              </label>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <Card key={attachment.id} className="p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {attachment.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadAttachment(attachment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteAttachment(attachment)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum arquivo anexado
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}