import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    clarity?: (...args: any[]) => void;
  }
}

/** Loads GA4 and Microsoft Clarity, sends section_view events via IntersectionObserver. */
export function useCommercialTracking(opts: {
  ga4Id?: string;
  clarityId?: string;
  rootRef: React.RefObject<HTMLElement>;
  onEvent?: (name: string, params?: Record<string, any>) => void;
}) {
  const { ga4Id, clarityId, rootRef, onEvent } = opts;

  // load GA4
  useEffect(() => {
    if (!ga4Id || document.getElementById("ga4-script")) return;
    const s = document.createElement("script");
    s.id = "ga4-script"; s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer!.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id, { send_page_view: true });
  }, [ga4Id]);

  // load Clarity
  useEffect(() => {
    if (!clarityId || document.getElementById("clarity-script")) return;
    const s = document.createElement("script");
    s.id = "clarity-script";
    s.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`;
    document.head.appendChild(s);
  }, [clarityId]);

  // proposal_view + section_view + end_reached
  useEffect(() => {
    emit("proposal_view");
    const root = rootRef.current;
    if (!root) return;
    const seen = new Set<string>();
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = (e.target as HTMLElement).dataset.sectionId || "";
        const type = (e.target as HTMLElement).dataset.sectionType || "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        emit("section_view", { section_id: id, section_type: type });
        if (type === "pricing") emit("investment_view", { section_id: id });
        if (id === "section-consideracoes") emit("proposal_end_reached");
      }
    }, { threshold: 0.4 });
    root.querySelectorAll<HTMLElement>("[data-section-id]").forEach((el) => obs.observe(el));

    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement).closest<HTMLElement>("[data-cta]");
      if (!a) return;
      emit(a.dataset.cta || "cta_click", { href: (a as HTMLAnchorElement).href });
    };
    root.addEventListener("click", onClick);
    return () => { obs.disconnect(); root.removeEventListener("click", onClick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef.current]);

  function emit(name: string, params?: Record<string, any>) {
    try { window.gtag?.("event", name, params || {}); } catch {}
    try { window.clarity?.("event", name); } catch {}
    onEvent?.(name, params);
  }

  return { emit };
}
