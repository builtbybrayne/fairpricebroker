-- 9 Sep 2026 (operator): new accounts start with 8 free credits, not 20.
-- Accounts already granted keep what they have (the grant is keyed once
-- per identity).
create or replace function grant_launch_credits() returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer;
begin
  v_id := ensure_identity();
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, 8, 'launch-grant', 'launch-grant:' || v_id::text)
  on conflict (account_identity_id, request_key) do nothing;
  select balance into v_bal from credit_balances where account_identity_id = v_id;
  return coalesce(v_bal, 0);
end $$;
