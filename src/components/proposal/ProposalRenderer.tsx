import { ProposalBlock, interpolate, VariableContext, formatBRL, calcPricingTotals } from "@/lib/proposalTypes";

interface Props {
  blocks: ProposalBlock[];
  variables: VariableContext;
  brandColor?: string;
}

export function ProposalRenderer({ blocks, variables, brandColor = "#22c55e" }: Props) {
  return (
    <div className="proposal-doc bg-white text-gray-900" style={{ ["--brand" as any]: brandColor }}>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} variables={variables} brandColor={brandColor} />
      ))}
      {/* Print/PDF helper styles scoped to .proposal-doc */}
      <style>{`
        .proposal-doc { font-family: 'Inter', system-ui, -apple-system, Arial, sans-serif; line-height: 1.6; }
        .proposal-doc .pg { padding: 48px 56px; page-break-after: always; }
        .proposal-doc .pg:last-child { page-break-after: auto; }
        .proposal-doc h1, .proposal-doc h2, .proposal-doc h3 { font-weight: 700; }
        .proposal-doc .pre-line { white-space: pre-line; }
        .proposal-doc .richtext-block h1 { font-size: 32px; margin: 16px 0 12px; }
        .proposal-doc .richtext-block h2 { font-size: 26px; margin: 16px 0 10px; }
        .proposal-doc .richtext-block h3 { font-size: 20px; margin: 14px 0 8px; }
        .proposal-doc .richtext-block p { margin: 8px 0; }
        .proposal-doc .richtext-block ul, .proposal-doc .richtext-block ol { padding-left: 24px; margin: 8px 0; }
        .proposal-doc .richtext-block ul { list-style: disc; }
        .proposal-doc .richtext-block ol { list-style: decimal; }
        .proposal-doc .richtext-block blockquote { border-left: 4px solid #e5e7eb; padding-left: 16px; color: #4b5563; font-style: italic; margin: 12px 0; }
        .proposal-doc .richtext-block img { max-width: 100%; height: auto; border-radius: 8px; margin: 12px auto; display: block; }
        .proposal-doc .richtext-block p:has(> img) { margin: 0; line-height: 0; }
        .proposal-doc .richtext-block a { color: var(--brand); text-decoration: underline; }
        .proposal-doc .richtext-block strong { font-weight: 700; }
      `}</style>
    </div>
  );
}

