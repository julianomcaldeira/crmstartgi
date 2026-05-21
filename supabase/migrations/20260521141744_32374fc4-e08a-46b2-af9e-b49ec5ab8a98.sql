UPDATE public.proposal_templates
SET blocks = (
  SELECT jsonb_agg(
    CASE
      WHEN b->>'html' IS NOT NULL
        THEN jsonb_set(b, '{html}', to_jsonb(
          replace(b->>'html', 'min-height:794px;width:1123px', 'min-height:500px;width:760px;max-width:760px')
        ))
      ELSE b
    END
  )
  FROM jsonb_array_elements(blocks) b
)
WHERE id = '9ac64afe-2213-4ceb-89c0-1bad0b83df87';