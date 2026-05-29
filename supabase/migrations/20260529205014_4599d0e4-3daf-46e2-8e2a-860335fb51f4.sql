UPDATE proposal_templates
SET blocks = (
  SELECT jsonb_set(
    blocks::jsonb,
    '{1,html}',
    to_jsonb(
      REPLACE(
        blocks::jsonb -> 1 ->> 'html',
        'Operações de vendas públicas exigem controle, velocidade e capacidade de <span style="color:#16a34a;">acompanhamento contínuo</span>.',
        'OS RESULTADOS DE UMA OPERAÇÃO DE VENDAS PÚBLICAS SÃO DEFINIDOS MUITO ANTES DA HOMOLOGAÇÃO DE UMA LICITAÇÃO'
      )
    ),
    false
  )
  FROM proposal_templates
  WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87'
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';