DO $$
DECLARE
  tpl_id uuid := '9ac64afe-2213-4ceb-89c0-1bad0b83df87';
  canon text := 'position:absolute;top:26px;left:28px;z-index:5;display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;width:max-content;';
  new_blocks jsonb;
  blk jsonb;
  i int := 0;
  new_html text;
BEGIN
  new_blocks := '[]'::jsonb;
  FOR blk IN SELECT * FROM jsonb_array_elements((SELECT blocks FROM public.proposal_templates WHERE id = tpl_id))
  LOOP
    new_html := regexp_replace(
      blk->>'html',
      '<div style="display:inline-flex[^"]*?border-radius:999px[^"]*?text-transform:uppercase[^"]*?">',
      '<div style="' || canon || '">',
      ''
    );
    new_blocks := new_blocks || jsonb_build_array(jsonb_set(blk, '{html}', to_jsonb(new_html)));
    i := i + 1;
  END LOOP;
  UPDATE public.proposal_templates SET blocks = new_blocks WHERE id = tpl_id;
  RAISE NOTICE 'Updated % blocks', i;
END $$;