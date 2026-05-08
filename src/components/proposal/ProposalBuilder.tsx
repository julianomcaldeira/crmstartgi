import { useState } from "react";
import { ProposalBlock, BlockType, BLOCK_LABELS, newBlock, AVAILABLE_VARIABLES, PricingItem, ScopeItem, TimelinePhase } from "@/lib/proposalTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, ArrowUp, ArrowDown, Variable, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  blocks: ProposalBlock[];
  onChange: (blocks: ProposalBlock[]) => void;
}

const BLOCK_OPTIONS: BlockType[] = ["cover", "about", "text", "scope", "pricing", "timeline", "image", "terms", "cta", "signature"];

export function ProposalBuilder({ blocks, onChange }: Props) {
  const [selected, setSelected] = useState<string | null>(blocks[0]?.id ?? null);

  const update = (id: string, patch: any) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const add = (type: BlockType) => {
    const b = newBlock(type);
    onChange([...blocks, b]);
    setSelected(b.id);
  };
  const remove = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    onChange(next);
    if (selected === id) setSelected(next[0]?.id ?? null);
  };
  const move = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const current = blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Sidebar de blocos */}
      <div className="col-span-4 border rounded-lg p-3 flex flex-col h-full bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Blocos</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="default"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1">
              <div className="grid">
                {BLOCK_OPTIONS.map((t) => (
                  <button key={t} className="text-left px-2 py-1.5 rounded hover:bg-accent text-sm" onClick={() => add(t)}>
                    {BLOCK_LABELS[t]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {blocks.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum bloco. Adicione o primeiro.</p>}
          {blocks.map((b, i) => (
            <Card key={b.id} className={`p-2 cursor-pointer flex items-center gap-2 ${selected === b.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelected(b.id)}>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{BLOCK_LABELS[b.type]}</div>
                <div className="text-[11px] text-muted-foreground truncate">{(b as any).title || (b as any).content?.slice(0, 40) || `#${i + 1}`}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); move(b.id, -1); }}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); move(b.id, 1); }}><ArrowDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); remove(b.id); }}><Trash2 className="h-3 w-3" /></Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Editor do bloco selecionado */}
      <div className="col-span-8 border rounded-lg p-4 overflow-y-auto">
        {!current && <p className="text-sm text-muted-foreground text-center pt-12">Selecione ou adicione um bloco para editar.</p>}
        {current && <BlockEditor block={current} onChange={(patch) => update(current.id, patch)} />}
      </div>
    </div>
  );
}

function VarPicker({ onPick }: { onPick: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline"><Variable className="h-3 w-3 mr-1" /> Variável</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1 max-h-72 overflow-y-auto">
        {AVAILABLE_VARIABLES.map((v) => (
          <button key={v.key} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent" onClick={() => onPick(v.key)}>
            <span className="font-mono text-primary">{v.key}</span>
            <span className="text-muted-foreground ml-2">{v.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function BlockEditor({ block, onChange }: { block: ProposalBlock; onChange: (p: any) => void }) {
  const append = (field: string, val: string) => onChange({ [field]: ((block as any)[field] || "") + " " + val });

  switch (block.type) {
    case "cover":
      return (
        <div className="space-y-3">
          <Field label="Título" right={<VarPicker onPick={(v) => append("title", v)} />}>
            <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Subtítulo" right={<VarPicker onPick={(v) => append("subtitle", v)} />}>
            <Input value={block.subtitle || ""} onChange={(e) => onChange({ subtitle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor de fundo"><Input type="color" value={block.backgroundColor || "#22c55e"} onChange={(e) => onChange({ backgroundColor: e.target.value })} /></Field>
            <Field label="Cor do texto"><Input type="color" value={block.textColor || "#ffffff"} onChange={(e) => onChange({ textColor: e.target.value })} /></Field>
          </div>
        </div>
      );
    case "text": case "about": case "terms":
      return (
        <div className="space-y-3">
          <Field label="Título"><Input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <Field label="Conteúdo" right={<VarPicker onPick={(v) => append("content", v)} />}>
            <Textarea rows={12} value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
          </Field>
        </div>
      );
    case "scope": {
      const items = block.items;
      const set = (i: number, patch: Partial<ScopeItem>) => onChange({ items: items.map((x, k) => k === i ? { ...x, ...patch } : x) });
      return (
        <div className="space-y-3">
          <Field label="Título"><Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          {items.map((it, i) => (
            <Card key={i} className="p-3 space-y-2">
              <Input placeholder="Nome do item" value={it.name} onChange={(e) => set(i, { name: e.target.value })} />
              <Textarea rows={2} placeholder="Descrição" value={it.description || ""} onChange={(e) => set(i, { description: e.target.value })} />
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ items: items.filter((_, k) => k !== i) })}><Trash2 className="h-3 w-3 mr-1" />Remover</Button>
            </Card>
          ))}
          <Button size="sm" variant="outline" onClick={() => onChange({ items: [...items, { name: "", description: "" }] })}><Plus className="h-3 w-3 mr-1" /> Item</Button>
        </div>
      );
    }
    case "pricing": {
      const items = block.items;
      const set = (i: number, patch: Partial<PricingItem>) => onChange({ items: items.map((x, k) => k === i ? { ...x, ...patch } : x) });
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mostrar totais</Label>
            <Switch checked={!!block.showTotals} onCheckedChange={(v) => onChange({ showTotals: v })} />
          </div>
          <Field label="Título"><Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          {items.map((it, i) => (
            <Card key={i} className="p-3 space-y-2">
              <Input placeholder="Item" value={it.name} onChange={(e) => set(i, { name: e.target.value })} />
              <Input placeholder="Descrição (opcional)" value={it.description || ""} onChange={(e) => set(i, { description: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" placeholder="Qtd" value={it.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} />
                <Input type="number" step="0.01" placeholder="Unitário" value={it.unit_price} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} />
                <Select value={it.recurrence} onValueChange={(v: any) => set(i, { recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ items: items.filter((_, k) => k !== i) })}><Trash2 className="h-3 w-3 mr-1" />Remover</Button>
            </Card>
          ))}
          <Button size="sm" variant="outline" onClick={() => onChange({ items: [...items, { name: "", qty: 1, unit_price: 0, recurrence: "mensal" }] })}><Plus className="h-3 w-3 mr-1" /> Item</Button>
        </div>
      );
    }
    case "timeline": {
      const items = block.items;
      const set = (i: number, patch: Partial<TimelinePhase>) => onChange({ items: items.map((x, k) => k === i ? { ...x, ...patch } : x) });
      return (
        <div className="space-y-3">
          <Field label="Título"><Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          {items.map((it, i) => (
            <Card key={i} className="p-3 space-y-2">
              <Input placeholder="Fase" value={it.phase} onChange={(e) => set(i, { phase: e.target.value })} />
              <Input placeholder="Duração (ex.: 2 semanas)" value={it.duration || ""} onChange={(e) => set(i, { duration: e.target.value })} />
              <Textarea rows={2} placeholder="Descrição" value={it.description || ""} onChange={(e) => set(i, { description: e.target.value })} />
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ items: items.filter((_, k) => k !== i) })}><Trash2 className="h-3 w-3 mr-1" />Remover</Button>
            </Card>
          ))}
          <Button size="sm" variant="outline" onClick={() => onChange({ items: [...items, { phase: "", duration: "", description: "" }] })}><Plus className="h-3 w-3 mr-1" /> Fase</Button>
        </div>
      );
    }
    case "signature":
      return (
        <div className="space-y-3">
          <Field label="Nome" right={<VarPicker onPick={(v) => append("name", v)} />}><Input value={block.name || ""} onChange={(e) => onChange({ name: e.target.value })} /></Field>
          <Field label="Cargo"><Input value={block.role || ""} onChange={(e) => onChange({ role: e.target.value })} /></Field>
          <Field label="Empresa"><Input value={block.company || ""} onChange={(e) => onChange({ company: e.target.value })} /></Field>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Mostrar linha de aceite do cliente</Label>
            <Switch checked={!!block.showClientLine} onCheckedChange={(v) => onChange({ showClientLine: v })} />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <Field label="URL da imagem"><Input value={block.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Legenda"><Input value={block.caption || ""} onChange={(e) => onChange({ caption: e.target.value })} /></Field>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <Field label="Título"><Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <Field label="Texto do botão"><Input value={block.buttonText} onChange={(e) => onChange({ buttonText: e.target.value })} /></Field>
          <Field label="URL do botão"><Input value={block.buttonUrl || ""} onChange={(e) => onChange({ buttonUrl: e.target.value })} /></Field>
        </div>
      );
  }
}

function Field({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {right}
      </div>
      {children}
    </div>
  );
}
