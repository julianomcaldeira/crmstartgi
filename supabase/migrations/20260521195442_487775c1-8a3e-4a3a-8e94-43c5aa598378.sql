UPDATE proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{2,html}',
  to_jsonb(replace(blocks->2->>'html', 'templates%2Festeira-licitacoes.png', 'templates%2Festeira-licitacoes.png?v=2'))
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';