function BlockView({ block, variables, brandColor }: { block: ProposalBlock; variables: VariableContext; brandColor: string }) {
  switch (block.type) {
    case "richtext": {
      const html = interpolate(block.html, variables);
      return (
        <section className="pg richtext-block" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
    case "cover": {
      const bg = block.backgroundColor || brandColor;
      const fg = block.textColor || "#ffffff";
      return (
        <section className="pg" style={{ background: `linear-gradient(135deg, ${bg} 0%, ${shade(bg, -20)} 100%)`, color: fg, minHeight: 700, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ opacity: 0.85, fontSize: 14, letterSpacing: 4, textTransform: "uppercase", marginBottom: 24 }}>Proposta Comercial</div>
          <h1 style={{ fontSize: 56, lineHeight: 1.1, marginBottom: 16 }}>{interpolate(block.title, variables)}</h1>
          {block.subtitle && <p style={{ fontSize: 22, opacity: 0.9 }}>{interpolate(block.subtitle, variables)}</p>}
          <div style={{ marginTop: 48, fontSize: 14, opacity: 0.8 }}>
            {variables.date?.today} · Apresentado por {variables.seller?.name}
          </div>
        </section>
      );
    }
    case "text":
    case "about":
    case "terms": {
      const padMap = { compact: "24px 40px", normal: "48px 56px", spacious: "72px 80px" } as const;
      const padding = padMap[(block as any).padding as keyof typeof padMap] || padMap.normal;
      const align = (block as any).align || "left";
      const titleColor = (block as any).titleColor || brandColor;
      const textColor = (block as any).textColor || "#111827";
      const bg = (block as any).bgColor;
      const fs = (block as any).fontSize || 16;
      return (
        <section className="pg" style={{ padding, background: bg || undefined, color: textColor, textAlign: align as any }}>
          {block.title && <h2 style={{ fontSize: 32, color: titleColor, marginBottom: 16, textAlign: align as any }}>{interpolate(block.title, variables)}</h2>}
          <div className="pre-line" style={{ fontSize: fs, color: textColor }}>{interpolate(block.content, variables)}</div>
        </section>
      );
    }
    case "scope":
      return (
        <section className="pg">
          <h2 style={{ fontSize: 32, color: brandColor, marginBottom: 24 }}>{interpolate(block.title, variables)}</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {block.items.map((it, i) => (
              <div key={i} style={{ padding: 16, border: `1px solid #e5e7eb`, borderLeft: `4px solid ${brandColor}`, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{interpolate(it.name, variables)}</div>
                {it.description && <div style={{ color: "#4b5563", marginTop: 4 }}>{interpolate(it.description, variables)}</div>}
              </div>
            ))}
          </div>
        </section>
      );
    case "pricing": {
      const totals = calcPricingTotals([block]);
      return (
        <section className="pg">
          <h2 style={{ fontSize: 32, color: brandColor, marginBottom: 24 }}>{interpolate(block.title, variables)}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: 12 }}>Item</th>
                <th style={{ padding: 12, textAlign: "right" }}>Qtd</th>
                <th style={{ padding: 12, textAlign: "right" }}>Unitário</th>
                <th style={{ padding: 12 }}>Recorrência</th>
                <th style={{ padding: 12, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {block.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{interpolate(it.name, variables)}</div>
                    {it.description && <div style={{ color: "#6b7280", fontSize: 13 }}>{interpolate(it.description, variables)}</div>}
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>{it.qty}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>{formatBRL(it.unit_price)}</td>
                  <td style={{ padding: 12, textTransform: "capitalize" }}>{it.recurrence}</td>
                  <td style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>{formatBRL(it.qty * it.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {block.showTotals && (
            <div style={{ marginTop: 24, padding: 20, background: "#f0fdf4", borderRadius: 12, border: `2px solid ${brandColor}` }}>
              {totals.unica > 0 && <Row label="Implantação (única)" value={formatBRL(totals.unica)} />}
              {totals.mensal > 0 && <Row label="Mensalidade" value={formatBRL(totals.mensal)} />}
              {totals.anual > 0 && <Row label="Anual" value={formatBRL(totals.anual)} />}
              <div style={{ borderTop: `1px dashed ${brandColor}`, marginTop: 8, paddingTop: 8, fontSize: 18, fontWeight: 700, color: brandColor, display: "flex", justifyContent: "space-between" }}>
                <span>Total geral</span><span>{formatBRL(totals.total)}</span>
              </div>
            </div>
          )}
        </section>
      );
    }
    case "timeline":
      return (
        <section className="pg">
          <h2 style={{ fontSize: 32, color: brandColor, marginBottom: 24 }}>{interpolate(block.title, variables)}</h2>
          <ol style={{ borderLeft: `3px solid ${brandColor}`, paddingLeft: 20, listStyle: "none", margin: 0 }}>
            {block.items.map((it, i) => (
              <li key={i} style={{ position: "relative", marginBottom: 20 }}>
                <span style={{ position: "absolute", left: -29, top: 4, width: 16, height: 16, borderRadius: "50%", background: brandColor, border: "3px solid white", boxShadow: "0 0 0 2px " + brandColor }} />
                <div style={{ fontWeight: 700, fontSize: 18 }}>{interpolate(it.phase, variables)}{it.duration && <span style={{ marginLeft: 8, color: "#6b7280", fontWeight: 400, fontSize: 14 }}>· {it.duration}</span>}</div>
                {it.description && <div style={{ color: "#4b5563" }}>{interpolate(it.description, variables)}</div>}
              </li>
            ))}
          </ol>
        </section>
      );
    case "signature":
      return (
        <section className="pg" style={{ minHeight: 400, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ display: "grid", gridTemplateColumns: block.showClientLine ? "1fr 1fr" : "1fr", gap: 48 }}>
            <div>
              <div style={{ borderTop: "1px solid #111", paddingTop: 8 }}>
                <div style={{ fontWeight: 700 }}>{interpolate(block.name, variables)}</div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>{interpolate(block.role, variables)}</div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>{interpolate(block.company, variables)}</div>
              </div>
            </div>
            {block.showClientLine && (
              <div>
                <div style={{ borderTop: "1px solid #111", paddingTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>Aceite do Cliente</div>
                  <div style={{ color: "#6b7280", fontSize: 14 }}>{variables.client?.company_name}</div>
                </div>
              </div>
            )}
          </div>
        </section>
      );
    case "image": {
      const presetW = block.width === "small" ? 40 : block.width === "medium" ? 70 : 100;
      const wPct = typeof block.widthPct === "number" ? block.widthPct : presetW;
      const align = block.align || "center";
      const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      const filterMap: Record<string, string> = { none: "", grayscale: "grayscale(100%)", sepia: "sepia(80%)", blur: "blur(2px)", bright: "brightness(1.15) contrast(1.05)" };
      const filter = filterMap[block.filter || "none"] || "";
      const shadow = block.shadow ? "0 8px 24px rgba(0,0,0,0.18)" : "none";
      return (
        <section className="pg" style={{ background: block.bgColor || undefined, display: "flex", flexDirection: "column", alignItems: justify }}>
          {block.url
            ? <img src={block.url} alt={block.caption || ""} style={{ width: `${wPct}%`, maxWidth: "100%", borderRadius: (block.borderRadius ?? 8) + "px", boxShadow: shadow, transform: `rotate(${block.rotate || 0}deg)`, filter, objectFit: block.objectFit || "contain", display: "block" }} />
            : <div style={{ padding: 48, background: "#f3f4f6", borderRadius: 8, color: "#9ca3af", width: "100%", textAlign: "center" }}>(Sem imagem)</div>}
          {block.caption && <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280", textAlign: align as any, width: "100%" }}>{block.caption}</div>}
        </section>
      );
    }
    case "gallery": {
      const cols = block.columns || 2;
      return (
        <section className="pg">
          {block.title && <h2 style={{ fontSize: 28, color: brandColor, marginBottom: 16 }}>{block.title}</h2>}
          {block.images?.length ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
              {block.images.map((img, i) => (
                <figure key={i} style={{ margin: 0 }}>
                  <img src={img.url} alt={img.caption || ""} style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 8 }} />
                  {img.caption && <figcaption style={{ marginTop: 4, fontSize: 12, color: "#6b7280", textAlign: "center" }}>{img.caption}</figcaption>}
                </figure>
              ))}
            </div>
          ) : <div style={{ padding: 48, background: "#f3f4f6", borderRadius: 8, color: "#9ca3af", textAlign: "center" }}>(Sem imagens)</div>}
        </section>
      );
    }
    case "cta":
      return (
        <section className="pg" style={{ textAlign: "center", background: `linear-gradient(135deg, ${brandColor}10, ${brandColor}25)` }}>
          <h2 style={{ fontSize: 36, marginBottom: 24 }}>{interpolate(block.title, variables)}</h2>
          {block.buttonUrl ? (
            <a href={block.buttonUrl} style={{ display: "inline-block", padding: "14px 28px", background: brandColor, color: "white", borderRadius: 999, fontWeight: 700, textDecoration: "none" }}>{block.buttonText}</a>
          ) : (
            <span style={{ display: "inline-block", padding: "14px 28px", background: brandColor, color: "white", borderRadius: 999, fontWeight: 700 }}>{block.buttonText}</span>
          )}
        </section>
      );
    default:
      return null;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>{label}</span><span style={{ fontWeight: 600 }}>{value}</span></div>;
}

function shade(hex: string, percent: number): string {
  // Lightens or darkens a hex color
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
