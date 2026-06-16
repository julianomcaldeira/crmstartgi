// Shared utility to build a multi-page A4-landscape (270x180mm 3:2) PDF
// from a rendered proposal DOM. Used by the builder, the public page, and
// the print/download buttons so all surfaces produce identical output.

export async function buildProposalSlidesPdf(rootEl: HTMLElement) {
  const html2canvas = (await import("html2canvas")).default;
  const { default: JsPDF } = await import("jspdf");

  const PAGE_W_MM = 270;
  const PAGE_H_MM = 180;
  const pdf = new JsPDF({
    unit: "mm",
    format: [PAGE_W_MM, PAGE_H_MM],
    orientation: "landscape",
    compress: true,
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  await document.fonts?.ready?.catch(() => undefined);

  const slides = Array.from(rootEl.querySelectorAll<HTMLElement>("[data-section-id], [data-block-id]"));
  const targets = slides.length ? slides : [rootEl];

  const waitForAssets = async (scope: HTMLElement) => {
    const images = Array.from(scope.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }));
  };

  try {
    for (let i = 0; i < targets.length; i++) {
      const rect = targets[i].getBoundingClientRect();
      const fallbackW = rootEl.getBoundingClientRect().width || 1200;
      const slideW = Math.max(1, Math.round(rect.width || fallbackW));
      const slideH = Math.max(1, Math.round(rect.height || slideW * 2 / 3));

      const stage = document.createElement("div");
      stage.dataset.proposalPdfStage = "true";
      stage.style.cssText = [
        "position:fixed",
        "left:-100000px",
        "top:0",
        `width:${slideW}px`,
        `height:${slideH}px`,
        "background:#ffffff",
        "overflow:hidden",
        "z-index:-1",
        "pointer-events:none",
      ].join(";");
      document.body.appendChild(stage);

      stage.innerHTML = "";
      const frame = document.createElement("div");
      frame.className = "proposal-doc iganhei-proposal";
      frame.style.cssText = [
        `width:${slideW}px`,
        `height:${slideH}px`,
        "display:flex",
        "align-items:stretch",
        "justify-content:stretch",
        "overflow:hidden",
        "background:#ffffff",
        "box-sizing:border-box",
      ].join(";");

      const clone = targets[i].cloneNode(true) as HTMLElement;
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.maxWidth = "none";
      clone.style.maxHeight = "none";
      clone.style.margin = "0";
      clone.style.boxSizing = "border-box";
      clone.querySelectorAll<HTMLElement>(".pg").forEach((pg) => {
        pg.style.pageBreakAfter = "auto";
        pg.style.minHeight = "0";
        pg.style.height = "100%";
        pg.style.maxHeight = "100%";
        pg.style.aspectRatio = "auto";
      });
      frame.appendChild(clone);
      stage.appendChild(frame);
      await waitForAssets(frame);

      const canvas = await html2canvas(frame, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: slideW,
        height: slideH,
        windowWidth: slideW,
        windowHeight: slideH,
      });

      if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0, 0, pageW, pageH,
        undefined, "SLOW",
      );

      stage.remove();
    }
  } finally {
    document.querySelectorAll<HTMLElement>("[data-proposal-pdf-stage='true']").forEach((el) => el.remove());
  }
  return pdf;
}
