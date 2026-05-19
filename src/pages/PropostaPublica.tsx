import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProposalRenderer } from "@/components/proposal/ProposalRenderer";
import { buildVariableContext } from "@/lib/proposalTypes";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, AlertCircle, MessageCircle, Mail, Printer, Download } from "lucide-react";
import logo from "@/assets/logo-evolua-crm.png";
import { flush, getVisitorId, type TrackEvent } from "@/lib/proposalTracker";
import { CommercialProposalRenderer } from "@/components/proposal/commercial/CommercialProposalRenderer";
import { resolveVariables, type CommercialSection, type CommercialTheme } from "@/lib/commercialProposal";
import { useCommercialTracking } from "@/components/proposal/commercial/useCommercialTracking";

const HEARTBEAT_MS = 15000;
const FLUSH_MS = 5000;

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const recipientId = params.get("r") || undefined;
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visitorId = useMemo(() => getVisitorId(), []);
  const queueRef = useRef<TrackEvent[]>([]);
  const docRef = useRef<HTMLDivElement | null>(null);
  const seenSections = useRef<Set<string>>(new Set());
  const lastBeatRef = useRef<number>(Date.now());
  const isVisibleRef = useRef<boolean>(true);

  // NOINDEX (proposal pages must never appear in search engines)
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow,noarchive";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // Load proposal
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_proposal_by_token", { _token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error("Proposta não encontrada ou expirada");
        setData(row);
      } catch (e: any) {
        setError(e.message || "Erro ao carregar proposta");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Enqueue helper
  const enqueue = (e: Omit<TrackEvent, "visitor_id">) => {
    queueRef.current.push({ ...e, visitor_id: visitorId, recipient_id: recipientId });
  };

  // Flush loop
  useEffect(() => {
    if (!token || !data) return;

    enqueue({ event_type: "open" });

    const flushTimer = setInterval(() => {
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length) flush(token, batch);
    }, FLUSH_MS);

    const heartbeat = setInterval(() => {
      if (!isVisibleRef.current) return;
      const now = Date.now();
      const delta = now - lastBeatRef.current;
      lastBeatRef.current = now;
      enqueue({ event_type: "heartbeat", duration_ms: Math.min(delta, HEARTBEAT_MS * 2) });
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      lastBeatRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => {
      const now = Date.now();
      const delta = now - lastBeatRef.current;
      if (delta > 1000) enqueue({ event_type: "heartbeat", duration_ms: Math.min(delta, HEARTBEAT_MS * 2) });
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (batch.length) flush(token, batch, true);
    };
    window.addEventListener("pagehide", onUnload);

    return () => {
      clearInterval(flushTimer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
      onUnload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, data]);

  // Section tracking via IntersectionObserver
  useEffect(() => {
    if (!docRef.current || !data) return;
    const blocks = Array.from(docRef.current.querySelectorAll<HTMLElement>("[data-block-id]"));
    if (!blocks.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          const id = el.getAttribute("data-block-id") || "";
          const type = el.getAttribute("data-block-type") || "";
          if (!id || seenSections.current.has(id)) continue;
          seenSections.current.add(id);
          enqueue({ event_type: "section_view", section_id: id, metadata: { type } });
          if (type === "pricing") {
            enqueue({ event_type: "pricing_view", section_id: id });
          }
        }
      },
      { threshold: 0.4 }
    );
    blocks.forEach((b) => obs.observe(b));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // CTA click tracking (delegated)
  useEffect(() => {
    if (!docRef.current) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      enqueue({ event_type: "cta_click", metadata: { href: a.href, text: (a.textContent || "").slice(0, 80) } });
    };
    const el = docRef.current;
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <AlertCircle className="h-12 w-12 text-destructive mb-3" />
      <h1 className="text-xl font-semibold">Proposta indisponível</h1>
      <p className="text-muted-foreground">{error}</p>
    </div>
  );
  if (!data) return null;

  // === New: Commercial template renderer (i-Ganhei) ===
  if (data.template_key && String(data.template_key).startsWith("iganhei")) {
    return <CommercialPublic data={data} docRef={docRef} enqueue={enqueue} />;
  }

  const variables = buildVariableContext({
    client: { company_name: data.client_company },
    validity_days: data.validity_days,
  });
  const finalVars = { ...variables, ...(data.variables || {}) };

  const handleShare = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    enqueue({ event_type: "share", metadata: { url } });
  };

  const handleDownload = () => {
    enqueue({ event_type: "download" });
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto p-3 flex items-center justify-between">
          <img src={logo} alt="Evolua CRM" className="h-10" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>Compartilhar link</Button>
            <Button variant="outline" size="sm" onClick={handleDownload}><FileText className="h-4 w-4 mr-1" /> Imprimir / PDF</Button>
          </div>
        </div>
      </header>
      <main className="py-6">
        <div ref={docRef} className="mx-auto bg-white shadow-lg" style={{ width: 794 }}>
          <ProposalRenderer blocks={data.blocks || []} variables={finalVars} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4 print:hidden">
          Validade: {data.validity_days || 30} dias · Visualização registrada
        </p>
      </main>
    </div>
  );
}

/* ---------------- Commercial public renderer ---------------- */
function CommercialPublic({ data, docRef, enqueue }: {
  data: any;
  docRef: React.RefObject<HTMLDivElement>;
  enqueue: (e: Omit<TrackEvent, "visitor_id">) => void;
}) {
  const [vars, setVars] = useState<Record<string, string> | null>(null);
  const sections = (data.sections || []) as CommercialSection[];
  const theme = (data.theme || {}) as Partial<CommercialTheme>;
  const tracking = (data.tracking || {}) as { ga4_id?: string; clarity_id?: string };

  useEffect(() => { resolveVariables(data).then(setVars); }, [data]);

  const { emit } = useCommercialTracking({
    ga4Id: tracking.ga4_id,
    clarityId: tracking.clarity_id,
    rootRef: docRef as any,
    onEvent: (name) => {
      if (name === "section_view") return; // already covered by parent observer
      enqueue({ event_type: name === "cta_click" ? "cta_click" : "section_view", metadata: { name } });
    },
  });

  if (!vars) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const phone = (vars.telefone_vendedor || "").replace(/\D/g, "");
  const wa = phone ? `https://wa.me/55${phone}` : "";

  const onPrint = () => { emit("proposal_print"); enqueue({ event_type: "download" }); window.print(); };
  const onPdf = () => { emit("proposal_pdf_download"); enqueue({ event_type: "download" }); window.print(); };
  const onWa = () => { emit("whatsapp_click"); };
  const onMail = () => { emit("email_click"); };

  return (
    <div className="min-h-screen" style={{ background: "#F5F7FA" }}>
      <div ref={docRef} className="bg-white" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <CommercialProposalRenderer sections={sections} variables={vars} theme={theme} />
      </div>
      <div className="ig-floating-bar">
        {wa && <a className="ig-cta-accent" href={wa} target="_blank" rel="noreferrer" onClick={onWa}><MessageCircle size={16} /> WhatsApp</a>}
        {vars.email_vendedor && <a href={`mailto:${vars.email_vendedor}`} onClick={onMail}><Mail size={16} /> E-mail</a>}
        <button onClick={onPrint}><Printer size={16} /> Imprimir</button>
        <button className="ig-cta-primary" onClick={onPdf}><Download size={16} /> Baixar PDF</button>
      </div>
    </div>
  );
}
