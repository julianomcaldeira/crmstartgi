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

  const SLIDE_W = 1620;
  const SLIDE_H = 1080;

  const slides = Array.from(rootEl.querySelectorAll<HTMLElement>("[data-block-id]"));
  const targets = slides.length ? slides : [rootEl];

  const stage = document.createElement("div");
  stage.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    `width:${SLIDE_W}px`,
    `height:${SLIDE_H}px`,
    "background:#ffffff",
    "overflow:hidden",
    "z-index:-1",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(stage);

  try {
    for (let i = 0; i < targets.length; i++) {
      stage.innerHTML = "";
      const frame = document.createElement("div");
      frame.className = "proposal-doc iganhei-proposal";
      frame.style.cssText = [
        `width:${SLIDE_W}px`,
        `height:${SLIDE_H}px`,
        "display:flex",
        "align-items:stretch",
        "justify-content:stretch",
        "overflow:hidden",
        "background:#ffffff",
        "box-sizing:border-box",
      ].join(";");

      const clone = targets[i].cloneNode(true) as HTMLElement;
      clone.classList.add("ig-slide", "ig-slide--pdf");
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

      const contentH = clone.scrollHeight;
      const contentW = clone.scrollWidth;
      const scale = Math.min(1, SLIDE_H / contentH, SLIDE_W / contentW);
      if (scale < 1) {
        clone.style.transform = `scale(${scale})`;
        clone.style.transformOrigin = "center center";
      }

      const canvas = await html2canvas(frame, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: SLIDE_W,
        height: SLIDE_H,
        windowWidth: SLIDE_W,
        windowHeight: SLIDE_H,
      });

      if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0, 0, pageW, pageH,
        undefined, "FAST",
      );
    }
  } finally {
    stage.remove();
  }
  return pdf;
}
