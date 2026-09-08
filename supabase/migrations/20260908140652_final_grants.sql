-- T3-m1-data-core §2.3: the client-facing EXECUTE set, issued last so no
-- forward reference exists. create_invited_session is deliberately absent
-- (entitlement gate: reachable only through launch_invited_session).
grant execute on function
  submit_position(uuid), recall_position(uuid), cancel_session(uuid),
  redeem_invite(text, text), request_visibility_disclosure(uuid),
  ensure_identity(), grant_launch_credits(),
  reserve_and_debit_launch_credit(text), release_launch_credit(text),
  current_credit_balance(),
  launch_invited_session(text, text, text, text, uuid, text, jsonb)
  to authenticated;
grant execute on function invite_preview(text) to anon, authenticated;
