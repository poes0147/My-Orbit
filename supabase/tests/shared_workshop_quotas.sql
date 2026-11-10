-- LOCAL ONLY. 50 separate accounts behind one network, plus an overflow account.
begin;
insert into auth.users(id,email)
select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'quota-' || i || '@example.invalid' from generate_series(1,51) i;
set local role authenticated;
do $$
declare i integer; attempt integer; actor uuid;
begin
  for i in 1..50 loop
    actor := ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    perform set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    for attempt in 1..3 loop
      if not public.claim_resume_analysis_attempt(repeat('d',64)) then raise exception 'Shared WiFi resume rejected: user %, attempt %',i,attempt; end if;
    end loop;
    -- Switching networks must not reset the account limit.
    if public.claim_resume_analysis_attempt(repeat('e',64)) then raise exception 'Resume account limit bypassed'; end if;
    for attempt in 1..5 loop
      if not public.claim_project_card_attempt(repeat('d',64)) then raise exception 'Shared WiFi card rejected: user %, attempt %',i,attempt; end if;
    end loop;
    if public.claim_project_card_attempt(repeat('e',64)) then raise exception 'Card account limit bypassed'; end if;
    for attempt in 1..10 loop
      if (select result_code from public.bind_nfc_tag('quotaFixture',repeat('a',32),repeat('d',64))) = 'RATE_LIMITED' then raise exception 'Shared WiFi NFC rejected: user %, attempt %',i,attempt; end if;
    end loop;
    if (select result_code from public.bind_nfc_tag('quotaFixture',repeat('a',32),repeat('e',64))) <> 'RATE_LIMITED' then raise exception 'NFC account limit bypassed'; end if;
  end loop;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000051","role":"authenticated"}',true);
  if public.claim_resume_analysis_attempt(repeat('d',64)) then raise exception 'Resume aggregate limit bypassed'; end if;
  if public.claim_project_card_attempt(repeat('d',64)) then raise exception 'Card aggregate limit bypassed'; end if;
  if (select result_code from public.bind_nfc_tag('quotaFixture',repeat('a',32),repeat('d',64))) <> 'RATE_LIMITED' then raise exception 'NFC aggregate limit bypassed'; end if;
  if (select result_code from public.bind_nfc_tag('quotaFixture',repeat('a',32),repeat('e',64))) = 'RATE_LIMITED' then raise exception 'Other NFC network wrongly blocked'; end if;
  if not public.claim_resume_analysis_attempt(repeat('e',64)) then raise exception 'Other network wrongly blocked'; end if;
  if not public.claim_project_card_attempt(repeat('e',64)) then raise exception 'Other network wrongly blocked'; end if;
  begin
    perform public.claim_resume_analysis_attempt('bad'); raise exception 'Invalid hash allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_project_card_attempt(null); raise exception 'Null hash allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.claim_project_card_attempt(repeat('d',64)); raise exception 'Missing identity allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Move attempts outside the rolling window; the next request must be allowed.
update private.resume_analysis_attempts set attempted_at=now()-interval '61 seconds';
update private.project_card_attempts set attempted_at=now()-interval '61 seconds';
update private.nfc_bind_attempts set attempted_at=now()-interval '61 seconds';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if not public.claim_resume_analysis_attempt(repeat('d',64)) then raise exception 'Resume window did not reset'; end if;
  if not public.claim_project_card_attempt(repeat('d',64)) then raise exception 'Card window did not reset'; end if;
  if (select result_code from public.bind_nfc_tag('quotaFixture',repeat('a',32),repeat('d',64))) = 'RATE_LIMITED' then raise exception 'NFC window did not reset'; end if;
  begin
    delete from private.resume_analysis_attempts; raise exception 'Caller can clear quota';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.claim_resume_analysis_attempt(repeat('d',64)); raise exception 'Anon resume quota allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_project_card_attempt(repeat('d',64)); raise exception 'Anon card quota allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
