UPDATE public.proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{0,html}',
  to_jsonb(replace(
    blocks->0->>'html',
    '<div style="position:relative;z-index:1;"><div style="position:absolute;top:26px;left:28px;z-index:5;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;"><span style="width:6px;height:6px;border-radius:50%;background:#fff;opacity:.9;"></span>Proposta Comercial</div>',
    '<div style="position:absolute;top:26px;left:28px;z-index:5;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;"><span style="width:6px;height:6px;border-radius:50%;background:#fff;opacity:.9;"></span>Proposta Comercial</div><div style="position:relative;z-index:1;">'
  ))
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';