UPDATE public.proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{2,html}',
  to_jsonb(replace(
    blocks->2->>'html',
    'templates%2Festeira-licitacoes.png?v=2',
    'templates%2Festeira-licitacoes-v3.png'
  ))
)
WHERE blocks->2->>'html' LIKE '%esteira-licitacoes.png%';