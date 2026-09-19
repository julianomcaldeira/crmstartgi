import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain,
  Database,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: { label: string; prompt: string }[] = [
  {
    label: "Resumo do funil",
    prompt:
      "Me dê um resumo do nosso pipeline de vendas: quantas oportunidades temos por status e qual o valor total em cada estágio?",
  },
  {
    label: "Oportunidades quentes",
    prompt:
      "Quais são as oportunidades mais valiosas em negociação ou proposta hoje? Liste cliente, título, valor e probabilidade.",
  },
  {
    label: "Minhas tarefas",
    prompt:
      "Quais tarefas estão atrasadas ou pendentes para mim? Liste as mais urgentes com cliente e data de vencimento.",
  },
  {
    label: "Clientes por estado",
    prompt:
      "Quantos clientes/prospects temos por estado e qual o segmento mais comum entre eles?",
  },
  {
    label: "Produtividade do time",
    prompt:
      "Resuma a produtividade do time: quantas tarefas foram concluídas e quantas estão pendentes por vendedor.",
  },
  {
    label: "Base de conhecimento",
    prompt:
      "O que existe na base de conhecimento? Agrupe os artigos por categoria e me diga quais são os principais.",
  },
];

function BrainAvatar({ size = 44 }: { size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-violet-500 via-primary to-cyan-400 opacity-50 blur-md animate-pulse" />
      <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-primary to-cyan-500 shadow-lg ring-1 ring-white/25">
        <Brain
          style={{ width: size * 0.54, height: size * 0.54 }}
          className="text-white drop-shadow"
          strokeWidth={2.1}
        />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background shadow">
          <Sparkles className="h-2.5 w-2.5 text-amber-400" />
        </span>
      </div>
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" />
    </div>
  );
}

const LOADING_STEPS = [
  "Conectando à base de dados...",
  "Consultando tabelas do CRM...",
  "Cruzando informações...",
  "Analisando resultados...",
];

export default function BrainChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [providerInfo, setProviderInfo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const id = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1600);
    return () => clearInterval(id);
  }, [loading]);

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
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-chat`;
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
        let msg = "Falha ao consultar o Brain.";
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
          else if (j?.message) msg = j.message;
        } catch {
          // resposta sem corpo JSON: mantém mensagem padrão
        }
        if (resp.status === 404)
          msg = "Função Brain não publicada no servidor. Faça o deploy pelo Lovable.";
        if (resp.status === 429)
          msg = "Muitas requisições. Aguarde alguns segundos.";
        if (resp.status === 402)
          msg = "Créditos de IA esgotados. Contate o administrador.";
        toast.error(msg);
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        return;
      }

      const providerName = resp.headers.get("x-brain-provider");
      const providerModel = resp.headers.get("x-brain-model");
      if (providerName) {
        setProviderInfo(
          providerModel ? `${providerName} · ${providerModel}` : providerName,
        );
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
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        console.error(e);
        toast.error("Erro ao consultar o Brain.");
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
    <Card className="flex flex-col h-[calc(100vh-260px)] min-h-[560px] max-h-[820px] overflow-hidden border-border/60 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-violet-500/10 via-primary/5 to-cyan-500/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <BrainAvatar size={44} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold">
              Brain
              <Badge
                variant="secondary"
                className="hidden gap-1 text-[10px] sm:inline-flex"
              >
                <Database className="h-3 w-3" />
                Base de dados conectada
              </Badge>
              {providerInfo && (
                <Badge
                  variant="outline"
                  className="hidden gap-1 text-[10px] md:inline-flex"
                  title="Provedor de IA em uso"
                >
                  <Sparkles className="h-3 w-3" />
                  {providerInfo}
                </Badge>
              )}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Pergunte qualquer coisa sobre seus clientes, vendas e tarefas
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

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div
          ref={scrollRef}
          className="mx-auto w-full max-w-3xl space-y-5 px-3 py-5 sm:px-5"
        >
          {messages.length === 0 && (
            <div className="space-y-5">
              <div className="py-6 text-center">
                <div className="mx-auto mb-3">
                  <div className="mx-auto w-fit">
                    <BrainAvatar size={64} />
                  </div>
                </div>
                <p className="text-base font-semibold">
                  Olá, eu sou o Brain
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Eu analiso toda a base do seu CRM para responder com dados
                  reais. Pode perguntar à vontade.
                </p>
              </div>
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Experimente perguntar
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.prompt)}
                      className="group rounded-xl border bg-card px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-accent"
                    >
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100" />
                        {s.label}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
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
                <div className="shrink-0 pt-0.5">
                  <BrainAvatar size={32} />
                </div>
              )}
              <div
                className={`max-w-[88%] px-4 py-2.5 text-sm shadow-sm sm:max-w-[80%] ${
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-2xl rounded-bl-md border border-border/60 bg-card"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none break-words leading-relaxed dark:prose-invert [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_h1]:mt-3 [&_h1]:text-base [&_h2]:mt-3 [&_h2]:text-sm [&_h3]:mt-2 [&_h3]:text-sm [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2">
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading &&
            (messages.length === 0 ||
              messages[messages.length - 1].role === "user") && (
              <div className="flex justify-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <BrainAvatar size={32} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {LOADING_STEPS[loadingStep]}
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t bg-background/95 p-3 backdrop-blur sm:p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/30">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Pergunte sobre clientes, oportunidades, tarefas, propostas, metas..."
              rows={1}
              className="max-h-32 min-h-[40px] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            O Brain lê apenas os dados que você tem permissão para ver.
          </p>
        </div>
      </div>
    </Card>
  );
}
