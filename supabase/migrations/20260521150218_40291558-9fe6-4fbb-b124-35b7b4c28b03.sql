UPDATE proposal_templates
SET blocks = jsonb_set(
  blocks,
  '{1,html}',
  to_jsonb(
    regexp_replace(
      blocks->1->>'html',
      '(<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">).*?(</div></div>$)',
      '\1{{slide2_cards_html}}\2'
    )
  )
)
WHERE id='9ac64afe-2213-4ceb-89c0-1bad0b83df87';