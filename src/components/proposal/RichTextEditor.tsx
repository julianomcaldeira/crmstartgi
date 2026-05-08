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

// Image with width attribute for resizing
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: any) => el.style.width || el.getAttribute("width") || null,
        renderHTML: (attrs: any) => {
          // Always responsive: max-width 100%, height auto, block-level so it
          // doesn't interfere with line-height when font/text size changes.
          const w = attrs.width;
          const base = "max-width:100%;height:auto;display:block;margin:8px auto;";
          return { style: w ? `width:${w};${base}` : base };
        },
      },
    };
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
  Minus, Droplet
} from "lucide-react";
import { useRef, useEffect } from "react";
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

        {/* Image size (when image selected) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" title="Tamanho da imagem" disabled={!editor.isActive("image")}>
              Tam
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1">
            {[
              { label: "25%", v: "25%" },
              { label: "50%", v: "50%" },
              { label: "75%", v: "75%" },
              { label: "100%", v: "100%" },
              { label: "Original", v: "" },
            ].map((o) => (
              <button key={o.label} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent" onClick={() => setImageWidth(o.v)}>{o.label}</button>
            ))}
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

        <span className="ml-auto flex gap-0.5">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo className="h-4 w-4" /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo className="h-4 w-4" /></Btn>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <style>{`
          .rte-content img { max-width: 100% !important; height: auto !important; display: block; margin: 8px auto; border-radius: 6px; }
          .rte-content p:has(> img) { line-height: 0; margin: 0; font-size: 0; }
        `}</style>
        <div className="rte-content"><EditorContent editor={editor} /></div>
      </div>
    </div>
  );
}
