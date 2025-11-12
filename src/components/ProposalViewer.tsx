import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer } from "lucide-react";
import { toast } from "sonner";

interface ProposalViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalHtml: string;
  opportunityTitle: string;
}

export function ProposalViewer({
  open,
  onOpenChange,
  proposalHtml,
  opportunityTitle,
}: ProposalViewerProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(proposalHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([proposalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Proposta-${opportunityTitle.replace(/[^a-z0-9]/gi, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Proposta baixada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Proposta Comercial
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Baixar HTML
              </Button>
              <Button variant="default" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Imprimir
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="border rounded-lg overflow-hidden bg-white">
          <iframe
            srcDoc={proposalHtml}
            className="w-full h-[70vh]"
            title="Proposta Comercial"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}