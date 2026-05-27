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
import { Download, Link2, Mail, FileText, Save, Sparkles, Eye, Wrench, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { proposalPublicUrl } from "@/lib/publicUrls";
import {
  IGANHEI_SLIDE2_CARDS,
  IGANHEI_SLIDE2_DEFAULT_IDS,
  IGANHEI_SLIDE2_PLACEHOLDER,
  buildSlide2CardsHtml,
} from "@/lib/iganheiCards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
}

export function GenerateProposalDialog({ open, onOpenChange, opportunity }: Props) {
  const [step, setStep] = useState<"choose" | "confirm" | "edit">("choose");
  const [templates, setTemplates] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [title, setTitle] = useState("Proposta Comercial");
  const [validityDays, setValidityDays] = useState(30);
  const [blocks, setBlocks] = useState<ProposalBlock[]>([]);
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [autoTemplate, setAutoTemplate] = useState<any>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("preview");
  const [slide2Cards, setSlide2Cards] = useState<string[]>(IGANHEI_SLIDE2_DEFAULT_IDS);
  const [isPreVendas, setIsPreVendas] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [contactEmails, setContactEmails] = useState<Array<{ name: string; email: string }>>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [extraEmail, setExtraEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsPreVendas((r || []).some((x: any) => x.role === "pre_vendas"));
    })();
  }, []);

  const hasSlide2Placeholder = useMemo(
    () => blocks.some((b: any) => typeof b?.html === "string" && b.html.includes(IGANHEI_SLIDE2_PLACEHOLDER)),
    [blocks]
  );

  const confirmHasSlide2 = useMemo(
    () => (autoTemplate?.blocks || []).some((b: any) => typeof b?.html === "string" && b.html.includes(IGANHEI_SLIDE2_PLACEHOLDER)),
    [autoTemplate]
  );

  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setProposalId(null);
    setShareToken(null);
    setAutoTemplate(null);
    loadInitial();
  }, [open]);

  const loadInitial = async () => {
    const [tplRes, clientRes, sellerRes, productRes] = await Promise.all([
      supabase.from("proposal_templates").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      opportunity?.client_id ? supabase.from("clients").select("*").eq("id", opportunity.client_id).maybeSingle() : Promise.resolve({ data: null } as any),
      opportunity?.assigned_to
        ? supabase.from("profiles").select("full_name,email,phone,avatar_url").eq("id", opportunity.assigned_to).maybeSingle()
        : supabase.auth.getUser().then(({ data }) => data.user
            ? supabase.from("profiles").select("full_name,email,phone,avatar_url").eq("id", data.user.id).maybeSingle()
            : ({ data: null } as any)),
      opportunity?.product_id
        ? supabase.from("products").select("id,name").eq("id", opportunity.product_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const tpls = tplRes.data || [];
    setTemplates(tpls);
    setClient(clientRes.data);
    setSeller(sellerRes.data);
    setProduct(productRes.data);
    setTitle(`Proposta Comercial - ${(clientRes.data as any)?.company_name || opportunity?.title || ""}`.slice(0, 100));

    // Auto-pick template by product (proposal_templates.category stores product_id uuid)
    if (opportunity?.product_id) {
      const match = tpls.find((t: any) => t.category === opportunity.product_id);
      if (match) {
        setAutoTemplate(match);
        setSlide2Cards(IGANHEI_SLIDE2_DEFAULT_IDS);
        setStep("confirm");
      }
    }
  };

  const variables = useMemo(() => ({
    ...buildVariableContext({ client, opportunity, seller, validity_days: validityDays }),
    _page: pageSettings,
    slide2_cards_html: buildSlide2CardsHtml(slide2Cards),
  }), [client, opportunity, seller, validityDays, pageSettings, slide2Cards]);

  const pickTemplate = (tpl: any) => {
    setTemplateId(tpl.id);
    const cloned: ProposalBlock[] = (tpl.blocks || []).map((b: any) => ({ ...b, id: crypto.randomUUID() }));
    setBlocks(cloned);
    setSlide2Cards(IGANHEI_SLIDE2_DEFAULT_IDS);
    setStep("edit");
  };
  const pickBlank = () => {
    setTemplateId(null);
    setBlocks([]);
    setStep("edit");
  };

  const confirmAndGenerate = async () => {
    if (!autoTemplate) return;
    if (confirmHasSlide2 && slide2Cards.filter(Boolean).length !== 4) {
      toast.error("Selecione 4 cards para o slide Cenários e Desafios");
      return;
    }
    setTemplateId(autoTemplate.id);
    const cloned: ProposalBlock[] = (autoTemplate.blocks || []).map((b: any) => ({ ...b, id: crypto.randomUUID() }));
    setBlocks(cloned);
    setStep("edit");
    toast.success("Proposta criada com o template de " + (product?.name || "produto"));
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

  // Builds a multi-page A4 landscape PDF where every slide has identical fixed
  // dimensions matching the page. Each block is cloned into an off-screen frame
  // sized exactly to A4 landscape, with the content centered both axes and
  // overflow hidden so nothing overflows or distorts the page.
  const buildSlidesPdf = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const { default: JsPDF } = await import("jspdf");
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();   // 297mm
    const pageH = pdf.internal.pageSize.getHeight();  // 210mm

    // Fixed A4 landscape canvas size in px (≈ 150dpi -> crisp PDF).
    const SLIDE_W = 1754;
    const SLIDE_H = 1240;

    const root = previewRef.current!;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
    const targets = slides.length ? slides : [root];

    // Off-screen stage container — kept rendered (not display:none) so
    // html2canvas can measure it, but moved far off the visible viewport.
    const stage = document.createElement("div");
    stage.style.cssText = [
      "position:fixed",
      "left:-100000px",
      "top:0",
      `width:${SLIDE_W}px`,
      `height:${SLIDE_H}px`,
      "background:#ffffff",
      "overflow:hidden",
      "z-index:-1",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(stage);

    try {
      for (let i = 0; i < targets.length; i++) {
        // Build a fresh fixed-size frame for each slide.
        stage.innerHTML = "";
        const frame = document.createElement("div");
        frame.style.cssText = [
          `width:${SLIDE_W}px`,
          `height:${SLIDE_H}px`,
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "overflow:hidden",
          "background:#ffffff",
          "box-sizing:border-box",
          "padding:48px 64px",
        ].join(";");

        const clone = targets[i].cloneNode(true) as HTMLElement;
        // Neutralize per-block paddings / min-heights that fight the fixed frame.
        clone.style.width = "100%";
        clone.style.maxWidth = "100%";
        clone.style.maxHeight = "100%";
        clone.style.margin = "0";
        clone.style.boxSizing = "border-box";
        // Drop forced page-breaks / huge min-heights coming from .pg sections.
        clone.querySelectorAll<HTMLElement>(".pg").forEach((pg) => {
          pg.style.pageBreakAfter = "auto";
          pg.style.minHeight = "0";
          pg.style.height = "auto";
          pg.style.maxHeight = "100%";
        });
        frame.appendChild(clone);
        stage.appendChild(frame);

        // Auto-fit: if content overflows the frame, scale it down uniformly so
        // nothing is cropped while still filling the page.
        const contentH = clone.scrollHeight;
        const contentW = clone.scrollWidth;
        const availH = SLIDE_H - 96; // padding 48*2
        const availW = SLIDE_W - 128; // padding 64*2
        const scale = Math.min(1, availH / contentH, availW / contentW);
        if (scale < 1) {
          clone.style.transform = `scale(${scale})`;
          clone.style.transformOrigin = "center center";
        }

        const canvas = await html2canvas(frame, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: SLIDE_W,
          height: SLIDE_H,
          windowWidth: SLIDE_W,
          windowHeight: SLIDE_H,
        });

        if (i > 0) pdf.addPage("a4", "landscape");
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0, 0, pageW, pageH,
          undefined, "FAST",
        );
      }
    } finally {
      stage.remove();
    }
    return pdf;
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    if (!previewRef.current) return null;
    const pdf = await buildSlidesPdf();
    return pdf.output("blob");
  };

  const downloadPdf = async () => {
    setTab("preview");
    await new Promise((r) => setTimeout(r, 250));
    if (!previewRef.current) return;
    try {
      const pdf = await buildSlidesPdf();
      pdf.save(`${title}.pdf`);
      toast.success("PDF baixado!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  };

  const copyShareLink = async () => {
    let prop = proposalId ? { id: proposalId, share_token: shareToken } : await saveProposal("draft");
    if (!prop) return;
    const url = proposalPublicUrl(prop.share_token || shareToken);
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openEmailDialog = async () => {
    // Load contacts of opportunity's client
    let contacts: Array<{ name: string; email: string }> = [];
    if (opportunity?.client_id) {
      const { data } = await supabase
        .from("contacts")
        .select("name,email")
        .eq("client_id", opportunity.client_id)
        .not("email", "is", null);
      contacts = (data || [])
        .filter((c: any) => c.email && c.email.trim())
        .map((c: any) => ({ name: c.name, email: c.email.trim() }));
    }
    // Include client primary email if present and not already in contacts
    if (client?.email && !contacts.some((c) => c.email.toLowerCase() === client.email.toLowerCase())) {
      contacts.unshift({ name: client.company_name || "Cliente", email: client.email });
    }
    setContactEmails(contacts);
    setSelectedEmails(contacts.map((c) => c.email));
    setExtraEmail("");
    setEmailDialogOpen(true);
  };

  const sendByEmail = async () => {
    const extras = extraEmail
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const recipients = Array.from(new Set([...selectedEmails, ...extras]));
    if (recipients.length === 0) {
      toast.error("Selecione ao menos um destinatário");
      return;
    }
    setSendingEmail(true);
    try {
      let prop: any = proposalId ? { id: proposalId, share_token: shareToken } : await saveProposal("sent");
      if (!prop) return;
      setTab("preview");
      await new Promise((r) => setTimeout(r, 300));
      const blob = await generatePdfBlob();
      if (!blob) throw new Error("Falha ao gerar PDF");
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user!.id}/${prop.id}.pdf`;
      const { error: upErr } = await supabase.storage.from("proposals").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("proposals").getPublicUrl(path);
      await supabase.from("proposals").update({ pdf_url: pub.publicUrl, status: "sent", sent_at: new Date().toISOString() }).eq("id", prop.id);

      const shareUrl = proposalPublicUrl(prop.share_token || shareToken);
      const html = `
        <p>Olá ${client?.company_name || ""},</p>
        <p>Segue a proposta comercial conforme conversamos.</p>
        <p><strong>Acesse online:</strong> <a href="${shareUrl}">${shareUrl}</a></p>
        <p>Você também pode <a href="${pub.publicUrl}">baixar o PDF</a>.</p>
        <p>Qualquer dúvida estou à disposição.</p>
        <p>Atenciosamente,<br/>${seller?.full_name || ""}</p>
      `;

      const { error: mailErr } = await supabase.functions.invoke("zoho-send-email", {
        body: {
          to: recipients,
          subject: title,
          content: html,
          mailFormat: "html",
          opportunityId: opportunity.id,
          clientId: opportunity.client_id,
        },
      });
      if (mailErr) throw mailErr;
      toast.success(`Proposta enviada para ${recipients.length} destinatário(s)!`);
      setEmailDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar: " + (e.message || ""));
    } finally {
      setSendingEmail(false);
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

        {step === "confirm" && autoTemplate && (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="rounded-lg border bg-primary/5 p-4">
                <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Template selecionado automaticamente</div>
                <div className="font-semibold">{autoTemplate.name}</div>
                <div className="text-xs text-muted-foreground">Produto: {product?.name || "—"} • {(autoTemplate.blocks || []).length} blocos</div>
              </div>

              <Card className="p-4">
                <div className="font-semibold mb-1">1. Os dados da oportunidade estão corretos?</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs">Título da proposta</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Validade (dias)</Label>
                    <Input type="number" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
                  </div>
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    Oportunidade: <strong className="text-foreground">{opportunity?.title}</strong>
                  </div>
                </div>
              </Card>

              {confirmHasSlide2 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold">2. Escolha os 4 cards de Cenários e Desafios</div>
                    <Badge variant={slide2Cards.filter(Boolean).length === 4 ? "default" : "destructive"}>
                      {slide2Cards.filter(Boolean).length}/4
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Selecione os desafios mais relevantes para esse cliente.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((idx) => {
                      const value = slide2Cards[idx] || "";
                      const used = new Set(slide2Cards.filter((_, i) => i !== idx));
                      const selected = IGANHEI_SLIDE2_CARDS.find((c) => c.id === value);
                      return (
                        <div key={idx} className="space-y-1">
                          <Label className="text-xs">Card {idx + 1}</Label>
                          <Select
                            value={value}
                            onValueChange={(v) => {
                              const next = [...slide2Cards];
                              next[idx] = v;
                              setSlide2Cards(next);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Selecione uma opção..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {IGANHEI_SLIDE2_CARDS.filter((c) => c.id === value || !used.has(c.id)).map((c) => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                  <div className="flex flex-col py-0.5">
                                    <span className="font-semibold">{c.title}</span>
                                    <span className="text-[11px] text-muted-foreground">{c.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selected && (
                            <p className="text-[11px] text-muted-foreground leading-snug">{selected.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <div className="font-semibold mb-2">3. Responsável pela proposta</div>
                {seller ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={seller.avatar_url || undefined} alt={seller.full_name || ""} />
                      <AvatarFallback>{(seller.full_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm space-y-0.5">
                      <div className="font-semibold">{seller.full_name || "—"}</div>
                      <div className="text-muted-foreground">{seller.email || "—"}</div>
                      <div className="text-muted-foreground">{seller.phone || "—"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Responsável não definido — será usado o usuário atual.</div>
                )}
              </Card>


              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep("choose")}>Escolher outro template</Button>
                <Button onClick={confirmAndGenerate} disabled={!client}>
                  <Sparkles className="h-4 w-4 mr-1" /> Confirmar e gerar proposta
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "edit" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 border-b flex flex-wrap gap-2 items-end bg-muted/30">
              <div className="flex-1 min-w-[280px]">
                <Label className="text-[10px]">Título</Label>
                <Input className="h-7 text-xs" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="w-24">
                <Label className="text-[10px]">Validade (dias)</Label>
                <Input className="h-7 text-xs" type="number" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} />
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setStep("choose")}>Trocar template</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => saveProposal("draft")} disabled={saving}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={downloadPdf}><Download className="h-3 w-3 mr-1" /> PDF</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyShareLink}><Link2 className="h-3 w-3 mr-1" /> Copiar link</Button>
              <Button size="sm" className="h-7 text-xs" onClick={openEmailDialog} disabled={saving}><Mail className="h-3 w-3 mr-1" /> Enviar por e-mail</Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-3 mt-1 self-start h-7 p-0.5">
                {isPreVendas && (
                  <TabsTrigger value="editor" className="h-6 text-xs px-2"><Wrench className="h-3 w-3 mr-1" /> Editor</TabsTrigger>
                )}
                <TabsTrigger value="preview" className="h-6 text-xs px-2"><Eye className="h-3 w-3 mr-1" /> Pré-visualização</TabsTrigger>
              </TabsList>

              {isPreVendas && tab === "editor" && (
                <TabsContent value="editor" className="flex-1 overflow-hidden p-3 mt-0 flex flex-col gap-3">
                  <div className="flex-1 overflow-hidden">
                    <ProposalBuilder blocks={blocks} onChange={setBlocks} pageSettings={pageSettings} onPageSettingsChange={setPageSettings} />
                  </div>
                </TabsContent>
              )}
              {tab === "preview" && (
                <TabsContent value="preview" className="flex-1 overflow-y-auto px-4 pt-1 pb-4 mt-0 bg-gray-100">
                  <div ref={previewRef} className="mx-auto shadow-lg" style={{ width: 794 /* A4 width @ 96dpi */ }}>
                    <ProposalRenderer blocks={blocks} variables={variables} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </DialogContent>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Enviar proposta por e-mail
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold">Contatos da oportunidade</Label>
              {contactEmails.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2">Nenhum contato com e-mail cadastrado.</p>
              ) : (
                <div className="mt-2 space-y-2 max-h-56 overflow-y-auto border rounded-md p-2">
                  {contactEmails.map((c) => {
                    const checked = selectedEmails.includes(c.email);
                    return (
                      <label key={c.email} className="flex items-start gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedEmails((prev) =>
                              v ? Array.from(new Set([...prev, c.email])) : prev.filter((e) => e !== c.email)
                            );
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Adicionar outros e-mails</Label>
              <Input
                value={extraEmail}
                onChange={(e) => setExtraEmail(e.target.value)}
                placeholder="email@exemplo.com, outro@exemplo.com"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Separe múltiplos e-mails por vírgula.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail}>
              Cancelar
            </Button>
            <Button onClick={sendByEmail} disabled={sendingEmail}>
              <Mail className="h-4 w-4 mr-1" />
              {sendingEmail ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
