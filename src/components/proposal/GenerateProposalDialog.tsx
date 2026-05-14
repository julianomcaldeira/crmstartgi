import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProposalBlock, buildVariableContext, calcPricingTotals, PageSettings, DEFAULT_PAGE_SETTINGS } from "@/lib/proposalTypes";
import { ProposalBuilder } from "./ProposalBuilder";
import { ProposalRenderer } from "./ProposalRenderer";
import { Download, Link2, Mail, FileText, Save, Sparkles, Eye, Wrench } from "lucide-react";
import html2pdf from "html2pdf.js";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
}

export function GenerateProposalDialog({ open, onOpenChange, opportunity }: Props) {
  const [step, setStep] = useState<"choose" | "edit">("choose");
  const [templates, setTemplates] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [title, setTitle] = useState("Proposta Comercial");
  const [validityDays, setValidityDays] = useState(30);
  const [blocks, setBlocks] = useState<ProposalBlock[]>([]);
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setProposalId(null);
    setShareToken(null);
    loadInitial();
  }, [open]);

  const loadInitial = async () => {
    const [tplRes, clientRes, sellerRes] = await Promise.all([
      supabase.from("proposal_templates").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      opportunity?.client_id ? supabase.from("clients").select("*").eq("id", opportunity.client_id).maybeSingle() : Promise.resolve({ data: null } as any),
      opportunity?.assigned_to
        ? supabase.from("profiles").select("full_name,email,phone").eq("id", opportunity.assigned_to).maybeSingle()
        : supabase.auth.getUser().then(({ data }) => data.user
            ? supabase.from("profiles").select("full_name,email,phone").eq("id", data.user.id).maybeSingle()
            : ({ data: null } as any)),
    ]);
    setTemplates(tplRes.data || []);
    setClient(clientRes.data);
    setSeller(sellerRes.data);
    setTitle(`Proposta Comercial - ${(clientRes.data as any)?.company_name || opportunity?.title || ""}`.slice(0, 100));
  };

  const variables = useMemo(() => ({
    ...buildVariableContext({ client, opportunity, seller, validity_days: validityDays }),
    _page: pageSettings,
  }), [client, opportunity, seller, validityDays, pageSettings]);

  const pickTemplate = (tpl: any) => {
    setTemplateId(tpl.id);
    // Deep clone with new ids
    const cloned: ProposalBlock[] = (tpl.blocks || []).map((b: any) => ({ ...b, id: crypto.randomUUID() }));
    setBlocks(cloned);
    setStep("edit");
  };
  const pickBlank = () => {
    setTemplateId(null);
    setBlocks([]);
    setStep("edit");
  };

  const saveProposal = async (status: "draft" | "sent" = "draft") => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const totals = calcPricingTotals(blocks);
      const payload: any = {
        opportunity_id: opportunity.id,
        client_id: opportunity.client_id,
        template_id: templateId,
        title,
        blocks,
        variables,
        validity_days: validityDays,
        total_value: totals.total,
        monthly_value: totals.mensal,
        implementation_value: totals.unica,
        status,
        created_by: user.id,
      };
      if (status === "sent") payload.sent_at = new Date().toISOString();

      let data: any;
      if (proposalId) {
        const r = await supabase.from("proposals").update(payload).eq("id", proposalId).select().single();
        if (r.error) throw r.error;
        data = r.data;
      } else {
        const r = await supabase.from("proposals").insert(payload).select().single();
        if (r.error) throw r.error;
        data = r.data;
        setProposalId(data.id);
        setShareToken(data.share_token);
      }
      toast.success("Proposta salva!");
      return data;
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar proposta");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!previewRef.current) return null;
    const opt = {
      margin: 0,
      filename: `${title}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };
    // @ts-ignore
    return await html2pdf().set(opt).from(previewRef.current).outputPdf("blob");
  };

  const downloadPdf = async () => {
    setTab("preview");
    await new Promise((r) => setTimeout(r, 200));
    if (!previewRef.current) return;
    const opt = {
      margin: 0,
      filename: `${title}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };
    // @ts-ignore
    await html2pdf().set(opt).from(previewRef.current).save();
    toast.success("PDF baixado!");
  };

  const copyShareLink = async () => {
    let prop = proposalId ? { id: proposalId, share_token: shareToken } : await saveProposal("draft");
    if (!prop) return;
    const url = `${window.location.origin}/p/${prop.share_token || shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const sendByEmail = async () => {
    let prop: any = proposalId ? { id: proposalId, share_token: shareToken } : await saveProposal("sent");
    if (!prop) return;
    if (!client?.email) {
      toast.error("Cliente sem e-mail cadastrado");
      return;
    }
    setTab("preview");
    await new Promise((r) => setTimeout(r, 300));
    try {
      const blob = await generatePdfBlob();
      if (!blob) throw new Error("Falha ao gerar PDF");
      // Upload to storage
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user!.id}/${prop.id}.pdf`;
      const { error: upErr } = await supabase.storage.from("proposals").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("proposals").getPublicUrl(path);
      await supabase.from("proposals").update({ pdf_url: pub.publicUrl, status: "sent", sent_at: new Date().toISOString() }).eq("id", prop.id);

      const shareUrl = `${window.location.origin}/p/${prop.share_token || shareToken}`;
      const html = `
        <p>Olá ${client.company_name || ""},</p>
        <p>Segue a proposta comercial conforme conversamos.</p>
        <p><strong>Acesse online:</strong> <a href="${shareUrl}">${shareUrl}</a></p>
        <p>Você também pode <a href="${pub.publicUrl}">baixar o PDF</a>.</p>
        <p>Qualquer dúvida estou à disposição.</p>
        <p>Atenciosamente,<br/>${seller?.full_name || ""}</p>
      `;

      const { error: mailErr } = await supabase.functions.invoke("zoho-send-email", {
        body: {
          to: [client.email],
          subject: title,
          content: html,
          mailFormat: "html",
          opportunityId: opportunity.id,
          clientId: opportunity.client_id,
        },
      });
      if (mailErr) throw mailErr;
      toast.success("Proposta enviada por e-mail!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar: " + (e.message || ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Construtor de Proposta — {opportunity?.title}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Escolha um template</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <Card className="p-4 cursor-pointer hover:border-primary border-dashed border-2 flex flex-col items-center justify-center min-h-[160px] text-muted-foreground" onClick={pickBlank}>
                <FileText className="h-8 w-8 mb-2" />
                <span className="text-sm font-medium">Em branco</span>
              </Card>
              {templates.map((t) => (
                <Card key={t.id} className="p-4 cursor-pointer hover:border-primary transition-colors min-h-[160px] flex flex-col" onClick={() => pickTemplate(t)}>
                  <div className="h-2 rounded mb-3" style={{ background: t.thumbnail_color || "#22c55e" }} />
                  <div className="font-semibold text-sm mb-1">{t.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-3 flex-1">{t.description || "Sem descrição"}</div>
                  <div className="text-[11px] text-muted-foreground mt-2">{(t.blocks || []).length} blocos</div>
                </Card>
              ))}
              {templates.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground py-6">
                  Nenhum template criado ainda. Vá em <strong>Propostas → Templates</strong> para criar.
                </div>
              )}
            </div>
          </div>
        )}

        {step === "edit" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex flex-wrap gap-2 items-end bg-muted/30">
              <div className="flex-1 min-w-[280px]">
                <Label className="text-xs">Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="w-32">
                <Label className="text-xs">Validade (dias)</Label>
                <Input type="number" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("choose")}>Trocar template</Button>
              <Button variant="outline" size="sm" onClick={() => saveProposal("draft")} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
              <Button variant="outline" size="sm" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>
              <Button variant="outline" size="sm" onClick={copyShareLink}><Link2 className="h-4 w-4 mr-1" /> Copiar link</Button>
              <Button size="sm" onClick={sendByEmail} disabled={saving}><Mail className="h-4 w-4 mr-1" /> Enviar por e-mail</Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-3 mt-2 self-start">
                <TabsTrigger value="editor"><Wrench className="h-3 w-3 mr-1" /> Editor</TabsTrigger>
                <TabsTrigger value="preview"><Eye className="h-3 w-3 mr-1" /> Pré-visualização</TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="flex-1 overflow-hidden p-3 mt-0">
                <ProposalBuilder blocks={blocks} onChange={setBlocks} />
              </TabsContent>
              <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 mt-0 bg-gray-100">
                <div ref={previewRef} className="mx-auto shadow-lg" style={{ width: 794 /* A4 width @ 96dpi */ }}>
                  <ProposalRenderer blocks={blocks} variables={variables} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
