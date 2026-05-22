UPDATE proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{2,html}',
  to_jsonb(replace(blocks->2->>'html', 'esteira-licitacoes-v3.png', 'esteira-licitacoes-v4.png'))
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';