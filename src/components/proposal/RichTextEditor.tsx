import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";

// Image with width + advanced styling attributes (align, radius, rotate, shadow, filter)
const FILTER_CSS: Record<string, string> = {
  none: "",
  grayscale: "grayscale(100%)",
  sepia: "sepia(80%)",
  blur: "blur(2px)",
  bright: "brightness(1.15) contrast(1.05)",
};
const buildImgStyle = (a: any) => {
  const styles: string[] = ["max-width:100%", "height:auto", "display:block"];
  if (a.width) styles.push(`width:${a.width}`);
  styles.push(`border-radius:${a.radius != null ? a.radius : 6}px`);
  if (a.rotate) styles.push(`transform:rotate(${a.rotate}deg)`);
  if (a.shadow === "true" || a.shadow === true) styles.push("box-shadow:0 8px 24px rgba(0,0,0,0.18)");
  const f = FILTER_CSS[a.filter] || "";
  if (f) styles.push(`filter:${f}`);
  const align = a.align || "center";
  const m = align === "center" ? "8px auto" : align === "right" ? "8px 0 8px auto" : "8px 0";
  styles.push(`margin:${m}`);
  return styles.join(";");
};
const dataAttr = (name: string) => ({
  default: null,
  parseHTML: (el: any) => el.getAttribute(`data-${name}`) || null,
  renderHTML: (attrs: any) => attrs[name] != null && attrs[name] !== "" ? { [`data-${name}`]: String(attrs[name]) } : {},
});
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: any) => el.getAttribute("data-width") || el.style?.width || el.getAttribute("width") || null,
        renderHTML: (attrs: any) => attrs.width ? { "data-width": attrs.width } : {},
      },
      align: dataAttr("align"),
      radius: dataAttr("radius"),
      rotate: dataAttr("rotate"),
      shadow: dataAttr("shadow"),
      filter: dataAttr("filter"),
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const a: any = node.attrs;
    return ["img", { ...HTMLAttributes, style: buildImgStyle(a) }];
  },
});
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Heading1, Heading2, Heading3,
  Image as ImageIcon, Link2, Variable, Undo, Redo, Palette, Type,
  Minus, Droplet, Code2
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AVAILABLE_VARIABLES } from "@/lib/proposalTypes";
import { uploadProposalImage } from "@/lib/proposalUpload";
import { toast } from "sonner";

