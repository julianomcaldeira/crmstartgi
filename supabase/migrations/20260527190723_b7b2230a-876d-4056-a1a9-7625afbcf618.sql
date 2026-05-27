UPDATE public.proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{0,html}',
  to_jsonb(replace(
    blocks->0->>'html',
    'margin-bottom:8px;">i-Ganhei • Inteligência em Licitações',
    'margin-top:56px;margin-bottom:8px;">i-Ganhei • Inteligência em Licitações'
  ))
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87'
  AND (blocks->0->>'html') LIKE '%margin-bottom:8px;">i-Ganhei • Inteligência em Licitações%';