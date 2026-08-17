import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { canAccessRevision, forbidden } from "../_shared/contract-access.ts";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from "https://esm.sh/docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const decisionLabel = (d: string) => d === "accepted" ? "ACEITA" : d === "rejected" ? "REJEITADA" : d === "counter_proposal" ? "CONTRAPROPOSTA" : "PENDENTE";
const decisionColor = (d: string) => d === "accepted" ? "DCFCE7" : d === "rejected" ? "FEE2E2" : d === "counter_proposal" ? "FEF3C7" : "F3F4F6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { revision_id } = await req.json();
    if (!revision_id) return new Response(JSON.stringify({ error: "revision_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (!(await canAccessRevision(admin, user.id, revision_id))) return forbidden(corsHeaders);

    const { data: rev } = await admin
      .from("contract_clause_revisions")
      .select("*, contracts(id, title, clients(company_name))")
      .eq("id", revision_id)
      .single();
    if (!rev) throw new Error("Revisão não encontrada");

    const { data: decisions } = await admin
      .from("contract_clause_decisions")
      .select("*")
      .eq("revision_id", revision_id)
      .order("position", { ascending: true });

    const contract: any = rev.contracts;

    const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
    const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

    const decisionRows = (decisions || []).flatMap((d: any, i: number) => [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders, width: { size: 600, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: { fill: "F3F4F6", type: ShadingType.CLEAR, color: "auto" },
            children: [new Paragraph({ children: [new TextRun({ text: `${i+1}`, bold: true })] })],
          }),
          new TableCell({
            borders: cellBorders, width: { size: 5760, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: d.clause_reference || "Cláusula", bold: true })] })],
          }),
          new TableCell({
            borders: cellBorders, width: { size: 3000, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: { fill: decisionColor(d.decision), type: ShadingType.CLEAR, color: "auto" },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: decisionLabel(d.decision), bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [new TableCell({
          borders: cellBorders, columnSpan: 3,
          width: { size: 9360, type: WidthType.DXA },
          margins: { top: 80, bottom: 120, left: 120, right: 120 },
          children: [
            new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Pedido do prospect: ", bold: true }), new TextRun(d.proposed_change || "—")] }),
            ...(d.original_text ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Texto original: ", bold: true, color: "666666" }), new TextRun({ text: d.original_text, color: "666666" })] })] : []),
            ...(d.admin_comment ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Parecer StartGI: ", bold: true }), new TextRun(d.admin_comment)] })] : []),
            ...(d.counter_text ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "Contraproposta: ", bold: true, color: "B45309" }), new TextRun({ text: d.counter_text, color: "B45309" })] })] : []),
          ],
        })],
      }),
    ]);

    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 32, bold: true, color: "16A34A" },
            paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
            run: { size: 26, bold: true },
            paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 } },
        ],
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Devolutiva de Negociação Contratual")] }),
          new Paragraph({ children: [new TextRun({ text: contract.title, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Cliente: ${contract.clients?.company_name || "—"}`, color: "555555" })] }),
          new Paragraph({ children: [new TextRun({ text: `Data: ${new Date().toLocaleString("pt-BR")}`, color: "555555" })] }),
          new Paragraph({ children: [new TextRun("")] }),
          ...(rev.admin_summary ? [
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Resumo geral")] }),
            new Paragraph({ children: [new TextRun(rev.admin_summary)] }),
            new Paragraph({ children: [new TextRun("")] }),
          ] : []),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`Decisões cláusula a cláusula (${decisions?.length || 0})`)] }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [600, 5760, 3000],
            rows: decisionRows,
          }),
        ],
      }],
    });

    const buf = await Packer.toBuffer(doc);
    const fileName = `devolutiva-${revision_id.slice(0, 8)}.docx`;
    const path = `${user.id}/${contract.id}/${fileName}`;
    const { error: upErr } = await admin.storage.from("contracts").upload(path, buf, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    if (upErr) throw upErr;

    const { data: signed } = await admin.storage.from("contracts").createSignedUrl(path, 60 * 60 * 24 * 30);
    const url = signed?.signedUrl || path;

    await admin.from("contract_files").insert({
      contract_id: contract.id,
      revision_id,
      kind: "negotiation_docx",
      file_url: url,
      file_name: fileName,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file_size: buf.byteLength,
      created_by: user.id,
    });

    await admin.from("contract_clause_revisions").update({ negotiation_docx_url: url }).eq("id", revision_id);

    return new Response(JSON.stringify({ ok: true, url, file_name: fileName }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-negotiation-docx error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
