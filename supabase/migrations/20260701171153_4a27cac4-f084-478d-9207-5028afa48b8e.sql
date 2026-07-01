
DO $$
DECLARE
  r RECORD;
  svc TEXT;
  cs TEXT;
BEGIN
  SELECT decrypted_secret INTO svc FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  BEGIN
    SELECT decrypted_secret INTO cs FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN cs := NULL; END;

  FOR r IN SELECT jobid, jobname, command FROM cron.job
           WHERE command ILIKE '%zoho-pull-inbox%' OR command ILIKE '%zoho-pull-events%'
  LOOP
    -- Skip if we cannot resolve CRON_SECRET from the vault (must be set manually).
    IF cs IS NULL THEN
      RAISE NOTICE 'CRON_SECRET not in vault; skipping reschedule of %', r.jobname;
      CONTINUE;
    END IF;
    PERFORM cron.unschedule(r.jobname);
    IF r.command ILIKE '%zoho-pull-inbox%' THEN
      PERFORM cron.schedule(r.jobname, '*/5 * * * *',
        format($f$SELECT net.http_post(
          url := 'https://eifsbqqrimniclsssoru.supabase.co/functions/v1/zoho-pull-inbox',
          headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L,'Authorization','Bearer %s'),
          body := '{}'::jsonb);$f$, cs, svc));
    ELSE
      PERFORM cron.schedule(r.jobname, '*/10 * * * *',
        format($f$SELECT net.http_post(
          url := 'https://eifsbqqrimniclsssoru.supabase.co/functions/v1/zoho-pull-events',
          headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L,'Authorization','Bearer %s'),
          body := '{}'::jsonb);$f$, cs, svc));
    END IF;
  END LOOP;
END $$;
