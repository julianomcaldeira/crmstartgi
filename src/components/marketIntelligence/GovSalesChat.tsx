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
        body: JSON.stringify({ messages: next }),
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

  return (
    <Card className="flex flex-col h-[640px]">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              Consultor IA — Vendas ao Governo
              <Badge variant="secondary" className="text-[10px] gap-1">
                <ShieldCheck className="h-3 w-3" />
                Fontes oficiais
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
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
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Nova conversa
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">
                  Como posso ajudar a prospectar novos clientes públicos?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Respondo apenas perguntas sobre vendas ao governo brasileiro.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Sugestões para começar
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.prompt)}
                      className="text-left rounded-lg border bg-card hover:bg-accent transition px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
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
              className={`flex gap-3 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-primary [&_a]:underline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading &&
            (messages.length === 0 ||
              messages[messages.length - 1].role === "user") && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando fontes oficiais...
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 bg-background">
        <div className="flex items-end gap-2">
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
            rows={2}
            className="resize-none min-h-[48px] max-h-32"
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-12 w-12 shrink-0"
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
    </Card>
  );
}
