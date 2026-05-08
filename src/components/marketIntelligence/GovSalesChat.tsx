import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  User as UserIcon,
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export type GovChatSearchContext = {
  searchTerms: string[];
  state?: string;
  totalValue12Months?: number;
  totalValue24Months?: number;
  totalQuantity12Months?: number;
  totalQuantity24Months?: number;
  topCompetitors?: Array<{ name: string; cnpj?: string; totalValue?: number; contractCount?: number }>;
  topOrgans?: Array<{ name: string; count?: number }>;
};

const SUGGESTIONS: { label: string; prompt: string }[] = [
  {
    label: "Mapear órgãos compradores",
    prompt:
      "Quero prospectar órgãos públicos federais que compraram software de gestão / CRM nos últimos 12 meses. Como faço esse mapeamento usando o PNCP e o Portal da Transparência? Me dê um passo a passo.",
  },
  {
    label: "Carona em Ata vigente",
    prompt:
      "Como identificar Atas de Registro de Preço vigentes (ARP) em que minha empresa pode pedir carona? Explique a base legal (Lei 14.133), onde consultar no PNCP e como abordar o órgão gerenciador.",
  },
  {
    label: "Dispensa por valor (Art. 75)",
    prompt:
      "Quais oportunidades existem na dispensa de licitação por valor (Art. 75, II da Lei 14.133/2021)? Como prospectar órgãos que compram via dispensa eletrônica no Compras.gov.br?",
  },
  {
    label: "PMI — Procedimento de Manifestação de Interesse",
    prompt:
      "Como usar PMI (Procedimento de Manifestação de Interesse) e consulta pública para influenciar editais antes da publicação? Quais órgãos costumam abrir PMI?",
  },
  {
    label: "Quem é o decisor da compra",
    prompt:
      "Em um órgão público, quem realmente decide a compra de tecnologia? Pregoeiro, ordenador de despesa, área demandante ou TI? Como identificar e abordar cada um sem ferir a Lei 14.133?",
  },
  {
    label: "Análise de concorrentes (PNCP)",
    prompt:
      "Como analisar quem ganhou licitações similares à minha solução nos últimos 24 meses, valores praticados e órgãos atendidos, usando dados oficiais do PNCP?",
  },
  {
    label: "Calendário de compras (PCA)",
    prompt:
      "O que é o PCA (Plano de Contratações Anual) e como usá-lo para antecipar oportunidades de venda em 2026? Onde encontro os PCAs publicados?",
  },
  {
    label: "Vendas para ME/EPP",
    prompt:
      "Quais vantagens a LC 123/2006 dá para minha empresa caso eu seja ME/EPP em licitações públicas? Como prospectar órgãos que reservam cota para pequenas empresas?",
  },
];

export default function GovSalesChat({
  searchContext,
}: {
  searchContext?: GovChatSearchContext;
} = {}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMsg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const {
      data: { session },
    } = await import("@/integrations/supabase/client").then((m) =>
      m.supabase.auth.getSession(),
    );
    const token = session?.access_token;
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gov-sales-chat`;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: next, searchContext }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        let msg = "Falha ao consultar a IA.";
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {}
        if (resp.status === 429)
          msg = "Muitas requisições. Aguarde alguns segundos.";
        if (resp.status === 402)
          msg = "Créditos de IA esgotados. Contate o administrador.";
        toast.error(msg);
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let started = false;
      let done = false;

      const upsert = (chunk: string) => {
        assistantText += chunk;
        setMessages((prev) => {
          if (!started) {
            started = true;
            return [...prev, { role: "assistant", content: assistantText }];
          }
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return copy;
        });
      };

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content: string | undefined =
              parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Erro ao consultar a IA.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
  }

  const hasContext =
    !!searchContext && searchContext.searchTerms.length > 0;

  return (
    <Card className="flex flex-col h-[calc(100vh-260px)] min-h-[560px] max-h-[820px] overflow-hidden border-border/60 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2 truncate">
              Consultor IA — Vendas ao Governo
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 hidden sm:inline-flex"
              >
                <ShieldCheck className="h-3 w-3" />
                Fontes oficiais
              </Badge>
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              PNCP · Compras.gov.br · Transparência · Lei 14.133/2021
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            disabled={loading}
            className="shrink-0"
          >
            <RotateCcw className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Nova conversa</span>
          </Button>
        )}
      </div>

      {/* Search context strip */}
      {hasContext && (
        <div className="px-4 sm:px-5 py-2 border-b bg-primary/5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-primary uppercase tracking-wide text-[10px]">
            Contexto:
          </span>
          {searchContext!.searchTerms.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
          {searchContext!.state && (
            <Badge variant="outline" className="text-[10px]">
              UF: {searchContext!.state}
            </Badge>
          )}
          {searchContext!.topCompetitors &&
            searchContext!.topCompetitors.length > 0 && (
              <span className="text-muted-foreground text-[11px]">
                · {searchContext!.topCompetitors.length} concorrentes mapeados
              </span>
            )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div
          ref={scrollRef}
          className="px-3 sm:px-5 py-5 space-y-5 max-w-3xl mx-auto w-full"
        >
          {messages.length === 0 && (
            <div className="space-y-5">
              <div className="text-center py-6">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary mx-auto mb-3 flex items-center justify-center">
                  <Sparkles className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold">
                  Como posso ajudar a prospectar novos clientes públicos?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Respondo apenas perguntas sobre vendas ao governo brasileiro.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider px-1">
                  Sugestões para começar
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.prompt)}
                      className="group text-left rounded-xl border bg-card hover:bg-accent hover:border-primary/40 transition px-3 py-2.5"
                    >
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100" />
                        {s.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {s.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2.5 sm:gap-3 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[88%] sm:max-w-[80%] px-4 py-2.5 text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                    : "bg-card border border-border/60 rounded-2xl rounded-bl-md"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed [&_a]:text-primary [&_a]:underline [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-2 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </p>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading &&
            (messages.length === 0 ||
              messages[messages.length - 1].role === "user") && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Consultando fontes oficiais...
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t bg-background/95 backdrop-blur p-3 sm:p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border bg-card focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition p-1.5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Pergunte sobre prospecção, licitações, PNCP, atas, dispensas..."
              rows={1}
              className="resize-none min-h-[40px] max-h-32 border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm"
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Apenas vendas ao governo brasileiro. Sempre valide informações nas
            fontes oficiais antes de agir.
          </p>
        </div>
      </div>
    </Card>
  );
}
