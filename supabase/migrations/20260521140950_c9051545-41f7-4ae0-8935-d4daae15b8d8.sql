UPDATE public.proposal_templates
SET blocks = (
  SELECT jsonb_agg(
    CASE
      WHEN b ? 'html' THEN jsonb_set(b, '{html}', to_jsonb(replace(b->>'html', 'min-height:1060px', 'min-height:794px;width:1123px')))
      ELSE b
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(b, ord)
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';