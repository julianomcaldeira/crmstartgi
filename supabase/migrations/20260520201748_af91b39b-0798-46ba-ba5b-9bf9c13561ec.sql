UPDATE public.proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{1,html}',
  to_jsonb(
    replace(
      replace(
        blocks->1->>'html',
        'grande volume de oportunidades, múltiplas fontes de informação',
        'grande volume de informação, múltiplas fontes de dados '
      ),
      'lidar diariamente com grande volume de informação',
      'lidar diariamente com grande volume de informação'
    )
  )
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';