// Custom extension to apply font-size via inline style on textStyle mark
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: any) => el.style.fontSize?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const FONT_FAMILIES = [
  { label: "Padrão", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
];
const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px", "48px"];
const COLORS = ["#000000", "#374151", "#6b7280", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ffffff"];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder = "Comece a escrever sua proposta...", minHeight = 400 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(value || "");

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ inline: false, HTMLAttributes: { class: "rounded my-2 max-w-full" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none p-4",
        style: `min-height: ${minHeight}px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const insertVariable = (key: string) => {
    editor.chain().focus().insertContent(key + " ").run();
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await uploadProposalImage(file);
      editor.chain().focus().insertContent(`<p><img src="${url}" alt="" /></p><p></p>`).run();
      toast.success("Imagem inserida");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar imagem");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setLink = () => {
    const url = window.prompt("URL do link:", editor.getAttributes("link").href || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const setImageWidth = (width: string) => {
    if (!editor.isActive("image")) {
      toast.info("Selecione uma imagem primeiro (clique sobre ela)");
      return;
    }
    editor.chain().focus().updateAttributes("image", { width }).run();
  };

  const insertWatermark = () => {
    const text = window.prompt("Texto da marca d'água:", "CONFIDENCIAL");
    if (!text) return;
    const html = `<p style="text-align:center;color:#9ca3af;opacity:0.25;font-size:72px;font-weight:700;letter-spacing:8px;transform:rotate(-15deg);margin:24px 0;user-select:none;">${text}</p>`;
    editor.chain().focus().insertContent(html).run();
  };

  const Btn = ({ active, onClick, title, children }: any) => (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      className="h-8 w-8 p-0"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-background flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b bg-muted/30 p-1.5 flex flex-wrap gap-0.5 items-center">
        {/* Font family */}
        <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.label} value={f.value || "default"} onSelect={() => f.value ? editor.chain().focus().setFontFamily(f.value).run() : editor.chain().focus().unsetFontFamily().run()}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Font size */}
        <Select onValueChange={(v) => (editor.chain().focus() as any).setFontSize(v).run()}>
          <SelectTrigger className="h-8 w-20 text-xs"><SelectValue placeholder="Tam." /></SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <span className="w-px h-6 bg-border mx-1" />

        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título 1"><Heading1 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 className="h-4 w-4" /></Btn>

        <span className="w-px h-6 bg-border mx-1" />

        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough className="h-4 w-4" /></Btn>

        {/* Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title="Cor do texto">
              <Palette className="h-4 w-4" style={{ color: editor.getAttributes("textStyle").color || undefined }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {COLORS.map((c) => (
                <button key={c} className="w-6 h-6 rounded border" style={{ background: c }} onClick={() => editor.chain().focus().setColor(c).run()} />
              ))}
            </div>
            <input type="color" className="w-full h-8" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
            <Button size="sm" variant="ghost" className="w-full mt-1" onClick={() => editor.chain().focus().unsetColor().run()}>Remover cor</Button>
          </PopoverContent>
        </Popover>

        <span className="w-px h-6 bg-border mx-1" />

        <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Esquerda"><AlignLeft className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centro"><AlignCenter className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Direita"><AlignRight className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justificado"><AlignJustify className="h-4 w-4" /></Btn>

        <span className="w-px h-6 bg-border mx-1" />

        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote className="h-4 w-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha separadora"><Minus className="h-4 w-4" /></Btn>

        <span className="w-px h-6 bg-border mx-1" />

        <Btn onClick={() => fileRef.current?.click()} title="Inserir imagem"><ImageIcon className="h-4 w-4" /></Btn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />

        {/* Image edit (when image selected) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" title="Editar imagem selecionada" disabled={!editor.isActive("image")}>
              Imagem
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2">
            {(() => {
              const a: any = editor.getAttributes("image");
              const upd = (patch: any) => editor.chain().focus().updateAttributes("image", patch).run();
              return (
                <>
                  <div>
                    <div className="text-xs font-medium mb-1">Largura</div>
                    <div className="flex flex-wrap gap-1">
                      {["25%", "50%", "75%", "100%", ""].map((v) => (
                        <button key={v || "orig"} className="px-2 py-1 text-xs rounded border hover:bg-accent" onClick={() => upd({ width: v })}>{v || "Original"}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Alinhamento</div>
                    <div className="flex gap-1">
                      {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([v, Ic]: any) => (
                        <Button key={v} type="button" size="sm" variant={a.align === v ? "default" : "outline"} className="h-7 w-7 p-0" onClick={() => upd({ align: v })}><Ic className="h-3.5 w-3.5" /></Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Raio: {a.radius ?? 6}px</div>
                    <input type="range" min={0} max={48} value={Number(a.radius ?? 6)} onChange={(e) => upd({ radius: e.target.value })} className="w-full" />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Rotação: {a.rotate || 0}°</div>
                    <input type="range" min={-180} max={180} value={Number(a.rotate || 0)} onChange={(e) => upd({ rotate: e.target.value })} className="w-full" />
                  </div>
                  <label className="flex items-center justify-between text-xs">
                    <span className="font-medium">Sombra</span>
                    <input type="checkbox" checked={a.shadow === "true" || a.shadow === true} onChange={(e) => upd({ shadow: e.target.checked ? "true" : null })} />
                  </label>
                  <div>
                    <div className="text-xs font-medium mb-1">Filtro</div>
                    <Select value={a.filter || "none"} onValueChange={(v) => upd({ filter: v === "none" ? null : v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="grayscale">Preto e branco</SelectItem>
                        <SelectItem value="sepia">Sépia</SelectItem>
                        <SelectItem value="blur">Desfoque</SelectItem>
                        <SelectItem value="bright">Brilho+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              );
            })()}
          </PopoverContent>
        </Popover>

        <Btn active={editor.isActive("link")} onClick={setLink} title="Inserir link"><Link2 className="h-4 w-4" /></Btn>
        <Btn onClick={insertWatermark} title="Inserir marca d'água"><Droplet className="h-4 w-4" /></Btn>

        <span className="w-px h-6 bg-border mx-1" />

        {/* Variables */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1">
              <Variable className="h-4 w-4" /> Variável
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1 max-h-72 overflow-y-auto">
            {AVAILABLE_VARIABLES.map((v) => (
              <button key={v.key} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent" onClick={() => insertVariable(v.key)}>
                <span className="font-mono text-primary">{v.key}</span>
                <span className="text-muted-foreground ml-2">{v.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <span className="ml-auto flex gap-0.5 items-center">
          <Button
            type="button"
            size="sm"
            variant={htmlMode ? "default" : "ghost"}
            className="h-8 gap-1 text-xs"
            title="Editar código HTML"
            onClick={() => {
              if (!htmlMode) {
                setHtmlDraft(editor.getHTML());
                setHtmlMode(true);
              } else {
                editor.commands.setContent(htmlDraft || "", { emitUpdate: true });
                setHtmlMode(false);
              }
            }}
          >
            <Code2 className="h-4 w-4" /> {htmlMode ? "Aplicar" : "HTML"}
          </Button>
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo className="h-4 w-4" /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo className="h-4 w-4" /></Btn>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <style>{`
          .rte-content img { max-width: 100% !important; height: auto !important; display: block; margin: 8px auto; border-radius: 6px; }
          .rte-content p:has(> img) { line-height: 0; margin: 0; font-size: 0; }
        `}</style>
        {htmlMode ? (
          <div className="p-3 h-full">
            <Textarea
              value={htmlDraft}
              onChange={(e) => setHtmlDraft(e.target.value)}
              className="font-mono text-xs h-full min-h-[400px] w-full"
              placeholder="<h1>Título</h1><p>Cole ou edite seu HTML aqui...</p>"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Edite o HTML diretamente. Clique em "Aplicar" para voltar ao editor visual.
            </p>
          </div>
        ) : (
          <div className="rte-content"><EditorContent editor={editor} /></div>
        )}
      </div>
    </div>
  );
}
