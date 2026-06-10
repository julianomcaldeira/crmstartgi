
-- Fix contact slide pill overlap on template
UPDATE proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{5,html}',
  to_jsonb(replace(
    blocks->5->>'html',
    'position:absolute;top:26px;left:28px;z-index:5;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;',
    'position:relative;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;margin-bottom:14px;'
  ))
)
WHERE id='9ac64afe-2213-4ceb-89c0-1bad0b83df87';

-- Apply same fix to existing proposals
UPDATE proposals
SET blocks = jsonb_set(
  blocks,
  '{5,html}',
  to_jsonb(replace(
    blocks->5->>'html',
    'position:absolute;top:26px;left:28px;z-index:5;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;',
    'position:relative;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;margin-bottom:14px;'
  ))
)
WHERE blocks->5->>'html' LIKE '%position:absolute;top:26px;left:28px;z-index:5;display:inline-flex%';
