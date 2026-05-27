import { useEffect } from "react";
import * as Icons from "lucide-react";
import "./theme.css";
import { CommercialSection, CommercialTheme, DEFAULT_THEME, ProposalVars, interp } from "@/lib/commercialProposal";

interface Props {
  sections: CommercialSection[];
  variables: ProposalVars;
  theme?: Partial<CommercialTheme>;
}

function Icon({ name, size = 28 }: { name?: string; size?: number }) {
  const Cmp = (name && (Icons as any)[name]) || Icons.Sparkles;
  return <Cmp size={size} strokeWidth={2} />;
}

export function CommercialProposalRenderer({ sections, variables, theme }: Props) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ig-primary", t.primary);
    root.style.setProperty("--ig-primary-dark", t.primaryDark);
    root.style.setProperty("--ig-accent", t.accent);
  }, [t.primary, t.primaryDark, t.accent]);

  const txt = (s: string) => interp(s || "", variables);

  return (
    <div className="iganhei-proposal">
      {sections.filter((s) => s.enabled !== false).map((s) => (
        <section key={s.id} id={s.id} data-section-id={s.id} data-section-type={s.type} className="ig-slide">
          {renderSection(s, txt, variables)}
        </section>
      ))}
    </div>
  );
}

function renderSection(s: CommercialSection, txt: (v: string) => string, vars: ProposalVars) {
  const c = s.content || {};
  switch (s.type) {
    case "capa":
      return (
        <div className="ig-cover">
          <span className="ig-eyebrow">{txt(c.eyebrow || "Proposta Comercial")}</span>
          <h1>{txt(c.headline || s.title)}</h1>
          <p style={{ marginTop: 16, maxWidth: 720 }}>{txt(c.subheadline || "")}</p>
          <div style={{ marginTop: 40, display: "flex", gap: 24, color: "rgba(255,255,255,.85)", fontSize: 14 }}>
            <div><strong style={{ display: "block", color: "#fff" }}>{txt("{{empresa_cliente}}")}</strong>Cliente</div>
            <div><strong style={{ display: "block", color: "#fff" }}>{txt("{{data_proposta}}")}</strong>Emissão</div>
            <div><strong style={{ display: "block", color: "#fff" }}>{txt("{{nome_vendedor}}")}</strong>Responsável</div>
          </div>
        </div>
      );

    case "termo":
      return (
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <span className="ig-eyebrow">Confidencialidade</span>
          <h2>{s.title}</h2>
          <p style={{ marginTop: 24, fontSize: 19 }}>{txt(c.body || "")}</p>
        </div>
      );

    case "cards":
      return (
        <div style={{ width: "100%" }}>
          <div style={{ textAlign: "center", maxWidth: 960, margin: "0 auto 44px" }}>
            <h2>{s.title}</h2>
            {c.intro && <p style={{ marginTop: 14 }}>{txt(c.intro)}</p>}
          </div>
          <div className={`ig-grid-${Math.min(3, (c.cards || []).length) || 3}`}>
            {(c.cards || []).map((card: any, i: number) => (
              <div key={i} className="ig-card ig-card-icon-top">
                <span className="ig-icon-bubble"><Icon name={card.icon} size={30} /></span>
                <h3>{txt(card.title || "")}</h3>
                <p style={{ fontSize: 16 }}>{txt(card.text || "")}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "list":
      return (
        <div style={{ width: "100%" }}>
          <div style={{ maxWidth: 960, marginBottom: 36 }}>
            <span className="ig-eyebrow">{s.title}</span>
            <h2>{txt(c.intro || s.title)}</h2>
          </div>
          <div className="ig-grid-2">
            {(c.items || []).map((it: any, i: number) => (
              <div key={i} className="ig-card ig-card-row">
                <span className="ig-icon-bubble"><Icon name={it.icon} size={28} /></span>
                <div>
                  <h3>{txt(it.title || "")}</h3>
                  <p style={{ marginTop: 8, fontSize: 16 }}>{txt(it.text || "")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "benefits":
      return (
        <div>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span className="ig-eyebrow">Resultados</span>
            <h2>{s.title}</h2>
          </div>
          <div className="ig-grid-4">
            {(c.items || []).map((it: any, i: number) => (
              <div key={i} className="ig-card" style={{ borderLeft: "4px solid var(--ig-accent)" }}>
                <h3>{txt(it.title || "")}</h3>
                <p style={{ marginTop: 8, fontSize: 15 }}>{txt(it.text || "")}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "timeline":
      return (
        <div>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span className="ig-eyebrow">Jornada</span>
            <h2>{s.title}</h2>
          </div>
          <div className="ig-timeline">
            {(c.steps || []).map((st: any, i: number) => (
              <div key={i} className="ig-timeline-step">
                <span className="ig-step-num">{i + 1}</span>
                <h3 style={{ fontSize: 17 }}>{txt(st.title || "")}</h3>
                <p style={{ marginTop: 6, fontSize: 14 }}>{txt(st.text || "")}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "pricing":
      return (
        <div>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span className="ig-eyebrow">Investimento</span>
            <h2>{s.title}</h2>
          </div>
          <div className="ig-grid-2" style={{ maxWidth: 820, margin: "0 auto" }}>
            {(c.cards || []).map((card: any, i: number) => {
              const v = vars[card.value_key] || "—";
              return (
                <div key={i} className="ig-pricing-card">
                  <div className="ig-pricing-label">{txt(card.label || "")}</div>
                  <div className="ig-pricing-value">
                    {v}
                    {card.monthly && <small> /mês</small>}
                  </div>
                  {card.note && <p style={{ marginTop: 14, color: "var(--ig-muted)", fontSize: 14 }}>{txt(card.note)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "validade":
      return (
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <span className="ig-eyebrow">Vigência</span>
          <h2>{s.title}</h2>
          <p style={{ marginTop: 20, fontSize: 18 }}>{txt(c.body || "")}</p>
        </div>
      );

    case "final": {
      const photo = vars.foto_vendedor;
      const initials = (vars.nome_vendedor || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const phone = (vars.telefone_vendedor || "").replace(/\D/g, "");
      const wa = phone ? `https://wa.me/55${phone}` : "";
      return (
        <div className="ig-final">
          <div>
            <span className="ig-eyebrow" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>Próximos passos</span>
            <h2>{txt(c.headline || s.title)}</h2>
            <p style={{ marginTop: 14, fontSize: 17 }}>{txt(c.body || "")}</p>
            {Array.isArray(c.next_steps) && (
              <ul>{c.next_steps.map((step: string, i: number) => <li key={i}>{txt(step)}</li>)}</ul>
            )}
            <div className="ig-contact-row">
              {wa && <a className="ig-contact-pill" href={wa} target="_blank" rel="noreferrer" data-cta="whatsapp_click"><Icons.MessageCircle size={16} /> WhatsApp</a>}
              {vars.email_vendedor && <a className="ig-contact-pill" href={`mailto:${vars.email_vendedor}`} data-cta="email_click"><Icons.Mail size={16} /> {vars.email_vendedor}</a>}
              {vars.telefone_vendedor && <span className="ig-contact-pill"><Icons.Phone size={16} /> {vars.telefone_vendedor}</span>}
            </div>
          </div>
          <div className="ig-seller-photo">
            {photo ? <img src={photo} alt={vars.nome_vendedor || "Responsável"} /> : <div className="ig-photo-fallback">{initials}</div>}
          </div>
        </div>
      );
    }
  }
  return null;
}
